/**
 * Looks closely at a few HTTP/S responses of QuickPizza (one user, one pass) and prints:
 * status, protocol, TLS version, important headers, size and a timing breakdown.
 *
 * Run: k6 run load/response-analysis.js
 */
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://quickpizza.grafana.com';

export const options = {
  iterations: 1,
  vus: 1,
  noConnectionReuse: true, // measure every request as a fresh connection
  userAgent: 'qa-automation-playwright-k6/1.0 (k6 response analysis)',
};

const HEADERS = ['Content-Type', 'Content-Length', 'Content-Encoding', 'Cache-Control', 'Etag', 'Last-Modified', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Vary', 'Set-Cookie'];

function describe(label, response) {
  const t = response.timings;
  const lines = [
    `\n=== ${label}`,
    `${response.request.method} ${response.url}`,
    `Status ${response.status} · ${response.proto} · ${response.tls_version || 'no TLS'} · ${response.body ? response.body.length : 0} bytes`,
    `Timing: getting a connection ${t.blocked.toFixed(0)} ms (of which TCP connect ${t.connecting.toFixed(0)} ms, TLS ${t.tls_handshaking.toFixed(0)} ms) | ` +
      `send ${t.sending.toFixed(1)} ms | wait for server (TTFB) ${t.waiting.toFixed(0)} ms | download ${t.receiving.toFixed(1)} ms | request total ${t.duration.toFixed(0)} ms`,
    ...HEADERS.map((name) => `  ${name}: ${response.headers[name] === undefined ? '(not sent)' : String(response.headers[name]).slice(0, 90)}`),
  ];
  lines.forEach((line) => console.log(line));
}

export default function () {
  const gzip = { headers: { 'Accept-Encoding': 'gzip, br' } };

  const home = http.get(`${BASE_URL}/`, gzip);
  describe('1. Homepage (HTML document)', home);
  check(home, { 'homepage: 200': (r) => r.status === 200, 'homepage: HTTP/2': (r) => r.proto === 'HTTP/2.0' });

  const css = (home.body.match(/href="\.\/(_app\/immutable\/assets\/[^"]+\.css)"/) || [])[1];
  if (css) {
    const stylesheet = http.get(`${BASE_URL}/${css}`, gzip);
    describe('2. Stylesheet (content-hashed static file)', stylesheet);
    check(stylesheet, { 'stylesheet: 200': (r) => r.status === 200 });
  }

  const quotes = http.get(`${BASE_URL}/api/quotes`, gzip);
  describe('3. Public JSON API', quotes);
  check(quotes, { 'api: 200 JSON': (r) => r.status === 200 && r.json('quotes') !== undefined });

  const noToken = http.post(`${BASE_URL}/api/pizza`, '{}', { headers: { 'Content-Type': 'application/json' } });
  describe('4. Protected API without token', noToken);
  check(noToken, { 'protected api: 401': (r) => r.status === 401 });

  const missing = http.get(`${BASE_URL}/this-page-does-not-exist`, gzip);
  describe('5. Page that does not exist', missing);
  check(missing, { 'unknown page: 404': (r) => r.status === 404 });

  const plainHttp = http.get(BASE_URL.replace('https://', 'http://') + '/', { timeout: '10s' });
  describe('6. Same homepage over plain HTTP (expect a redirect to HTTPS)', plainHttp);
  check(plainHttp, { 'http: redirected to https': (r) => r.url.startsWith('https://') && r.status === 200 });
}
