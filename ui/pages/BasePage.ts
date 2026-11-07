import type { Locator, Page } from '@playwright/test';
import { Header } from './Header';

/** What every page of the shop has: the header and the main content area. */
export class BasePage {
  readonly header: Header;
  readonly main: Locator;

  constructor(readonly page: Page) {
    this.header = new Header(page);
    this.main = page.getByRole('main');
  }
}

/** "€1,234.56" -> 1234.56 */
export function parsePrice(text: string): number {
  const match = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) throw new Error(`No price found in "${text}"`);
  return Number(match[0]);
}
