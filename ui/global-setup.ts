import { chromium, request, type APIRequestContext, type Browser } from '@playwright/test';

/**
 * Runs once before the UI tests and returns the teardown that runs after them.
 *
 * The PrestaShop live demo has no fixed shop URL: every visit to demo.prestashop.com creates a fresh,
 * temporary shop (e.g. https://boss-riddle.demo.prestashop.com), shows it in an iframe and destroys it
 * when the page is closed. So, unless SHOP_URL is set, we open the demo page in a browser that stays open
 * for the whole run and hand the shop URL to the tests through process.env.SHOP_URL.
 */
export default async function globalSetup() {
  let demoBrowser: Browser | undefined;

  if (!process.env.SHOP_URL) {
    demoBrowser = await chromium.launch();
    const demoPage = await demoBrowser.newPage();
    await demoPage.goto('https://demo.prestashop.com/#/en/front', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const shopFrame = demoPage.locator('#framelive[src^="http"]');
    await shopFrame.waitFor({ state: 'attached', timeout: 90_000 });
    process.env.SHOP_URL = new URL((await shopFrame.getAttribute('src'))!).origin;
  }

  const shopUrl = process.env.SHOP_URL;
  console.log(`[setup] Shop under test: ${shopUrl} - waiting until it is ready...`);
  const started = Date.now();
  await waitUntilReady(shopUrl);
  console.log(`[setup] Shop ready after ${Math.round((Date.now() - started) / 1000)}s`);

  return async () => {
    await demoBrowser?.close();
  };
}

/** Pages that must answer 200 and show the given text before the shop is considered ready. */
const READINESS_CHECKS = [
  { path: '/', text: 'Main navigation' },
  { path: '/login', text: 'Sign in' },
  { path: '/registration', text: 'Create an account' },
  { path: '/cart?action=show', text: 'Shopping Cart' },
  // The search index is built after the shop starts, so check that search really finds products.
  { path: '/search?controller=search&s=mug', text: 'Mug The best is yet to come' },
];

/**
 * A new demo shop answers 502 or hangs now and then during its first minute (BUG-007).
 * It is ready when every check passes twice in a row.
 */
async function waitUntilReady(shopUrl: string) {
  const api = await request.newContext({ baseURL: shopUrl, timeout: 20_000 });
  const deadline = Date.now() + 240_000;
  let cleanRounds = 0;
  let problem: string | undefined;

  while (cleanRounds < 2) {
    if (Date.now() > deadline) throw new Error(`Shop ${shopUrl} was not ready after 4 minutes. Last problem: ${problem}`);
    problem = await findProblem(api);
    cleanRounds = problem ? 0 : cleanRounds + 1;
    if (cleanRounds < 2) await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  await api.dispose();
}

/** Returns what is wrong with the shop, or undefined when every check passes. */
async function findProblem(api: APIRequestContext): Promise<string | undefined> {
  for (const { path, text } of READINESS_CHECKS) {
    try {
      const response = await api.get(path);
      if (response.status() !== 200) return `${path} answered HTTP ${response.status()}`;
      if (!(await response.text()).includes(text)) return `${path} does not show "${text}"`;
    } catch (error) {
      return `${path} did not answer: ${(error as Error).message.split('\n')[0]}`;
    }
  }
  return undefined;
}
