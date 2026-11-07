import type { Locator, Page } from '@playwright/test';

/** Top bar shown on every page: search, account menu and cart counter. */
export class Header {
  readonly searchBox: Locator;
  readonly signInLink: Locator;
  readonly accountButton: Locator;
  readonly cartCount: Locator;

  constructor(private readonly page: Page) {
    const banner = page.getByRole('banner');
    this.searchBox = banner.getByRole('combobox', { name: 'Search' });
    this.signInLink = banner.getByRole('link', { name: 'Sign in' });
    this.accountButton = banner.getByRole('button', { name: /^View my account/ });
    this.cartCount = page.locator('#_desktop_ps_shoppingcart .header-block__badge');
  }

  async search(term: string) {
    await this.searchBox.fill(term);
    await this.searchBox.press('Enter');
    await this.page.waitForURL(/[?&]s=/);
  }

  /** Types slowly so the live search (autocomplete) reacts like it does for a real user. */
  async typeInSearch(term: string) {
    await this.searchBox.click();
    await this.searchBox.pressSequentially(term, { delay: 60 });
  }

  suggestion(productName: string): Locator {
    return this.page.getByRole('banner').getByRole('listbox').getByText(productName, { exact: true });
  }

  async signOut() {
    await this.accountButton.click();
    await this.page.getByRole('banner').getByRole('link', { name: 'Sign out' }).click();
    await this.signInLink.waitFor();
  }
}
