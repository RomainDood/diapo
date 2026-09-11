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
  'html',
  'markdown',
] as const;

export type PresentationCodeLanguage = (typeof PRESENTATION_CODE_LANGUAGES)[number];

export const PRESENTATION_LAYOUTS = ['desktop', 'vertical'] as const;

export type PresentationLayout = (typeof PRESENTATION_LAYOUTS)[number];

export const PRESENTATION_DEMO_WORKSPACES = [
  'none',
  'angular-route-resources',
] as const;

export type PresentationDemoWorkspaceId = string;

export type PresentationDemoWorkspaceConfig = {
  readonly id: PresentationDemoWorkspaceId;
  readonly title: string;
  readonly directory: string;
  readonly command: string;
  readonly port: number;
};

export type PresentationDemoWorkspaceFile = {
  readonly path: string;
  readonly language: PresentationCodeLanguage;
  readonly content: string;
};

export type PresentationDemoWorkspace = {
  readonly id: PresentationDemoWorkspaceId;
  readonly title: string;
  readonly files: readonly PresentationDemoWorkspaceFile[];
};

export const PRESENTATION_DEMO_WORKSPACE_PROCESS_STATES = [
  'stopped',
  'starting',
  'running',
  'stopping',
  'error',
] as const;

export type PresentationDemoWorkspaceProcessState = (typeof PRESENTATION_DEMO_WORKSPACE_PROCESS_STATES)[number];

export const PRESENTATION_DEMO_WORKSPACE_TERMINAL_STATES = ['idle', 'running', 'error'] as const;

export type PresentationDemoWorkspaceTerminalState = (typeof PRESENTATION_DEMO_WORKSPACE_TERMINAL_STATES)[number];

export type PresentationDemoWorkspaceProcessStatus = {
  readonly id: PresentationDemoWorkspaceId;
  readonly state: PresentationDemoWorkspaceProcessState;
  readonly terminalState: PresentationDemoWorkspaceTerminalState;
  readonly url: string;
  readonly command: string;
  readonly terminalCommand: string;
  readonly runtime: string;
  readonly logs: readonly string[];
};

export const PRESENTATION_BACKGROUND_TYPES = ['theme', 'image', 'video'] as const;

export type PresentationBackgroundType = (typeof PRESENTATION_BACKGROUND_TYPES)[number];

export const PRESENTATION_THEMES = ['aurora', 'sunset', 'ocean', 'forest', 'paper', 'custom'] as const;

export type PresentationThemeId = (typeof PRESENTATION_THEMES)[number];

export type PresentationGradient = {
  readonly start: string;
  readonly middle: string;
  readonly end: string;
  readonly angle: number;
};

export const PRESENTATION_THEME_GRADIENTS: Record<PresentationThemeId, PresentationGradient> = {
  aurora: { start: '#211047', middle: '#3c176b', end: '#8514f5', angle: 135 },
  sunset: { start: '#32142f', middle: '#8f3048', end: '#f06b37', angle: 135 },
  ocean: { start: '#071d35', middle: '#075985', end: '#087e8b', angle: 135 },
  forest: { start: '#071d18', middle: '#104c43', end: '#176b57', angle: 135 },
  paper: { start: '#3b241d', middle: '#623b2e', end: '#9a5c45', angle: 135 },
  custom: { start: '#211047', middle: '#3c176b', end: '#8514f5', angle: 135 },
};

export const PRESENTATION_DECORATIONS = ['orb', 'rings', 'particles', 'grid', 'none'] as const;

export type PresentationDecoration = (typeof PRESENTATION_DECORATIONS)[number];

export const PRESENTATION_DECORATION_DEFAULT_COLOR = '#f736e3';

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

export const PRESENTATION_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
] as const;

export const PRESENTATION_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
] as const;

export const PRESENTATION_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type PresentationImageMimeType = (typeof PRESENTATION_IMAGE_MIME_TYPES)[number];
export type PresentationVideoMimeType = (typeof PRESENTATION_VIDEO_MIME_TYPES)[number];
export type PresentationMediaMimeType = (typeof PRESENTATION_MEDIA_MIME_TYPES)[number];

export type PresentationImageUploadInput = {
  readonly filename: string;
  readonly mimeType: PresentationMediaMimeType;
  readonly dataUrl: string;
};

export type PresentationImageUpload = {
  readonly url: string;
  readonly filename: string;
  readonly mimeType: PresentationMediaMimeType;
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
  readonly demoWorkspaceId?: PresentationDemoWorkspaceId;
};

export type PresentationSection = {
  readonly id: string;
  readonly title: string;
  readonly intention: string;
  readonly demoWorkspaceId?: PresentationDemoWorkspaceId;
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
  readonly demoWorkspaceId: PresentationDemoWorkspaceId;
  readonly backgroundType: PresentationBackgroundType;
  readonly backgroundTheme: PresentationThemeId;
  readonly backgroundUrl: string;
  readonly backgroundGradientStart: string;
  readonly backgroundGradientMiddle: string;
  readonly backgroundGradientEnd: string;
  readonly backgroundGradientAngle: number;
  readonly backgroundDecoration: PresentationDecoration;
  readonly backgroundDecorationColor: string;
  readonly objective: string;
  readonly coverImageUrl: string;
  readonly coverImageAlt: string;
  readonly sections: readonly PresentationSection[];
};

export type PresentationExportFormat = 'markdown' | 'youtube';

export type PresentationMarkdownParseResult = {
  readonly document?: PresentationDocument;
  readonly errors: readonly string[];
};

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

function markdownInlineText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

function markdownMessage(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => /^[-+*]\s+/.test(line) ? `• ${markdownInlineText(line.replace(/^[-+*]\s+/, ''))}` : markdownInlineText(line.replace(/^>\s?/, '')))
    .join('\n');
}

function parseMarkdownField(line: string, labels: readonly string[]): string | undefined {
  const labelPattern = labels.join('|');
  const match = line.match(new RegExp(`^\\*\\*\\s*(?:${labelPattern})\\s*:?\\s*\\*\\*\\s*(.+?)\\s*$`, 'i'));
  return match?.[1]?.trim();
}

function parseMarkdownHeading(line: string, level: number, labels: readonly string[]): string | undefined {
  const match = line.match(new RegExp(`^#{${level}}\\s+(.+?)\\s*$`));
  if (!match?.[1]) return undefined;
  const heading = match[1].trim();
  const labelPattern = labels.join('|');
  return heading.replace(new RegExp(`^(?:${labelPattern})\\s*\\d*\\s*[—-]\\s*`, 'i'), '').trim() || heading;
}

function parseMarkdownIntention(line: string): string | undefined {
  const match = line.match(/^\*\s*Intention\s*:?\s*\*\s*(.+?)\s*$/i);
  return match?.[1]?.trim();
}

function parseMarkdownDemoWorkspace(line: string): PresentationDemoWorkspaceId | undefined {
  const value = parseMarkdownField(line, ['Demo', 'Projet', 'Workspace']);
  return value?.trim() || undefined;
}

function parsePresentationCodeLanguage(value: string | undefined): PresentationCodeLanguage {
  const normalized = value?.trim().toLowerCase();
  const aliases: Record<string, PresentationCodeLanguage> = {
    ts: 'typescript',
    typescript: 'typescript',
    js: 'javascript',
    javascript: 'javascript',
    py: 'python',
    python: 'python',
    json: 'json',
    css: 'css',
    sh: 'bash',
    shell: 'bash',
    bash: 'bash',
  };
  return aliases[normalized ?? ''] ?? 'typescript';
}

function parsePresentationTransition(value: string | undefined, fallback: PresentationTransition): PresentationTransition {
  const normalized = value?.trim().toLowerCase();
  return PRESENTATION_TRANSITIONS.find((transition) => transition.toLowerCase() === normalized) ?? fallback;
}

function parsePresentationIntention(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().toLowerCase();
  return PRESENTATION_INTENTIONS.find((intention) => intention.toLowerCase() === normalized) ?? value?.trim() ?? fallback;
}

function parseSimpleFrontmatter(lines: readonly string[]): { readonly values: Readonly<Record<string, string>>; readonly bodyStart: number } {
  if (lines[0]?.trim() !== '---') return { values: {}, bodyStart: 0 };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) return { values: {}, bodyStart: 0 };
  const values: Record<string, string> = {};
  lines.slice(1, end).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator < 0) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && value) values[key] = value;
  });
  return { values, bodyStart: end + 1 };
}

function createMarkdownSection(index: number, title: string, intention: string): PresentationSection {
  return { id: `markdown-section-${index}`, title, intention, sequences: [] };
}

function createMarkdownSequence(sectionIndex: number, sequenceIndex: number, title: string): PresentationSequence {
  return {
    id: `markdown-sequence-${sectionIndex}-${sequenceIndex}`,
    title,
    message: '',
    notes: '',
    durationMinutes: 1,
    transition: 'Fondu',
    code: '',
    codeLanguage: 'typescript',
    imageUrl: '',
    imageAlt: '',
  };
}

/** Parse the canonical presentation Markdown emitted by formatPresentationAsMarkdown. */
export function parsePresentationMarkdown(markdown: string, fallback: PresentationDocument): PresentationMarkdownParseResult {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const frontmatter = parseSimpleFrontmatter(lines);
  const body = lines.slice(frontmatter.bodyStart);
  const values: Record<string, string> = { ...frontmatter.values };
  const errors: string[] = [];
  const sections: PresentationSection[] = [];
  let currentSection: PresentationSection | undefined;
  let currentSequence: PresentationSequence | undefined;
  let messageLines: string[] = [];
  let noteLines: string[] = [];
  let codeLines: string[] = [];
  let mode: 'message' | 'notes' | 'code' = 'message';
  let codeFenceLength = 0;
  let codeFenceOpen = false;

  const flushSequence = () => {
    if (!currentSequence) return;
    const sequence = {
      ...currentSequence,
      message: markdownMessage(messageLines),
      notes: noteLines.map((line) => line.replace(/^>\s?/, '').trim()).filter(Boolean).join('\n'),
      code: codeLines.join('\n').trim(),
    };
    if (!currentSection) currentSection = createMarkdownSection(sections.length + 1, 'Contenu', 'Expliquer');
    currentSection = { ...currentSection, sequences: [...currentSection.sequences, sequence] };
    messageLines = [];
    noteLines = [];
    codeLines = [];
    currentSequence = undefined;
    mode = 'message';
    codeFenceLength = 0;
  };

  const flushSection = () => {
    flushSequence();
    if (currentSection) {
      sections.push(currentSection);
      currentSection = undefined;
    }
  };

  body.forEach((line) => {
    const trimmed = line.trim();
    const openingFence = trimmed.match(/^(`{3,})([A-Za-z0-9+#.-]*)\s*$/);
    if (mode === 'code') {
      if (trimmed === '`'.repeat(codeFenceLength)) {
        mode = 'message';
        codeFenceOpen = false;
      } else {
        codeLines.push(line);
      }
      return;
    }
    if (openingFence && currentSequence) {
      mode = 'code';
      codeFenceOpen = true;
      codeFenceLength = openingFence[1].length;
      currentSequence = { ...currentSequence, codeLanguage: parsePresentationCodeLanguage(openingFence[2]) };
      return;
    }
    if (trimmed === '---') return;

    const sectionTitle = parseMarkdownHeading(line, 2, ['Part', 'Partie']);
    if (sectionTitle) {
      flushSection();
      currentSection = createMarkdownSection(sections.length + 1, sectionTitle, 'Expliquer');
      return;
    }
    const sequenceTitle = parseMarkdownHeading(line, 3, ['Sequence', 'Séquence']);
    if (sequenceTitle) {
      flushSequence();
      if (!currentSection) currentSection = createMarkdownSection(sections.length + 1, 'Contenu', 'Expliquer');
      currentSequence = createMarkdownSequence(sections.length + 1, currentSection.sequences.length + 1, sequenceTitle);
      return;
    }
    if (!currentSequence && /^#\s+/.test(line)) {
      const title = line.replace(/^#\s+/, '').trim();
      if (title) values.title = title;
      return;
    }
    if (currentSection) {
      const intention = parseMarkdownIntention(line);
      if (intention) {
        currentSection = { ...currentSection, intention: parsePresentationIntention(intention, currentSection.intention) };
        return;
      }
      const demoWorkspaceId = parseMarkdownDemoWorkspace(line);
      if (demoWorkspaceId) {
        if (currentSequence) currentSequence = { ...currentSequence, demoWorkspaceId };
        else currentSection = { ...currentSection, demoWorkspaceId };
        return;
      }
    }
    if (!currentSequence) {
      const audience = parseMarkdownField(line, ['Audience', 'Public']);
      if (audience) { values.audience = audience; return; }
      const objective = parseMarkdownField(line, ['Objective', 'Objectif']);
      if (objective) { values.objective = objective; return; }
      const demoWorkspaceId = parseMarkdownDemoWorkspace(line);
      if (demoWorkspaceId) { values.demoWorkspaceId = demoWorkspaceId; return; }
      return;
    }
    if (/^####\s+Notes?\s*$/i.test(line)) { mode = 'notes'; return; }
    if (/^####\s+Code\s*$/i.test(line)) { mode = 'message'; return; }
    if (mode === 'notes') {
      if (/^####\s+/.test(line)) mode = 'message';
      else if (trimmed) noteLines.push(line);
      if (mode === 'notes') return;
    }
    const duration = parseMarkdownField(line, ['Duration', 'Durée']);
    if (duration) {
      const minutes = Number.parseInt(duration, 10);
      if (Number.isFinite(minutes)) currentSequence = { ...currentSequence, durationMinutes: Math.max(1, minutes) };
      return;
    }
    const transition = parseMarkdownField(line, ['Transition']);
    if (transition) {
      currentSequence = { ...currentSequence, transition: parsePresentationTransition(transition, currentSequence.transition) };
      return;
    }
    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      currentSequence = { ...currentSequence, imageAlt: image[1].trim(), imageUrl: image[2].trim() };
      return;
    }
    if (trimmed) messageLines.push(line);
  });

  if (codeFenceOpen) errors.push('Un bloc de code Markdown est resté ouvert. Ajoutez sa clôture avec des accents graves.');
  flushSection();
  const title = values.title?.trim() || fallback.title.trim();
  if (!title) errors.push('Le Markdown doit contenir un titre avec « # ».');
  if (sections.length === 0 || sections.every((section) => section.sequences.length === 0)) errors.push('Le Markdown doit contenir au moins une séquence « ### ».');
  if (errors.length > 0) return { errors };

  const document: PresentationDocument = {
    ...fallback,
    title,
    audience: values.audience?.trim() ?? fallback.audience,
    objective: values.objective?.trim() ?? fallback.objective,
    demoWorkspaceId: values.demoWorkspaceId?.trim() || fallback.demoWorkspaceId,
    layout: values.layout === 'vertical' ? 'vertical' : values.layout === 'desktop' ? 'desktop' : fallback.layout,
    backgroundType: values.backgroundType === 'image' || values.backgroundType === 'video' ? values.backgroundType : fallback.backgroundType,
    backgroundTheme: PRESENTATION_THEMES.includes(values.backgroundTheme as PresentationThemeId) ? values.backgroundTheme as PresentationThemeId : fallback.backgroundTheme,
    sections,
    sectionCount: sections.length,
    durationMinutes: sections.flatMap((section) => section.sequences).reduce((total, sequence) => total + sequence.durationMinutes, 0),
  };
  return { document, errors: [] };
}

export function formatPresentationAsMarkdown(document: PresentationDocument): string {
  const lines = [`# ${document.title.trim() || 'Untitled presentation'}`, ''];
  addOptionalField(lines, 'Audience', document.audience);
  addOptionalField(lines, 'Objective', document.objective);
  addOptionalField(lines, 'Demo', document.demoWorkspaceId === 'none' ? '' : document.demoWorkspaceId);

  document.sections.forEach((part, partIndex) => {
    lines.push(`## Part ${partIndex + 1} — ${part.title}`, '', `*Intention :* ${part.intention}`, '');
    addOptionalField(lines, 'Demo', part.demoWorkspaceId && part.demoWorkspaceId !== 'none' ? part.demoWorkspaceId : '');
    part.sequences.forEach((sequence, sequenceIndex) => {
      lines.push(`### Sequence ${sequenceIndex + 1} — ${sequence.title}`, '');
      addOptionalField(lines, 'Demo', sequence.demoWorkspaceId && sequence.demoWorkspaceId !== 'none' ? sequence.demoWorkspaceId : '');
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
  readonly demoWorkspaceId: PresentationDemoWorkspaceId;
  readonly backgroundType: PresentationBackgroundType;
  readonly backgroundTheme: PresentationThemeId;
  readonly backgroundUrl: string;
  readonly backgroundGradientStart: string;
  readonly backgroundGradientMiddle: string;
  readonly backgroundGradientEnd: string;
  readonly backgroundGradientAngle: number;
  readonly backgroundDecoration: PresentationDecoration;
  readonly backgroundDecorationColor: string;
  readonly title: string;
  readonly audience: string;
  readonly objective: string;
  readonly coverImageUrl: string;
  readonly coverImageAlt: string;
  readonly sections: readonly PresentationSection[];
};

export const DEFAULT_PRESENTATION: PresentationStoreInput = {
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
