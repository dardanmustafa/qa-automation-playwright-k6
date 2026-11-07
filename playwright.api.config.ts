import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

/**
 * REST API tests for the OpenStreetMap API 0.6 on the official development server.
 * The development server is a sandbox: data created here never reaches openstreetmap.org.
 */
export default defineConfig({
  testDir: './api/tests',
  outputDir: 'test-results/api',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 2, // a shared, free sandbox: stay polite
  reporter: [
    [process.env.GITHUB_ACTIONS ? 'github' : 'list'], // GitHub annotations only on GitHub, readable lines elsewhere (GitLab, local)
    ['junit', { outputFile: 'test-results/api/junit.xml' }], // shown in GitLab's Tests tab (see .gitlab-ci.yml)
    ['html', { outputFolder: 'playwright-report/api', open: 'never' }],
    // Results for the combined Allure report (`npm run report`). They live in outputDir, which Playwright empties before every run.
    ['allure-playwright', {
      resultsDir: 'test-results/api/allure-results',
      globalLabels: [{ name: 'epic', value: 'REST API (OpenStreetMap)' }],
      links: { issue: { urlTemplate: 'https://github.com/dardanmustafa/qa-automation-playwright-k6/blob/main/bugs/%s.md', nameTemplate: '%s' } },
    }],
  ],
  use: {
    baseURL: 'https://master.apis.dev.openstreetmap.org/api/0.6/',
    extraHTTPHeaders: {
      // OSM's API usage policy asks every client to identify itself.
      'User-Agent': 'qa-automation-playwright-k6/1.0 (Playwright API tests)',
      // Playwright's default list, but with spaces: map data requests reject "gzip,deflate,br" (BUG-013).
      'Accept-Encoding': 'gzip, deflate, br',
    },
  },
});
