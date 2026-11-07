/**
 * Load test: 1000 users visit the QuickPizza homepage within 15 seconds.
 *
 * Timeline (one run, ~1m30s):
 *
 *   0s ──── before ──── 30s   35s ── load: 1000 visits ── 50s   55s ──── after ──── 85s
 *                              35s ── during (probe) ───── 50s
 *
 *   before  - 1 user, one visit per second: normal response time with no extra load (baseline)
 *   load    - 1000 new users arrive evenly over 15 s (~67 visits/second), each visits the homepage once
 *   during  - 1 user doing exactly what "before" does, while the 1000 users are arriving,
 *             so "before" and "during" can be compared like for like
 *   after   - 1 user again: does the site recover once the load is gone?
 *
 * Every visit is a brand-new visitor: new TCP + TLS connection, no cookies (noVUConnectionReuse).
 *
 * Run:   npm run load:test   (k6 run --summary-mode=full, which reports every phase separately)
 * Other: k6 run --summary-mode=full -e BASE_URL=http://localhost:3333 -e USERS=1000 -e SECONDS=15 load/homepage-load-test.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://quickpizza.grafana.com';
const USERS = Number(__ENV.USERS || 1000);
const SECONDS = Number(__ENV.SECONDS || 15);

const BASELINE = 30; // seconds of measurement before and after the load
const loadStart = BASELINE + 5;
const afterStart = loadStart + SECONDS + 5;

export const options = {
  noVUConnectionReuse: true,
  userAgent: 'qa-automation-playwright-k6/1.0 (k6 load test)',
  summaryTrendStats: ['count', 'avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    before: { executor: 'constant-vus', exec: 'singleUser', vus: 1, duration: `${BASELINE}s`, startTime: '0s' },
    load: {
      executor: 'constant-arrival-rate',
      exec: 'newVisitor',
      rate: USERS,
      timeUnit: `${SECONDS}s`, // USERS visits per SECONDS seconds ...
      duration: `${SECONDS}s`, // ... for SECONDS seconds = USERS visits in total
      preAllocatedVUs: Math.min(USERS, 200),
      maxVUs: USERS,
      startTime: `${loadStart}s`,
    },
    during: { executor: 'constant-vus', exec: 'singleUser', vus: 1, duration: `${SECONDS}s`, startTime: `${loadStart}s` },
    after: { executor: 'constant-vus', exec: 'singleUser', vus: 1, duration: `${BASELINE}s`, startTime: `${afterStart}s` },
  },
  // Pass/fail criteria for the load phase
  thresholds: {
    'http_req_failed{scenario:load}': ['rate<0.01'], // fewer than 1% errors
    'http_req_duration{scenario:load}': ['p(95)<1000'], // 95% of homepage answers under 1 s
    'checks{scenario:load}': ['rate>0.99'],
    dropped_iterations: ['count==0'], // every one of the users really got to visit
  },
};

function visitHomepage() {
  const response = http.get(`${BASE_URL}/`);
  check(response, {
    'status is 200': (r) => r.status === 200,
    'is the QuickPizza page': (r) => typeof r.body === 'string' && r.body.includes('QuickPizza'),
    'is HTML': (r) => (r.headers['Content-Type'] || '').includes('text/html'),
  });
}

/** One of the 1000 new visitors: visits the homepage once. */
export function newVisitor() {
  visitHomepage();
}

/** The reference user of the before/during/after phases: one visit, then a one-second pause. */
export function singleUser() {
  visitHomepage();
  sleep(1);
}
