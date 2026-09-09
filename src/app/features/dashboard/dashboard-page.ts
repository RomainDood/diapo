/* eslint-disable craft-ts/require-effect-adapters, craft-ts/prefer-craft-template-blocks, craft-ts/prefer-craft-router-link -- CraftHttpClient is the transport boundary and this page projects server-owned cards. */
import {
  button,
  a,
  craftComponent,
  div,
  forNode,
  heading,
  ifNode,
  input,
  p,
  section,
  span,
} from '@craft-ts/component';
import {
  craftComputed,
  insertReactOnMutation,
  craftMethod,
  mutation,
  query,
  state,
} from '@craft-ts/core';
import { i18n } from '../../../i18n';
import { createPresentation, listPresentations } from '../../api';
import type { CreatePresentationInput } from '../../../shared/presentation';
import { eventValue } from '../../event-value';

const EMPTY_DRAFT: CreatePresentationInput = {
  title: '',
  audience: '',
  objective: '',
};

export const DashboardPage = craftComponent(
  'DashboardPage',
  {},
  function* () {
    const draft = yield* state('newPresentationDraft', EMPTY_DRAFT, ({ update }) => ({
      setTitle: (title: string) => update((current) => ({ ...current, title })),
      setAudience: (audience: string) => update((current) => ({ ...current, audience })),
      setObjective: (objective: string) => update((current) => ({ ...current, objective })),
    }));
    const create = yield* mutation('createPresentation', {
      method: (input: CreatePresentationInput) => input,
      loader: function* ({ params }) {
        return yield* createPresentation(params);
      },
    });
    const presentations = yield* query(
      'presentations',
      {
        params: () => true,
        loader: function* () {
          return yield* listPresentations();
        },
      },
      insertReactOnMutation(create, { reload: { onMutationResolved: true } }),
    );
    const createdPresentation = craftComputed('createdPresentation', function* () {
      const title = (yield* draft()).title;
      return (yield* presentations.value())?.find((presentation) => presentation.title === title);
    });
    const hasCreatedPresentation = craftComputed('hasCreatedPresentation', function* () {
      return Boolean((yield* createdPresentation())?.id);
    });
    const createPresentationAndRevealLink = craftMethod('createPresentationAndRevealLink', function* () {
      const input = yield* draft();
      if (!input.title.trim()) return;
      yield* create.mutate(input);
    });
    return { presentations, draft, create, createdPresentation, hasCreatedPresentation, createPresentationAndRevealLink };
  },
  ({ presentations, draft, create, createdPresentation, hasCreatedPresentation, createPresentationAndRevealLink }) =>
    div({ class: 'dashboard-shell' }, [
      section({ class: 'dashboard-hero' }, [
        div({ class: 'studio-eyebrow' }, i18n.t('ui.dashboard.eyebrow')),
        heading({ 'aria-label': i18n.t('ui.dashboard.title') }, i18n.t('ui.dashboard.title')),
        p(i18n.t('ui.dashboard.body')),
      ]),
      section({ class: 'dashboard-create' }, [
        div({ class: 'dashboard-create__copy' }, [
          span({ class: 'studio-panel__label' }, i18n.t('ui.dashboard.createLabel')),
          heading({ 'aria-label': i18n.t('ui.dashboard.createTitle') }, i18n.t('ui.dashboard.createTitle')),
          p(i18n.t('ui.dashboard.createBody')),
        ]),
        div({ class: 'dashboard-form' }, [
          input('newPresentationTitle', {
            type: 'text',
            'aria-label': i18n.t('ui.dashboard.titlePlaceholder'),
            placeholder: i18n.t('ui.dashboard.titlePlaceholder'),
            value: function* () { return (yield* draft()).title; },
            *input(event) { yield* draft.setTitle(eventValue(event)); },
          }),
          input('newPresentationAudience', {
            type: 'text',
            'aria-label': i18n.t('ui.dashboard.audiencePlaceholder'),
            placeholder: i18n.t('ui.dashboard.audiencePlaceholder'),
            value: function* () { return (yield* draft()).audience; },
            *input(event) { yield* draft.setAudience(eventValue(event)); },
          }),
          input('newPresentationObjective', {
            type: 'text',
            'aria-label': i18n.t('ui.dashboard.objectivePlaceholder'),
            placeholder: i18n.t('ui.dashboard.objectivePlaceholder'),
            value: function* () { return (yield* draft()).objective; },
            *input(event) { yield* draft.setObjective(eventValue(event)); },
          }),
          button(
            'createPresentation',
            { type: 'button', 'aria-label': i18n.t('ui.dashboard.createButton'), class: 'studio-button studio-button--primary', disabled: create.isLoading, click: createPresentationAndRevealLink },
            i18n.t('ui.dashboard.createButton'),
          ),
          ifNode(hasCreatedPresentation, () => a('openCreatedPresentation', { class: 'studio-link', 'aria-label': i18n.t('ui.dashboard.openCreated'), href: function* () { return `/editor/${(yield* createdPresentation())?.id ?? ''}`; } }, i18n.t('ui.dashboard.openCreated'))),
        ]),
      ]),
      section({ class: 'dashboard-library' }, [
        div({ class: 'dashboard-library__header' }, [
          div([
            span({ class: 'studio-panel__label' }, i18n.t('ui.dashboard.libraryLabel')),
            heading({ 'aria-label': i18n.t('ui.dashboard.libraryTitle') }, i18n.t('ui.dashboard.libraryTitle')),
          ]),
          span({ class: 'studio-chip' }, function* () {
            return `${(yield* presentations.value())?.length ?? 0} ${i18n.t('ui.dashboard.presentationCount')}`;
          }),
        ]),
        forNode(
          function* () { return (yield* presentations.value()) ?? []; },
          { track: (presentation) => presentation.id, empty: () => p({ class: 'studio-empty' }, i18n.t('ui.dashboard.empty')) },
          (presentationInput) => div({ class: 'presentation-card' }, [
            div({ class: 'presentation-card__content' }, [
              span({ class: 'studio-eyebrow' }, function* () { return (yield* presentationInput()).audience; }),
              heading({ 'aria-label': i18n.t('ui.dashboard.openButton') }, function* () { return (yield* presentationInput()).title; }),
              p(function* () { return `${(yield* presentationInput()).sectionCount} ${i18n.t('ui.dashboard.sectionCount')} · ${(yield* presentationInput()).durationMinutes} ${i18n.t('ui.dashboard.minutes')}`; }),
            ]),
            div({ class: 'presentation-card__actions' }, [
              a('dashboardOpenPresentation', { class: 'studio-button', 'aria-label': i18n.t('ui.dashboard.openButton'), 'data-navigation': 'external', href: function* () { return `/editor/${(yield* presentationInput()).id}`; } }, i18n.t('ui.dashboard.openButton')),
              a('dashboardPresentPresentation', { class: 'studio-button studio-button--primary', 'aria-label': i18n.t('ui.dashboard.presentButton'), 'data-navigation': 'external', href: function* () { return `/present/${(yield* presentationInput()).id}`; } }, i18n.t('ui.dashboard.presentButton')),
            ]),
          ]),
        ),
      ]),
    ]),
);

export default DashboardPage;
