/* eslint-disable craft-ts/require-effect-adapters, craft-ts/no-imperative-craft-method-actions, craft-ts/no-ephemeral-template-form-state, craft-ts/require-primitive-derived-property, craft-ts/require-craft-resource-trigger-yield -- The browser file directive triggers the async upload process; the editor projects keyed section/sequence inputs. */
import {
  a,
  button,
  craftComponent,
  div,
  forNode,
  heading,
  ifNode,
  img,
  input,
  label,
  option,
  p,
  safeResourceUrl,
  section,
  select,
  span,
  textarea,
  type Input,
} from '@craft-ts/component';
import {
  afterRecomputation,
  asyncProcess,
  craftNodeDirective,
  craftMethod,
  craftComputed,
  insertReactOnMutation,
  mutation,
  query,
  state,
  signalSource,
} from '@craft-ts/core';
import { i18n } from '../../../i18n';
import { loadPresentation, savePresentation, uploadPresentationImage } from '../../api';
import {
  PRESENTATION_CODE_LANGUAGES,
  PRESENTATION_IMAGE_ALLOWED_ORIGINS,
  PRESENTATION_IMAGE_MAX_BYTES,
  PRESENTATION_IMAGE_MIME_TYPES,
  PRESENTATION_INTENTIONS,
  PRESENTATION_TRANSITIONS,
} from '../../../shared/presentation';
import type {
  PresentationDocument,
  PresentationImageMimeType,
  PresentationImageUploadInput,
  PresentationCodeLanguage,
  PresentationIntention,
  PresentationLayout,
  PresentationSequence,
  PresentationSection,
  PresentationStoreInput,
  PresentationTransition,
} from '../../../shared/presentation';
import { eventValue } from '../../event-value';

const EMPTY_DOCUMENT: PresentationDocument = {
  id: '',
  layout: 'desktop',
  title: '',
  audience: '',
  objective: '',
  durationMinutes: 0,
  sectionCount: 0,
  updatedAt: '',
  coverImageUrl: '',
  coverImageAlt: '',
  sections: [],
};

type ImageTarget =
  | { readonly kind: 'cover' }
  | { readonly kind: 'sequence'; readonly sectionId: string; readonly sequenceId: string };

type ImageReadyDetail = { readonly file: File; readonly dataUrl: string };
type ImageUploadProcessParams = {
  readonly presentationId: string;
  readonly payload: PresentationImageUploadInput;
  readonly target: ImageTarget;
};

function applyUploadedImage(document: PresentationDocument, target: ImageTarget, imageUrl: string): PresentationDocument {
  return target.kind === 'cover'
    ? { ...document, coverImageUrl: imageUrl }
    : {
      ...document,
      sections: document.sections.map((section) => section.id === target.sectionId
        ? {
          ...section,
          sequences: section.sequences.map((sequence) => sequence.id === target.sequenceId
            ? { ...sequence, imageUrl }
            : sequence),
        }
        : section),
    };
}

function safePresentationImageUrl(url: string): string {
  if (!url) return '';
  try {
    return safeResourceUrl(url, { allowedOrigins: PRESENTATION_IMAGE_ALLOWED_ORIGINS });
  } catch {
    return '';
  }
}

const readPresentationImageFile = craftNodeDirective(
  'readPresentationImageFile',
  [],
  ({ element }) => {
    const emitImage = (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        if (typeof reader.result !== 'string') return;
        element.dispatchEvent(new CustomEvent<ImageReadyDetail>('imageReady', {
          detail: { file, dataUrl: reader.result },
        }));
      }, { once: true });
      reader.readAsDataURL(file);
    };
    const onChange = (event: Event) => {
      const target = event.target;
      if (target && 'files' in target && target.files instanceof FileList) emitImage(target.files.item(0) ?? undefined);
    };
    const onDrop = (event: Event) => {
      event.preventDefault();
      const dragEvent = event as DragEvent;
      emitImage(dragEvent.dataTransfer?.files.item(0) ?? undefined);
    };
    const onDragover = (event: Event) => event.preventDefault();
    element.addEventListener('change', onChange);
    element.addEventListener('drop', onDrop);
    element.addEventListener('dragover', onDragover);
    return () => {
      element.removeEventListener('change', onChange);
      element.removeEventListener('drop', onDrop);
      element.removeEventListener('dragover', onDragover);
    };
  },
);

function toStoreInput(document: PresentationDocument): PresentationStoreInput {
  return {
    layout: document.layout,
    title: document.title,
    audience: document.audience,
    objective: document.objective,
    coverImageUrl: document.coverImageUrl,
    coverImageAlt: document.coverImageAlt,
    sections: document.sections,
  };
}

export const EditorPage = craftComponent(
  'EditorPage',
  {},
  function* (presentationId: Input<string>) {
    const draft = yield* state('presentationDraft', undefined as PresentationDocument | undefined, ({ set }) => ({
      replace: (value: PresentationDocument) => set(value),
    }));
    const imageUploadNotice = yield* state('imageUploadNotice', '', ({ set }) => ({
      setNotice: (value: string) => set(value),
    }));
    const imageUploadError = yield* state('imageUploadError', '', ({ set }) => ({
      setError: (value: string) => set(value),
      clear: () => set(''),
    }));
    const collapsedSectionIds = yield* state('collapsedSectionIds', [] as readonly string[], ({ update }) => ({
      toggle: (sectionId: string) => update((ids) => ids.includes(sectionId)
        ? ids.filter((id) => id !== sectionId)
        : [...ids, sectionId]),
    }));
    const draftChanges = signalSource<PresentationStoreInput>('draftChanges');
    const save = yield* mutation('savePresentation', {
      method: afterRecomputation(draftChanges, (value) => value),
      loader: function* ({ params }) {
        return yield* savePresentation(yield* presentationId(), params);
      },
    });
    const presentation = yield* query(
      'presentationEditor',
      {
        params: presentationId,
        loader: function* ({ params }) {
          return yield* loadPresentation(params);
        },
      },
      insertReactOnMutation(save, {
        update: ({ mutationResource, queryResource }) => mutationResource.value() ?? queryResource.value() ?? EMPTY_DOCUMENT,
      }),
    );
    const imageUpload = yield* asyncProcess('uploadPresentationImage', {
      method: (input: ImageUploadProcessParams) => input,
      loader: function* ({ params }) {
        const uploaded = yield* uploadPresentationImage(params.presentationId, params.payload);
        const document = (yield* draft()) ?? (yield* presentation.value()) ?? EMPTY_DOCUMENT;
        const nextDocument = applyUploadedImage(document, params.target, uploaded.url);
        yield* draft.replace(nextDocument);
        draftChanges.set(toStoreInput(nextDocument));
        yield* imageUploadNotice.setNotice(i18n.t('ui.editor.imageUploadNotice'));
        return uploaded;
      },
    });
    const currentDocument = craftComputed('currentDocument', function* () {
      return (yield* draft()) ?? (yield* presentation.value()) ?? EMPTY_DOCUMENT;
    });
    const hasDocument = craftComputed('hasDocument', function* () {
      return (yield* draft()) !== undefined || (yield* presentation.value()) !== undefined;
    });
    const hasCoverImage = craftComputed('hasCoverImage', function* () {
      return Boolean((yield* currentDocument()).coverImageUrl);
    });
    const coverImageAlt = craftComputed('coverImageAlt', function* () {
      return (yield* currentDocument()).coverImageAlt || i18n.t('ui.editor.coverImageAltFallback');
    });
    const isAutosaving = craftComputed('isAutosaving', function* () {
      return yield* save.isLoading();
    });
    const autosaveStatus = craftComputed('autosaveStatus', function* () {
      return (yield* isAutosaving()) ? i18n.t('ui.editor.saving') : i18n.t('ui.editor.saved');
    });
    const imageUploading = craftComputed('imageUploading', function* () {
      return yield* imageUpload.isLoading();
    });
    const imageUploadFailed = craftComputed('imageUploadFailed', function* () {
      return (yield* imageUpload.hasException()) || Boolean(yield* imageUploadError());
    });
    const imageUploadErrorMessage = craftComputed('imageUploadErrorMessage', function* () {
      return (yield* imageUploadError()) || i18n.t('ui.editor.imageUploadError');
    });
    const hasImageUploadNotice = craftComputed('hasImageUploadNotice', function* () {
      return Boolean(yield* imageUploadNotice());
    });
    const sectionViews = craftComputed('sectionViews', function* () {
      const document = yield* currentDocument();
      const collapsedIds = yield* collapsedSectionIds();

      return document.sections.map((section, index) => {
        const isCollapsed = collapsedIds.includes(section.id);

        return {
          section,
          isCollapsed,
          isExpanded: !isCollapsed,
          toggleIcon: isCollapsed ? '▸' : '▾',
          toggleLabel: isCollapsed ? i18n.t('ui.editor.expandSection') : i18n.t('ui.editor.collapseSection'),
          canMoveUp: index > 0,
          canMoveDown: index < document.sections.length - 1,
        };
      });
    });
    const updateTitle = craftMethod('updateTitle', function* (title: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, title };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateAudience = craftMethod('updateAudience', function* (audience: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, audience };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateObjective = craftMethod('updateObjective', function* (objective: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, objective };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateCoverImageAlt = craftMethod('updateCoverImageAlt', function* (coverImageAlt: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, coverImageAlt };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateLayout = craftMethod('updateLayout', function* (layout: PresentationLayout) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, layout };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateSection = craftMethod('updateSection', function* (sectionId: string, patch: Partial<PresentationSection>) {
      const document = yield* currentDocument();
      const nextDocument = {
        ...document,
        sections: document.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
      };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateSequence = craftMethod('updateSequence', function* (sectionId: string, sequenceId: string, patch: Partial<PresentationSequence>) {
      const document = yield* currentDocument();
      const nextDocument = {
        ...document,
        sections: document.sections.map((section) => section.id === sectionId
          ? { ...section, sequences: section.sequences.map((sequence) => sequence.id === sequenceId ? { ...sequence, ...patch } : sequence) }
          : section),
      };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const toggleSection = craftMethod('toggleSection', function* (sectionId: string) {
      yield* collapsedSectionIds.toggle(sectionId);
    });
    const moveSection = craftMethod('moveSection', function* (sectionId: string, direction: 'up' | 'down') {
      const document = yield* currentDocument();
      const fromIndex = document.sections.findIndex((section) => section.id === sectionId);
      const toIndex = fromIndex + (direction === 'up' ? -1 : 1);
      if (fromIndex < 0 || toIndex < 0 || toIndex >= document.sections.length) return;
      const sections = [...document.sections];
      const [section] = sections.splice(fromIndex, 1);
      if (!section) return;
      sections.splice(toIndex, 0, section);
      const nextDocument: PresentationDocument = { ...document, sections };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const handleImageFile = craftMethod('handleImageFile', function* (image: ImageReadyDetail, target: ImageTarget) {
      const { file, dataUrl } = image;
      if (!file) return;
      yield* imageUploadNotice.setNotice('');
      yield* imageUploadError.clear();
      if (!PRESENTATION_IMAGE_MIME_TYPES.includes(file.type as PresentationImageMimeType)) {
        yield* imageUploadError.setError(i18n.t('ui.editor.imageUploadTypeError'));
        return;
      }
      if (file.size > PRESENTATION_IMAGE_MAX_BYTES) {
        yield* imageUploadError.setError(i18n.t('ui.editor.imageUploadSizeError'));
        return;
      }

      yield* imageUpload.method({
        presentationId: yield* presentationId(),
        payload: {
          filename: file.name,
          mimeType: file.type as PresentationImageMimeType,
          dataUrl,
        },
        target,
      });
    });
    const addSection = craftMethod('addSection', function* () {
      const document = yield* currentDocument();
      const sectionId = `section-${Date.now()}`;
      const nextDocument: PresentationDocument = {
        ...document,
        sections: [...document.sections, {
          id: sectionId,
          title: `Partie ${document.sections.length + 1}`,
          intention: 'Expliquer',
          sequences: [{
            id: `sequence-${Date.now()}`,
            title: 'Nouvelle séquence',
            message: 'Ajouter le message visible par le public.',
            notes: 'Ajouter les notes de l’orateur.',
            durationMinutes: 3,
            transition: 'Fondu',
            code: '',
            codeLanguage: 'typescript',
            imageUrl: '',
            imageAlt: '',
          }],
        }],
      };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const addSequence = craftMethod('addSequence', function* (sectionId: string) {
      const document = yield* currentDocument();
      const nextDocument: PresentationDocument = {
        ...document,
        sections: document.sections.map((section) => section.id === sectionId
          ? {
            ...section,
            sequences: [...section.sequences, {
              id: `sequence-${Date.now()}`,
              title: 'Nouvelle séquence',
              message: 'Ajouter le message visible par le public.',
              notes: 'Ajouter les notes de l’orateur.',
              durationMinutes: 3,
              transition: 'Fondu',
              code: '',
              codeLanguage: 'typescript',
              imageUrl: '',
              imageAlt: '',
            }],
          }
          : section),
      };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const deleteSequence = craftMethod('deleteSequence', function* (sectionId: string, sequenceId: string) {
      const document = yield* currentDocument();
      const nextDocument: PresentationDocument = {
        ...document,
        sections: document.sections.map((section) => section.id === sectionId
          ? { ...section, sequences: section.sequences.filter((sequence) => sequence.id !== sequenceId) }
          : section),
      };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const saveChanges = craftMethod('saveChanges', function* () {
      draftChanges.set(toStoreInput(yield* currentDocument()));
    });
    return {
      presentation,
      currentDocument,
      hasDocument,
      hasCoverImage,
      coverImageAlt,
      imageUploading,
      imageUploadFailed,
      imageUploadErrorMessage,
      imageUploadNotice,
      hasImageUploadNotice,
      imageUploadError,
      isAutosaving,
      autosaveStatus,
      updateTitle,
      updateAudience,
      updateObjective,
      updateCoverImageAlt,
      updateLayout,
      updateSection,
      updateSequence,
      collapsedSectionIds,
      sectionViews,
      toggleSection,
      moveSection,
      handleImageFile,
      addSection,
      addSequence,
      deleteSequence,
      save,
      saveChanges,
      presentationId,
    };
  },
  ({ presentation, currentDocument, hasDocument, hasCoverImage, coverImageAlt, imageUploading, imageUploadFailed, imageUploadErrorMessage, imageUploadNotice, hasImageUploadNotice, isAutosaving, autosaveStatus, updateTitle, updateAudience, updateObjective, updateCoverImageAlt, updateLayout, updateSection, updateSequence, sectionViews, toggleSection, moveSection, handleImageFile, addSection, addSequence, deleteSequence, saveChanges, presentationId }) =>
    div({ class: 'editor-shell' }, [
      div({ class: 'editor-toolbar' }, [
          a('backToDashboard', { class: 'studio-link', 'aria-label': i18n.t('ui.editor.backToDashboard'), 'data-navigation': 'external', href: '/feature' }, i18n.t('ui.editor.backToDashboard')),
        div({ class: 'studio-toolbar' }, [
          ifNode(hasDocument, () => span({ class: 'editor-autosave-status' }, autosaveStatus)),
          ifNode(hasDocument, () => button('savePresentation', { type: 'button', class: 'studio-button', 'aria-label': i18n.t('ui.editor.save'), disabled: isAutosaving, click: saveChanges }, i18n.t('ui.editor.save'))),
          ifNode(hasDocument, () => a('editorPresentPresentation', { class: 'studio-button studio-button--primary', 'aria-label': i18n.t('ui.editor.present'), 'data-navigation': 'external', href: function* () { return `/present/${yield* presentationId()}`; }, click: saveChanges }, i18n.t('ui.editor.present'))),
        ]),
      ]),
      ifNode(presentation.isLoading, () => p({ class: 'studio-status' }, i18n.t('ui.editor.loading'))),
      ifNode(presentation.hasException, () => p({ class: 'studio-status', 'data-tone': 'danger' }, i18n.t('ui.editor.error'))),
      ifNode(hasDocument, () => [
      section({ class: 'editor-header-card' }, [
        span({ class: 'studio-eyebrow' }, i18n.t('ui.editor.eyebrow')),
        input('presentationTitle', { type: 'text', 'aria-label': i18n.t('ui.editor.titleLabel'), class: 'editor-title-input', value: function* () { return (yield* currentDocument()).title; }, *input(event) { yield* updateTitle(eventValue(event)); } }),
        select('presentationLayout', { 'aria-label': i18n.t('ui.editor.layoutLabel'), class: 'editor-layout-select', value: function* () { return (yield* currentDocument()).layout; }, *change(event) { yield* updateLayout(eventValue(event) as PresentationLayout); } }, [
          option({ value: 'desktop' }, i18n.t('ui.editor.layoutDesktop')),
          option({ value: 'vertical' }, i18n.t('ui.editor.layoutVertical')),
        ]),
        input('presentationAudience', { type: 'text', 'aria-label': i18n.t('ui.editor.audiencePlaceholder'), class: 'editor-audience-input', placeholder: i18n.t('ui.editor.audiencePlaceholder'), value: function* () { return (yield* currentDocument()).audience; }, *input(event) { yield* updateAudience(eventValue(event)); } }),
        textarea('presentationObjective', { 'aria-label': i18n.t('ui.editor.objectivePlaceholder'), class: 'editor-objective-input', placeholder: i18n.t('ui.editor.objectivePlaceholder'), value: function* () { return (yield* currentDocument()).objective; }, *input(event) { yield* updateObjective(eventValue(event)); } }),
        input('presentationCoverImageAlt', { type: 'text', 'aria-label': i18n.t('ui.editor.coverImageAltLabel'), class: 'editor-cover-image-input', placeholder: i18n.t('ui.editor.coverImageAltPlaceholder'), value: function* () { return (yield* currentDocument()).coverImageAlt; }, *input(event) { yield* updateCoverImageAlt(eventValue(event)); } }),
        label({ class: 'editor-image-dropzone', 'aria-label': i18n.t('ui.editor.coverImageDropzone'), onImageReady: function* (event: Event) { yield* handleImageFile((event as CustomEvent<ImageReadyDetail>).detail, { kind: 'cover' }); } }, [
          span({ class: 'editor-image-dropzone__title' }, i18n.t('ui.editor.imageDropzoneTitle')),
          span({ class: 'editor-image-dropzone__hint' }, i18n.t('ui.editor.imageDropzoneHint')),
          input('presentationCoverImageFile', { type: 'file', accept: PRESENTATION_IMAGE_MIME_TYPES.join(','), class: 'editor-image-file-input', 'aria-label': i18n.t('ui.editor.coverImageDropzone') }),
        ]).pipe(readPresentationImageFile),
        // eslint-disable-next-line craft-ts/no-raw-user-url, craft-ts/require-reactive-template-bindings -- safePresentationImageUrl validates and drops blocked origins.
        ifNode(hasCoverImage, () => img({ class: 'editor-cover-image-preview', src: function* () { return safePresentationImageUrl((yield* currentDocument()).coverImageUrl); }, alt: coverImageAlt })),
        ifNode(imageUploading, () => p({ class: 'studio-status' }, i18n.t('ui.editor.imageUploading'))),
        ifNode(imageUploadFailed, () => p({ class: 'studio-status', 'data-tone': 'danger' }, imageUploadErrorMessage)),
        ifNode(hasImageUploadNotice, () => p({ class: 'studio-status' }, imageUploadNotice)),
      ]),
      section({ class: 'editor-sections' }, [
        div({ class: 'editor-sections__header' }, [
          div([
            span({ class: 'studio-panel__label' }, i18n.t('ui.editor.sectionsLabel')),
          heading({ 'aria-label': i18n.t('ui.editor.sectionsTitle') }, i18n.t('ui.editor.sectionsTitle')),
          ]),
          button('addSection', { type: 'button', class: 'studio-button', 'aria-label': i18n.t('ui.editor.addSection'), click: addSection }, i18n.t('ui.editor.addSection')),
        ]),
        forNode(
          sectionViews,
          { track: (section) => section.section.id },
          (sectionViewInput) => div({ class: 'editor-section-card' }, [
            div({ class: 'editor-section-card__header' }, [
              button('toggleSection', { type: 'button', class: 'editor-section-toggle', 'aria-expanded': function* () { return String((yield* sectionViewInput()).isExpanded); }, 'aria-label': function* () { return (yield* sectionViewInput()).toggleLabel; }, click: function* () { yield* toggleSection((yield* sectionViewInput()).section.id); } }, function* () { return (yield* sectionViewInput()).toggleIcon; }),
              input('sectionTitle', { type: 'text', 'aria-label': i18n.t('ui.editor.sectionTitleLabel'), class: 'editor-section-title', value: function* () { return (yield* sectionViewInput()).section.title; }, *input(event) { const section = (yield* sectionViewInput()).section; yield* updateSection(section.id, { title: eventValue(event) }); } }),
              select('sectionIntention', { 'aria-label': i18n.t('ui.editor.sectionIntentionLabel'), class: 'editor-section-intention', value: function* () { return (yield* sectionViewInput()).section.intention; }, *change(event) { const section = (yield* sectionViewInput()).section; yield* updateSection(section.id, { intention: eventValue(event) as PresentationIntention }); } }, PRESENTATION_INTENTIONS.map((intention) => option({ value: intention }, intention))),
              div({ class: 'editor-section-card__actions' }, [
                button('moveSectionUp', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.moveSectionUp'), disabled: function* () { return (yield* sectionViewInput()).canMoveUp === false; }, click: function* () { yield* moveSection((yield* sectionViewInput()).section.id, 'up'); } }, '↑'),
                button('moveSectionDown', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.moveSectionDown'), disabled: function* () { return (yield* sectionViewInput()).canMoveDown === false; }, click: function* () { yield* moveSection((yield* sectionViewInput()).section.id, 'down'); } }, '↓'),
              ]),
            ]),
            div({ class: 'editor-section-card__body', 'data-collapsed': function* () { return String((yield* sectionViewInput()).isCollapsed); } }, [
            forNode(function* () { return (yield* sectionViewInput()).section.sequences; }, { track: (sequence) => sequence.id }, (sequenceInput) => div({ class: 'editor-sequence-card' }, [
              input('sequenceTitle', { type: 'text', 'aria-label': i18n.t('ui.editor.sequenceTitleLabel'), class: 'editor-sequence-title', value: function* () { return (yield* sequenceInput()).title; }, *input(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { title: eventValue(event) }); } }),
              textarea('sequenceMessage', { 'aria-label': i18n.t('ui.editor.sequenceMessageLabel'), class: 'editor-sequence-message', value: function* () { return (yield* sequenceInput()).message; }, *input(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { message: eventValue(event) }); } }),
              textarea('sequenceNotes', { 'aria-label': i18n.t('ui.editor.notesPlaceholder'), class: 'editor-notes-input', placeholder: i18n.t('ui.editor.notesPlaceholder'), value: function* () { return (yield* sequenceInput()).notes; }, *input(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { notes: eventValue(event) }); } }),
              textarea('sequenceCode', { 'aria-label': i18n.t('ui.editor.codeLabel'), class: 'editor-code-input', placeholder: i18n.t('ui.editor.codePlaceholder'), value: function* () { return (yield* sequenceInput()).code; }, *input(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { code: eventValue(event) }); } }),
              select('sequenceCodeLanguage', { 'aria-label': i18n.t('ui.editor.codeLanguageLabel'), class: 'editor-code-language', value: function* () { return (yield* sequenceInput()).codeLanguage; }, *change(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { codeLanguage: eventValue(event) as PresentationCodeLanguage }); } }, PRESENTATION_CODE_LANGUAGES.map((language) => option({ value: language }, language))),
              label({ class: 'editor-image-dropzone', 'aria-label': i18n.t('ui.editor.sequenceImageDropzone'), onImageReady: function* (event: Event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* handleImageFile((event as CustomEvent<ImageReadyDetail>).detail, { kind: 'sequence', sectionId: section.id, sequenceId: sequence.id }); } }, [
                span({ class: 'editor-image-dropzone__title' }, i18n.t('ui.editor.imageDropzoneTitle')),
                span({ class: 'editor-image-dropzone__hint' }, i18n.t('ui.editor.imageDropzoneHint')),
                input('sequenceImageFile', { type: 'file', accept: PRESENTATION_IMAGE_MIME_TYPES.join(','), class: 'editor-image-file-input', 'aria-label': i18n.t('ui.editor.sequenceImageDropzone') }),
              ]).pipe(readPresentationImageFile),
              input('sequenceImageAlt', { type: 'text', 'aria-label': i18n.t('ui.editor.imageAltLabel'), class: 'editor-image-input', placeholder: i18n.t('ui.editor.imageAltPlaceholder'), value: function* () { return (yield* sequenceInput()).imageAlt; }, *input(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { imageAlt: eventValue(event) }); } }),
              // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
              img({ class: 'editor-sequence-image', src: function* () { return safePresentationImageUrl((yield* sequenceInput()).imageUrl); }, alt: function* () { return (yield* sequenceInput()).imageAlt; } }),
              div({ class: 'editor-sequence-footer' }, [
                input('sequenceDuration', { type: 'number', 'aria-label': i18n.t('ui.editor.durationLabel'), min: '1', class: 'editor-duration-input', value: function* () { return String((yield* sequenceInput()).durationMinutes); }, *input(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { durationMinutes: Number(eventValue(event)) || 1 }); } }),
                select('sequenceTransition', { 'aria-label': i18n.t('ui.editor.transitionLabel'), class: 'editor-transition-select', value: function* () { return (yield* sequenceInput()).transition; }, *change(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { transition: eventValue(event) as PresentationTransition }); } }, PRESENTATION_TRANSITIONS.map((transition) => option({ value: transition }, transition))),
                button('deleteSequence', { type: 'button', class: 'studio-button studio-button--danger', 'aria-label': i18n.t('ui.editor.deleteSequence'), click: function* () { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* deleteSequence(section.id, sequence.id); } }, i18n.t('ui.editor.deleteSequence')),
              ]),
            ])),
            ]),
            button('addSequence', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.addSequence'), click: function* () { yield* addSequence((yield* sectionViewInput()).section.id); } }, i18n.t('ui.editor.addSequence')),
          ]),
        ),
      ]),
      ], () => section({ class: 'editor-loading-card', 'aria-label': i18n.t('ui.editor.loading') }, [
        div({ class: 'editor-loading-card__bar' }),
        div({ class: 'editor-loading-card__line' }),
        div({ class: 'editor-loading-card__line editor-loading-card__line--short' }),
      ])),
    ]),
);

export default EditorPage;
