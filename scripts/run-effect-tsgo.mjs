import { chmodSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const effectTsgoPath = resolve(projectRoot, 'node_modules/.bin/effect-tsgo');
if (process.platform !== 'win32') {
  const nativeBinary = resolve(
    projectRoot,
    'node_modules',
    '@effect',
    'tsgo-' + process.platform + '-' + process.arch,
    'lib',
    'tsc',
  );
if (existsSync(nativeBinary)) chmodSync(nativeBinary, 0o755);
}
const originalArgs = process.argv.slice(2);
const projectArgument = valueAfter(originalArgs, '--project') ?? valueAfter(originalArgs, '-p');
if (originalArgs[0] === 'diagnostics' && projectArgument) {
  const projectPath = resolve(projectRoot, projectArgument);
  const listed = spawnSync(
    resolve(projectRoot, 'node_modules/.bin/tsc'),
    ['-p', projectPath, '--listFilesOnly', '--pretty', 'false'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  const programFiles = (listed.stdout ?? '').split(/\r?\n/).filter((file) => /\.(ts|tsx|mts|cts)$/.test(file));
  console.log('Effect check scope: ' + relative(projectRoot, projectPath));
  console.log('TypeScript program files: ' + programFiles.length);
  if (programFiles.length === 0) {
    console.error('Effect check refused to continue: the TypeScript program contains no files. Check --project and tsconfig include/exclude.');
    process.exitCode = 1;
    process.exit();
  }
}
const args =
  originalArgs[0] === 'diagnostics' && !originalArgs.includes('--progress')
    ? [...originalArgs, '--progress']
    : originalArgs;
const result = spawnSync(effectTsgoPath, args, {
  cwd: projectRoot,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  const inline = args.find((argument) => argument.startsWith(flag + '='));
  return inline?.slice(flag.length + 1);
}
