import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const viewport = { width: 1440, height: 900 };

/**
 * UI tests for the PrestaShop demo store.
 * The shop URL is created in global setup and handed to the workers through process.env.SHOP_URL.
 */
export default defineConfig({
  testDir: './ui/tests',
  globalSetup: './ui/global-setup.ts',
  outputDir: 'test-results/ui',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  // The demo shop is small and shared by every worker: keep parallelism modest, and retry
  // in case the demo infrastructure answers 502 for a moment (see BUG-007).
  retries: isCI ? 2 : 1,
  workers: isCI ? 2 : 3,
  reporter: [
    [process.env.GITHUB_ACTIONS ? 'github' : 'list'], // GitHub annotations only on GitHub, readable lines elsewhere (GitLab, local)
    // Shown in GitLab's Tests tab (see .gitlab-ci.yml). The browser goes into each test's name, because GitLab
    // keeps only the first of several tests with the same name and would drop the WebKit results.
    ['junit', { outputFile: 'test-results/ui/junit.xml', includeProjectInTestName: true }],
    ['html', { outputFolder: 'playwright-report/ui', open: 'never' }],
    // Results for the combined Allure report (`npm run report`). They live in outputDir, which Playwright empties before every run.
    ['allure-playwright', {
      resultsDir: 'test-results/ui/allure-results',
      globalLabels: [{ name: 'epic', value: 'E-commerce UI (PrestaShop)' }],
      links: { issue: { urlTemplate: 'https://github.com/dardanmustafa/qa-automation-playwright-k6/blob/main/bugs/%s.md', nameTemplate: '%s' } },
    }],
  ],
  use: {
    baseURL: process.env.SHOP_URL,
    locale: 'en-GB',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport } },
  ],
});
