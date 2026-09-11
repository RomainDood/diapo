import { Effect } from 'effect';
import {
  createPresentationRuntime,
  PresentationStore,
  PresentationStoreError,
} from './presentation-store';
import {
  PRESENTATION_CODE_LANGUAGES,
  PRESENTATION_DEMO_WORKSPACES,
  PRESENTATION_INTENTIONS,
  PRESENTATION_LAYOUTS,
  PRESENTATION_TRANSITIONS,
  PRESENTATION_BACKGROUND_TYPES,
  PRESENTATION_THEMES,
  PRESENTATION_THEME_GRADIENTS,
  PRESENTATION_DECORATIONS,
  PRESENTATION_DECORATION_DEFAULT_COLOR,
} from '../shared/presentation';
import type {
  CreatePresentationInput,
  PresentationSection,
  PresentationStoreInput,
} from '../shared/presentation';

export type PresentationApiResponse = {
  readonly status: number;
  readonly body: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCreateInput(value: unknown): CreatePresentationInput | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.title !== 'string' || typeof value.audience !== 'string' || typeof value.objective !== 'string') return undefined;
  return { title: value.title.trim(), audience: value.audience.trim(), objective: value.objective.trim() };
}

function readStoreInput(value: unknown): PresentationStoreInput | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.title !== 'string' || typeof value.audience !== 'string' || typeof value.objective !== 'string' || !Array.isArray(value.sections)) return undefined;
  const sections = value.sections as readonly PresentationSection[];
  const backgroundTheme = PRESENTATION_THEMES.includes(value.backgroundTheme as (typeof PRESENTATION_THEMES)[number])
    ? value.backgroundTheme as (typeof PRESENTATION_THEMES)[number]
    : 'aurora';
  const gradient = PRESENTATION_THEME_GRADIENTS[backgroundTheme];
  return {
    layout: PRESENTATION_LAYOUTS.includes(value.layout as (typeof PRESENTATION_LAYOUTS)[number])
      ? value.layout as (typeof PRESENTATION_LAYOUTS)[number]
      : 'desktop',
    demoWorkspaceId: PRESENTATION_DEMO_WORKSPACES.includes(value.demoWorkspaceId as (typeof PRESENTATION_DEMO_WORKSPACES)[number])
      ? value.demoWorkspaceId as (typeof PRESENTATION_DEMO_WORKSPACES)[number]
      : 'none',
    backgroundType: PRESENTATION_BACKGROUND_TYPES.includes(value.backgroundType as (typeof PRESENTATION_BACKGROUND_TYPES)[number])
      ? value.backgroundType as (typeof PRESENTATION_BACKGROUND_TYPES)[number]
      : 'theme',
    backgroundTheme,
    backgroundUrl: typeof value.backgroundUrl === 'string' ? value.backgroundUrl.trim() : '',
    backgroundGradientStart: typeof value.backgroundGradientStart === 'string' && /^#[0-9a-f]{6}$/i.test(value.backgroundGradientStart)
      ? value.backgroundGradientStart
      : gradient.start,
    backgroundGradientMiddle: typeof value.backgroundGradientMiddle === 'string' && /^#[0-9a-f]{6}$/i.test(value.backgroundGradientMiddle)
      ? value.backgroundGradientMiddle
      : gradient.middle,
    backgroundGradientEnd: typeof value.backgroundGradientEnd === 'string' && /^#[0-9a-f]{6}$/i.test(value.backgroundGradientEnd)
      ? value.backgroundGradientEnd
      : gradient.end,
    backgroundGradientAngle: typeof value.backgroundGradientAngle === 'number' && Number.isFinite(value.backgroundGradientAngle)
      ? Math.min(Math.max(Math.round(value.backgroundGradientAngle), 0), 360)
      : gradient.angle,
    backgroundDecoration: PRESENTATION_DECORATIONS.includes(value.backgroundDecoration as (typeof PRESENTATION_DECORATIONS)[number])
      ? value.backgroundDecoration as (typeof PRESENTATION_DECORATIONS)[number]
      : 'orb',
    backgroundDecorationColor: typeof value.backgroundDecorationColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.backgroundDecorationColor)
      ? value.backgroundDecorationColor
      : PRESENTATION_DECORATION_DEFAULT_COLOR,
    title: value.title,
    audience: value.audience,
    objective: value.objective,
    coverImageUrl: typeof value.coverImageUrl === 'string' ? value.coverImageUrl : '',
    coverImageAlt: typeof value.coverImageAlt === 'string' ? value.coverImageAlt : '',
    sections: sections.map((section) => ({
      ...section,
      intention: PRESENTATION_INTENTIONS.includes(section.intention as (typeof PRESENTATION_INTENTIONS)[number])
        ? section.intention as (typeof PRESENTATION_INTENTIONS)[number]
        : 'Expliquer',
      sequences: section.sequences.map((sequence) => ({
        ...sequence,
        transition: PRESENTATION_TRANSITIONS.includes(sequence.transition as (typeof PRESENTATION_TRANSITIONS)[number])
          ? sequence.transition as (typeof PRESENTATION_TRANSITIONS)[number]
          : 'Fondu',
        code: sequence.code ?? '',
        codeLanguage: PRESENTATION_CODE_LANGUAGES.includes(sequence.codeLanguage as (typeof PRESENTATION_CODE_LANGUAGES)[number])
          ? sequence.codeLanguage as (typeof PRESENTATION_CODE_LANGUAGES)[number]
          : 'typescript',
        imageUrl: sequence.imageUrl ?? '',
        imageAlt: sequence.imageAlt ?? '',
      })),
    })),
  };
}

function isStoreError(error: unknown): error is PresentationStoreError {
  return error instanceof PresentationStoreError;
}

export function createPresentationApi(databasePath: string) {
  const run = createPresentationRuntime(databasePath);

  return {
    handle(method: string, pathname: string, payload: unknown): Promise<PresentationApiResponse> {
      const program = Effect.gen(function* () {
        const store = yield* PresentationStore;
        if (method === 'GET' && pathname === '/api/presentations') {
          return { status: 200, body: yield* store.list };
        }
        if (method === 'GET' && pathname.startsWith('/api/presentations/')) {
          return { status: 200, body: yield* store.get(pathname.slice('/api/presentations/'.length)) };
        }
        if (method === 'POST' && pathname === '/api/presentations') {
          const input = readCreateInput(payload);
          if (!input?.title) return { status: 400, body: { error: 'A title is required.' } };
          return { status: 201, body: yield* store.create(input) };
        }
        if (method === 'PUT' && pathname.startsWith('/api/presentations/')) {
          const input = readStoreInput(payload);
          if (!input?.title) return { status: 400, body: { error: 'A title is required.' } };
          return { status: 200, body: yield* store.update(pathname.slice('/api/presentations/'.length), input) };
        }
        return { status: 404, body: { error: 'Not found.' } };
      });

      return run(program).then(
        (response) => response,
        (error): PresentationApiResponse => ({
          status: isStoreError(error) && error.message.includes('not found') ? 404 : 500,
          body: { error: error instanceof Error ? error.message : 'Unexpected backend error.' },
        }),
      );
    },
  };
}
