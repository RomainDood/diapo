export const PRESENTATION_INTENTIONS = [
  'Expliquer',
  'Démontrer',
  'Comparer',
  'Décider',
  'Conclusion',
] as const;

export type PresentationIntention = (typeof PRESENTATION_INTENTIONS)[number];

export const PRESENTATION_TRANSITIONS = [
  'Fondu',
  'Glissement',
  'Zoom',
  'Coupure',
] as const;

export type PresentationTransition = (typeof PRESENTATION_TRANSITIONS)[number];

export const PRESENTATION_CODE_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'json',
  'css',
  'bash',
] as const;

export type PresentationCodeLanguage = (typeof PRESENTATION_CODE_LANGUAGES)[number];

export const PRESENTATION_LAYOUTS = ['desktop', 'vertical'] as const;

export type PresentationLayout = (typeof PRESENTATION_LAYOUTS)[number];

export const PRESENTATION_IMAGE_ALLOWED_ORIGINS = [
  'https://images.unsplash.com',
  'https://images.pexels.com',
  'https://i.imgur.com',
  'https://placehold.co',
] as const;

export const PRESENTATION_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const PRESENTATION_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type PresentationImageMimeType = (typeof PRESENTATION_IMAGE_MIME_TYPES)[number];

export type PresentationImageUploadInput = {
  readonly filename: string;
  readonly mimeType: PresentationImageMimeType;
  readonly dataUrl: string;
};

export type PresentationImageUpload = {
  readonly url: string;
  readonly filename: string;
  readonly mimeType: PresentationImageMimeType;
};

export type PresentationSequence = {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly notes: string;
  readonly durationMinutes: number;
  readonly transition: PresentationTransition;
  readonly code: string;
  readonly codeLanguage: PresentationCodeLanguage;
  readonly imageUrl: string;
  readonly imageAlt: string;
};

export type PresentationSection = {
  readonly id: string;
  readonly title: string;
  readonly intention: string;
  readonly sequences: readonly PresentationSequence[];
};

export type PresentationSummary = {
  readonly id: string;
  readonly title: string;
  readonly audience: string;
  readonly durationMinutes: number;
  readonly sectionCount: number;
  readonly updatedAt: string;
};

export type PresentationDocument = PresentationSummary & {
  readonly layout: PresentationLayout;
  readonly objective: string;
  readonly coverImageUrl: string;
  readonly coverImageAlt: string;
  readonly sections: readonly PresentationSection[];
};

export type PresentationExportFormat = 'markdown' | 'youtube';

function nonEmptyLines(value: string): readonly string[] {
  return value.trim() ? value.trim().split(/\r?\n/) : [];
}

function quoteNotes(notes: string): string {
  return nonEmptyLines(notes).map((line) => `> ${line}`).join('\n');
}

function addOptionalField(lines: string[], label: string, value: string): void {
  if (value.trim()) lines.push(`**${label} :** ${value.trim()}`, '');
}

function codeFence(code: string): string {
  return code.includes('```') ? '````' : '```';
}

export function formatPresentationAsMarkdown(document: PresentationDocument): string {
  const lines = [`# ${document.title.trim() || 'Untitled presentation'}`, ''];
  addOptionalField(lines, 'Audience', document.audience);
  addOptionalField(lines, 'Objective', document.objective);

  document.sections.forEach((part, partIndex) => {
    lines.push(`## Part ${partIndex + 1} — ${part.title}`, '', `*Intention :* ${part.intention}`, '');
    part.sequences.forEach((sequence, sequenceIndex) => {
      lines.push(`### Sequence ${sequenceIndex + 1} — ${sequence.title}`, '');
      if (sequence.message.trim()) lines.push(sequence.message.trim(), '');
      lines.push(`**Duration :** ${sequence.durationMinutes} min`, `**Transition :** ${sequence.transition}`, '');
      if (sequence.notes.trim()) lines.push('#### Notes', '', quoteNotes(sequence.notes), '');
      if (sequence.code.trim()) {
        const fence = codeFence(sequence.code);
        lines.push('#### Code', '', `${fence}${sequence.codeLanguage}`, sequence.code.trim(), fence, '');
      }
      if (sequence.imageUrl.trim()) {
        lines.push(`![${sequence.imageAlt.trim() || 'Sequence image'}](${sequence.imageUrl.trim()})`, '');
      }
    });
  });

  return `${lines.join('\n').trim()}\n`;
}

export function formatPresentationForYouTube(document: PresentationDocument): string {
  const lines = [
    `PRESENTATION — ${document.title.trim() || 'Untitled presentation'}`,
    document.audience.trim() ? `AUDIENCE — ${document.audience.trim()}` : '',
    document.objective.trim() ? `OBJECTIVE — ${document.objective.trim()}` : '',
    '',
  ];

  document.sections.forEach((part, partIndex) => {
    lines.push(`PART ${partIndex + 1} — ${part.title}`, `INTENTION — ${part.intention}`, '');
    part.sequences.forEach((sequence, sequenceIndex) => {
      lines.push(`SEQUENCE ${sequenceIndex + 1} — ${sequence.title}`, 'CONTENT:');
      if (sequence.message.trim()) lines.push(sequence.message.trim());
      lines.push(`DURATION — ${sequence.durationMinutes} min`, `TRANSITION — ${sequence.transition}`, '');
      if (sequence.notes.trim()) lines.push('NOTES:', quoteNotes(sequence.notes), '');
      if (sequence.code.trim()) lines.push(`CODE (${sequence.codeLanguage}):`, sequence.code.trim(), '');
      if (sequence.imageUrl.trim()) lines.push(`IMAGE — ${sequence.imageAlt.trim() || sequence.imageUrl.trim()}`, sequence.imageUrl.trim(), '');
    });
  });

  return `${lines.join('\n').trim()}\n`;
}

export function presentationExportFilename(title: string, format: PresentationExportFormat): string {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'presentation';
  return `${normalized}-${format === 'markdown' ? 'notes' : 'youtube'}.${format === 'markdown' ? 'md' : 'txt'}`;
}

export type CreatePresentationInput = {
  readonly title: string;
  readonly audience: string;
  readonly objective: string;
};

export type PresentationStoreInput = {
  readonly layout: PresentationLayout;
  readonly title: string;
  readonly audience: string;
  readonly objective: string;
  readonly coverImageUrl: string;
  readonly coverImageAlt: string;
  readonly sections: readonly PresentationSection[];
};

export const DEFAULT_PRESENTATION: PresentationStoreInput = {
  layout: 'desktop',
  title: 'Les architectures distribuées',
  audience: 'Développeurs et ingénieurs',
  objective: 'Rendre le raisonnement visible avant de le décorer.',
  coverImageUrl: '',
  coverImageAlt: '',
  sections: [
    {
      id: 'section-probleme',
      title: 'Le problème',
      intention: 'Expliquer',
      sequences: [
        {
          id: 'sequence-probleme',
          title: 'Une idée par séquence',
          message: 'Rendre le raisonnement visible avant de le décorer.',
          notes: 'Commencer par une situation vécue par le public.',
          durationMinutes: 3,
          transition: 'Fondu',
          code: '',
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
      ],
    },
    {
      id: 'section-solution',
      title: 'La solution',
      intention: 'Démontrer',
      sequences: [
        {
          id: 'sequence-solution',
          title: 'Découper pour mieux expliquer',
          message: 'Chaque séquence porte une seule idée forte.',
          notes: 'Faire apparaître le schéma après l’intuition.',
          durationMinutes: 4,
          transition: 'Glissement',
          code: 'const audience = presentation.sections.flatMap((section) => section.sequences);',
          codeLanguage: 'typescript',
          imageUrl: '',
          imageAlt: '',
        },
      ],
    },
  ],
};
