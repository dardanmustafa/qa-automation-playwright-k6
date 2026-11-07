import { test as base, expect, type APIRequestContext } from '@playwright/test';

const token = process.env.OSM_ACCESS_TOKEN?.trim();

/**
 * Tests send anonymous requests with Playwright's built-in `request` fixture, and requests as a
 * signed-in user with `signedIn` (OAuth 2.0 token from OSM_ACCESS_TOKEN). Tests that use `signedIn`
 * are skipped while the token is not set.
 */
export const test = base.extend<{ signedIn: APIRequestContext }>({
  signedIn: async ({ playwright, baseURL, extraHTTPHeaders }, use, testInfo) => {
    testInfo.skip(!token, 'OSM_ACCESS_TOKEN is not set - see README "OpenStreetMap access token"');
    const signedIn = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { ...extraHTTPHeaders, Authorization: `Bearer ${token}` },
    });
    await use(signedIn);
    await signedIn.dispose();
  },
});

export { expect };

/**
 * A random point near "Null Island" (0, 0) in the Gulf of Guinea, so parallel runs do not collide.
 * The development server is a sandbox: nothing created there reaches the real map.
 */
export function randomLocation() {
  const coordinate = () => Number((Math.random() * 0.5 + 0.01).toFixed(6));
  return { lat: coordinate(), lon: coordinate() };
}
