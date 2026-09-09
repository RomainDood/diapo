export type PresentationNotePart =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly id: string;
    }
  | {
      readonly kind: 'link';
      readonly text: string;
      readonly url: string;
      readonly id: string;
    };

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const TRAILING_PUNCTUATION = /[),.;:!?\]}]+$/;

export function extractPresentationNoteParts(notes: string): readonly PresentationNotePart[] {
  const parts: PresentationNotePart[] = [];
  let cursor = 0;
  let partIndex = 0;

  for (const match of notes.matchAll(URL_PATTERN)) {
    const rawUrl = match[0];
    const start = match.index ?? cursor;
    const href = rawUrl.replace(TRAILING_PUNCTUATION, '');
    if (!href) continue;

    if (start > cursor) {
      parts.push({ kind: 'text', text: notes.slice(cursor, start), id: `text-${partIndex++}` });
    }

    parts.push({ kind: 'link', text: href, url: href, id: `link-${partIndex++}` });
    const trailingText = rawUrl.slice(href.length);
    if (trailingText) {
      parts.push({ kind: 'text', text: trailingText, id: `text-${partIndex++}` });
    }
    cursor = start + rawUrl.length;
  }

  if (cursor < notes.length) {
    parts.push({ kind: 'text', text: notes.slice(cursor), id: `text-${partIndex}` });
  }

  return parts;
}
