import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const WORKERS     = Number.parseInt(process.env.WORKERS    ?? '1');
const TIMEOUT_NAV = Number.parseInt(process.env.TIMEOUT_NAV ?? '120000');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: WORKERS,
  retries: 0,
  timeout: TIMEOUT_NAV * 3,
  globalTeardown: './global-teardown.ts',
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/session.json',
      },
      dependencies: ['setup'],
    },
  ],
});
