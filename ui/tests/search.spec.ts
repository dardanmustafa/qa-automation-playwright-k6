import { expect, test } from '../fixtures';
import { categories } from '../test-data';

/**
 * "Searching products by three criteria":
 *   1. by keyword   - the search box in the header
 *   2. by category  - the main menu (Clothes > Men, Accessories > Stationery, ...)
 *   3. by attribute - the "Filter By" sidebar (size, colour) together with sorting
 */
test.describe('Criterion 1 - keyword', () => {
  test('TC-SEARCH-01 Keyword search returns only matching products', { tag: '@smoke' }, async ({ catalogPage, page }) => {
    await page.goto('/');
    await catalogPage.header.search('mug');

    await expect(catalogPage.heading).toHaveText('Search results for "mug"');
    const names = await catalogPage.productNames();
    expect(names).toHaveLength(5);
    for (const name of names) expect(name.toLowerCase()).toContain('mug');
    expect(await catalogPage.announcedTotal()).toBe(names.length);
  });

  test('TC-SEARCH-02 Live suggestions appear while typing', async ({ catalogPage, page }) => {
    await page.goto('/');
    await catalogPage.header.typeInSearch('notebook');

    for (const name of ['Mountain fox notebook', 'Brown bear notebook', 'Hummingbird notebook']) {
      await expect(catalogPage.header.suggestion(name)).toBeVisible();
    }
  });

  test('TC-SEARCH-03 Keyword search is not case-sensitive', async ({ catalogPage }) => {
    await catalogPage.openSearchResults('mug');
    const lowerCase = await catalogPage.productNames();

    await catalogPage.openSearchResults('MUG');
    expect(await catalogPage.productNames()).toEqual(lowerCase);
  });

  for (const keyword of ['qqqq', 'asdfgh']) {
    test(`TC-SEARCH-04 Keyword with no matching product shows the empty state ("${keyword}")`, {
      tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-001' },
    }, async ({ catalogPage }) => {
      await catalogPage.openSearchResults(keyword);
      await expect(catalogPage.heading).toContainText(`"${keyword}"`);

      test.fail(true, 'Expected to fail until BUG-001 is fixed');
      await expect(catalogPage.heading).toHaveText(`No search results for "${keyword}"`, { timeout: 5_000 });
      await expect(catalogPage.tiles).toHaveCount(0);
    });
  }
});

test.describe('Criterion 2 - category', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC-SEARCH-05 Category from the main menu shows only its products', { tag: '@smoke' }, async ({ catalogPage }) => {
    await catalogPage.navigateViaMenu('Clothes', 'Men');

    await expect(catalogPage.heading).toHaveText('Men');
    await expect(catalogPage.breadcrumb).toContainText('Clothes');
    expect(await catalogPage.productNames()).toEqual(['Hummingbird printed t-shirt']);
  });

  test('TC-SEARCH-06 Sub-category lists exactly the products it announces', async ({ catalogPage }) => {
    await catalogPage.navigateViaMenu('Accessories', 'Stationery');

    await expect(catalogPage.heading).toHaveText('Stationery');
    const names = await catalogPage.productNames();
    expect(names.sort()).toEqual(['Brown bear notebook', 'Hummingbird notebook', 'Mountain fox notebook']);
    expect(await catalogPage.announcedTotal()).toBe(3);
  });

  test('TC-SEARCH-07 Top-level category shows the products of its sub-categories', async ({ catalogPage }) => {
    await catalogPage.navigateViaMenu('Clothes');

    await expect(catalogPage.heading).toHaveText('Clothes');
    expect((await catalogPage.productNames()).sort()).toEqual(['Hummingbird printed sweater', 'Hummingbird printed t-shirt']);
  });
});

test.describe('Criterion 3 - attributes (filters and sorting)', () => {
  test('TC-SEARCH-08 Size and colour filters narrow down the results', { tag: '@smoke' }, async ({ catalogPage, page }) => {
    await catalogPage.openCategory(categories.clothes);
    await expect(catalogPage.tiles).toHaveCount(2);

    await catalogPage.filterBy('Size', 'M');
    await expect(page).toHaveURL(/q=Size-M/);
    await expect(catalogPage.tiles).toHaveCount(2);

    await catalogPage.filterBy('Color', 'Black');
    await expect(page).toHaveURL(/Color-Black/);
    await expect(catalogPage.tiles).toHaveCount(1);
    expect(await catalogPage.productNames()).toEqual(['Hummingbird printed t-shirt']);
  });

  test('TC-SEARCH-09 Sorting by price orders products from cheapest to most expensive and back', async ({ catalogPage }) => {
    await catalogPage.openCategory(categories.accessories);

    await catalogPage.sortBy('Price, low to high');
    const ascending = await catalogPage.productPrices();
    expect(ascending.length).toBeGreaterThan(1);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

    await catalogPage.sortBy('Price, high to low');
    const descending = await catalogPage.productPrices();
    expect(descending).toEqual([...descending].sort((a, b) => b - a));
  });

  test('TC-SEARCH-10 Sorting by name orders products alphabetically', async ({ catalogPage }) => {
    await catalogPage.openCategory(categories.accessories);

    await catalogPage.sortBy('Name, A to Z');
    const names = await catalogPage.productNames();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

test.describe('Product information in results', () => {
  test('TC-SEARCH-11 Product image and link describe the same product as its title', {
    tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-005' },
  }, async ({ catalogPage }) => {
    await catalogPage.openCategory(categories.women);
    const tile = catalogPage.tiles.first();
    const title = (await tile.getByRole('link', { name: /^View product / }).innerText()).trim();
    expect(title).toBe('Hummingbird printed sweater');
    const image = tile.getByRole('img').first();
    await expect(image).toBeVisible();

    test.fail(true, 'Expected to fail until BUG-005 is fixed');
    await expect(image).toHaveAttribute('alt', title, { timeout: 3_000 });
  });
});
