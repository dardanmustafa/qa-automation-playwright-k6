# QA automation: PrestaShop UI, OpenStreetMap API and k6 load test

Automated tests for three kinds of systems:

| Part | What | Tools | Where to start |
|---|---|---|---|
| **1. E-commerce UI** | Login, search by 3 criteria, cart, checkout on the [PrestaShop live demo](https://demo.prestashop.com/#/en/front) | Playwright, TypeScript, Page Object Model, Allure report | [`ui/`](ui/) |
| **2. REST API** | Create, read, update and delete map data on the [OpenStreetMap API](https://wiki.openstreetmap.org/wiki/API_v0.6) (development server) | Playwright API testing, TypeScript, Allure report | [`api/`](api/) |
| **3. Load test** | 1000 users visit the [QuickPizza](https://quickpizza.grafana.com) homepage within 15 s | k6 | [`load/`](load/) |

📄 **Documents:**

- [Test flows and test cases](docs/test-plan.md), written for both technical and non-technical readers
- [Load test report](docs/load-test/README.md)
- [Bug tickets](bugs/README.md): 11 bugs found, plus 2 improvement suggestions

## Results at a glance

| Suite | Result |
|---|---|
| UI, Chromium + WebKit | **42 tests**, each run in both browsers (so the report shows 84). 34 pass. 8 fail on purpose: they reproduce the 6 shop bugs below (two of them with two inputs each) and link to their tickets |
| API | **36 tests**. 34 pass. 2 fail on purpose: they reproduce the 2 API bugs below. Without an OpenStreetMap token, the 12 tests that need a signed-in user are skipped (see [below](#openstreetmap-access-token)) |
| Load | 1000 users in 15 s: **no measurable impact** on response time (median 138 ms before, 139 ms during), 0% errors |

**11 bugs**, each with a ticket that has steps to reproduce by hand ([list](bugs/README.md)):

- **Shop, 6** (BUG-001 to 006), found by exploratory testing. The UI tests reproduce all 6.
- **OpenStreetMap API, 2** (BUG-010, BUG-013), found when API tests failed. The API tests reproduce both.
- **QuickPizza, 2** (BUG-011, BUG-012), found by analysing the HTTP responses during the load test.
- **Demo environment, 1** (BUG-007), found by exploratory testing. The UI suite works around it with a health check.

## Quick start

Requirements: **Node.js 20+**, plus [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) for part 3 (`brew install k6` on macOS).

```bash
npm ci
npx playwright install chromium webkit
cp .env.example .env   # optional, see "Configuration"
```

| Command | What it does |
|---|---|
| `npm run test:ui` | UI tests in Chromium and WebKit (takes about 2–3 minutes) |
| `npm run test:api` | API tests |
| `npm test` | API tests, then UI tests, then the **Allure report** of both, in one HTML file (`allure-report/index.html`). Both suites always run, the report is built even when a test fails, and the command fails if either suite fails |
| `npm run report` | Rebuild the Allure report from the last UI and API runs and open it |
| `npm run report:ui` / `npm run report:api` | Open Playwright's own report of one suite, with a screenshot, video and trace of every failed test (for debugging) |
| `npm run load:test` | k6 load test; HTML dashboard in `load/results/dashboard.html` |
| `npm run load:analyse` | k6 analysis of a few HTTP/S responses |
| `npm run typecheck` | TypeScript type check |

Playwright options go after `--`, e.g. `npm run test:ui -- --project=chromium` (one browser) or `npm run test:ui -- --grep @smoke` (only the most important tests).

## Configuration

All settings are optional and live in `.env` (copy [`.env.example`](.env.example)):

| Variable | Used by | Meaning |
|---|---|---|
| `SHOP_URL` | UI | Empty (default): a fresh shop is created on demo.prestashop.com for every run. Set it to test a fixed shop, e.g. your own PrestaShop in Docker. |
| `OSM_ACCESS_TOKEN` | API | OAuth 2.0 token for the OpenStreetMap **development** server. Without it, the tests that need a signed-in user are skipped. |
| `OSM_CLIENT_ID` | `npm run osm:token` | Client ID of your OAuth app, remembered so you do not have to type it again. |

### OpenStreetMap access token

1. Create an account on the **development** server: <https://master.apis.dev.openstreetmap.org/user/new>. It is separate from openstreetmap.org.
2. Register an app at <https://master.apis.dev.openstreetmap.org/oauth2/applications/new>:
   - Redirect URI: `urn:ietf:wg:oauth:2.0:oob`
   - Untick *Confidential application*
   - Tick *Read user preferences*, *Modify the map* and *Modify notes*
3. Run `npm run osm:token -- <client-id>`, open the printed link, allow access, and paste the code back.
4. The script saves `OSM_ACCESS_TOKEN` in `.env` and offers to store it as the GitHub Actions secret of the same name, for CI.

## How it is built

```
ui/
  global-setup.ts   creates a demo shop, keeps it alive during the run, waits until it is ready
  fixtures.ts       gives every test its page objects, and a new customer to tests that need an account
  test-data.ts      customers, address, products, categories, carriers, payment methods
  pages/            Page Objects: one class per page, plus the header and the cart pop-up that several pages share
  tests/            login, search, cart and checkout tests
api/
  fixtures.ts       signed-in requests (OAuth token) and random test locations
  tests/            notes and map data tests
  scripts/          get-osm-token.mjs (OAuth 2.0 helper)
load/               homepage-load-test.js, response-analysis.js (k6)
docs/               test plan, load test report and results
bugs/               bug tickets with screenshots
```

### Design notes

- **Page Object Model.** Tests describe *what* a user does (`cartPage.setQuantity(mug.name, 5)`), and page objects know *how* (which button, which field). Locators use what users and assistive technology see (roles, labels and visible text) rather than CSS classes wherever the page allows it.
- **Plain API requests.** API tests call the endpoints with Playwright's `request`, so each test shows exactly what it sends, the same request that the test plan lists.
- **Fresh, isolated data.** The PrestaShop demo creates a temporary shop per visit and destroys it when the visit ends. [`ui/global-setup.ts`](ui/global-setup.ts) opens the demo page in a separate browser and keeps it open for the whole run. It then waits until five key pages, including search, answer correctly (see [BUG-007](bugs/BUG-007.md) for why). Each test runs in its own fresh browser session, with its own cookies and cart, and tests that need an account register their own new customer. So tests run in parallel without sharing carts or orders.
- **Known bugs stay visible without breaking the pipeline.** A test that reproduces an open bug is marked with `test.fail(...)`, tagged `@known-bug` and linked to its ticket with an `issue` annotation. In the Allure report it is green (it failed as expected), and the tag makes all of them easy to filter. `test.fail(...)` is declared right before the check that shows the bug, after the steps and checks that lead up to it. So a failure on the way there, such as a broken locator or a page that does not load, still fails the run, and only the bug's own check (e.g. *"Received: 25"*) is allowed to fail. When the bug is fixed, the test passes "unexpectedly", Playwright reports it, and the ticket can be closed.
- **Polite to shared services.** API tests run against OpenStreetMap's sandbox, mark everything they create as an automated test, and identify themselves with a User-Agent. The load test only downloads the homepage document from QuickPizza's public demo, which is meant for small tests.
- **No real money or personal data.** Checkout uses bank wire, check, or click & collect. Customers are generated with `@example.com` addresses on throw-away shops.

## Continuous integration

The same pipeline is defined twice, once for GitHub and once for GitLab:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (GitHub Actions) runs on every push to `main`, on every pull request, every weekday at 05:00 UTC, and on demand.
- [`.gitlab-ci.yml`](.gitlab-ci.yml) (GitLab CI) runs on every push to `main`, on every merge request, on pipeline schedules and on demand (*Build › Pipelines › Run pipeline*). It uses the official Playwright Docker image of the same version as the project. It runs once the repository is imported into a GitLab project that has a runner.

| Job | What |
|---|---|
| UI tests | Chromium + WebKit; uploads the Playwright report and the Allure results, and on GitLab a JUnit report for the pipeline's *Tests* tab |
| API tests | Uses `OSM_ACCESS_TOKEN` when present (a GitHub secret, or a masked GitLab CI/CD variable); uploads the Playwright report and the Allure results, and on GitLab a JUnit report |
| Allure report | Combines the UI and API results into one Allure report, a single HTML file (downloadable artifact) |
| Load test | Only when started manually: *"Also run the k6 load test"* on GitHub, `RUN_LOAD_TEST` = `true` on GitLab; uploads the k6 HTML dashboard |

**Cloud option:** GitHub Actions already runs everything in the cloud. The k6 test can also run on Grafana Cloud k6 (`k6 cloud run load/homepage-load-test.js` with a `K6_CLOUD_TOKEN`). It runs from one location by default, and can spread the load over several regions once they are set in the script's `options.cloud.distribution`.
