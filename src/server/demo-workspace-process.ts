import { execFileSync, spawn, type ChildProcessByStdio } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import type {
  PresentationDemoWorkspaceId,
  PresentationDemoWorkspaceConfig,
  PresentationDemoWorkspaceProcessState,
  PresentationDemoWorkspaceProcessStatus,
  PresentationDemoWorkspaceTerminalState,
} from '../shared/presentation.ts';
import { readDemoWorkspaceConfig } from './demo-workspace-registry.ts';

const demoNode = findDemoNode();
const demoRuntime = readDemoRuntime(demoNode);
const MAX_LOG_LINES = 240;
const START_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_DELAY_MS = 350;

type ManagedProcess = {
  readonly child: ChildProcessByStdio<null, Readable, Readable>;
  readonly id: PresentationDemoWorkspaceId;
  readonly config: PresentationDemoWorkspaceConfig;
  outputRemainder: string;
  healthCheckTimer?: ReturnType<typeof setTimeout>;
  stopTimer?: ReturnType<typeof setTimeout>;
  startDeadline: number;
};

type ManagedTerminalProcess = {
  readonly child: ChildProcessByStdio<null, Readable, Readable>;
  readonly id: PresentationDemoWorkspaceId;
  outputRemainder: string;
};

type DemoCommand = {
  readonly executable: string;
  readonly args: readonly string[];
  readonly longRunning: boolean;
};

function findDemoNode(): string {
  const nvmRoot = resolve(process.env.NVM_DIR ?? join(homedir(), '.nvm'), 'versions/node');
  let nvmCandidates: string[] = [];
  try {
    nvmCandidates = readdirSync(nvmRoot)
      .filter((entry) => /^v22\.\d+\.\d+$/.test(entry))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map((version) => join(nvmRoot, version, 'bin/node'));
  } catch {
    // A machine without nvm simply falls back to the Node process running Vite.
  }
  const candidates = [
    process.env.CRAFT_DEMO_NODE,
    ...nvmCandidates,
    '/opt/homebrew/opt/node@22/bin/node',
    '/usr/local/opt/node@22/bin/node',
    process.execPath,
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => existsSync(candidate)) ?? process.execPath;
}

function readDemoRuntime(nodePath: string): string {
  try {
    return execFileSync(nodePath, ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return `v${process.versions.node}`;
  }
}

function tokenizeCommand(command: string): string[] | undefined {
  if (!command.trim() || /[\r\n;&|<>`$]/.test(command)) return undefined;
  const tokens = command.trim().match(/"[^"]*"|'[^']*'|[^\s]+/g);
  if (!tokens) return undefined;
  return tokens.map((token) => token.replace(/^['"]|['"]$/g, ''));
}

function parseCommand(config: PresentationDemoWorkspaceConfig, command: string): DemoCommand | undefined {
  const tokens = tokenizeCommand(command);
  if (!tokens) return undefined;
  const [executable, ...args] = tokens;
  if (executable === 'node' && (args.length === 1 && (args[0] === '-v' || args[0] === '--version'))) {
    return { executable: demoNode, args, longRunning: false };
  }
  if (executable === 'pwd' && args.length === 0) {
    return { executable: process.platform === 'win32' ? 'cd' : '/bin/pwd', args: [], longRunning: false };
  }
  if (executable === 'ls' && args.length === 0) {
    return { executable: process.platform === 'win32' ? 'cmd' : '/bin/ls', args: process.platform === 'win32' ? ['/c', 'dir'] : [], longRunning: false };
  }
  if (executable === 'ng' && args.length === 1 && args[0] === 'serve') {
    return { executable, args: ['serve', '--host', '127.0.0.1', '--port', String(config.port)], longRunning: true };
  }
  if (command === config.command) {
    return { executable, args, longRunning: true };
  }
  const script = args[0] === 'run' ? args[1] : args[0];
  if ((executable === 'npm' || executable === 'pnpm') && script === 'start') {
    return { executable, args, longRunning: true };
  }
  if ((executable === 'npm' || executable === 'pnpm') && script === 'build') {
    return { executable, args, longRunning: false };
  }
  return undefined;
}

function workspaceEnvironment(config: PresentationDemoWorkspaceConfig): NodeJS.ProcessEnv {
  const nodeBin = dirname(demoNode);
  const localBin = join(config.directory, 'node_modules/.bin');
  return { ...process.env, PATH: [nodeBin, localBin, process.env.PATH].filter(Boolean).join(':'), FORCE_COLOR: '0' };
}

function emptyStatus(id: PresentationDemoWorkspaceId): PresentationDemoWorkspaceProcessStatus {
  const config = readDemoWorkspaceConfig(id);
  return {
    id,
    state: 'stopped',
    terminalState: 'idle',
    url: config ? `http://127.0.0.1:${config.port}` : '',
    command: config?.command ?? '',
    terminalCommand: '',
    runtime: demoRuntime,
    logs: [],
  };
}

export class DemoWorkspaceProcessManager {
  private readonly statuses = new Map<PresentationDemoWorkspaceId, PresentationDemoWorkspaceProcessStatus>();
  private readonly processes = new Map<PresentationDemoWorkspaceId, ManagedProcess>();
  private readonly terminalProcesses = new Map<PresentationDemoWorkspaceId, ManagedTerminalProcess>();

  status(id: PresentationDemoWorkspaceId): PresentationDemoWorkspaceProcessStatus {
    return this.statuses.get(id) ?? emptyStatus(id);
  }

  start(id: PresentationDemoWorkspaceId): PresentationDemoWorkspaceProcessStatus {
    const config = readDemoWorkspaceConfig(id);
    if (!config) return this.status(id);
    const current = this.status(id);
    if (current.state === 'starting' || current.state === 'running' || current.state === 'stopping') return current;

    const parsed = parseCommand(config, config.command);
    if (!parsed) return this.status(id);
    const child = spawn(parsed.executable, [...parsed.args], {
      cwd: config.directory,
      env: workspaceEnvironment(config),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const managed: ManagedProcess = {
      child,
      id,
      config,
      outputRemainder: '',
      startDeadline: Date.now() + START_TIMEOUT_MS,
    };
    this.processes.set(id, managed);
    this.updateStatus(id, 'starting', [`$ ${config.command}`]);
    child.stdout.on('data', (chunk: Buffer | string) => this.appendOutput(managed, String(chunk)));
    child.stderr.on('data', (chunk: Buffer | string) => this.appendOutput(managed, String(chunk)));
    child.once('error', (error) => {
      this.appendOutput(managed, `${error.message}\n`);
      this.finishProcess(managed, 'error');
    });
    child.once('close', (code, signal) => {
      if (managed.healthCheckTimer) clearTimeout(managed.healthCheckTimer);
      if (managed.stopTimer) clearTimeout(managed.stopTimer);
      const currentStatus = this.status(id);
      if (currentStatus.state === 'stopping') {
        this.updateStatus(id, 'stopped');
      } else if (code !== 0 || signal) {
        this.appendOutput(managed, `\nProcess exited${code === null ? ` with ${signal ?? 'an error'}` : ` with code ${code}`}.\n`);
        this.updateStatus(id, 'error');
      } else {
        this.updateStatus(id, 'stopped');
      }
      this.processes.delete(id);
    });
    this.scheduleHealthCheck(managed);
    return this.status(id);
  }

  runCommand(id: PresentationDemoWorkspaceId, command: string): PresentationDemoWorkspaceProcessStatus {
    const config = readDemoWorkspaceConfig(id);
    if (!config) return this.status(id);
    const normalizedCommand = command.trim();
    const parsed = parseCommand(config, normalizedCommand);
    if (!parsed) {
      this.appendLog(id, `$ ${normalizedCommand}`, 'error');
      this.appendLog(id, 'Command not allowed. Try: node -v, ng serve, npm start, or npm run build.', 'error');
      return this.status(id);
    }
    if (parsed.longRunning) return this.start(id);
    if (this.terminalProcesses.has(id)) return this.status(id);

    const child = spawn(parsed.executable, [...parsed.args], {
      cwd: config.directory,
      env: workspaceEnvironment(config),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const managed: ManagedTerminalProcess = { child, id, outputRemainder: '' };
    this.terminalProcesses.set(id, managed);
    this.updateTerminalStatus(id, 'running', normalizedCommand, [`$ ${normalizedCommand}`]);
    child.stdout.on('data', (chunk: Buffer | string) => this.appendTerminalOutput(managed, String(chunk)));
    child.stderr.on('data', (chunk: Buffer | string) => this.appendTerminalOutput(managed, String(chunk)));
    child.once('error', (error) => {
      this.appendTerminalOutput(managed, `${error.message}\n`);
      this.updateTerminalStatus(id, 'error');
      this.terminalProcesses.delete(id);
    });
    child.once('close', (code) => {
      if (code !== 0) this.appendTerminalOutput(managed, `\nProcess exited with code ${code ?? 'an error'}.\n`);
      this.updateTerminalStatus(id, code === 0 ? 'idle' : 'error');
      this.terminalProcesses.delete(id);
    });
    return this.status(id);
  }

  stop(id: PresentationDemoWorkspaceId): PresentationDemoWorkspaceProcessStatus {
    const managed = this.processes.get(id);
    if (!managed) {
      this.updateStatus(id, 'stopped');
      return this.status(id);
    }
    if (this.status(id).state === 'stopping') return this.status(id);
    this.updateStatus(id, 'stopping', ['Stopping local demo…']);
    managed.child.kill('SIGINT');
    managed.stopTimer = setTimeout(() => {
      if (this.processes.get(id) === managed && this.status(id).state === 'stopping') managed.child.kill('SIGTERM');
    }, 2_000);
    return this.status(id);
  }

  stopAll(): void {
    for (const id of this.processes.keys()) this.stop(id);
    for (const managed of this.terminalProcesses.values()) managed.child.kill('SIGTERM');
  }

  private scheduleHealthCheck(managed: ManagedProcess): void {
    managed.healthCheckTimer = setTimeout(() => {
      if (this.processes.get(managed.id) !== managed || this.status(managed.id).state !== 'starting') return;
      void fetch(`http://127.0.0.1:${managed.config.port}`, { signal: AbortSignal.timeout(1_000) }).then((response) => {
        if (response.ok) this.updateStatus(managed.id, 'running');
        else if (Date.now() >= managed.startDeadline) {
          this.appendOutput(managed, '\nThe local demo did not become ready within 30 seconds.\n');
          this.finishProcess(managed, 'error');
        } else this.scheduleHealthCheck(managed);
      }).catch(() => {
        if (Date.now() >= managed.startDeadline) {
          this.appendOutput(managed, '\nThe local demo did not become ready within 30 seconds.\n');
          this.finishProcess(managed, 'error');
          return;
        }
        this.scheduleHealthCheck(managed);
      });
    }, HEALTH_CHECK_DELAY_MS);
  }

  private finishProcess(managed: ManagedProcess, state: Extract<PresentationDemoWorkspaceProcessState, 'error' | 'stopped'>): void {
    if (managed.healthCheckTimer) clearTimeout(managed.healthCheckTimer);
    if (!managed.child.killed) managed.child.kill('SIGTERM');
    this.updateStatus(managed.id, state);
  }

  private appendOutput(managed: ManagedProcess, output: string): void {
    if (this.status(managed.id).state === 'stopping') return;
    const combined = managed.outputRemainder + output.replaceAll('\r', '');
    const lines = combined.split('\n');
    managed.outputRemainder = lines.pop() ?? '';
    if (lines.length === 0) return;
    const current = this.status(managed.id);
    this.statuses.set(managed.id, {
      ...current,
      logs: [...current.logs, ...lines].slice(-MAX_LOG_LINES),
    });
  }

  private appendTerminalOutput(managed: ManagedTerminalProcess, output: string): void {
    const combined = managed.outputRemainder + output.replaceAll('\r', '');
    const lines = combined.split('\n');
    managed.outputRemainder = lines.pop() ?? '';
    if (lines.length === 0) return;
    this.appendLog(managed.id, lines.join('\n'));
  }

  private appendLog(id: PresentationDemoWorkspaceId, output: string, terminalState?: PresentationDemoWorkspaceTerminalState): void {
    const current = this.status(id);
    this.statuses.set(id, {
      ...current,
      ...(terminalState ? { terminalState } : {}),
      logs: [...current.logs, ...output.split('\n')].slice(-MAX_LOG_LINES),
    });
  }

  private updateTerminalStatus(id: PresentationDemoWorkspaceId, terminalState: PresentationDemoWorkspaceTerminalState, command?: string, extraLogs: readonly string[] = []): void {
    const current = this.status(id);
    this.statuses.set(id, {
      ...current,
      terminalState,
      terminalCommand: command ?? current.terminalCommand,
      logs: [...current.logs, ...extraLogs].slice(-MAX_LOG_LINES),
    });
  }

  private updateStatus(id: PresentationDemoWorkspaceId, state: PresentationDemoWorkspaceProcessState, extraLogs: readonly string[] = []): void {
    const current = this.status(id);
    this.statuses.set(id, {
      ...current,
      state,
      logs: [...current.logs, ...extraLogs].slice(-MAX_LOG_LINES),
    });
  }
}
