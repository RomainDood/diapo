import { readFileSync } from 'node:fs'; import { join, resolve } from 'node:path';
export function resolveReferenceManifest(root) { return JSON.parse(readFileSync(join(root, '.references/manifest.json'), 'utf8')); }
export function resolveReferencePath(root, name) { const manifest = resolveReferenceManifest(root); return manifest[name] ? resolve(root, manifest[name].path) : undefined; }
