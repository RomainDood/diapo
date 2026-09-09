import { describe, expect, it } from 'vitest';
import { extractPresentationNoteParts } from './presentation-links';

describe('presentation speaker note links', () => {
  it('keeps note text and turns HTTP links into separate parts', () => {
    expect(extractPresentationNoteParts('Voir https://example.com/docs puis https://craft-ts.dev.')).toEqual([
      { kind: 'text', text: 'Voir ', id: 'text-0' },
      { kind: 'link', text: 'https://example.com/docs', url: 'https://example.com/docs', id: 'link-1' },
      { kind: 'text', text: ' puis ', id: 'text-2' },
      { kind: 'link', text: 'https://craft-ts.dev', url: 'https://craft-ts.dev', id: 'link-3' },
      { kind: 'text', text: '.', id: 'text-4' },
    ]);
  });

  it('preserves line breaks when notes contain no links', () => {
    expect(extractPresentationNoteParts('Première idée\nDeuxième idée')).toEqual([
      { kind: 'text', text: 'Première idée\nDeuxième idée', id: 'text-0' },
    ]);
  });
});
