import { expect } from '@playwright/test';
import { BasePage, parsePrice } from './BasePage';
import { CartModal } from './CartModal';

/**
 * A list of products: a category page or the search results. Both have the same layout, and together
 * they offer the three search criteria: keyword (header search), category (main menu) and attributes (filters).
 */
export class CatalogPage extends BasePage {
  readonly heading = this.main.getByRole('heading', { level: 1 });
  readonly breadcrumb = this.main.getByRole('navigation', { name: 'breadcrumb' });
  readonly tiles = this.main.locator('article');
  readonly cartModal = new CartModal(this.page);
  private readonly filters = this.main.getByRole('region', { name: 'Product filters' });
  private readonly sortButton = this.main.getByRole('button', { name: 'Change sort order' });

  async openCategory(path: string) {
    await this.page.goto(path);
  }

  /** Opens the same URL that the header search produces. */
  async openSearchResults(term: string) {
    await this.page.goto(`/search?controller=search&s=${encodeURIComponent(term)}`);
  }

  /** Uses the main menu like a shopper: open "Clothes", then click "Men". Without a child, clicks the parent. */
  async navigateViaMenu(parent: string, child?: string) {
    const menu = this.page.getByRole('navigation', { name: 'Main navigation' });
    if (child) {
      await menu.getByRole('button', { name: `Open ${parent} submenu` }).click();
      await menu.getByRole('link', { name: child, exact: true }).click();
    } else {
      await menu.getByRole('link', { name: parent, exact: true }).click();
    }
  }

  async productNames(): Promise<string[]> {
    const names = await this.tiles.getByRole('link', { name: /^View product / }).allInnerTexts();
    return names.map((name) => name.trim());
  }

  async productPrices(): Promise<number[]> {
    return (await this.tiles.getByLabel('Price', { exact: true }).allInnerTexts()).map(parsePrice);
  }

  /** The number in the sentence "There are N products." */
  async announcedTotal(): Promise<number> {
    const sentence = await this.main.getByText(/There (is|are) \d+ products?\./).innerText();
    return Number(sentence.match(/\d+/)![0]);
  }

  /** Ticks a value in the "Filter By" sidebar, e.g. filterBy('Size', 'M'). */
  async filterBy(facet: string, value: string) {
    const urlBefore = this.page.url();
    const facetToggle = this.filters.getByRole('button', { name: facet, exact: true });
    if ((await facetToggle.getAttribute('aria-expanded')) !== 'true') await facetToggle.click();
    await this.filters.getByRole('checkbox', { name: new RegExp(`^${value} \\(\\d+ results? \\)$`) }).click();
    // The list is reloaded in the background and the filter is written into the URL (?q=Size-M).
    await this.page.waitForURL((url) => url.toString() !== urlBefore);
  }

  /** E.g. sortBy('Price, low to high'). */
  async sortBy(option: string) {
    const urlBefore = this.page.url();
    await this.sortButton.click();
    await this.page.getByRole('menuitem', { name: `Sort products by: ${option}` }).click();
    // The list is reloaded in the background: wait for the new URL and for the button to show the new order.
    await this.page.waitForURL((url) => url.toString() !== urlBefore);
    await expect(this.sortButton).toContainText(option);
  }

  async addToCart(productName: string) {
    await this.main.getByRole('button', { name: `Add to cart ${productName}`, exact: true }).click();
    await this.cartModal.dialog.waitFor();
  }
}
