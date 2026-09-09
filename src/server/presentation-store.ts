import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Context, Data, Effect, Layer } from 'effect';
import {
  DEFAULT_PRESENTATION,
  type CreatePresentationInput,
  type PresentationDocument,
  PRESENTATION_CODE_LANGUAGES,
  PRESENTATION_LAYOUTS,
  PRESENTATION_INTENTIONS,
  type PresentationSection,
  type PresentationStoreInput,
  type PresentationSummary,
  PRESENTATION_TRANSITIONS,
  type PresentationCodeLanguage,
  type PresentationIntention,
  type PresentationTransition,
} from '../shared/presentation';

export class PresentationStoreError extends Data.TaggedError('PresentationStoreError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type PresentationStoreShape = {
  readonly list: Effect.Effect<readonly PresentationSummary[], PresentationStoreError>;
  readonly get: (id: string) => Effect.Effect<PresentationDocument, PresentationStoreError>;
  readonly create: (input: CreatePresentationInput) => Effect.Effect<PresentationDocument, PresentationStoreError>;
  readonly update: (id: string, input: PresentationStoreInput) => Effect.Effect<PresentationDocument, PresentationStoreError>;
};

export class PresentationStore extends Context.Service<PresentationStore, PresentationStoreShape>()(
  'diapo/PresentationStore',
) {}

type PresentationRow = {
  id: string;
  layout: string;
  title: string;
  audience: string;
  objective: string;
  cover_image_url: string;
  cover_image_alt: string;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
};

type SectionRow = {
  id: string;
  title: string;
  intention: string;
  sequence_id: string;
  sequence_title: string;
  message: string;
  notes: string;
  duration_minutes: number;
  transition: string;
  code: string;
  code_language: string;
  image_url: string;
  image_alt: string;
};

type SummaryRow = {
  id: string;
  title: string;
  audience: string;
  duration_minutes: number;
  sectionCount: number;
  updated_at: string;
};

function databaseEffect<A>(thunk: () => A): Effect.Effect<A, PresentationStoreError> {
  return Effect.try({
    try: thunk,
    catch: (cause) => new PresentationStoreError({
      message: cause instanceof Error ? cause.message : 'SQLite operation failed',
      cause,
    }),
  });
}

function durationOf(sections: readonly PresentationSection[]): number {
  return sections.reduce(
    (total, section) => total + section.sequences.reduce((subtotal, sequence) => subtotal + sequence.durationMinutes, 0),
    0,
  );
}

function presentationIntention(value: string): PresentationIntention {
  return PRESENTATION_INTENTIONS.includes(value as PresentationIntention)
    ? value as PresentationIntention
    : 'Expliquer';
}

function presentationTransition(value: string): PresentationTransition {
  return PRESENTATION_TRANSITIONS.includes(value as PresentationTransition)
    ? value as PresentationTransition
    : 'Fondu';
}

function presentationCodeLanguage(value: string): PresentationCodeLanguage {
  return PRESENTATION_CODE_LANGUAGES.includes(value as PresentationCodeLanguage)
    ? value as PresentationCodeLanguage
    : 'typescript';
}

function presentationLayout(value: string): PresentationStoreInput['layout'] {
  return PRESENTATION_LAYOUTS.includes(value as PresentationStoreInput['layout'])
    ? value as PresentationStoreInput['layout']
    : 'desktop';
}

function groupSections(rows: readonly SectionRow[]): readonly PresentationSection[] {
  const sections = new Map<string, PresentationSection>();
  for (const row of rows) {
    const current = sections.get(row.id) ?? {
      id: row.id,
      title: row.title,
      intention: presentationIntention(row.intention),
      sequences: [],
    };
    sections.set(row.id, {
      ...current,
      sequences: [
        ...current.sequences,
        {
          id: row.sequence_id,
          title: row.sequence_title,
          message: row.message,
          notes: row.notes,
          durationMinutes: row.duration_minutes,
          transition: presentationTransition(row.transition),
          code: row.code ?? '',
          codeLanguage: presentationCodeLanguage(row.code_language),
          imageUrl: row.image_url ?? '',
          imageAlt: row.image_alt ?? '',
        },
      ],
    });
  }
  return [...sections.values()];
}

function createDatabaseStore(databasePath: string): PresentationStoreShape {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS presentations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      audience TEXT NOT NULL,
      objective TEXT NOT NULL,
      layout TEXT NOT NULL DEFAULT 'desktop',
      cover_image_url TEXT NOT NULL DEFAULT '',
      cover_image_alt TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      intention TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sequences (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      notes TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 1,
      transition TEXT NOT NULL DEFAULT 'Fondu'
    );
  `);

  const presentationColumns = database.prepare('PRAGMA table_info(presentations)').all() as readonly { name: string }[];
  const presentationColumnNames = new Set(presentationColumns.map((column) => column.name));
  if (!presentationColumnNames.has('layout')) database.exec("ALTER TABLE presentations ADD COLUMN layout TEXT NOT NULL DEFAULT 'desktop'");
  if (!presentationColumnNames.has('cover_image_url')) database.exec("ALTER TABLE presentations ADD COLUMN cover_image_url TEXT NOT NULL DEFAULT ''");
  if (!presentationColumnNames.has('cover_image_alt')) database.exec("ALTER TABLE presentations ADD COLUMN cover_image_alt TEXT NOT NULL DEFAULT ''");

  const sequenceColumns = database.prepare('PRAGMA table_info(sequences)').all() as readonly { name: string }[];
  const sequenceColumnNames = new Set(sequenceColumns.map((column) => column.name));
  if (!sequenceColumnNames.has('code')) database.exec("ALTER TABLE sequences ADD COLUMN code TEXT NOT NULL DEFAULT ''");
  if (!sequenceColumnNames.has('code_language')) database.exec("ALTER TABLE sequences ADD COLUMN code_language TEXT NOT NULL DEFAULT 'typescript'");
  if (!sequenceColumnNames.has('image_url')) database.exec("ALTER TABLE sequences ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
  if (!sequenceColumnNames.has('image_alt')) database.exec("ALTER TABLE sequences ADD COLUMN image_alt TEXT NOT NULL DEFAULT ''");
  database.prepare("UPDATE sequences SET code = ?, code_language = ? WHERE id = 'sequence-solution' AND code = ''").run(
    'const audience = presentation.sections.flatMap((section) => section.sequences);',
    'typescript',
  );

  const insertPresentation = database.prepare(
    `INSERT INTO presentations (id, title, audience, objective, layout, cover_image_url, cover_image_alt, duration_minutes, created_at, updated_at)
     VALUES (@id, @title, @audience, @objective, @layout, @coverImageUrl, @coverImageAlt, @durationMinutes, @createdAt, @updatedAt)`,
  );
  const insertSection = database.prepare(
    `INSERT INTO sections (id, presentation_id, position, title, intention)
     VALUES (@id, @presentationId, @position, @title, @intention)`,
  );
  const insertSequence = database.prepare(
    `INSERT INTO sequences (id, section_id, position, title, message, notes, duration_minutes, transition, code, code_language, image_url, image_alt)
     VALUES (@id, @sectionId, @position, @title, @message, @notes, @durationMinutes, @transition, @code, @codeLanguage, @imageUrl, @imageAlt)`,
  );

  const writeDocument = database.transaction((id: string, input: PresentationStoreInput, timestamps: { readonly createdAt: string; readonly updatedAt: string }) => {
    database.prepare('DELETE FROM sections WHERE presentation_id = ?').run(id);
    database.prepare(
      `UPDATE presentations
       SET title = ?, audience = ?, objective = ?, layout = ?, cover_image_url = ?, cover_image_alt = ?, duration_minutes = ?, updated_at = ?
       WHERE id = ?`,
    ).run(input.title, input.audience, input.objective, input.layout, input.coverImageUrl, input.coverImageAlt, durationOf(input.sections), timestamps.updatedAt, id);
    input.sections.forEach((section, sectionIndex) => {
      insertSection.run({
        id: section.id,
        presentationId: id,
        position: sectionIndex,
        title: section.title,
        intention: section.intention,
      });
      section.sequences.forEach((sequence, sequenceIndex) => {
        insertSequence.run({
          id: sequence.id,
          sectionId: section.id,
          position: sequenceIndex,
          title: sequence.title,
          message: sequence.message,
          notes: sequence.notes,
          durationMinutes: sequence.durationMinutes,
          transition: sequence.transition,
          code: sequence.code,
          codeLanguage: sequence.codeLanguage,
          imageUrl: sequence.imageUrl,
          imageAlt: sequence.imageAlt,
        });
      });
    });
  });

  function read(id: string): PresentationDocument {
    const presentation = database.prepare('SELECT * FROM presentations WHERE id = ?').get(id) as PresentationRow | undefined;
    if (!presentation) throw new Error(`Presentation ${id} not found`);
    const rows = database.prepare(
      `SELECT s.id, s.title, s.intention, q.id AS sequence_id, q.title AS sequence_title,
              q.message, q.notes, q.duration_minutes, q.transition,
              q.code, q.code_language, q.image_url, q.image_alt
       FROM sections s
       LEFT JOIN sequences q ON q.section_id = s.id
       WHERE s.presentation_id = ?
       ORDER BY s.position, q.position`,
    ).all(id) as SectionRow[];
    const sections = groupSections(rows.filter((row) => row.sequence_id));
    return {
      id: presentation.id,
      title: presentation.title,
      audience: presentation.audience,
      objective: presentation.objective,
      layout: presentationLayout(presentation.layout),
      coverImageUrl: presentation.cover_image_url ?? '',
      coverImageAlt: presentation.cover_image_alt ?? '',
      durationMinutes: presentation.duration_minutes,
      sectionCount: sections.length,
      updatedAt: presentation.updated_at,
      sections,
    };
  }

  const count = database.prepare('SELECT COUNT(*) AS count FROM presentations').get() as { count: number };
  if (count.count === 0) {
    const id = 'presentation-demo';
    const now = new Date().toISOString();
    insertPresentation.run({
      id,
      title: DEFAULT_PRESENTATION.title,
      audience: DEFAULT_PRESENTATION.audience,
      objective: DEFAULT_PRESENTATION.objective,
      layout: DEFAULT_PRESENTATION.layout,
      coverImageUrl: DEFAULT_PRESENTATION.coverImageUrl,
      coverImageAlt: DEFAULT_PRESENTATION.coverImageAlt,
      durationMinutes: durationOf(DEFAULT_PRESENTATION.sections),
      createdAt: now,
      updatedAt: now,
    });
    DEFAULT_PRESENTATION.sections.forEach((section, sectionIndex) => {
      insertSection.run({ id: section.id, presentationId: id, position: sectionIndex, title: section.title, intention: section.intention });
      section.sequences.forEach((sequence, sequenceIndex) => {
        insertSequence.run({
          id: sequence.id,
          sectionId: section.id,
          position: sequenceIndex,
          title: sequence.title,
          message: sequence.message,
          notes: sequence.notes,
          durationMinutes: sequence.durationMinutes,
          transition: sequence.transition,
          code: sequence.code,
          codeLanguage: sequence.codeLanguage,
          imageUrl: sequence.imageUrl,
          imageAlt: sequence.imageAlt,
        });
      });
    });
  }

  return {
    list: databaseEffect(() => {
      const rows = database.prepare(
        `SELECT p.id, p.title, p.audience, p.duration_minutes, p.updated_at,
                COUNT(DISTINCT s.id) AS sectionCount
         FROM presentations p
         LEFT JOIN sections s ON s.presentation_id = p.id
         GROUP BY p.id
         ORDER BY p.updated_at DESC`,
      ).all() as SummaryRow[];
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        audience: row.audience,
        durationMinutes: row.duration_minutes,
        sectionCount: row.sectionCount,
        updatedAt: row.updated_at,
      }));
    }),
    get: (id) => databaseEffect(() => read(id)),
    create: (input) => databaseEffect(() => {
      const id = `presentation-${randomUUID()}`;
      const now = new Date().toISOString();
      const initial: PresentationStoreInput = {
        ...input,
        layout: 'desktop',
        coverImageUrl: '',
        coverImageAlt: '',
        sections: [{
          id: `section-${randomUUID()}`,
          title: 'Nouvelle partie',
          intention: 'Expliquer',
          sequences: [{
            id: `sequence-${randomUUID()}`,
            title: 'Première idée',
            message: 'Décrire le message principal de cette partie.',
          notes: 'Ajouter ici les notes de l’orateur.',
          durationMinutes: 3,
          transition: 'Fondu',
          code: '',
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
          }],
        }],
      };
      insertPresentation.run({ id, title: initial.title, audience: initial.audience, objective: initial.objective, layout: initial.layout, coverImageUrl: initial.coverImageUrl, coverImageAlt: initial.coverImageAlt, durationMinutes: durationOf(initial.sections), createdAt: now, updatedAt: now });
      writeDocument(id, initial, { createdAt: now, updatedAt: now });
      return read(id);
    }),
    update: (id, input) => databaseEffect(() => {
      const current = read(id);
      writeDocument(id, input, { createdAt: current.updatedAt, updatedAt: new Date().toISOString() });
      return read(id);
    }),
  };
}

export const presentationStoreLayer = (databasePath: string) =>
  Layer.succeed(PresentationStore, createDatabaseStore(databasePath));

export function createPresentationRuntime(databasePath: string) {
  const store = createDatabaseStore(databasePath);
  return function run<A>(program: Effect.Effect<A, PresentationStoreError, PresentationStore>): Promise<A> {
    return Effect.runPromise(Effect.provideService(program, PresentationStore, store));
  };
}
