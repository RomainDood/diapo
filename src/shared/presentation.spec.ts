import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESENTATION,
  formatPresentationAsMarkdown,
  formatPresentationForYouTube,
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
});
