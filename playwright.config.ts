import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const starterPort = Number(process.env.CRAFT_STARTER_PORT ?? 4173);
const presentationDatabasePath = process.env.CRAFT_PRESENTATION_DB_PATH
  ?? join(mkdtempSync(join(tmpdir(), 'diapo-e2e-')), 'presentations.sqlite');

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:' + starterPort, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:' + starterPort,
    reuseExistingServer: false,
    env: { CRAFT_PRESENTATION_DB_PATH: presentationDatabasePath },
  },
});
