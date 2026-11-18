import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'browser',
  fullyParallel: true,
  reporter: 'list',
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 }
  }
});
