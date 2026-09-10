import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESENTATION,
  formatPresentationAsMarkdown,
  formatPresentationForYouTube,
  parsePresentationMarkdown,
  presentationExportFilename,
} from './presentation';

describe('presentation model', () => {
  it('starts with editable sections and speaker notes', () => {
    expect(DEFAULT_PRESENTATION.sections).toHaveLength(2);
    expect(DEFAULT_PRESENTATION.sections.flatMap((section) => section.sequences)).toHaveLength(2);
    expect(DEFAULT_PRESENTATION.sections[0]?.sequences[0]?.notes).toContain('situation');
  });

  it('exports a markdown hierarchy with quoted speaker notes and code', () => {
    const markdown = formatPresentationAsMarkdown({
      ...DEFAULT_PRESENTATION,
      id: 'demo',
      updatedAt: '',
      durationMinutes: 7,
      sectionCount: 2,
    });

    expect(markdown).toContain('# Les architectures distribuées');
    expect(markdown).toContain('## Part 1 — Le problème');
    expect(markdown).toContain('### Sequence 1 — Une idée par séquence');
    expect(markdown).toContain('> Commencer par une situation vécue par le public.');
    expect(markdown).toContain('```typescript');
  });

  it('exports a copy-ready YouTube structure and a safe filename', () => {
    const text = formatPresentationForYouTube({
      ...DEFAULT_PRESENTATION,
      id: 'demo',
      updatedAt: '',
      durationMinutes: 7,
      sectionCount: 2,
    });

    expect(text).toContain('PART 1 — Le problème');
    expect(text).toContain('SEQUENCE 1 — Une idée par séquence');
    expect(text).toContain('CONTENT:');
    expect(text).toContain('NOTES:\n> Commencer par une situation vécue par le public.');
    expect(presentationExportFilename('Les architectures distribuées', 'youtube')).toBe('les-architectures-distribuees-youtube.txt');
  });

  it('imports the Markdown hierarchy, notes, images and fenced code', () => {
    const markdown = `# Une présentation Markdown

**Audience :** Équipe produit
**Objectif :** Décider ensemble

## Part 1 — Le contexte

*Intention :* Expliquer

### Sequence 1 — Une idée forte

- Une idée par séquence
- Un exemple concret

**Duration :** 5 min
**Transition :** Zoom

#### Notes

> Commencer par le problème.

#### Code

\`\`\`ts
const answer = 42;
\`\`\`

![Schéma](https://placehold.co/800x400)
`;
    const result = parsePresentationMarkdown(markdown, {
      ...DEFAULT_PRESENTATION,
      id: 'demo',
      updatedAt: '',
      durationMinutes: 7,
      sectionCount: 2,
    });

    expect(result.errors).toEqual([]);
    expect(result.document?.title).toBe('Une présentation Markdown');
    expect(result.document?.audience).toBe('Équipe produit');
    expect(result.document?.sections[0]?.sequences[0]).toMatchObject({
      title: 'Une idée forte',
      message: '• Une idée par séquence\n• Un exemple concret',
      notes: 'Commencer par le problème.',
      durationMinutes: 5,
      transition: 'Zoom',
      code: 'const answer = 42;',
      codeLanguage: 'typescript',
      imageAlt: 'Schéma',
    });
  });

  it('round-trips the Markdown export back into the presentation model', () => {
    const source = formatPresentationAsMarkdown({
      ...DEFAULT_PRESENTATION,
      id: 'demo',
      updatedAt: '',
      durationMinutes: 7,
      sectionCount: 2,
    });
    const result = parsePresentationMarkdown(source, {
      ...DEFAULT_PRESENTATION,
      id: 'demo',
      updatedAt: '',
      durationMinutes: 7,
      sectionCount: 2,
    });

    expect(result.errors).toEqual([]);
    expect(result.document?.sections).toHaveLength(2);
    expect(result.document?.sections[1]?.sequences[0]?.code).toContain('flatMap');
    expect(result.document?.sections[0]?.sequences[0]?.notes).toContain('situation');
  });
});
