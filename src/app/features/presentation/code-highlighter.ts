import type { PresentationCodeLanguage } from '../../../shared/presentation';

type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'literal';

const TOKEN_CLASSES: Record<TokenKind, string> = {
  plain: 'presentation-code__token',
  keyword: 'presentation-code__token presentation-code__token--keyword',
  string: 'presentation-code__token presentation-code__token--string',
  number: 'presentation-code__token presentation-code__token--number',
  comment: 'presentation-code__token presentation-code__token--comment',
  literal: 'presentation-code__token presentation-code__token--literal',
};

const KEYWORDS: Record<PresentationCodeLanguage, ReadonlySet<string>> = {
  typescript: new Set('as const class else export extends from function if import interface let new return type typeof const async await for in of private public readonly throw try while'.split(' ')),
  javascript: new Set('class else export extends from function if import let new return const async await for in of throw try while'.split(' ')),
  python: new Set('and as class def elif else for from if import in is lambda not or pass return try while with yield'.split(' ')),
  json: new Set(),
  css: new Set('from import media supports'.split(' ')),
  bash: new Set('case do done elif else esac fi for function if in then while'.split(' ')),
};

const TOKEN_PATTERN = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;

function tokenKind(token: string, language: PresentationCodeLanguage): TokenKind {
  if (token.startsWith('//') || token.startsWith('/*') || (token.startsWith('#') && language !== 'css')) return 'comment';
  if (/^["'`]/.test(token)) return 'string';
  if (/^\d/.test(token)) return 'number';
  if (token === 'true' || token === 'false' || token === 'null' || token === 'undefined' || token === 'None') return 'literal';
  if (KEYWORDS[language].has(token)) return 'keyword';
  return 'plain';
}

export type HighlightedCodeToken = {
  readonly id: number;
  readonly text: string;
  readonly className: string;
};

export function highlightCodeTokens(code: string, language: PresentationCodeLanguage): readonly HighlightedCodeToken[] {
  const tokens: HighlightedCodeToken[] = [];
  let cursor = 0;
  let id = 0;
  for (const match of code.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    const start = match.index ?? cursor;
    if (start > cursor) tokens.push({ id: id++, text: code.slice(cursor, start), className: TOKEN_CLASSES.plain });
    tokens.push({ id: id++, text: token, className: TOKEN_CLASSES[tokenKind(token, language)] });
    cursor = start + token.length;
  }
  if (cursor < code.length) tokens.push({ id: id++, text: code.slice(cursor), className: TOKEN_CLASSES.plain });
  return tokens;
}
