/* eslint-disable craft-ts/require-effect-adapters, craft-ts/require-primitive-derived-property, craft-ts/require-reactive-template-bindings, craft-ts/no-noninteractive-element-interactions, craft-ts/no-raw-class -- The stage is a keyboard-navigable composite presentation surface; its static visual classes are defined by the studio stylesheet. */
import {
  a,
  button,
  craftComponent,
  div,
  forNode,
  heading,
  h,
  ifNode,
  iframe,
  img,
  matchNode,
  p,
  pre,
  safeResourceUrl,
  safeUrl,
  section,
  span,
  type Input,
} from '@craft-ts/component';
import { assign, num, unit } from '@craft-ts/style';
import type { ColorValue } from '@craft-ts/style';
import { craftComputed, craftMethod, craftNodeDirective, query, state } from '@craft-ts/core';
import { i18n } from '../../../i18n';
import { loadPresentation } from '../../api';
import { PRESENTATION_IMAGE_ALLOWED_ORIGINS, PRESENTATION_THEME_GRADIENTS } from '../../../shared/presentation';
import type { PresentationSequence } from '../../../shared/presentation';
import { highlightCodeTokens } from './code-highlighter';
import { extractPresentationNoteParts } from './presentation-links';
import { presentationGradientVars, presentationProgressVars, presentationSlideVars } from '../../ui/ui.style';
import { threePresentationBackdrop } from './presentation-visual';

function cssColor(value: string): ColorValue {
  return { css: value, dark: value, role: 'none', unproven: '' } as ColorValue;
}

function safePresentationImageUrl(url: string): string {
  if (!url) return '';
  try {
    return safeResourceUrl(url, { allowedOrigins: PRESENTATION_IMAGE_ALLOWED_ORIGINS });
  } catch {
    return '';
  }
}

function safePresentationMediaUrl(url: string): string {
  if (!url) return '';
  try {
    if (url.startsWith('/')) return safeResourceUrl(url, { allowedOrigins: PRESENTATION_IMAGE_ALLOWED_ORIGINS });
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const safeUrlValue = safeUrl(url);
    return safeResourceUrl(safeUrlValue, { allowedOrigins: [parsed.origin] });
  } catch {
    return '';
  }
}

function safePresentationLinkUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return safeUrl(url);
  } catch {
    return '';
  }
}

function safePresentationEmbeddedUrl(url: string): string {
  const safeUrlValue = safePresentationLinkUrl(url);
  if (!safeUrlValue) return '';
  try {
    return safeResourceUrl(safeUrlValue, { allowedOrigins: [new URL(safeUrlValue).origin] });
  } catch {
    return '';
  }
}

const EMPTY_SLIDE: PresentationSequence = {
  id: '',
  title: '',
  message: '',
  notes: '',
  durationMinutes: 0,
  transition: 'Fondu',
  code: '',
  codeLanguage: 'typescript',
  imageUrl: '',
  imageAlt: '',
};

type PresentationImageViewer = {
  url: string;
  alt: string;
};

function clampImageViewerZoom(value: number): number {
  return Math.min(Math.max(value, 1), 4);
}

const focusPresentationStage = craftNodeDirective(
  'focusPresentationStage',
  [],
  ({ element }) => {
    if ('focus' in element && typeof element.focus === 'function') {
      element.focus();
    }
  },
);

const dragPresentationSurface = craftNodeDirective(
  'dragPresentationSurface',
  [],
  ({ element }) => {
    const handle = element as HTMLElement;
    const surface = handle.dataset.dragSurface === 'notes' ? handle.parentElement?.parentElement : handle;
    if (!surface) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      const bounds = surface.getBoundingClientRect();
      const view = surface.ownerDocument.defaultView;
      const maxX = (view?.innerWidth ?? bounds.width) - bounds.width - 12;
      const maxY = (view?.innerHeight ?? bounds.height) - bounds.height - 12;
      surface.style.left = `${clamp(event.clientX - offsetX, 12, maxX)}px`;
      surface.style.top = `${clamp(event.clientY - offsetY, 12, maxY)}px`;
      surface.style.right = 'auto';
      surface.style.bottom = 'auto';
    };
    const stop = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      surface.dataset.dragging = 'false';
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    const start = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (surface === handle && event.target instanceof Element && event.target.closest('a,button,input,select,textarea')) return;
      const bounds = surface.getBoundingClientRect();
      dragging = true;
      offsetX = event.clientX - bounds.left;
      offsetY = event.clientY - bounds.top;
      surface.dataset.dragging = 'true';
      surface.style.position = 'fixed';
      surface.style.zIndex = handle.dataset.dragSurface === 'topbar' ? '20' : '12';
      surface.style.width = `${bounds.width}px`;
      surface.style.height = `${bounds.height}px`;
      surface.style.margin = '0';
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    handle.addEventListener('pointerdown', start);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
    return () => {
      handle.removeEventListener('pointerdown', start);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
  },
);

const imageViewerInteraction = craftNodeDirective(
  'imageViewerInteraction',
  [],
  ({ element }) => {
    const viewer = element as HTMLElement;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      const viewport = viewer.querySelector<HTMLElement>('.presentation-image-viewer__viewport');
      const image = viewer.querySelector<HTMLImageElement>('.presentation-image-viewer__image');
      if (!viewport || !image) return;

      let zoom = 1;
      let offsetX = 0;
      let offsetY = 0;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const clampOffset = () => {
      const bounds = viewport.getBoundingClientRect();
      const maxX = Math.max(0, (image.offsetWidth * zoom - bounds.width) / 2);
      const maxY = Math.max(0, (image.offsetHeight * zoom - bounds.height) / 2);
      offsetX = Math.min(Math.max(offsetX, -maxX), maxX);
      offsetY = Math.min(Math.max(offsetY, -maxY), maxY);
      };
      const update = () => {
      clampOffset();
      image.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${zoom})`;
      viewer.dataset.zoomed = String(zoom > 1);
      const zoomLabel = viewer.querySelector<HTMLElement>('.presentation-image-viewer__zoom-value');
      if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      };
      const setZoom = (value: number) => {
      zoom = clampImageViewerZoom(value);
      if (zoom === 1) {
        offsetX = 0;
        offsetY = 0;
      }
      update();
      };
      const onImageLoad = () => update();
      const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
      };
      const onPointerDown = (event: PointerEvent) => {
      if (zoom === 1 || event.button !== 0) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      viewer.dataset.dragging = 'true';
      image.setPointerCapture(event.pointerId);
      event.preventDefault();
      };
      const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      offsetX += event.clientX - lastX;
      offsetY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      update();
      };
      const stopDragging = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      viewer.dataset.dragging = 'false';
      if (image.hasPointerCapture(event.pointerId)) image.releasePointerCapture(event.pointerId);
      };
      const onDoubleClick = () => setZoom(zoom === 1 ? 2 : 1);
      const onControlClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>('[data-image-viewer-action]');
      if (!control || !viewer.contains(control)) return;
      const action = control.dataset.imageViewerAction;
      if (action === 'zoom-in') setZoom(zoom + 0.25);
      else if (action === 'zoom-out') setZoom(zoom - 0.25);
      else if (action === 'reset') setZoom(1);
      };

      image.addEventListener('load', onImageLoad);
      viewport.addEventListener('wheel', onWheel, { passive: false });
      image.addEventListener('pointerdown', onPointerDown);
      image.addEventListener('pointermove', onPointerMove);
      image.addEventListener('pointerup', stopDragging);
      image.addEventListener('pointercancel', stopDragging);
      image.addEventListener('dblclick', onDoubleClick);
      viewer.addEventListener('click', onControlClick);
      update();

      cleanup = () => {
        image.removeEventListener('load', onImageLoad);
        viewport.removeEventListener('wheel', onWheel);
        image.removeEventListener('pointerdown', onPointerDown);
        image.removeEventListener('pointermove', onPointerMove);
        image.removeEventListener('pointerup', stopDragging);
        image.removeEventListener('pointercancel', stopDragging);
        image.removeEventListener('dblclick', onDoubleClick);
        viewer.removeEventListener('click', onControlClick);
      };
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  },
);

const embedPresentationLink = craftNodeDirective(
  'embedPresentationLink',
  [],
  ({ element }) => {
    const frame = element as HTMLIFrameElement;
    const safeUrlValue = safePresentationEmbeddedUrl(frame.dataset.source ?? '');
    if (safeUrlValue) frame.src = safeUrlValue;
  },
);

function createPresentationPage(name: string, presenterMode: boolean) {
  return craftComponent(
    name,
    {},
    function* (presentationId: Input<string>) {
      const presentation = yield* query('presentationStage', {
        params: presentationId,
        loader: function* ({ params }) {
          return yield* loadPresentation(params);
        },
      });
      const slideIndex = yield* state('slideIndex', 0, ({ set }) => ({
        setIndex: (value: number) => set(value),
      }));
      const notesVisible = yield* state('notesVisible', false, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const activeLink = yield* state('activeLink', null as string | null, ({ set }) => ({
        open: (url: string) => set(url),
        close: () => set(null),
      }));
      const imageViewer = yield* state('imageViewer', null as PresentationImageViewer | null, ({ set }) => ({
        open: (value: PresentationImageViewer) => set(value),
        close: () => set(null),
      }));
      const overview = yield* state('overview', true, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const linkReturnState = yield* state('linkReturnState', false, ({ set }) => ({
        remember: (wasOverviewVisible: boolean) => set(wasOverviewVisible),
        clear: () => set(false),
      }));
      const publicNotesHidden = craftComputed('publicNotesHidden', () => false);
      const showNotes = presenterMode ? notesVisible : publicNotesHidden;
      const hasCoverImage = craftComputed('hasCoverImage', function* () {
        return Boolean((yield* presentation.value())?.coverImageUrl);
      });
      const hasBackgroundImage = craftComputed('hasBackgroundImage', function* () {
        const document = yield* presentation.value();
        return document?.backgroundType === 'image' && Boolean(document.backgroundUrl);
      });
      const hasBackgroundVideo = craftComputed('hasBackgroundVideo', function* () {
        const document = yield* presentation.value();
        return document?.backgroundType === 'video' && Boolean(document.backgroundUrl);
      });
      const showStage = craftComputed('showStage', function* () {
        return !(yield* overview());
      });
      const hasImageViewer = craftComputed('hasImageViewer', function* () {
        return Boolean(yield* imageViewer());
      });
      const presentationGradientStyle = craftComputed('presentationGradientStyle', function* () {
        const document = yield* presentation.value();
        const gradient = document ?? {
          backgroundGradientStart: PRESENTATION_THEME_GRADIENTS.aurora.start,
          backgroundGradientMiddle: PRESENTATION_THEME_GRADIENTS.aurora.middle,
          backgroundGradientEnd: PRESENTATION_THEME_GRADIENTS.aurora.end,
          backgroundGradientAngle: PRESENTATION_THEME_GRADIENTS.aurora.angle,
        };
        return {
          ...assign(presentationGradientVars.start, cssColor(gradient.backgroundGradientStart)),
          ...assign(presentationGradientVars.middle, cssColor(gradient.backgroundGradientMiddle)),
          ...assign(presentationGradientVars.end, cssColor(gradient.backgroundGradientEnd)),
          ...assign(presentationGradientVars.angle, unit.deg(gradient.backgroundGradientAngle)),
        };
      });
      const slides = craftComputed('slides', function* () {
        const document = yield* presentation.value();
        return document?.sections.flatMap((part) => part.sequences) ?? [];
      });
      const sectionNavigation = craftComputed('sectionNavigation', function* () {
        const document = yield* presentation.value();
        let slideOffset = 0;
        return document?.sections.map((part) => {
          const sequences = part.sequences.map((sequence) => {
            const navigationSequence = { ...sequence, slideIndex: slideOffset };
            slideOffset += 1;
            return navigationSequence;
          });
          return {
            ...part,
            firstSlideIndex: sequences[0]?.slideIndex ?? 0,
            sequences,
          };
        }) ?? [];
      });
      const currentSlide = craftComputed('currentSlide', function* () {
        return (yield* slides())[yield* slideIndex()] ?? EMPTY_SLIDE;
      });
      const currentSectionTitle = craftComputed('currentSectionTitle', function* () {
        const document = yield* presentation.value();
        const slide = yield* currentSlide();
        return document?.sections.find((part) => part.sequences.some((sequence) => sequence.id === slide.id))?.title ?? '';
      });
      const currentSectionIntention = craftComputed('currentSectionIntention', function* () {
        const document = yield* presentation.value();
        const slide = yield* currentSlide();
        return document?.sections.find((part) => part.sequences.some((sequence) => sequence.id === slide.id))?.intention ?? '';
      });
      const hasImage = craftComputed('hasImage', function* () {
        return Boolean((yield* currentSlide()).imageUrl);
      });
      const hasCode = craftComputed('hasCode', function* () {
        return Boolean((yield* currentSlide()).code);
      });
      const highlightedCode = craftComputed('highlightedCode', function* () {
        const slide = yield* currentSlide();
        return highlightCodeTokens(slide.code, slide.codeLanguage);
      });
      const noteParts = craftComputed('noteParts', function* () {
        return extractPresentationNoteParts((yield* currentSlide()).notes);
      });
      const hasActiveLink = craftComputed('hasActiveLink', function* () {
        return Boolean(yield* activeLink());
      });
      const showOverviewContent = craftComputed('showOverviewContent', function* () {
        return !(yield* hasActiveLink());
      });
      const slideItems = craftComputed('slideItems', function* () {
        const slide = yield* currentSlide();
        return slide.id ? [slide] : [];
      });
      const progressPercent = craftComputed('progressPercent', function* () {
        const count = (yield* slides()).length;
        return count === 0 ? 0 : ((yield* slideIndex()) + 1) / count * 100;
      });
      const next = craftMethod('next', function* () {
        const count = (yield* slides()).length;
        const current = yield* slideIndex();
        if (yield* overview()) {
          if (count > 0) {
            yield* overview.hide();
            yield* slideIndex.setIndex(0);
          }
          return;
        }
        if (current < count - 1) yield* slideIndex.setIndex(current + 1);
      });
      const previous = craftMethod('previous', function* () {
        const current = yield* slideIndex();
        if (current > 0) yield* slideIndex.setIndex(current - 1);
      });
      const openImageViewer = craftMethod('openImageViewer', function* () {
        const slide = yield* currentSlide();
        const url = safePresentationImageUrl(slide.imageUrl);
        if (url) yield* imageViewer.open({ url, alt: slide.imageAlt || i18n.t('ui.editor.imageAltFallback') });
      });
      const closeImageViewer = craftMethod('closeImageViewer', function* () {
        yield* imageViewer.close();
      });
      const handleKeydown = craftMethod('handleKeydown', function* (event: KeyboardEvent) {
        if (yield* imageViewer()) {
          if (event.key === 'Escape') {
            event.preventDefault();
            yield* imageViewer.close();
          }
          return;
        }
        if (yield* activeLink()) {
          if (event.key === 'Escape') {
            event.preventDefault();
            yield* activeLink.close();
          }
          return;
        }
        const count = (yield* slides()).length;
        const current = yield* slideIndex();
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
          event.preventDefault();
          if (current < count - 1) yield* slideIndex.setIndex(current + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
          event.preventDefault();
          if (current > 0) yield* slideIndex.setIndex(current - 1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          yield* overview.show();
          yield* slideIndex.setIndex(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          if (count > 0) yield* slideIndex.setIndex(count - 1);
          yield* overview.hide();
        }
      });
      const selectSlide = craftMethod('selectSlide', function* (index: number) {
        const count = (yield* slides()).length;
        if (index >= 0 && index < count) {
          yield* slideIndex.setIndex(index);
          yield* overview.hide();
        }
      });
      const toggleNotes = craftMethod('toggleNotes', function* () {
        if (yield* notesVisible()) yield* notesVisible.hide(); else yield* notesVisible.show();
      });
      const openPresentationLink = craftMethod('openPresentationLink', function* (url: string) {
        const safeUrlValue = safePresentationLinkUrl(url);
        if (safeUrlValue) {
          yield* linkReturnState.remember(yield* overview());
          yield* overview.show();
          yield* activeLink.open(safeUrlValue);
        }
      });
      const closePresentationLink = craftMethod('closePresentationLink', function* () {
        yield* activeLink.close();
        if (!(yield* linkReturnState())) yield* overview.hide();
        yield* linkReturnState.clear();
      });
      return { presentation, overview, hasCoverImage, hasBackgroundImage, hasBackgroundVideo, showStage, hasImageViewer, presentationGradientStyle, slideIndex, slides, sectionNavigation, currentSlide, currentSectionTitle, currentSectionIntention, progressPercent, showNotes, hasImage, hasCode, highlightedCode, noteParts, hasActiveLink, showOverviewContent, activeLink, imageViewer, slideItems, next, previous, handleKeydown, selectSlide, toggleNotes, openPresentationLink, closePresentationLink, openImageViewer, closeImageViewer, presentationId };
    },
    ({ presentation, overview, hasCoverImage, hasBackgroundImage, hasBackgroundVideo, showStage, hasImageViewer, presentationGradientStyle, slideIndex, slides, sectionNavigation, currentSlide, currentSectionTitle, currentSectionIntention, progressPercent, showNotes, hasImage, hasCode, highlightedCode, noteParts, hasActiveLink, showOverviewContent, activeLink, imageViewer, slideItems, next, previous, selectSlide, toggleNotes, openPresentationLink, closePresentationLink, openImageViewer, closeImageViewer, handleKeydown, presentationId }) =>
      div({ class: 'presentation-shell', style: presentationGradientStyle, 'data-layout': function* () { return (yield* presentation.value())?.layout ?? 'desktop'; }, 'data-theme': function* () { return (yield* presentation.value())?.backgroundTheme ?? 'aurora'; }, 'data-background-type': function* () { return (yield* presentation.value())?.backgroundType ?? 'theme'; }, 'data-decoration': function* () { return (yield* presentation.value())?.backgroundDecoration ?? 'orb'; }, 'data-decoration-color': function* () { return (yield* presentation.value())?.backgroundDecorationColor ?? '#f736e3'; }, 'data-presenter': presenterMode ? 'true' : 'false', role: 'application', 'aria-label': i18n.t('ui.presentation.stage'), tabIndex: 0, *keydown(event) { yield* handleKeydown(event); } }, [
        // eslint-disable-next-line craft-ts/no-raw-user-url, craft-ts/require-reactive-template-bindings -- safePresentationMediaUrl validates the protocol and origin.
        ifNode(hasBackgroundImage, () => img({ class: 'presentation-background-media', src: function* () { return safePresentationMediaUrl((yield* presentation.value())?.backgroundUrl ?? ''); }, alt: '' })),
        // eslint-disable-next-line craft-ts/no-raw-user-url, craft-ts/require-reactive-template-bindings -- safePresentationMediaUrl validates the protocol and origin.
        ifNode(hasBackgroundVideo, () => h('video', { class: 'presentation-background-media', src: function* () { return safePresentationMediaUrl((yield* presentation.value())?.backgroundUrl ?? ''); }, autoplay: true, muted: true, loop: true, playsinline: true, preload: 'auto', 'aria-hidden': true })),
        div({ class: 'presentation-topbar', 'data-drag-surface': 'topbar' }, presenterMode
          ? [
              a('publicView', { class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.publicView'), 'data-navigation': 'external', href: function* () { return `/present/${yield* presentationId()}`; } }, i18n.t('ui.presentation.publicView')),
              span({ class: 'presentation-brand' }, function* () { return (yield* presentation.value())?.title ?? i18n.t('ui.presentation.loading'); }),
              button('toggleSpeakerNotes', { type: 'button', 'aria-label': i18n.t('ui.presentation.notes'), class: 'presentation-control', click: toggleNotes }, i18n.t('ui.presentation.notes')),
            ]
          : [
              a('exitPresentation', { class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.exit'), 'data-navigation': 'external', href: function* () { return `/editor/${yield* presentationId()}`; } }, i18n.t('ui.presentation.exit')),
              span({ class: 'presentation-brand' }, function* () { return (yield* presentation.value())?.title ?? i18n.t('ui.presentation.loading'); }),
              a('presenterView', { class: 'presentation-control', 'aria-label': i18n.t('ui.presentation.presenterView'), 'data-navigation': 'external', href: function* () { return `/presenter/${yield* presentationId()}`; } }, i18n.t('ui.presentation.presenterView')),
            ]).pipe(dragPresentationSurface),
        ifNode(presentation.isLoading, () => p({ class: 'presentation-loading' }, i18n.t('ui.presentation.loading'))),
        ifNode(overview, () => section({ class: 'presentation-overview', 'data-drag-surface': 'overview', 'data-link-viewer': function* () { return String(yield* hasActiveLink()); }, 'aria-labelledby': 'presentationOverviewTitle' }, [
          h('canvas', { class: 'presentation-overview__canvas', 'aria-hidden': true }).pipe(threePresentationBackdrop),
          ifNode(hasActiveLink, () => section({ class: 'presentation-link-viewer', 'aria-label': i18n.t('ui.presentation.linkViewer') }, [
            div({ class: 'presentation-link-viewer__topbar' }, [
              div({ class: 'presentation-link-viewer__heading' }, [
                span({ class: 'presentation-stage__kicker' }, i18n.t('ui.presentation.linkViewerEyebrow')),
                span({ class: 'presentation-link-viewer__url' }, activeLink),
              ]),
              div({ class: 'presentation-link-viewer__actions' }, [
                a('openPresentationLinkExternal', { class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.openLinkExternal'), href: function* () { return safeUrl((yield* activeLink()) ?? ''); }, target: '_blank', rel: 'noopener noreferrer', 'data-navigation': 'external' }, i18n.t('ui.presentation.openLinkExternal')),
                button('closePresentationLink', { type: 'button', class: 'presentation-control presentation-control--primary', 'aria-label': i18n.t('ui.presentation.closeLink'), click: closePresentationLink }, i18n.t('ui.presentation.closeLink')),
              ]),
            ]),
            div({ class: 'presentation-link-viewer__frame' }, [
              iframe({ title: i18n.t('ui.presentation.linkViewer'), 'data-source': activeLink, loading: 'eager', referrerPolicy: 'no-referrer', sandbox: 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-same-origin', allow: 'fullscreen; autoplay; picture-in-picture' }).pipe(embedPresentationLink),
            ]),
          ])),
          ifNode(showOverviewContent, () => [
            div({ class: 'presentation-overview__content' }, [
              // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
              ifNode(hasCoverImage, () => img({ class: 'presentation-overview__image', src: function* () { return safePresentationImageUrl((yield* presentation.value())?.coverImageUrl ?? ''); }, alt: function* () { return (yield* presentation.value())?.coverImageAlt || i18n.t('ui.editor.coverImageAltFallback'); } })),
              span({ class: 'presentation-stage__kicker' }, i18n.t('ui.presentation.overview')),
              heading({ id: 'presentationOverviewTitle', class: 'presentation-overview__title' }, function* () { return (yield* presentation.value())?.title ?? ''; }),
              p({ class: 'presentation-overview__objective' }, function* () { return (yield* presentation.value())?.objective ?? ''; }),
              span({ class: 'presentation-overview__hint' }, i18n.t('ui.presentation.overviewHint')),
            ]),
            div({ class: 'presentation-overview__carousel', role: 'list', 'aria-label': i18n.t('ui.presentation.presentationOutline') }, [
              forNode(sectionNavigation, { track: (part) => part.id }, (partInput) => button('overviewPart', { type: 'button', class: 'presentation-overview__card', 'aria-label': function* () { return `${i18n.t('ui.presentation.selectPart')}: ${(yield* partInput()).title}`; }, click: function* () { yield* selectSlide((yield* partInput()).firstSlideIndex); } }, [
                span({ class: 'presentation-overview__card-index' }, function* () { return String((yield* partInput()).firstSlideIndex + 1).padStart(2, '0'); }),
                span({ class: 'presentation-overview__card-title' }, function* () { return (yield* partInput()).title; }),
                span({ class: 'presentation-overview__card-intention' }, function* () { return (yield* partInput()).intention; }),
                div({ class: 'presentation-overview__card-sequences' }, [
                  forNode(function* () { return (yield* partInput()).sequences; }, { track: (sequence) => sequence.id }, (sequenceInput) => span({ class: 'presentation-overview__sequence' }, function* () { return (yield* sequenceInput()).title; })),
                ]),
              ])),
            ]),
          ]),
        ]).pipe(dragPresentationSurface)),
        ifNode(showStage, () => section({ class: 'presentation-stage', tabIndex: -1 }, [
          h('canvas', { class: 'presentation-stage__canvas', 'aria-hidden': true }).pipe(threePresentationBackdrop),
          div({ class: 'presentation-stage__glow' }),
          forNode(
            slideItems,
            { track: (slide) => slide.id },
            () => div({ class: 'presentation-stage__slide', 'data-index': function* () { return String(yield* slideIndex()); }, 'data-transition': function* () { return (yield* currentSlide()).transition; }, style: function* () { return assign(presentationSlideVars.phase, num((yield* slideIndex()) % 2)); } }, [
              span({ class: 'presentation-stage__kicker' }, function* () {
                return `${String((yield* slideIndex()) + 1).padStart(2, '0')} · ${yield* currentSectionTitle()} · ${yield* currentSectionIntention()}`;
              }),
              heading({ class: 'presentation-stage__title', 'aria-label': i18n.t('ui.presentation.currentSlide') }, function* () { return (yield* currentSlide()).title; }),
              p({ class: 'presentation-stage__message' }, function* () { return (yield* currentSlide()).message; }),
              // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
              ifNode(hasImage, () => button('openImageViewer', { type: 'button', class: 'presentation-stage__image-trigger', 'aria-label': i18n.t('ui.presentation.openImageViewer'), title: i18n.t('ui.presentation.openImageViewer'), click: openImageViewer }, img({ class: 'presentation-stage__image', src: function* () { return safePresentationImageUrl((yield* currentSlide()).imageUrl); }, alt: function* () { return (yield* currentSlide()).imageAlt || i18n.t('ui.editor.imageAltFallback'); } }))),
              ifNode(hasCode, () => pre('slideCode', { class: 'presentation-code', 'data-language': function* () { return (yield* currentSlide()).codeLanguage; } }, forNode(highlightedCode, { track: (token) => token.id }, (tokenInput) => span({ class: function* () { return (yield* tokenInput()).className; } }, function* () { return (yield* tokenInput()).text; })))),
            ]),
          ),
          div({ class: 'presentation-stage__controls' }, [
            button('previousSlide', { type: 'button', 'aria-label': i18n.t('ui.presentation.previous'), title: i18n.t('ui.presentation.previous'), class: 'presentation-control presentation-control--icon', disabled: function* () { return (yield* slideIndex()) === 0; }, click: previous }, span({ 'aria-hidden': true }, '←')),
            div({ class: 'presentation-carousel', role: 'list', 'aria-label': i18n.t('ui.presentation.presentationOutline') }, [
              forNode(sectionNavigation, { track: (part) => part.id }, (partInput) => [
                button('carouselSection', { type: 'button', class: 'presentation-carousel__part', 'data-active': function* () { return String((yield* slideIndex()) >= (yield* partInput()).firstSlideIndex && (yield* slideIndex()) < (yield* partInput()).firstSlideIndex + (yield* partInput()).sequences.length); }, click: function* () { yield* selectSlide((yield* partInput()).firstSlideIndex); } }, function* () { return (yield* partInput()).title; }),
                forNode(function* () { return (yield* partInput()).sequences; }, { track: (sequence) => sequence.id }, (sequenceInput) => button('carouselSequence', { type: 'button', class: 'presentation-carousel__sequence', 'data-active': function* () { return String((yield* sequenceInput()).slideIndex === (yield* slideIndex())); }, click: function* () { yield* selectSlide((yield* sequenceInput()).slideIndex); } }, function* () { return (yield* sequenceInput()).title; })),
              ]),
            ]),
            div({ class: 'presentation-progress' }, [
              div({ class: 'presentation-progress__track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progressPercent }, div({ class: 'presentation-progress__fill', style: function* () { return assign(presentationProgressVars.value, unit.pct(yield* progressPercent())); } })),
              span(function* () { return `${(yield* slideIndex()) + 1} / ${(yield* slides()).length}`; }),
            ]),
            button('nextSlide', { type: 'button', 'aria-label': i18n.t('ui.presentation.next'), title: i18n.t('ui.presentation.next'), class: 'presentation-control presentation-control--icon', disabled: function* () { return (yield* slideIndex()) >= (yield* slides()).length - 1; }, click: next }, span({ 'aria-hidden': true }, '→')),
          ]),
        ]).pipe(focusPresentationStage)),
        ifNode(hasImageViewer, () => div({ class: 'presentation-image-viewer', role: 'dialog', 'aria-modal': true, 'aria-label': i18n.t('ui.presentation.imageViewer'), tabIndex: -1 }, [
          div({ class: 'presentation-image-viewer__toolbar' }, [
            span({ class: 'presentation-image-viewer__title' }, i18n.t('ui.presentation.imageViewer')),
            div({ class: 'presentation-image-viewer__actions' }, [
              button('zoomOutImage', { type: 'button', class: 'presentation-image-viewer__control', 'data-image-viewer-action': 'zoom-out', 'aria-label': i18n.t('ui.presentation.zoomOut'), title: i18n.t('ui.presentation.zoomOut') }, '−'),
              span({ class: 'presentation-image-viewer__zoom-value', 'aria-live': 'polite' }, '100%'),
              button('zoomInImage', { type: 'button', class: 'presentation-image-viewer__control', 'data-image-viewer-action': 'zoom-in', 'aria-label': i18n.t('ui.presentation.zoomIn'), title: i18n.t('ui.presentation.zoomIn') }, '+'),
              button('resetImageZoom', { type: 'button', class: 'presentation-image-viewer__control presentation-image-viewer__control--reset', 'data-image-viewer-action': 'reset', 'aria-label': i18n.t('ui.presentation.resetZoom'), title: i18n.t('ui.presentation.resetZoom') }, '↺'),
              button('closeImageViewer', { type: 'button', class: 'presentation-image-viewer__control presentation-image-viewer__control--close', 'aria-label': i18n.t('ui.presentation.closeImageViewer'), title: i18n.t('ui.presentation.closeImageViewer'), click: closeImageViewer }, '×'),
            ]),
          ]),
          div({ class: 'presentation-image-viewer__viewport' }, [
            // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
            img({ class: 'presentation-image-viewer__image', src: function* () { return (yield* imageViewer())?.url ?? ''; }, alt: function* () { return (yield* imageViewer())?.alt ?? ''; }, draggable: false }),
          ]),
          p({ class: 'presentation-image-viewer__hint' }, i18n.t('ui.presentation.imageZoomHint')),
        ]).pipe(imageViewerInteraction)),
        ifNode(showNotes, () => section({ class: 'presentation-notes' }, [
          div({ class: 'presentation-notes__header' }, [
            span({ class: 'studio-panel__label' }, i18n.t('ui.presentation.speakerNotes')),
            button('dragSpeakerNotes', { type: 'button', class: 'presentation-notes__drag-handle', 'data-drag-surface': 'notes', 'aria-label': i18n.t('ui.presentation.moveNotes'), title: i18n.t('ui.presentation.moveNotes') }, '↕').pipe(dragPresentationSurface),
          ]),
          div({ class: 'presentation-notes__body' }, [
            forNode(noteParts, { track: (part) => part.id }, (notePartInput) => matchNode.exhaustive(notePartInput, 'kind', {
              link: (part) => a('speakerNoteLink', { 'aria-label': part.text, href: safeUrl(part.url), 'data-navigation': 'external', click: function* (event) { event.preventDefault(); yield* openPresentationLink(part.url); } }, part.text),
              text: (part) => span(part.text),
            })),
          ]),
        ])),
      ]).pipe(focusPresentationStage),
  );
}

export const PresentationPage = createPresentationPage('PresentationPage', false);
export const PresenterPage = createPresentationPage('PresenterPage', true);
