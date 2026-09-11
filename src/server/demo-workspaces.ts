import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import type {
  PresentationCodeLanguage,
  PresentationDemoWorkspace,
  PresentationDemoWorkspaceFile,
  PresentationDemoWorkspaceId,
} from '../shared/presentation.ts';
import { readDemoWorkspaceConfig } from './demo-workspace-registry.ts';

const MAX_FILES = 80;
const MAX_FILE_BYTES = 180_000;
const IGNORED_DIRECTORIES = new Set(['.git', '.angular', 'dist', 'node_modules']);
const ALLOWED_EXTENSIONS = new Set(['.ts', '.html', '.css', '.json', '.md']);

function languageForFile(path: string): PresentationCodeLanguage {
  switch (extname(path).toLowerCase()) {
    case '.css': return 'css';
    case '.html': return 'html';
    case '.json': return 'json';
    case '.md': return 'markdown';
    default: return 'typescript';
  }
}

function collectFiles(directory: string, root: string, files: PresentationDemoWorkspaceFile[]): void {
  if (files.length >= MAX_FILES) return;
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (files.length >= MAX_FILES) return;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) collectFiles(resolve(directory, entry.name), root, files);
      continue;
    }
    const filePath = resolve(directory, entry.name);
    if (!ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    if (statSync(filePath).size > MAX_FILE_BYTES) continue;
    const relativePath = relative(root, filePath).split(sep).join('/');
    files.push({
      path: relativePath,
      language: languageForFile(relativePath),
      content: readFileSync(filePath, 'utf8'),
    });
  }
}

export function readDemoWorkspace(id: PresentationDemoWorkspaceId): PresentationDemoWorkspace {
  const config = readDemoWorkspaceConfig(id);
  if (!config) return { id: 'none', title: '', files: [] };
  const files: PresentationDemoWorkspaceFile[] = [];
  collectFiles(config.directory, config.directory, files);
  return {
    id,
    title: config.title,
    files,
  };
}
