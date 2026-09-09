import { execFileSync } from 'node:child_process'; import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'; import { join, relative, resolve } from 'node:path';
const projectRoot = realpathSync(resolve(import.meta.dirname, '..'));
const gitRoot = realpathSync(resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: projectRoot, encoding: 'utf8' }).trim()));
const manifestPath = join(projectRoot, '.references/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const metadataKeys = new Set(['schemaVersion', 'mode', 'effectEnabled']);
const subtreeSha = () => {
  const message = execFileSync('git', ['log', '-n', '20', '--format=%B'], { cwd: gitRoot, encoding: 'utf8' });
  return message.match(/^git-subtree-split: ([0-9a-f]{40})$/m)?.[1];
};
if (execFileSync('git', ['status', '--short'], { cwd: gitRoot, encoding: 'utf8' }).trim()) {
  throw new Error('Working tree is not clean; commit or stash changes before updating vendored references.');
}
for (const [, entry] of Object.entries(manifest).filter(([key, value]) => !metadataKeys.has(key) && value && value.path)) {
  const path = resolve(projectRoot, entry.path);
  if (!existsSync(path)) throw new Error('Missing vendored reference: ' + path);
  if (existsSync(join(path, '.git'))) throw new Error('Nested Git clone found; migrate this reference to git subtree: ' + path);
  const prefix = relative(gitRoot, path).replaceAll('\\', '/');
  const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: gitRoot, encoding: 'utf8' }).trim();
  execFileSync('git', ['subtree', 'pull', '--prefix=' + prefix, entry.url, entry.requestedRef, '--squash'], { cwd: gitRoot, stdio: 'inherit' });
  const after = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: gitRoot, encoding: 'utf8' }).trim();
  if (after !== before) {
    const sha = subtreeSha();
    if (sha) entry.resolvedSha = sha;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const manifestRelative = relative(gitRoot, realpathSync(manifestPath)).replaceAll('\\', '/');
    execFileSync('git', ['add', '--', manifestRelative], { cwd: gitRoot });
    execFileSync('git', ['commit', '--amend', '--no-edit'], { cwd: gitRoot, stdio: 'inherit' });
  }
}
