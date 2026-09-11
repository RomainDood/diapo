/* eslint-disable craft-ts/require-effect-adapters, craft-ts/no-imperative-craft-method-actions, craft-ts/no-ephemeral-template-form-state, craft-ts/require-primitive-derived-property -- The browser file directive triggers the async upload process; the editor projects keyed section/sequence inputs. */
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
  Console,
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
import { listDemoWorkspaceConfigs, loadPresentation, saveDemoWorkspaceConfig as saveDemoWorkspaceConfigRequest, savePresentation, uploadPresentationImage } from '../../api';
import {
  PRESENTATION_CODE_LANGUAGES,
  PRESENTATION_IMAGE_ALLOWED_ORIGINS,
  PRESENTATION_IMAGE_MAX_BYTES,
  PRESENTATION_IMAGE_MIME_TYPES,
  PRESENTATION_VIDEO_MIME_TYPES,
  PRESENTATION_INTENTIONS,
  PRESENTATION_TRANSITIONS,
  PRESENTATION_BACKGROUND_TYPES,
  PRESENTATION_THEMES,
  PRESENTATION_THEME_GRADIENTS,
  PRESENTATION_DECORATIONS,
  PRESENTATION_DECORATION_DEFAULT_COLOR,
  formatPresentationAsMarkdown,
  formatPresentationForYouTube,
  parsePresentationMarkdown,
  presentationExportFilename,
} from '../../../shared/presentation';
import type {
  PresentationDocument,
  PresentationImageMimeType,
  PresentationMediaMimeType,
  PresentationImageUploadInput,
  PresentationCodeLanguage,
  PresentationIntention,
  PresentationLayout,
  PresentationSequence,
  PresentationSection,
  PresentationStoreInput,
  PresentationTransition,
  PresentationExportFormat,
  PresentationBackgroundType,
  PresentationThemeId,
  PresentationDecoration,
  PresentationDemoWorkspaceId,
  PresentationDemoWorkspaceConfig,
} from '../../../shared/presentation';
import { eventValue } from '../../event-value';

const EMPTY_DOCUMENT: PresentationDocument = {
  id: '',
  layout: 'desktop',
  demoWorkspaceId: 'none',
  backgroundType: 'theme',
  backgroundTheme: 'aurora',
  backgroundUrl: '',
  backgroundGradientStart: PRESENTATION_THEME_GRADIENTS.aurora.start,
  backgroundGradientMiddle: PRESENTATION_THEME_GRADIENTS.aurora.middle,
  backgroundGradientEnd: PRESENTATION_THEME_GRADIENTS.aurora.end,
  backgroundGradientAngle: PRESENTATION_THEME_GRADIENTS.aurora.angle,
  backgroundDecoration: 'orb',
  backgroundDecorationColor: PRESENTATION_DECORATION_DEFAULT_COLOR,
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
  | { readonly kind: 'background' }
  | { readonly kind: 'sequence'; readonly sectionId: string; readonly sequenceId: string };

type ImageReadyDetail = { readonly file: File; readonly dataUrl: string };
type ImageUploadProcessParams = {
  readonly presentationId: string;
  readonly payload: PresentationImageUploadInput;
  readonly target: ImageTarget;
};

type PresentationAuthoringMode = 'visual' | 'markdown';

function applyUploadedImage(document: PresentationDocument, target: ImageTarget, imageUrl: string): PresentationDocument {
  return target.kind === 'cover'
    ? { ...document, coverImageUrl: imageUrl }
    : target.kind === 'background'
      ? { ...document, backgroundUrl: imageUrl }
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

function backgroundTypeLabel(value: PresentationBackgroundType): string {
  if (value === 'image') return i18n.t('ui.editor.backgroundType.image');
  if (value === 'video') return i18n.t('ui.editor.backgroundType.video');
  return i18n.t('ui.editor.backgroundType.theme');
}

function themeLabel(value: PresentationThemeId): string {
  if (value === 'sunset') return i18n.t('ui.editor.theme.sunset');
  if (value === 'ocean') return i18n.t('ui.editor.theme.ocean');
  if (value === 'forest') return i18n.t('ui.editor.theme.forest');
  if (value === 'paper') return i18n.t('ui.editor.theme.paper');
  if (value === 'custom') return i18n.t('ui.editor.theme.custom');
  return i18n.t('ui.editor.theme.aurora');
}

function decorationLabel(value: PresentationDecoration): string {
  if (value === 'rings') return i18n.t('ui.editor.decoration.rings');
  if (value === 'particles') return i18n.t('ui.editor.decoration.particles');
  if (value === 'grid') return i18n.t('ui.editor.decoration.grid');
  if (value === 'none') return i18n.t('ui.editor.decoration.none');
  return i18n.t('ui.editor.decoration.orb');
}

function demoWorkspaceOrNone(value: PresentationDemoWorkspaceId | undefined): PresentationDemoWorkspaceId {
  return value ?? 'none';
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

const downloadPresentationExport = craftNodeDirective(
  'downloadPresentationExport',
  [],
  ({ element }) => {
    const buttonElement = element as HTMLButtonElement;
    const download = () => {
      const document = buttonElement.ownerDocument;
      const url = document.defaultView?.URL.createObjectURL(new Blob([buttonElement.dataset.exportContent ?? ''], { type: 'text/plain;charset=utf-8' }));
      if (!url) return;
      const link = document.createElement('a');
      link.href = url;
      link.download = buttonElement.dataset.exportFilename ?? 'presentation.txt';
      link.click();
      document.defaultView?.setTimeout(() => document.defaultView?.URL.revokeObjectURL(url), 0);
    };
    buttonElement.addEventListener('click', download);
    return () => buttonElement.removeEventListener('click', download);
  },
);

function toStoreInput(document: PresentationDocument): PresentationStoreInput {
  return {
    layout: document.layout,
    demoWorkspaceId: document.demoWorkspaceId,
    backgroundType: document.backgroundType,
    backgroundTheme: document.backgroundTheme,
    backgroundUrl: document.backgroundUrl,
    backgroundGradientStart: document.backgroundGradientStart,
    backgroundGradientMiddle: document.backgroundGradientMiddle,
    backgroundGradientEnd: document.backgroundGradientEnd,
    backgroundGradientAngle: document.backgroundGradientAngle,
    backgroundDecoration: document.backgroundDecoration,
    backgroundDecorationColor: document.backgroundDecorationColor,
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
    const exportFormat = yield* state('exportFormat', 'markdown' as PresentationExportFormat, ({ set }) => ({
      setFormat: (value: PresentationExportFormat) => set(value),
    }));
    const authoringMode = yield* state('authoringMode', 'visual' as PresentationAuthoringMode, ({ set }) => ({
      setMode: (value: PresentationAuthoringMode) => set(value),
    }));
    const markdownSource = yield* state('markdownSource', undefined as string | undefined, ({ set }) => ({
      replace: (value: string) => set(value),
    }));
    const markdownErrors = yield* state('markdownErrors', [] as readonly string[], ({ set }) => ({
      replace: (value: readonly string[]) => set(value),
    }));
    const newDemoWorkspaceId = yield* state('newDemoWorkspaceId', '', ({ set }) => ({ setValue: (value: string) => set(value) }));
    const newDemoWorkspaceTitle = yield* state('newDemoWorkspaceTitle', '', ({ set }) => ({ setValue: (value: string) => set(value) }));
    const newDemoWorkspaceDirectory = yield* state('newDemoWorkspaceDirectory', '', ({ set }) => ({ setValue: (value: string) => set(value) }));
    const newDemoWorkspaceCommand = yield* state('newDemoWorkspaceCommand', 'npm start', ({ set }) => ({ setValue: (value: string) => set(value) }));
    const newDemoWorkspacePort = yield* state('newDemoWorkspacePort', '4300', ({ set }) => ({ setValue: (value: string) => set(value) }));
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
    const saveDemoWorkspaceConfig = yield* mutation('saveDemoWorkspaceConfig', {
      method: (config: PresentationDemoWorkspaceConfig) => config,
      loader: function* ({ params }) {
        return yield* saveDemoWorkspaceConfigRequest(params);
      },
    });
    const demoWorkspaceConfigs = yield* query('demoWorkspaceConfigs', {
      params: () => 'local',
      loader: function* () {
        return yield* listDemoWorkspaceConfigs();
      },
    }, insertReactOnMutation(saveDemoWorkspaceConfig, { reload: { onMutationResolved: true } }));
    const demoWorkspaceConfigList = craftComputed('demoWorkspaceConfigList', function* () {
      return (yield* demoWorkspaceConfigs.value()) ?? [];
    });
    const imageUpload = yield* asyncProcess('uploadPresentationImage', {
      method: (input: ImageUploadProcessParams) => input,
      loader: function* ({ params }) {
        const uploaded = yield* uploadPresentationImage(params.presentationId, params.payload);
        yield* Console.info('Presentation image upload succeeded', {
          filename: params.payload.filename,
          mimeType: params.payload.mimeType,
          dataUrlLength: params.payload.dataUrl.length,
          target: params.target.kind,
          url: uploaded.url,
        });
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
    const markdownValue = craftComputed('markdownValue', function* () {
      return (yield* markdownSource()) ?? formatPresentationAsMarkdown(yield* currentDocument());
    });
    const isMarkdownMode = craftComputed('isMarkdownMode', function* () {
      return (yield* authoringMode()) === 'markdown';
    });
    const isVisualMode = craftComputed('isVisualMode', function* () {
      return (yield* authoringMode()) === 'visual';
    });
    const hasMarkdownErrors = craftComputed('hasMarkdownErrors', function* () {
      return (yield* markdownErrors()).length > 0;
    });
    const isMarkdownValid = craftComputed('isMarkdownValid', function* () {
      return !(yield* hasMarkdownErrors());
    });
    const markdownErrorMessage = craftComputed('markdownErrorMessage', function* () {
      return (yield* markdownErrors())[0] ?? '';
    });
    const exportContent = craftComputed('exportContent', function* () {
      const document = yield* currentDocument();
      return (yield* exportFormat()) === 'markdown'
        ? formatPresentationAsMarkdown(document)
        : formatPresentationForYouTube(document);
    });
    const exportFilename = craftComputed('exportFilename', function* () {
      const document = yield* currentDocument();
      return presentationExportFilename(document.title, yield* exportFormat());
    });
    const hasDocument = craftComputed('hasDocument', function* () {
      return (yield* draft()) !== undefined || (yield* presentation.value()) !== undefined;
    });
    const hasCoverImage = craftComputed('hasCoverImage', function* () {
      return Boolean((yield* currentDocument()).coverImageUrl);
    });
    const hasBackgroundMedia = craftComputed('hasBackgroundMedia', function* () {
      return Boolean((yield* currentDocument()).backgroundUrl);
    });
    const isThemeBackground = craftComputed('isThemeBackground', function* () {
      return (yield* currentDocument()).backgroundType === 'theme';
    });
    const isMediaBackground = craftComputed('isMediaBackground', function* () {
      return (yield* currentDocument()).backgroundType !== 'theme';
    });
    const isImageBackground = craftComputed('isImageBackground', function* () {
      return (yield* currentDocument()).backgroundType === 'image';
    });
    const isVideoBackground = craftComputed('isVideoBackground', function* () {
      return (yield* currentDocument()).backgroundType === 'video';
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
    const startMarkdownMode = craftMethod('startMarkdownMode', function* () {
      yield* markdownSource.replace(formatPresentationAsMarkdown(yield* currentDocument()));
      yield* markdownErrors.replace([]);
      yield* authoringMode.setMode('markdown');
    });
    const startVisualMode = craftMethod('startVisualMode', function* () {
      yield* authoringMode.setMode('visual');
    });
    const updateMarkdown = craftMethod('updateMarkdown', function* (markdown: string) {
      const parsed = parsePresentationMarkdown(markdown, yield* currentDocument());
      yield* markdownSource.replace(markdown);
      yield* markdownErrors.replace(parsed.errors);
      if (!parsed.document) return;
      yield* draft.replace(parsed.document);
      draftChanges.set(toStoreInput(parsed.document));
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
    const updateDemoWorkspace = craftMethod('updateDemoWorkspace', function* (demoWorkspaceId: PresentationDemoWorkspaceId) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, demoWorkspaceId };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const saveLocalDemoWorkspace = craftMethod('saveLocalDemoWorkspace', function* () {
      const config: PresentationDemoWorkspaceConfig = {
        id: (yield* newDemoWorkspaceId()).trim(),
        title: (yield* newDemoWorkspaceTitle()).trim(),
        directory: (yield* newDemoWorkspaceDirectory()).trim(),
        command: (yield* newDemoWorkspaceCommand()).trim(),
        port: Number.parseInt((yield* newDemoWorkspacePort()).trim(), 10),
      };
      if (!config.id || !config.title || !config.directory || !config.command || !Number.isInteger(config.port)) return;
      yield* saveDemoWorkspaceConfig.mutate(config);
      yield* demoWorkspaceConfigs.resource.reload();
      const document = yield* currentDocument();
      const nextDocument = { ...document, demoWorkspaceId: config.id };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundType = craftMethod('updateBackgroundType', function* (backgroundType: PresentationBackgroundType) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundType };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundTheme = craftMethod('updateBackgroundTheme', function* (backgroundTheme: PresentationThemeId) {
      const document = yield* currentDocument();
      if (backgroundTheme === 'custom') {
        const nextDocument = { ...document, backgroundTheme };
        yield* draft.replace(nextDocument);
        draftChanges.set(toStoreInput(nextDocument));
        return;
      }
      const gradient = PRESENTATION_THEME_GRADIENTS[backgroundTheme];
      const nextDocument = { ...document, backgroundTheme, backgroundGradientStart: gradient.start, backgroundGradientMiddle: gradient.middle, backgroundGradientEnd: gradient.end, backgroundGradientAngle: gradient.angle };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundGradientStart = craftMethod('updateBackgroundGradientStart', function* (backgroundGradientStart: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundTheme: 'custom' as const, backgroundGradientStart };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundGradientMiddle = craftMethod('updateBackgroundGradientMiddle', function* (backgroundGradientMiddle: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundTheme: 'custom' as const, backgroundGradientMiddle };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundGradientEnd = craftMethod('updateBackgroundGradientEnd', function* (backgroundGradientEnd: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundTheme: 'custom' as const, backgroundGradientEnd };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundGradientAngle = craftMethod('updateBackgroundGradientAngle', function* (backgroundGradientAngle: number) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundTheme: 'custom' as const, backgroundGradientAngle };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundUrl = craftMethod('updateBackgroundUrl', function* (backgroundUrl: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundUrl };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundDecoration = craftMethod('updateBackgroundDecoration', function* (backgroundDecoration: PresentationDecoration) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundDecoration };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const updateBackgroundDecorationColor = craftMethod('updateBackgroundDecorationColor', function* (backgroundDecorationColor: string) {
      const document = yield* currentDocument();
      const nextDocument = { ...document, backgroundDecorationColor };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const clearImage = craftMethod('clearImage', function* (target: ImageTarget) {
      const document = yield* currentDocument();
      const nextDocument: PresentationDocument = target.kind === 'cover'
        ? { ...document, coverImageUrl: '', coverImageAlt: '' }
        : target.kind === 'background'
          ? { ...document, backgroundUrl: '' }
          : {
            ...document,
            sections: document.sections.map((section) => section.id === target.sectionId
              ? {
                ...section,
                sequences: section.sequences.map((sequence) => sequence.id === target.sequenceId
                  ? { ...sequence, imageUrl: '', imageAlt: '' }
                  : sequence),
              }
              : section),
          };
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
    const moveSequence = craftMethod('moveSequence', function* (sectionId: string, sequenceId: string, direction: 'up' | 'down') {
      const document = yield* currentDocument();
      const sections = document.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const fromIndex = section.sequences.findIndex((sequence) => sequence.id === sequenceId);
        const toIndex = fromIndex + (direction === 'up' ? -1 : 1);
        if (fromIndex < 0 || toIndex < 0 || toIndex >= section.sequences.length) return section;
        const sequences = [...section.sequences];
        const [sequence] = sequences.splice(fromIndex, 1);
        if (!sequence) return section;
        sequences.splice(toIndex, 0, sequence);
        return { ...section, sequences };
      });
      if (sections.every((section, index) => section === document.sections[index])) return;
      const nextDocument: PresentationDocument = { ...document, sections };
      yield* draft.replace(nextDocument);
      draftChanges.set(toStoreInput(nextDocument));
    });
    const handleImageFile = craftMethod('handleImageFile', function* (image: ImageReadyDetail, target: ImageTarget) {
      const { file, dataUrl } = image;
      if (!file) return;
      yield* imageUploadNotice.setNotice('');
      yield* imageUploadError.clear();
      const isVideoBackgroundUpload = target.kind === 'background' && (yield* currentDocument()).backgroundType === 'video';
      const isSupportedUpload = isVideoBackgroundUpload
        ? PRESENTATION_VIDEO_MIME_TYPES.includes(file.type as (typeof PRESENTATION_VIDEO_MIME_TYPES)[number])
        : PRESENTATION_IMAGE_MIME_TYPES.includes(file.type as PresentationImageMimeType);
      if (!isSupportedUpload) {
        yield* imageUploadError.setError(isVideoBackgroundUpload ? i18n.t('ui.editor.videoUploadTypeError') : i18n.t('ui.editor.imageUploadTypeError'));
        return;
      }
      if (file.size > PRESENTATION_IMAGE_MAX_BYTES) {
        yield* imageUploadError.setError(i18n.t('ui.editor.imageUploadSizeError'));
        return;
      }

      yield* Console.info('Presentation image upload started', {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        target: target.kind,
      });
      yield* imageUpload.method({
        presentationId: yield* presentationId(),
        payload: {
          filename: file.name,
          mimeType: file.type as PresentationMediaMimeType,
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
      demoWorkspaceConfigs,
      demoWorkspaceConfigList,
      currentDocument,
      exportFormat,
      authoringMode,
      markdownValue,
      isMarkdownMode,
      isVisualMode,
      hasMarkdownErrors,
      isMarkdownValid,
      markdownErrorMessage,
      exportContent,
      exportFilename,
      hasDocument,
      hasCoverImage,
      hasBackgroundMedia,
      isThemeBackground,
      isMediaBackground,
      isImageBackground,
      isVideoBackground,
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
      startMarkdownMode,
      startVisualMode,
      updateMarkdown,
      updateAudience,
      updateObjective,
      updateCoverImageAlt,
      updateLayout,
      updateDemoWorkspace,
      newDemoWorkspaceId,
      newDemoWorkspaceTitle,
      newDemoWorkspaceDirectory,
      newDemoWorkspaceCommand,
      newDemoWorkspacePort,
      saveLocalDemoWorkspace,
      updateBackgroundType,
      updateBackgroundTheme,
      updateBackgroundGradientStart,
      updateBackgroundGradientMiddle,
      updateBackgroundGradientEnd,
      updateBackgroundGradientAngle,
      updateBackgroundUrl,
      updateBackgroundDecoration,
      updateBackgroundDecorationColor,
      clearImage,
      updateSection,
      updateSequence,
      collapsedSectionIds,
      sectionViews,
      toggleSection,
      moveSection,
      moveSequence,
      handleImageFile,
      addSection,
      addSequence,
      deleteSequence,
      save,
      saveChanges,
      presentationId,
    };
  },
  ({ presentation, currentDocument, demoWorkspaceConfigList, hasDocument, exportFormat, markdownValue, isMarkdownMode, isVisualMode, hasMarkdownErrors, isMarkdownValid, markdownErrorMessage, exportContent, exportFilename, hasCoverImage, hasBackgroundMedia, isThemeBackground, isMediaBackground, isImageBackground, isVideoBackground, coverImageAlt, imageUploading, imageUploadFailed, imageUploadErrorMessage, imageUploadNotice, hasImageUploadNotice, isAutosaving, autosaveStatus, startMarkdownMode, startVisualMode, updateMarkdown, updateTitle, updateAudience, updateObjective, updateCoverImageAlt, updateLayout, updateDemoWorkspace, newDemoWorkspaceId, newDemoWorkspaceTitle, newDemoWorkspaceDirectory, newDemoWorkspaceCommand, newDemoWorkspacePort, saveLocalDemoWorkspace, updateBackgroundType, updateBackgroundTheme, updateBackgroundGradientStart, updateBackgroundGradientMiddle, updateBackgroundGradientEnd, updateBackgroundGradientAngle, updateBackgroundUrl, updateBackgroundDecoration, updateBackgroundDecorationColor, clearImage, updateSection, updateSequence, sectionViews, toggleSection, moveSection, moveSequence, handleImageFile, addSection, addSequence, deleteSequence, saveChanges, presentationId }) =>
    div({ class: 'editor-shell' }, [
      div({ class: 'editor-toolbar' }, [
          a('backToDashboard', { class: 'studio-link', 'aria-label': i18n.t('ui.editor.backToDashboard'), 'data-navigation': 'external', href: '/feature' }, i18n.t('ui.editor.backToDashboard')),
        ifNode(hasDocument, () => div({ class: 'editor-authoring-toggle', role: 'group', 'aria-label': i18n.t('ui.editor.authoringModeLabel') }, [
          button('editorVisualMode', { type: 'button', class: 'editor-authoring-toggle__button', 'data-active': function* () { return String(yield* isVisualMode()); }, 'aria-pressed': function* () { return String(yield* isVisualMode()); }, 'aria-label': i18n.t('ui.editor.visualMode'), click: startVisualMode }, i18n.t('ui.editor.visualMode')),
          button('editorMarkdownMode', { type: 'button', class: 'editor-authoring-toggle__button', 'data-active': function* () { return String(yield* isMarkdownMode()); }, 'aria-pressed': function* () { return String(yield* isMarkdownMode()); }, 'aria-label': i18n.t('ui.editor.markdownMode'), click: startMarkdownMode }, i18n.t('ui.editor.markdownMode')),
        ])),
        div({ class: 'studio-toolbar' }, [
          ifNode(hasDocument, () => span({ class: 'editor-autosave-status' }, autosaveStatus)),
          ifNode(hasDocument, () => button('savePresentation', { type: 'button', class: 'studio-button', 'aria-label': i18n.t('ui.editor.save'), disabled: isAutosaving, click: saveChanges }, i18n.t('ui.editor.save'))),
          ifNode(hasDocument, () => div({ class: 'editor-export-controls' }, [
            select('presentationExportFormat', { 'aria-label': i18n.t('ui.editor.exportFormatLabel'), class: 'editor-export-select', value: exportFormat, *change(event) { yield* exportFormat.setFormat(eventValue(event) as PresentationExportFormat); } }, [
              option({ value: 'markdown' }, i18n.t('ui.editor.exportMarkdown')),
              option({ value: 'youtube' }, i18n.t('ui.editor.exportYouTube')),
            ]),
            button('exportPresentation', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.export'), 'data-export-content': exportContent, 'data-export-filename': exportFilename }, i18n.t('ui.editor.export')).pipe(downloadPresentationExport),
          ])),
          ifNode(hasDocument, () => a('editorPresentPresentation', { class: 'studio-button studio-button--primary', 'aria-label': i18n.t('ui.editor.present'), 'data-navigation': 'external', href: function* () { return `/present/${yield* presentationId()}`; }, click: saveChanges }, i18n.t('ui.editor.present'))),
        ]),
      ]),
      ifNode(presentation.isLoading, () => p({ class: 'studio-status' }, i18n.t('ui.editor.loading'))),
      ifNode(presentation.hasException, () => p({ class: 'studio-status', 'data-tone': 'danger' }, i18n.t('ui.editor.error'))),
      ifNode(hasDocument, () => [
      ifNode(isMarkdownMode, () => section({ class: 'editor-markdown-card' }, [
        div({ class: 'editor-markdown-card__header' }, [
          div([
            span({ class: 'studio-panel__label' }, i18n.t('ui.editor.markdownLabel')),
            heading({ 'aria-label': i18n.t('ui.editor.markdownTitle') }, i18n.t('ui.editor.markdownTitle')),
          ]),
          button('editorMarkdownVisualMode', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.visualMode'), click: startVisualMode }, i18n.t('ui.editor.visualMode')),
        ]),
        div({ class: 'editor-markdown-card__grid' }, [
          div({ class: 'editor-markdown-help' }, [
            p({ class: 'editor-markdown-help__intro' }, i18n.t('ui.editor.markdownDescription')),
            p({ class: 'editor-markdown-help__rule' }, i18n.t('ui.editor.markdownRuleSlides')),
            p({ class: 'editor-markdown-help__rule' }, i18n.t('ui.editor.markdownRuleSections')),
            p({ class: 'editor-markdown-help__rule' }, i18n.t('ui.editor.markdownRuleCode')),
            p({ class: 'editor-markdown-help__rule' }, i18n.t('ui.editor.markdownRuleNotes')),
            p({ class: 'editor-markdown-help__rule' }, i18n.t('ui.editor.markdownRuleDemo')),
          ]),
          textarea('presentationMarkdown', { 'aria-label': i18n.t('ui.editor.markdownTitle'), class: 'editor-markdown-input', spellcheck: false, value: markdownValue, *input(event) { yield* updateMarkdown(eventValue(event)); } }),
        ]),
        ifNode(hasMarkdownErrors, () => p({ class: 'studio-status', 'data-tone': 'danger' }, markdownErrorMessage)),
        ifNode(isMarkdownValid, () => p({ class: 'studio-status editor-markdown-valid' }, i18n.t('ui.editor.markdownValid'))),
      ])),
      ifNode(isVisualMode, () => [
      section({ class: 'editor-header-card' }, [
        span({ class: 'studio-eyebrow' }, i18n.t('ui.editor.eyebrow')),
        input('presentationTitle', { type: 'text', 'aria-label': i18n.t('ui.editor.titleLabel'), class: 'editor-title-input', value: function* () { return (yield* currentDocument()).title; }, *input(event) { yield* updateTitle(eventValue(event)); } }),
        select('presentationLayout', { 'aria-label': i18n.t('ui.editor.layoutLabel'), class: 'editor-layout-select', value: function* () { return (yield* currentDocument()).layout; }, *change(event) { yield* updateLayout(eventValue(event) as PresentationLayout); } }, [
          option({ value: 'desktop' }, i18n.t('ui.editor.layoutDesktop')),
          option({ value: 'vertical' }, i18n.t('ui.editor.layoutVertical')),
        ]),
        select('presentationDemoWorkspace', { 'aria-label': i18n.t('ui.editor.demoWorkspaceLabel'), class: 'editor-layout-select', value: function* () { return (yield* currentDocument()).demoWorkspaceId; }, *change(event) { yield* updateDemoWorkspace(eventValue(event) as PresentationDemoWorkspaceId); } }, [
          option({ value: 'none' }, i18n.t('ui.editor.demoWorkspaceNone')),
          forNode(demoWorkspaceConfigList, { track: (config) => config.id }, (configInput) => option({ value: function* () { return (yield* configInput()).id; } }, function* () { return (yield* configInput()).title; })),
        ]),
        div({ class: 'editor-demo-workspace-settings' }, [
          span({ class: 'studio-panel__label' }, i18n.t('ui.editor.demoWorkspaceAddLabel')),
          input('newDemoWorkspaceId', { type: 'text', 'aria-label': i18n.t('ui.editor.demoWorkspaceIdLabel'), placeholder: i18n.t('ui.editor.demoWorkspaceIdPlaceholder'), value: newDemoWorkspaceId, *input(event) { yield* newDemoWorkspaceId.setValue(eventValue(event)); } }),
          input('newDemoWorkspaceTitle', { type: 'text', 'aria-label': i18n.t('ui.editor.demoWorkspaceTitleLabel'), placeholder: i18n.t('ui.editor.demoWorkspaceTitlePlaceholder'), value: newDemoWorkspaceTitle, *input(event) { yield* newDemoWorkspaceTitle.setValue(eventValue(event)); } }),
          input('newDemoWorkspaceDirectory', { type: 'text', 'aria-label': i18n.t('ui.editor.demoWorkspaceDirectoryLabel'), placeholder: i18n.t('ui.editor.demoWorkspaceDirectoryPlaceholder'), value: newDemoWorkspaceDirectory, *input(event) { yield* newDemoWorkspaceDirectory.setValue(eventValue(event)); } }),
          input('newDemoWorkspaceCommand', { type: 'text', 'aria-label': i18n.t('ui.editor.demoWorkspaceCommandLabel'), placeholder: i18n.t('ui.editor.demoWorkspaceCommandPlaceholder'), value: newDemoWorkspaceCommand, *input(event) { yield* newDemoWorkspaceCommand.setValue(eventValue(event)); } }),
          input('newDemoWorkspacePort', { type: 'number', 'aria-label': i18n.t('ui.editor.demoWorkspacePortLabel'), placeholder: i18n.t('ui.editor.demoWorkspacePortPlaceholder'), value: newDemoWorkspacePort, *input(event) { yield* newDemoWorkspacePort.setValue(eventValue(event)); } }),
          button('saveLocalDemoWorkspace', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.demoWorkspaceAdd'), click: saveLocalDemoWorkspace }, i18n.t('ui.editor.demoWorkspaceAdd')),
        ]),
        div({ class: 'editor-background-settings' }, [
          div({ class: 'editor-background-settings__header' }, [
            span({ class: 'studio-panel__label' }, i18n.t('ui.editor.backgroundLabel')),
            span({ class: 'editor-background-settings__hint' }, i18n.t('ui.editor.backgroundHint')),
          ]),
          select('presentationBackgroundType', { 'aria-label': i18n.t('ui.editor.backgroundTypeLabel'), class: 'editor-layout-select', value: function* () { return (yield* currentDocument()).backgroundType; }, *change(event) { yield* updateBackgroundType(eventValue(event) as PresentationBackgroundType); } }, PRESENTATION_BACKGROUND_TYPES.map((backgroundType) => option({ value: backgroundType }, backgroundTypeLabel(backgroundType)))),
          ifNode(isThemeBackground, () => div({ class: 'editor-theme-picker', role: 'list', 'aria-label': i18n.t('ui.editor.themePickerLabel') }, PRESENTATION_THEMES.map((themeId) => button('presentationTheme', { type: 'button', class: 'editor-theme-option', 'data-theme': themeId, 'data-active': function* () { return String((yield* currentDocument()).backgroundTheme === themeId); }, 'aria-label': themeLabel(themeId), title: themeLabel(themeId), click: function* () { yield* updateBackgroundTheme(themeId); } }, [
            span({ class: 'editor-theme-option__swatch', 'aria-hidden': true }),
            span({ class: 'editor-theme-option__name' }, themeLabel(themeId)),
          ])))),
          ifNode(isThemeBackground, () => div({ class: 'editor-gradient-editor' }, [
            div({ class: 'editor-gradient-editor__header' }, [
              span({ class: 'editor-gradient-editor__title' }, i18n.t('ui.editor.gradientLabel')),
              span({ class: 'editor-background-settings__hint' }, i18n.t('ui.editor.gradientHint')),
            ]),
            div({ class: 'editor-gradient-editor__colors' }, [
              label({ class: 'editor-gradient-editor__field' }, [
                span({}, i18n.t('ui.editor.gradientStartLabel')),
                input('presentationBackgroundGradientStart', { type: 'color', 'aria-label': i18n.t('ui.editor.gradientStartLabel'), value: function* () { return (yield* currentDocument()).backgroundGradientStart; }, *input(event) { yield* updateBackgroundGradientStart(eventValue(event)); } }),
              ]),
              label({ class: 'editor-gradient-editor__field' }, [
                span({}, i18n.t('ui.editor.gradientMiddleLabel')),
                input('presentationBackgroundGradientMiddle', { type: 'color', 'aria-label': i18n.t('ui.editor.gradientMiddleLabel'), value: function* () { return (yield* currentDocument()).backgroundGradientMiddle; }, *input(event) { yield* updateBackgroundGradientMiddle(eventValue(event)); } }),
              ]),
              label({ class: 'editor-gradient-editor__field' }, [
                span({}, i18n.t('ui.editor.gradientEndLabel')),
                input('presentationBackgroundGradientEnd', { type: 'color', 'aria-label': i18n.t('ui.editor.gradientEndLabel'), value: function* () { return (yield* currentDocument()).backgroundGradientEnd; }, *input(event) { yield* updateBackgroundGradientEnd(eventValue(event)); } }),
              ]),
              label({ class: 'editor-gradient-editor__field editor-gradient-editor__angle' }, [
                span({ class: 'editor-gradient-editor__angle-label' }, [
                  span({}, i18n.t('ui.editor.gradientAngleLabel')),
                  span({}, function* () { return `${(yield* currentDocument()).backgroundGradientAngle}°`; }),
                ]),
                input('presentationBackgroundGradientAngle', { type: 'range', min: '0', max: '360', step: '1', 'aria-label': i18n.t('ui.editor.gradientAngleLabel'), value: function* () { return String((yield* currentDocument()).backgroundGradientAngle); }, *input(event) { yield* updateBackgroundGradientAngle(Number(eventValue(event))); } }),
              ]),
            ]),
          ])),
          ifNode(isMediaBackground, () => [
            ifNode(isImageBackground, () => label({ class: 'editor-image-dropzone editor-background-upload', 'aria-label': i18n.t('ui.editor.backgroundImageDropzone'), onImageReady: function* (event: Event) { yield* handleImageFile((event as CustomEvent<ImageReadyDetail>).detail, { kind: 'background' }); } }, [
              span({ class: 'editor-image-dropzone__title' }, i18n.t('ui.editor.backgroundImageDropzoneTitle')),
              span({ class: 'editor-image-dropzone__hint' }, i18n.t('ui.editor.imageDropzoneHint')),
              input('presentationBackgroundImageFile', { type: 'file', accept: PRESENTATION_IMAGE_MIME_TYPES.join(','), class: 'editor-image-file-input', 'aria-label': i18n.t('ui.editor.backgroundImageDropzone') }),
            ]).pipe(readPresentationImageFile)),
            ifNode(isVideoBackground, () => label({ class: 'editor-image-dropzone editor-background-upload', 'aria-label': i18n.t('ui.editor.backgroundVideoDropzone'), onImageReady: function* (event: Event) { yield* handleImageFile((event as CustomEvent<ImageReadyDetail>).detail, { kind: 'background' }); } }, [
              span({ class: 'editor-image-dropzone__title' }, i18n.t('ui.editor.backgroundVideoDropzoneTitle')),
              span({ class: 'editor-image-dropzone__hint' }, i18n.t('ui.editor.videoDropzoneHint')),
              input('presentationBackgroundVideoFile', { type: 'file', accept: PRESENTATION_VIDEO_MIME_TYPES.join(','), class: 'editor-image-file-input', 'aria-label': i18n.t('ui.editor.backgroundVideoDropzone') }),
            ]).pipe(readPresentationImageFile)),
            input('presentationBackgroundUrl', { type: 'url', 'aria-label': i18n.t('ui.editor.backgroundUrlLabel'), class: 'editor-background-url', placeholder: i18n.t('ui.editor.backgroundUrlPlaceholder'), value: function* () { return (yield* currentDocument()).backgroundUrl; }, *input(event) { yield* updateBackgroundUrl(eventValue(event)); } }),
            ifNode(hasBackgroundMedia, () => button('removeBackgroundMedia', { type: 'button', class: 'studio-button studio-button--subtle editor-media-remove', 'aria-label': i18n.t('ui.editor.removeBackgroundMedia'), click: function* () { yield* clearImage({ kind: 'background' }); } }, i18n.t('ui.editor.removeBackgroundMedia'))),
            p({ class: 'editor-background-settings__hint' }, i18n.t('ui.editor.backgroundMediaHint')),
          ]),
          div({ class: 'editor-background-decoration' }, [
            label({ class: 'editor-background-decoration__field' }, [
              span({ class: 'editor-background-decoration__label' }, i18n.t('ui.editor.backgroundDecorationLabel')),
              select('presentationBackgroundDecoration', { 'aria-label': i18n.t('ui.editor.backgroundDecorationLabel'), value: function* () { return (yield* currentDocument()).backgroundDecoration; }, *change(event) { yield* updateBackgroundDecoration(eventValue(event) as PresentationDecoration); } }, PRESENTATION_DECORATIONS.map((decoration) => option({ value: decoration }, decorationLabel(decoration)))),
            ]),
            label({ class: 'editor-background-decoration__field editor-background-decoration__color' }, [
              span({ class: 'editor-background-decoration__label' }, i18n.t('ui.editor.backgroundDecorationColorLabel')),
              input('presentationBackgroundDecorationColor', { type: 'color', 'aria-label': i18n.t('ui.editor.backgroundDecorationColorLabel'), value: function* () { return (yield* currentDocument()).backgroundDecorationColor; }, *input(event) { yield* updateBackgroundDecorationColor(eventValue(event)); } }),
            ]),
          ]),
          p({ class: 'editor-background-settings__hint' }, i18n.t('ui.editor.backgroundDecorationHint')),
        ]),
        input('presentationAudience', { type: 'text', 'aria-label': i18n.t('ui.editor.audiencePlaceholder'), class: 'editor-audience-input', placeholder: i18n.t('ui.editor.audiencePlaceholder'), value: function* () { return (yield* currentDocument()).audience; }, *input(event) { yield* updateAudience(eventValue(event)); } }),
        textarea('presentationObjective', { 'aria-label': i18n.t('ui.editor.objectivePlaceholder'), class: 'editor-objective-input', placeholder: i18n.t('ui.editor.objectivePlaceholder'), value: function* () { return (yield* currentDocument()).objective; }, *input(event) { yield* updateObjective(eventValue(event)); } }),
        input('presentationCoverImageAlt', { type: 'text', 'aria-label': i18n.t('ui.editor.coverImageAltLabel'), class: 'editor-cover-image-input', placeholder: i18n.t('ui.editor.coverImageAltPlaceholder'), value: function* () { return (yield* currentDocument()).coverImageAlt; }, *input(event) { yield* updateCoverImageAlt(eventValue(event)); } }),
        label({ class: 'editor-image-dropzone', 'aria-label': i18n.t('ui.editor.coverImageDropzone'), onImageReady: function* (event: Event) { yield* handleImageFile((event as CustomEvent<ImageReadyDetail>).detail, { kind: 'cover' }); } }, [
          span({ class: 'editor-image-dropzone__title' }, i18n.t('ui.editor.imageDropzoneTitle')),
          span({ class: 'editor-image-dropzone__hint' }, i18n.t('ui.editor.imageDropzoneHint')),
          input('presentationCoverImageFile', { type: 'file', accept: PRESENTATION_IMAGE_MIME_TYPES.join(','), class: 'editor-image-file-input', 'aria-label': i18n.t('ui.editor.coverImageDropzone') }),
        ]).pipe(readPresentationImageFile),
        ifNode(hasCoverImage, () => div({ class: 'editor-media-preview' }, [
          // eslint-disable-next-line craft-ts/no-raw-user-url, craft-ts/require-reactive-template-bindings -- safePresentationImageUrl validates and drops blocked origins.
          img({ class: 'editor-cover-image-preview', src: function* () { return safePresentationImageUrl((yield* currentDocument()).coverImageUrl); }, alt: coverImageAlt }),
          button('removeCoverImage', { type: 'button', class: 'studio-button studio-button--subtle editor-media-remove', 'aria-label': i18n.t('ui.editor.removeImage'), click: function* () { yield* clearImage({ kind: 'cover' }); } }, i18n.t('ui.editor.removeImage')),
        ])),
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
              select('sectionDemoWorkspace', { 'aria-label': i18n.t('ui.editor.demoWorkspaceSectionLabel'), class: 'editor-section-intention', value: function* () { return demoWorkspaceOrNone((yield* sectionViewInput()).section.demoWorkspaceId); }, *change(event) { const section = (yield* sectionViewInput()).section; yield* updateSection(section.id, { demoWorkspaceId: eventValue(event) }); } }, [
                option({ value: 'none' }, i18n.t('ui.editor.demoWorkspaceNone')),
                forNode(demoWorkspaceConfigList, { track: (config) => config.id }, (configInput) => option({ value: function* () { return (yield* configInput()).id; } }, function* () { return (yield* configInput()).title; })),
              ]),
              div({ class: 'editor-section-card__actions' }, [
                button('moveSectionUp', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.moveSectionUp'), disabled: function* () { return (yield* sectionViewInput()).canMoveUp === false; }, click: function* () { yield* moveSection((yield* sectionViewInput()).section.id, 'up'); } }, '↑'),
                button('moveSectionDown', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.moveSectionDown'), disabled: function* () { return (yield* sectionViewInput()).canMoveDown === false; }, click: function* () { yield* moveSection((yield* sectionViewInput()).section.id, 'down'); } }, '↓'),
              ]),
            ]),
            div({ class: 'editor-section-card__body', 'data-collapsed': function* () { return String((yield* sectionViewInput()).isCollapsed); } }, [
            forNode(function* () { return (yield* sectionViewInput()).section.sequences; }, { track: (sequence) => sequence.id }, (sequenceInput) => div({ class: 'editor-sequence-card' }, [
              input('sequenceTitle', { type: 'text', 'aria-label': i18n.t('ui.editor.sequenceTitleLabel'), class: 'editor-sequence-title', value: function* () { return (yield* sequenceInput()).title; }, *input(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { title: eventValue(event) }); } }),
              select('sequenceDemoWorkspace', { 'aria-label': i18n.t('ui.editor.demoWorkspaceSequenceLabel'), class: 'editor-code-language', value: function* () { return demoWorkspaceOrNone((yield* sequenceInput()).demoWorkspaceId); }, *change(event) { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* updateSequence(section.id, sequence.id, { demoWorkspaceId: eventValue(event) }); } }, [
                option({ value: 'none' }, i18n.t('ui.editor.demoWorkspaceNone')),
                forNode(demoWorkspaceConfigList, { track: (config) => config.id }, (configInput) => option({ value: function* () { return (yield* configInput()).id; } }, function* () { return (yield* configInput()).title; })),
              ]),
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
              div({ class: 'editor-media-preview', 'data-has-image': function* () { return String(Boolean((yield* sequenceInput()).imageUrl)); } }, [
                // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
                img({ class: 'editor-sequence-image', src: function* () { return safePresentationImageUrl((yield* sequenceInput()).imageUrl); }, alt: function* () { return (yield* sequenceInput()).imageAlt; } }),
                button('removeSequenceImage', { type: 'button', class: 'studio-button studio-button--subtle editor-media-remove', 'aria-label': i18n.t('ui.editor.removeImage'), click: function* () { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* clearImage({ kind: 'sequence', sectionId: section.id, sequenceId: sequence.id }); } }, i18n.t('ui.editor.removeImage')),
              ]),
              div({ class: 'editor-sequence-footer' }, [
                button('moveSequenceUp', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.moveSequenceUp'), disabled: function* () { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); return section.sequences.findIndex((item) => item.id === sequence.id) <= 0; }, click: function* () { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* moveSequence(section.id, sequence.id, 'up'); } }, '↑'),
                button('moveSequenceDown', { type: 'button', class: 'studio-button studio-button--subtle', 'aria-label': i18n.t('ui.editor.moveSequenceDown'), disabled: function* () { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); return section.sequences.findIndex((item) => item.id === sequence.id) >= section.sequences.length - 1; }, click: function* () { const section = (yield* sectionViewInput()).section; const sequence = yield* sequenceInput(); yield* moveSequence(section.id, sequence.id, 'down'); } }, '↓'),
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
      ]),
      ], () => section({ class: 'editor-loading-card', 'aria-label': i18n.t('ui.editor.loading') }, [
        div({ class: 'editor-loading-card__bar' }),
        div({ class: 'editor-loading-card__line' }),
        div({ class: 'editor-loading-card__line editor-loading-card__line--short' }),
      ])),
    ]),
);

export default EditorPage;
