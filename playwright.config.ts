import { defineConfig, devices } from '@playwright/test';

const starterPort = Number(process.env.CRAFT_STARTER_PORT ?? 4173);

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:' + starterPort, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:' + starterPort,
    reuseExistingServer: false,
  },
});
