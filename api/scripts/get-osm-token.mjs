#!/usr/bin/env node
/**
 * Gets an OAuth 2.0 access token for the OpenStreetMap DEVELOPMENT server and saves it for the API tests.
 *
 * Before running it:
 *  1. Create an account on https://master.apis.dev.openstreetmap.org/user/new (separate from openstreetmap.org).
 *  2. Register an app on https://master.apis.dev.openstreetmap.org/oauth2/applications/new
 *       - Name: anything, e.g. "QA automation"
 *       - Redirect URI: urn:ietf:wg:oauth:2.0:oob
 *       - Untick "Confidential application"
 *       - Permissions: "Read user preferences", "Modify the map", "Modify notes"
 *     and copy its Client ID.
 *
 * Then:  npm run osm:token -- <client-id>      (the Client ID is remembered in .env for next time)
 * The script prints a link: open it, allow access, paste the code shown back here.
 * It then writes OSM_ACCESS_TOKEN into .env and offers to store it as the GitHub Actions secret.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import readline from 'node:readline/promises';

const SERVER = 'https://master.apis.dev.openstreetmap.org';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = 'read_prefs write_api write_notes';
const ENV_FILE = '.env';

function readEnv() {
  if (!fs.existsSync(ENV_FILE)) fs.copyFileSync('.env.example', ENV_FILE);
  return fs.readFileSync(ENV_FILE, 'utf8');
}

/** Replaces `KEY=...` in .env, or appends it when the line is missing. */
function saveToEnv(key, value) {
  const lines = readEnv().split('\n');
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV_FILE, lines.join('\n'));
}

const savedClientId = readEnv().match(/^OSM_CLIENT_ID=(.+)$/m)?.[1]?.trim();
const clientId = (process.argv[2] || savedClientId || '').trim();
if (!clientId) {
  console.error('Usage: npm run osm:token -- <client-id>\nThe Client ID is on https://master.apis.dev.openstreetmap.org/oauth2/applications (click your app).');
  process.exit(1);
}
saveToEnv('OSM_CLIENT_ID', clientId);

// PKCE: proves that the code is exchanged by the same program that asked for it (no client secret needed).
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

const authorizeUrl = new URL(`${SERVER}/oauth2/authorize`);
authorizeUrl.search = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  scope: SCOPES,
  code_challenge: challenge,
  code_challenge_method: 'S256',
}).toString();

const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`\n1. Open this link in your browser and click "Authorize":\n\n${authorizeUrl}\n`);
const code = (await prompt.question('2. Paste the authorization code shown on that page here and press Enter: ')).trim();

const response = await fetch(`${SERVER}/oauth2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, client_id: clientId, code_verifier: verifier }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok || !body.access_token) {
  prompt.close();
  console.error(`\nThat did not work (HTTP ${response.status}): ${body.error_description || body.error || 'unknown error'}`);
  console.error('Codes work only once and expire after a few minutes - run the command again for a new link.');
  process.exit(1);
}

const token = body.access_token;
const masked = `${token.slice(0, 4)}…${token.slice(-4)}`;

// Check the token really works before saving it.
const me = await fetch(`${SERVER}/api/0.6/user/details.json`, { headers: { Authorization: `Bearer ${token}` } });
if (!me.ok) {
  prompt.close();
  console.error(`\nThe new token ${masked} does not work (HTTP ${me.status}), so it was not saved.`);
  console.error('Check that the app has the "Read user preferences" permission, then run the command again.');
  process.exit(1);
}
const user = (await me.json()).user?.display_name;

saveToEnv('OSM_ACCESS_TOKEN', token);
console.log(`\n✔ Token ${masked} saved in .env${user ? ` (signed in as "${user}")` : ''}. Permissions: ${body.scope}`);

const answer = (await prompt.question('\n3. Also save it as the GitHub Actions secret OSM_ACCESS_TOKEN for CI? [Y/n] ')).trim().toLowerCase();
prompt.close();
if (answer === '' || answer.startsWith('y')) {
  try {
    execFileSync('gh', ['secret', 'set', 'OSM_ACCESS_TOKEN'], { input: token, stdio: ['pipe', 'inherit', 'inherit'] });
    console.log('✔ GitHub secret saved.');
  } catch {
    console.error('Could not save the GitHub secret. You can do it later with:\n  grep \'^OSM_ACCESS_TOKEN=\' .env | cut -d= -f2- | gh secret set OSM_ACCESS_TOKEN');
  }
}
console.log('\nAll set. Run the API tests with: npm run test:api');
