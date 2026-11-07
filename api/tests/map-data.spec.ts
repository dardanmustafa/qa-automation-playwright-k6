import { expect, newSignedInContext, randomLocation, test } from '../fixtures';

/**
 * Map data = points (nodes) that become part of the map itself.
 * Every edit belongs to a "changeset" (like a commit). Editing needs a signed-in user.
 */

const escapeXml = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

/** Request options with an OSM XML document as body: the API only accepts XML for writing map data. */
function osmXml(element: 'changeset' | 'node', attributes: Record<string, number>, tags: Record<string, string> = {}) {
  const attributeText = Object.entries(attributes).map(([name, value]) => ` ${name}="${value}"`).join('');
  const tagText = Object.entries(tags).map(([key, value]) => `<tag k="${escapeXml(key)}" v="${escapeXml(value)}"/>`).join('');
  return {
    data: `<osm><${element}${attributeText}>${tagText}</${element}></osm>`,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  };
}

test.describe('Without login', () => {
  test('API-MAP-01 Anonymous user cannot start editing the map (401)', { tag: '@smoke' }, async ({ request }) => {
    const response = await request.put('changeset/create', osmXml('changeset', {}, { comment: 'Should not be allowed' }));

    expect(response.status()).toBe(401);
    expect(await response.text()).toContain("Couldn't authenticate you");
  });

  test('API-MAP-02 Point that never existed is reported as not found (404)', async ({ request }) => {
    const response = await request.get('node/999999999999.json');

    expect(response.status()).toBe(404);
  });

  test('API-MAP-03 API reports itself online and announces its limits (200)', async ({ request }) => {
    const response = await request.get('capabilities.json');

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.api.status.api).toBe('online');
    expect(body.api.note_area.maximum).toBeGreaterThan(0);
  });

  test('API-MAP-04 Unchanged capabilities are answered with 304 Not Modified', async ({ request }) => {
    // Uncompressed on purpose: with gzip the server never answers 304 (BUG-010, covered by API-NOTE-12).
    const uncompressed = { 'Accept-Encoding': 'identity' };
    const etag = (await request.get('capabilities.json', { headers: uncompressed })).headers()['etag'];

    const response = await request.get('capabilities.json', { headers: { ...uncompressed, 'If-None-Match': etag } });

    expect(response.status()).toBe(304);
  });

  test('API-MAP-13 Map data can be requested with a compact Accept-Encoding list (200)', {
    tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-013' },
  }, async ({ request }) => {
    // Playwright's own default header. HTTP allows lists with or without spaces after the commas.
    const response = await request.get('map.json?bbox=0.0001,0.0001,0.0002,0.0002', { headers: { 'Accept-Encoding': 'gzip,deflate,br' } });
    expect([200, 406], 'any other status is a different problem than BUG-013').toContain(response.status());

    test.fail(true, 'Expected to fail until BUG-013 is fixed');
    expect(response.status()).toBe(200);
  });
});

/**
 * One point goes through its whole life: created > read > moved > conflicting edit > deleted > gone.
 * The steps depend on each other, so they run in order and stop at the first failure.
 * When a step fails, the later steps are skipped, so afterAll deletes the point and closes the changeset.
 */
test.describe.serial('Create, modify and delete a point', () => {
  const start = randomLocation();
  let changesetId: number;
  let nodeId: number;
  let version: number;
  let pointDeleted = false;
  let changesetClosed = false;

  // Runs after every attempt (also on a CI retry), so a failed run leaves no test point on the map.
  // Each clean-up step is tried even when the one before failed, and any failure is reported.
  test.afterAll(async ({ playwright }, testInfo) => {
    if (!changesetId || changesetClosed) return;
    const api = await newSignedInContext(playwright, testInfo.project.use);
    const problems: string[] = [];
    const attempt = async (what: string, step: () => Promise<void>) => {
      try {
        await step();
      } catch (error) {
        problems.push(`${what}: ${error instanceof Error ? error.message : error}`);
      }
    };

    if (nodeId && !pointDeleted) {
      await attempt(`delete point ${nodeId}`, async () => {
        const current = await api.get(`node/${nodeId}.json`);
        if (current.status() === 410) return; // already deleted
        if (!current.ok()) throw new Error(`reading it answered ${current.status()}`);
        const [node] = (await current.json()).elements;
        const deleted = await api.delete(`node/${nodeId}`, osmXml('node', { id: nodeId, version: node.version, changeset: changesetId, lat: node.lat, lon: node.lon }));
        if (!deleted.ok()) throw new Error(`answered ${deleted.status()} ${await deleted.text()}`);
      });
    }
    await attempt(`close changeset ${changesetId}`, async () => {
      const closed = await api.put(`changeset/${changesetId}/close`);
      if (!closed.ok() && closed.status() !== 409) throw new Error(`answered ${closed.status()} ${await closed.text()}`); // 409: already closed
    });
    await api.dispose();

    if (problems.length) throw new Error(`Clean-up failed, test data may be left on the map:\n- ${problems.join('\n- ')}`);
  });

  test('API-MAP-05 Signed-in user opens a changeset (200)', async ({ signedIn }) => {
    const tags = { comment: 'Automated API test (QA automation) - safe to ignore', created_by: 'qa-automation-playwright-k6 (Playwright API tests)' };

    const response = await signedIn.put('changeset/create', osmXml('changeset', {}, tags));

    expect(response.status()).toBe(200);
    changesetId = Number(await response.text());
    expect(changesetId).toBeGreaterThan(0);
  });

  test('API-MAP-06 New point with tags is added to the map (200)', async ({ signedIn }) => {
    const response = await signedIn.put('node/create', osmXml('node', { changeset: changesetId, ...start }, { amenity: 'bench', note: 'QA test point' }));

    expect(response.status()).toBe(200);
    nodeId = Number(await response.text());
    expect(nodeId).toBeGreaterThan(0);
  });

  test('API-MAP-07 New point can be read back with its location and tags (200)', async ({ signedIn }) => {
    const response = await signedIn.get(`node/${nodeId}.json`);

    expect(response.status()).toBe(200);
    const { elements } = await response.json();
    expect(elements).toHaveLength(1);
    const [node] = elements;
    expect(node).toMatchObject({ type: 'node', id: nodeId, lat: start.lat, lon: start.lon, version: 1, changeset: changesetId });
    expect(node.tags).toEqual({ amenity: 'bench', note: 'QA test point' });
    version = node.version;
  });

  test('API-MAP-08 Point can be moved and re-tagged, which creates a new version (200)', async ({ signedIn }) => {
    // toFixed: plain addition can give 0.12445600000000001, which the server stores as 0.124456
    const moved = { lat: Number((start.lat + 0.001).toFixed(6)), lon: Number((start.lon + 0.001).toFixed(6)) };

    const response = await signedIn.put(`node/${nodeId}`, osmXml('node', { id: nodeId, version, changeset: changesetId, ...moved }, { amenity: 'bench', backrest: 'yes' }));

    expect(response.status()).toBe(200);
    expect(Number(await response.text())).toBe(version + 1);
    const readBack = await signedIn.get(`node/${nodeId}.json`);
    expect(readBack.status()).toBe(200);
    const [node] = (await readBack.json()).elements;
    expect(node).toMatchObject({ lat: moved.lat, lon: moved.lon, version: version + 1 });
    expect(node.tags).toEqual({ amenity: 'bench', backrest: 'yes' });
    version = node.version;
  });

  test('API-MAP-09 Edit based on an outdated version is refused (409)', async ({ signedIn }) => {
    const response = await signedIn.put(`node/${nodeId}`, osmXml('node', { id: nodeId, version: version - 1, changeset: changesetId, ...start }));

    expect(response.status()).toBe(409);
    expect(await response.text()).toContain('Version mismatch');
  });

  test('API-MAP-10 Point with a location outside the world is refused (400)', async ({ signedIn }) => {
    const response = await signedIn.put('node/create', osmXml('node', { changeset: changesetId, lat: 95, lon: 10 }));

    expect(response.status()).toBe(400);
  });

  test('API-MAP-11 Point can be deleted (200) and is then gone (410)', async ({ signedIn }) => {
    const current = await signedIn.get(`node/${nodeId}.json`);
    expect(current.status()).toBe(200);
    const [node] = (await current.json()).elements;

    const response = await signedIn.delete(`node/${nodeId}`, osmXml('node', { id: nodeId, version, changeset: changesetId, lat: node.lat, lon: node.lon }));

    expect(response.status()).toBe(200);
    pointDeleted = true;
    expect(Number(await response.text())).toBe(version + 1);
    expect((await signedIn.get(`node/${nodeId}.json`)).status()).toBe(410);
  });

  test('API-MAP-12 Closed changeset cannot be used for new edits (200, then 409)', async ({ signedIn }) => {
    const close = await signedIn.put(`changeset/${changesetId}/close`);
    expect(close.status()).toBe(200);
    changesetClosed = true;

    const response = await signedIn.put('node/create', osmXml('node', { changeset: changesetId, ...randomLocation() }));
    expect(response.status()).toBe(409);
    expect(await response.text()).toContain(`The changeset ${changesetId} was closed at`);
  });
});
