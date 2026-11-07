# Bug tickets

Bugs found while testing. Every ticket has steps to reproduce, expected and actual results, and evidence.
Where possible, a bug is also covered by an automated test. Those tests are marked as *expected to fail* (`test.fail`) and link to the ticket. They keep the pipeline green while the bug exists, and Playwright reports them as soon as the bug is fixed (the test then passes unexpectedly), so the ticket can be closed.

| ID | Title | Severity | Priority | Area | Found by | Automated test |
|---|---|---|---|---|---|---|
| [BUG-001](BUG-001.md) | Search returns unrelated products for words that match nothing | Major | High | Shop · Search | Exploratory testing | TC-SEARCH-04 |
| [BUG-002](BUG-002.md) | Quantity "2.5" in the cart becomes 25 items | Major | High | Shop · Cart | Exploratory testing | TC-CART-09 |
| [BUG-003](BUG-003.md) | Negative quantity "-3" in the cart becomes 3 items | Minor | Medium | Shop · Cart | Exploratory testing | TC-CART-10 |
| [BUG-004](BUG-004.md) | Future birth date is rejected with a misleading "Format should be…" message | Minor | Low | Shop · Create account | Exploratory testing | TC-LOGIN-11 |
| [BUG-005](BUG-005.md) | "Hummingbird printed sweater" has the image text and URL of "Brown bear printed sweater" | Minor | Medium | Shop · Catalogue | Exploratory testing | TC-SEARCH-11 |
| [BUG-006](BUG-006.md) | Bank-wire payment instructions show blank placeholders instead of bank details | Major | Medium | Shop · Checkout | Exploratory testing | TC-CHK-06 |
| [BUG-007](BUG-007.md) | A new demo shop sometimes answers 502 Bad Gateway or hangs during its first minute | Medium | Medium | Demo environment | Exploratory testing | – (the UI suite works around it with a health check) |
| [BUG-010](BUG-010.md) | OSM API: caching (304 Not Modified) never works for compressed answers | Medium | Medium | OSM API | An API test that failed | API-NOTE-12 |
| [BUG-011](BUG-011.md) | QuickPizza: `http://` does not redirect to HTTPS, it times out | Medium | Medium | QuickPizza | Load-test response analysis | – (the k6 check `http: redirected to https` in [`response-analysis.js`](../load/response-analysis.js) reports it on every run, but doesn't fail the run) |
| [BUG-012](BUG-012.md) | QuickPizza: no compression and no caching headers, even on static files | Minor | Low | QuickPizza | Load-test response analysis | – |
| [BUG-013](BUG-013.md) | OSM API: map data requests are refused (406) when `Accept-Encoding` has no spaces after the commas | Medium | Medium | OSM API | An API test that failed | API-MAP-13 |

**Severity** is how badly the bug hurts users or the business:

- **Blocker:** a core flow is impossible.
- **Major:** wrong results, money or data at risk.
- **Medium:** a degraded experience with a workaround.
- **Minor:** cosmetic or rare.

**Priority** is how soon it should be fixed.

Screenshots are in [`assets/`](assets/). In the Allure report, every test that reproduces a bug is tagged `known-bug` and links to its ticket. Both the Allure and the Playwright report show the failed check, e.g. *Expected: not "25", Received: "25"*.

**Environment for the shop bugs:**

- Shop: PrestaShop 9 with the Hummingbird theme, on the official live demo (`demo.prestashop.com`, a temporary shop per visit)
- Browsers: Chromium and WebKit (Playwright 1.64), macOS
- Date: 23 October 2026

## Improvement suggestions

Behaviour that matches the provider's documented design, so it is not a bug, but that would make the API easier to use. Both were first filed as bugs (BUG-008 and BUG-009) and reclassified after checking OpenStreetMap's own definition of the behaviour. Their tests check the current, documented behaviour and pass.

| ID | Title | Priority | Area | Automated test |
|---|---|---|---|---|
| [IMP-001](IMP-001.md) | OSM API: offer JSON error answers on `.json` endpoints | Low | OSM API | API-NOTE-09 (checks today's plain-text errors) |
| [IMP-002](IMP-002.md) | OSM API: answer 405 Method Not Allowed for unsupported HTTP methods | Low | OSM API | API-NOTE-10 (checks today's 404) |
