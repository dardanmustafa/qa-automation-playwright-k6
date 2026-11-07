import type { Locator, Page } from '@playwright/test';

/** Pop-up that opens after "Add to cart", on a product page or in a product list. */
export class CartModal {
  readonly dialog: Locator;
  readonly message: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Added to your cart' });
    this.message = this.dialog.getByRole('status');
  }

  async continueShopping() {
    await this.dialog.getByRole('button', { name: 'Continue shopping' }).click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  async goToCart() {
    await this.dialog.getByRole('link', { name: 'Proceed to checkout' }).click();
    await this.page.waitForURL(/\/cart/);
  }
}
