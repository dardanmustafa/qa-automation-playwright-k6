import type { APIRequestContext } from '@playwright/test';
import { expect, randomLocation, test } from '../fixtures';

/**
 * Map notes = a location + a message pinned on the map ("there is a new bakery here").
 * Creating, reading and searching works anonymously; commenting and closing need a signed-in user.
 */

const noteText = (purpose: string) => `Automated API test (QA automation) - ${purpose} - ${new Date().toISOString()} - safe to ignore`;

/** A box (minLon,minLat,maxLon,maxLat) around every point that randomLocation() returns. */
const testArea = '0,0,0.6,0.6';

/** Creates a note (at a random test location unless one is given) and returns it. */
async function createNote(api: APIRequestContext, purpose: string, location = randomLocation()) {
  const response = await api.post('notes.json', { params: { ...location, text: noteText(purpose) } });
  expect(response.status()).toBe(200);
  return response.json();
}

test.describe('Send a location to the map', () => {
  test('API-NOTE-01 Note with a valid location is created (200)', { tag: '@smoke' }, async ({ request }) => {
    const location = randomLocation();
    const text = noteText('create note');

    const response = await request.post('notes.json', { params: { ...location, text } });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toMatchObject({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [location.lon, location.lat] }, // GeoJSON order: longitude, latitude
      properties: {
        id: expect.any(Number),
        url: expect.any(String),
        date_created: expect.any(String),
        status: 'open',
        comments: [{ action: 'opened', text, date: expect.any(String) }],
      },
    });
  });

  test('API-NOTE-02 Created note can be read back by its id (200)', async ({ request }) => {
    const location = randomLocation();
    const created = await createNote(request, 'read back', location);

    const response = await request.get(`notes/${created.properties.id}.json`);

    expect(response.status()).toBe(200);
    const note = await response.json();
    expect(note.properties.id).toBe(created.properties.id);
    expect(note.geometry.coordinates).toEqual([location.lon, location.lat]);
  });

  test('API-NOTE-03 Created note is found when searching its map area (200)', async ({ request }) => {
    const created = await createNote(request, 'search area');

    const response = await request.get('notes.json', { params: { bbox: testArea, closed: 0 } }); // closed=0: open notes only

    expect(response.status()).toBe(200);
    const area = await response.json();
    expect(area.features.map((feature: { properties: { id: number } }) => feature.properties.id)).toContain(created.properties.id);
  });

  for (const corner of [{ lat: 90, lon: 180 }, { lat: -90, lon: -180 }]) {
    test(`API-NOTE-04 Edge of the world (${corner.lat}, ${corner.lon}) is a valid location (200)`, async ({ request }) => {
      const response = await request.post('notes.json', { params: { ...corner, text: noteText('edge coordinates') } });

      expect(response.status()).toBe(200);
      expect((await response.json()).geometry.coordinates).toEqual([corner.lon, corner.lat]);
    });
  }

  test('API-NOTE-05 Unicode text is stored unchanged and HTML in it is escaped (200)', async ({ request }) => {
    const text = `Café 🚲 <b>bold</b> & "quotes" - ${noteText('special characters')}`;

    const response = await request.post('notes.json', { params: { ...randomLocation(), text } });

    expect(response.status()).toBe(200);
    const [comment] = (await response.json()).properties.comments;
    expect(comment.text).toBe(text);
    expect(comment.html).not.toContain('<b>');
    expect(comment.html).toContain('&lt;b&gt;');
  });
});

test.describe('Invalid location information', () => {
  const invalidNotes: { case: string; params: Record<string, string | number>; error: string }[] = [
    { case: 'latitude above 90', params: { lat: 90.0001, lon: 10, text: 'x' }, error: 'The note is outside this world' },
    { case: 'longitude below -180', params: { lat: 10, lon: -180.5, text: 'x' }, error: 'The note is outside this world' },
    { case: 'latitude is not a number', params: { lat: 'north', lon: 10, text: 'x' }, error: 'lat was not a number' },
    { case: 'latitude missing', params: { lon: 10, text: 'x' }, error: 'No lat was given' },
    { case: 'text missing', params: { lat: 10, lon: 10 }, error: 'No text was given' },
    { case: 'text only spaces', params: { lat: 10, lon: 10, text: '   ' }, error: 'No text was given' },
  ];

  for (const invalid of invalidNotes) {
    test(`API-NOTE-06 Note is rejected when ${invalid.case} (400)`, async ({ request }) => {
      const response = await request.post('notes.json', { params: invalid.params });

      expect(response.status()).toBe(400);
      expect(await response.text()).toContain(invalid.error);
    });
  }

  test('API-NOTE-07 Searching an area larger than allowed is rejected (400)', async ({ request }) => {
    const response = await request.get('notes.json', { params: { bbox: '0,0,10,10' } });

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('The maximum bbox size is 25');
  });

  test('API-NOTE-08 Note that does not exist is reported as not found (404)', async ({ request }) => {
    const response = await request.get('notes/999999999.json');

    expect(response.status()).toBe(404);
  });

  // OSM reports errors as plain text, also in an "Error" header, even on .json endpoints. JSON errors are suggested in IMP-001.
  test('API-NOTE-09 Error answers are plain text with the message also in the Error header (400)', async ({ request }) => {
    const response = await request.post('notes.json', { params: { lat: 91, lon: 0, text: 'x' } });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(response.headers()['error']).toBe('The note is outside this world');
    expect(await response.text()).toBe('The note is outside this world');
  });

  // OSM answers 404 for any request it has no route for, including a wrong method. 405 is suggested in IMP-002.
  test('API-NOTE-10 Unsupported HTTP method is refused with 404 and the note is unaffected', async ({ request }) => {
    const note = await createNote(request, 'method check');

    const response = await request.put(`notes/${note.properties.id}.json`);

    expect(response.status()).toBe(404);
    expect((await request.get(`notes/${note.properties.id}.json`)).status()).toBe(200);
  });
});

test.describe('Caching', () => {
  // "identity" = ask for an uncompressed answer. See API-NOTE-12 for what happens with compression.
  const uncompressed = { 'Accept-Encoding': 'identity' };

  test('API-NOTE-11 Unchanged note is answered with 304 Not Modified', async ({ request }) => {
    const note = await createNote(request, 'etag');

    const first = await request.get(`notes/${note.properties.id}.json`, { headers: uncompressed });
    const etag = first.headers()['etag'];
    expect(etag, 'the API should send an ETag header').toBeTruthy();

    const second = await request.get(`notes/${note.properties.id}.json`, { headers: { ...uncompressed, 'If-None-Match': etag } });
    expect(second.status()).toBe(304);
    expect((await second.body()).length).toBe(0);
  });

  test('API-NOTE-12 Caching also works when the answer is compressed (gzip)', {
    tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-010' },
  }, async ({ request }) => {
    const note = await createNote(request, 'etag gzip');
    const gzip = { 'Accept-Encoding': 'gzip' };

    const first = await request.get(`notes/${note.properties.id}.json`, { headers: gzip });
    expect(first.headers()['content-encoding']).toBe('gzip');
    const etag = first.headers()['etag'];
    expect(etag, 'the API should send an ETag header').toBeTruthy();

    const second = await request.get(`notes/${note.properties.id}.json`, { headers: { ...gzip, 'If-None-Match': etag } });
    expect([200, 304], 'any other status is a different problem than BUG-010').toContain(second.status());

    test.fail(true, 'Expected to fail until BUG-010 is fixed');
    expect(second.status()).toBe(304);
  });

  test('API-NOTE-13 Changed note is sent again (200) even with the old ETag', async ({ signedIn }) => {
    const note = await createNote(signedIn, 'etag change');
    const etag = (await signedIn.get(`notes/${note.properties.id}.json`, { headers: uncompressed })).headers()['etag'];

    await signedIn.post(`notes/${note.properties.id}/comment.json`, { params: { text: 'A change that must invalidate the ETag' } });
    const response = await signedIn.get(`notes/${note.properties.id}.json`, { headers: { ...uncompressed, 'If-None-Match': etag } });

    expect(response.status()).toBe(200);
    expect((await response.json()).properties.comments).toHaveLength(2);
  });
});

test.describe('Modify notes', () => {
  test('API-NOTE-14 Anonymous user cannot comment on or close a note (401)', { tag: '@smoke' }, async ({ request }) => {
    const { properties: { id } } = await createNote(request, 'anonymous changes');

    const comment = await request.post(`notes/${id}/comment.json`, { params: { text: 'anonymous comment' } });
    expect(comment.status()).toBe(401);
    expect(await comment.text()).toContain("Couldn't authenticate you");

    const close = await request.post(`notes/${id}/close.json`);
    expect(close.status()).toBe(401);

    // Nothing changed
    const note = await (await request.get(`notes/${id}.json`)).json();
    expect(note.properties.status).toBe('open');
    expect(note.properties.comments).toHaveLength(1);
  });

  test('API-NOTE-15 Signed-in user can comment on a note (200)', async ({ signedIn }) => {
    const { properties: { id } } = await createNote(signedIn, 'comment');

    const response = await signedIn.post(`notes/${id}/comment.json`, { params: { text: 'Second comment from the API test' } });

    expect(response.status()).toBe(200);
    expect((await response.json()).properties.comments.at(-1)).toMatchObject({ action: 'commented', text: 'Second comment from the API test' });
  });

  test('API-NOTE-16 Note can be closed once, a second close is a conflict (200, 409) and it can be reopened (200)', async ({ signedIn }) => {
    const { properties: { id } } = await createNote(signedIn, 'close and reopen');

    const close = await signedIn.post(`notes/${id}/close.json`, { params: { text: 'Resolved' } });
    expect(close.status()).toBe(200);
    expect((await close.json()).properties.status).toBe('closed');

    const closeAgain = await signedIn.post(`notes/${id}/close.json`);
    expect(closeAgain.status()).toBe(409);
    expect(await closeAgain.text()).toContain(`The note ${id} was closed at`);

    const reopen = await signedIn.post(`notes/${id}/reopen.json`, { params: { text: 'Not resolved after all' } });
    expect(reopen.status()).toBe(200);
    expect((await reopen.json()).properties.status).toBe('open');
  });

  test('API-NOTE-17 Regular user is not allowed to delete (hide) a note (403)', async ({ signedIn }) => {
    const { properties: { id } } = await createNote(signedIn, 'delete attempt');

    const response = await signedIn.delete(`notes/${id}.json`);

    expect(response.status()).toBe(403);
    expect((await signedIn.get(`notes/${id}.json`)).status()).toBe(200);
  });
});
