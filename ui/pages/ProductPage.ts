import { expect } from '@playwright/test';
import type { Product } from '../test-data';
import { BasePage } from './BasePage';
import { CartModal } from './CartModal';

/** A product page. It also lists other products with their own buttons, so controls are found by the product's name. */
export class ProductPage extends BasePage {
  readonly cartModal = new CartModal(this.page);
  private productName = '';

  async open(product: Product) {
    this.productName = product.name;
    await this.page.goto(product.path);
  }

  /** Price and stock are reloaded for the new size; the URL follows once that is done. */
  async selectSize(size: string) {
    await this.main.getByRole('combobox', { name: 'Size' }).selectOption(size);
    await this.page.waitForURL(new RegExp(`size-${size}`, 'i'));
  }

  async selectColor(color: string) {
    // The real radio button is covered by a colour swatch (its <label>), which is what shoppers click.
    const radio = this.main.getByRole('radio', { name: `Color - ${color}` });
    await this.page.locator(`label[for="${await radio.getAttribute('id')}"]`).click();
    await expect(radio).toBeChecked();
    await this.page.waitForURL(new RegExp(`color-${color}`, 'i'));
  }

  async setQuantity(quantity: number) {
    await this.main.getByRole('textbox', { name: `Change quantity of ${this.productName}`, exact: true }).first().fill(String(quantity));
  }

  async addToCart() {
    await this.main.getByRole('button', { name: `Add to cart ${this.productName}`, exact: true }).first().click();
    await this.cartModal.dialog.waitFor();
  }
}
