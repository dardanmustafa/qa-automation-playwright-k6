import { BasePage, parsePrice } from './BasePage';

export class CartPage extends BasePage {
  readonly lines = this.main.getByRole('list', { name: 'Products in cart' }).getByRole('listitem');
  readonly itemsLabel = this.main.locator('#cart-subtotal-products .cart-summary__label');
  readonly total = this.main.locator('.cart-summary__total .cart-summary__value');
  readonly emptyCartMessage = this.main.getByText('There are no more items in your cart');
  readonly removedAlert = this.main.getByRole('alert');
  /** "Proceed to checkout" is a link while the cart has products, and a disabled button when it is empty. */
  readonly proceedToCheckoutButton = this.main.getByRole('button', { name: 'Proceed to checkout' });

  async open() {
    await this.page.goto('/cart?action=show');
  }

  line(productName: string) {
    return this.lines.filter({ has: this.page.getByRole('link', { name: productName, exact: true }) });
  }

  quantityInput(productName: string) {
    return this.main.getByRole('textbox', { name: `Change quantity of ${productName}`, exact: true });
  }

  async lineTotalAmount(productName: string): Promise<number> {
    return parsePrice(await this.line(productName).locator('.product-line__price').innerText());
  }

  async totalAmount(): Promise<number> {
    return parsePrice(await this.total.innerText());
  }

  async increaseQuantity(productName: string) {
    await this.main.getByRole('button', { name: `Increase quantity of ${productName}`, exact: true }).click();
  }

  /** Accepts a string so tests can also type invalid values such as "-3" or "2.5". */
  async setQuantity(productName: string, quantity: number | string) {
    // The cart is saved in the background after Enter. Some invalid values never reach the server, so don't insist.
    const cartSaved = this.page
      .waitForResponse((response) => response.url().includes('/cart') && response.request().method() === 'POST', { timeout: 10_000 })
      .catch(() => undefined);
    await this.quantityInput(productName).fill(String(quantity));
    await this.quantityInput(productName).press('Enter');
    await cartSaved;
  }

  async remove(productName: string) {
    await this.main.getByRole('link', { name: `Remove ${productName} from cart`, exact: true }).click();
  }

  async proceedToCheckout() {
    await this.main.getByRole('link', { name: 'Proceed to checkout' }).click();
    await this.page.waitForURL(/\/order/);
  }
}
