import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { PresentationDemoWorkspaceConfig } from '../shared/presentation.ts';

const stackblitzRoot = resolve(import.meta.dirname, '../../../stackblitz');
const registryPath = resolve(import.meta.dirname, '.data/demo-workspaces.json');

const builtInWorkspace: PresentationDemoWorkspaceConfig = {
  id: 'angular-route-resources',
  title: 'Démo Angular Route Resources',
  directory: stackblitzRoot,
  command: 'pnpm start -- --host 127.0.0.1 --port 4200',
  port: 4200,
};

function validConfig(value: unknown): value is PresentationDemoWorkspaceConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Record<string, unknown>;
  return typeof config.id === 'string'
    && /^[a-z0-9][a-z0-9-]{1,63}$/.test(config.id)
    && config.id !== 'none'
    && typeof config.title === 'string'
    && typeof config.directory === 'string'
    && config.directory.length > 0
    && typeof config.command === 'string'
    && config.command.length > 0
    && typeof config.port === 'number'
    && Number.isInteger(config.port)
    && config.port >= 1024
    && config.port <= 65535
    && existsSync(config.directory);
}

function readCustomWorkspaces(): readonly PresentationDemoWorkspaceConfig[] {
  try {
    const value: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
    return Array.isArray(value) ? value.filter(validConfig) : [];
  } catch {
    return [];
  }
}

export function readDemoWorkspaceConfigs(): readonly PresentationDemoWorkspaceConfig[] {
  return [builtInWorkspace, ...readCustomWorkspaces().filter((config) => config.id !== builtInWorkspace.id)];
}

export function readDemoWorkspaceConfig(id: string): PresentationDemoWorkspaceConfig | undefined {
  return readDemoWorkspaceConfigs().find((config) => config.id === id);
}

export function saveDemoWorkspaceConfig(config: unknown): PresentationDemoWorkspaceConfig {
  if (!validConfig(config)) throw new Error('The project id, directory, command, and port are invalid.');
  if (config.id === builtInWorkspace.id) throw new Error('The built-in Angular project cannot be replaced.');
  mkdirSync(dirname(registryPath), { recursive: true });
  const custom = readCustomWorkspaces().filter((entry) => entry.id !== config.id);
  writeFileSync(registryPath, `${JSON.stringify([...custom, config], null, 2)}\n`, 'utf8');
  return config;
}
