# Load test report – QuickPizza homepage

**Tool:** [k6](https://k6.io) 2.3 · **Target:** <https://quickpizza.grafana.com> · **Protocol:** HTTPS (HTTP/2, TLS 1.3)
**Run:** 23 Oct 2026, from a laptop in Europe · **Scripts:** [`load/homepage-load-test.js`](../../load/homepage-load-test.js), [`load/response-analysis.js`](../../load/response-analysis.js)

## In short

| Question | Answer |
|---|---|
| Did 1000 users in 15 s slow the site down? | **No.** The homepage answered in a median of **138 ms before**, **139 ms during** and **138 ms after** the load. p95 moved from 141 ms to 140 ms. 0 errors out of 1,056 requests. |
| How long does a new visitor's first request take? | About **415 ms** for the homepage's HTML: ~137 ms to open the connection, ~141 ms for encryption (TLS), ~138 ms for the answer. Almost all of that is the distance between Europe and the server in Ohio (USA). The page's JS and CSS files and the time to display the page come on top; this test doesn't measure them. |
| What is a good response time for a modern web app? | Server answer (TTFB) **under 200 ms** is great, under 800 ms acceptable. The main content of a page should be visible within **2.5 s**, and the page should react to a click within **200 ms**. See [below](#what-is-a-good-response-time-for-a-modern-web-application). |
| Anything wrong in the HTTP/S responses? | Yes, mostly about performance: no compression, no caching headers on static files, no HSTS, and plain `http://` does not redirect to HTTPS (it times out). See [the analysis](#analysis-of-a-few-https-responses). |

## The test in detail

### What is simulated

1000 users visiting the homepage within 15 seconds is modelled as **1000 brand-new visitors arriving at an even pace over 15 seconds**, about 67 new visitors every second. Each visitor:

- opens a **new** TCP connection and does a **new** TLS handshake, like someone who has never been to the site (`noVUConnectionReuse`)
- has no cookies
- requests the homepage `GET /` once and checks the answer:
  - the status is `200`
  - the content type is HTML
  - the page is really the QuickPizza page

k6's [`constant-arrival-rate`](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/) executor starts new visitors at a fixed rate, whether or not earlier visitors are finished. That is how real traffic behaves. A fixed group of users that each wait for their previous request would slow down automatically when the server slows down, and hide the problem.

### Measuring "before" and "during"

The run has four phases, so the same thing is measured before, during and after the load:

```
 0s ─── before ─── 30s    35s ── load: 1000 new visitors ── 50s    55s ─── after ─── 85s
                          35s ── during: 1 reference user ─ 50s
```

| Phase | Who | Why |
|---|---|---|
| **before** | 1 reference user: one visit, a 1-second pause, repeat | The normal response time, with no extra load (baseline). |
| **load** | 1000 new visitors over 15 s | The load itself. Its own response times are measured too. |
| **during** | The same reference user as in *before*, at the same time as the load | A like-for-like comparison: same user and same behaviour, but now the server is busy. |
| **after** | The reference user again | Shows whether the site goes back to normal (recovers). |

### What is measured

| Metric | Meaning in plain words |
|---|---|
| `http_req_duration` | Time from sending the request until the full answer arrived. The connection set-up is *not* included. |
| `http_req_waiting` (TTFB) | "Time to first byte": how long we wait for the server to start answering. |
| `http_req_connecting` / `http_req_tls_handshaking` | Time to open the TCP connection / to agree on encryption. |
| `http_req_blocked` | Time to get a connection. For a new visitor that is the TCP connect plus the TLS handshake, so connection + `http_req_duration` is everything a new visitor waits for. |
| `http_req_failed` | Share of requests that failed (network error or HTTP status 4xx/5xx). |
| `dropped_iterations` | Visitors k6 could not start in time. It must be 0, or fewer than 1000 users were really simulated. |

Results are reported as **percentiles**, not just averages. "p95 = 141 ms" means 95 out of 100 visitors got their answer in 141 ms or less. Averages hide the slow visitors, and percentiles show them.

### Pass/fail criteria (k6 thresholds)

A run fails (k6 exit code 99) when any of these rules is broken during the load phase:

| Rule | Value |
|---|---|
| Failed requests | < 1% |
| Homepage answer time, p95 | < 1000 ms |
| Checks passed | > 99% |
| Dropped visitors | 0 |

### Choices made on purpose

- **Only the HTML document is downloaded, not the 18 JS/CSS files behind it.** QuickPizza's [README](https://github.com/grafana/quickpizza#readme) says the public instance is for *"small-scale performance tests"*. Downloading the assets as well would send about 18 times more requests (~1,200 per second). Heavier tests like that belong on your own copy (`docker run -p 3333:3333 ghcr.io/grafana/quickpizza-local`, then `-e BASE_URL=http://localhost:3333`).
- **The traffic is identified.** Requests carry the user agent `qa-automation-playwright-k6/1.0 (k6 load test)`, so the site owners can recognise it.
- **Target and load are configurable:** `BASE_URL`, `USERS`, `SECONDS`.

### How to run it

```bash
npm run load:test      # the load test + HTML dashboard in load/results/dashboard.html
npm run load:analyse   # the HTTP/S response analysis
```

`npm run load:test` runs k6 with `--summary-mode=full`, so the summary at the end has a section for every phase (before, load, during, after).

In CI the load test runs only when started manually (*Actions → QA automation → Run workflow → "Also run the k6 load test"*). That way the shared public demo is not hit on every commit.

## Results

Recorded on 23 Oct 2026 with `npm run load:test`. k6's own summary of that run is in [`k6-summary.txt`](k6-summary.txt), and the interactive charts are in [`k6-dashboard.html`](k6-dashboard.html) (download it and open it in a browser).

| Phase | Requests | Failed | Avg | Median | p90 | p95 | p99 | Max | Median TTFB | Median TCP connect | Median TLS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| before | 22 | 0% | 139 ms | 138 ms | 140 ms | 141 ms | 163 ms | 168 ms | 138 ms | 138 ms | 142 ms |
| during | 11 | 0% | 139 ms | 139 ms | 140 ms | 140 ms | 140 ms | 140 ms | 139 ms | 137 ms | 141 ms |
| load | 1001 | 0% | 138 ms | 138 ms | 140 ms | 141 ms | 142 ms | 146 ms | 138 ms | 137 ms | 140 ms |
| after | 22 | 0% | 138 ms | 138 ms | 141 ms | 141 ms | 142 ms | 143 ms | 138 ms | 138 ms | 142 ms |

All four pass/fail rules passed. The load phase shows 1001 requests because the arrival-rate scheduler rounds up by one visitor.

### Did the load test have an impact on response time?

**No measurable impact.** Comparing the reference user before and during the load:

| | Before | During | Difference |
|---|---:|---:|---:|
| Median answer time | 138 ms | 139 ms | +1 ms |
| p95 answer time | 141 ms | 140 ms | −1 ms |
| Errors | 0% | 0% | – |

The ±1 ms differences are normal network jitter. The slowest of the 1001 visitors (146 ms) was only 8 ms slower than the median, and the slowest request of the whole run (168 ms) came in the *before* phase, without any load.

**Why there is no measurable impact:**

1. **Most of the answer time is network distance.** TTFB (~138 ms) is about the same as the TCP connect time (~137 ms), which is one network round trip. In the [analysis below](#analysis-of-a-few-https-responses), the two differ by −1 to 3 ms for each of the five requests. That suggests network latency dominates; the server's own processing time was not measured directly. The test ran from Europe, and the site's DNS name points to an AWS load balancer in `us-east-2` (Ohio), `k8s-k6quickp-quickpiz-054c2324eb-….us-east-2.elb.amazonaws.com`. Every answer also sets AWS's load-balancer cookie, `AWSALB`.
2. **67 requests per second for a 2.8 KB page is light** for a service behind an AWS load balancer. The `k8s-` at the start of the load balancer's name is how AWS names load balancers that it creates for Kubernetes, so the site most likely runs on Kubernetes.
3. **The load did not reach the expensive parts:** no JS/CSS downloads and no API calls.

**What this does *not* show:** where the site's limit is. The test answers "does 1000 users in 15 s hurt?", not "how many users before it breaks?". To find the limit, run a **stress test** against your own copy of QuickPizza. Raise the arrival rate step by step (`ramping-arrival-rate`), include the assets and the `/api/pizza` call, and watch for the point where p95 or the error rate starts to climb. One run from one location is also only one sample. Repeat it, ideally from the region where the users are.

## What is a good response time for a modern web application?

There is no single number. It depends on what is measured:

| What | Good | Needs improvement | Source |
|---|---|---|---|
| **Server answer (TTFB)** | ≤ 200 ms ideal, ≤ 800 ms "good" | > 1.8 s is poor | [web.dev – TTFB](https://web.dev/articles/ttfb) |
| **Main content visible** (Largest Contentful Paint) | ≤ 2.5 s | > 4 s is poor | [Core Web Vitals](https://web.dev/articles/vitals) |
| **Reaction to a click or tap** (Interaction to Next Paint) | ≤ 200 ms | > 500 ms is poor | Core Web Vitals |
| **API calls behind the page** | ≤ 100–300 ms | > 1 s | common industry practice |

How people perceive delays (Jakob Nielsen's classic limits):

- **0.1 s** feels instant.
- **1 s** keeps the user's flow of thought.
- **10 s** is about where people lose attention and leave.

Google's Core Web Vitals are judged at the **75th percentile of real visitors**. In load tests we usually set targets on the **95th or 99th percentile**, so slow outliers are not hidden by the average.

Measured against these numbers, QuickPizza is in good shape: a ~140 ms server answer (mostly network distance) and ~415 ms for a new visitor's first HTML request including connection setup, even from another continent. How fast the page displays and reacts (Largest Contentful Paint, Interaction to Next Paint) needs a browser, and this test does not measure it.

## Analysis of a few HTTP/S responses

From [`response-analysis.txt`](response-analysis.txt). Each request used a fresh connection.

| # | Request | Status | Protocol | Size | Connection set-up (TCP + TLS) | TTFB | Download |
|---|---|---|---|---:|---:|---:|---:|
| 1 | `GET /` (homepage HTML) | **200 OK** | HTTP/2, TLS 1.3 | 2,847 B | 134 + 150 ms | 134 ms | 0.2 ms |
| 2 | `GET /_app/immutable/assets/0.kLK4yNcK.css` | **200 OK** | HTTP/2, TLS 1.3 | 16,151 B | 135 + 144 ms | 138 ms | **135 ms** |
| 3 | `GET /api/quotes` (public JSON API) | **200 OK** | HTTP/2, TLS 1.3 | 495 B | 138 + 147 ms | 137 ms | 0.2 ms |
| 4 | `POST /api/pizza` without token | **401 Unauthorized** | HTTP/2, TLS 1.3 | 34 B | 138 + 144 ms | 137 ms | 0.1 ms |
| 5 | `GET /this-page-does-not-exist` | **404 Not Found** | HTTP/2, TLS 1.3 | 19 B | 139 + 146 ms | 139 ms | 0.2 ms |
| 6 | `GET http://…/` (plain HTTP) | **no answer** (timed out after 10 s) | – | – | – | – | – |

**What is good**

- HTTPS uses **HTTP/2 and TLS 1.3**. TLS 1.3 needs only one round trip for the handshake, and HTTP/2 lets a browser fetch all 18 assets over one connection.
- Status codes are correct and meaningful. A missing token gives `401` with a JSON body `{"error":"authentication failed"}`, and an unknown page gives `404`.
- The API answers JSON with the right `Content-Type: application/json`.

**What could be better** (also filed as [BUG-011](../../bugs/BUG-011.md) and [BUG-012](../../bugs/BUG-012.md))

1. **No compression.** The request says `Accept-Encoding: gzip, br`, but every answer comes back uncompressed (no `Content-Encoding`). The 16 KB stylesheet needs an extra 135 ms to download. Gzip would make it about 4 KB, small enough to arrive with the first packets.
2. **No caching headers on static files.** Files under `/_app/immutable/` have a content hash in their name, so they never change. They could be cached for a year (`Cache-Control: public, max-age=31536000, immutable`). They are sent without `Cache-Control`, `ETag` or `Last-Modified`, so browsers download them again or have to guess.
3. **Plain HTTP does not redirect to HTTPS.** `http://quickpizza.grafana.com` does not answer at all; the connection times out. Anyone who types the address without `https://` (or follows an old link) waits and then gets an error. Also, no `Strict-Transport-Security` (HSTS) header is sent.
4. **A load-balancer cookie (`AWSALB`) is set on every response,** static files included. It adds about 300 bytes to every request and response for no benefit on files that are the same for everyone.
5. **The 404 page is plain text** (`404 page not found`). That's fine for the API, but a visitor who mistypes a URL gets a bare text page instead of a helpful HTML page.
