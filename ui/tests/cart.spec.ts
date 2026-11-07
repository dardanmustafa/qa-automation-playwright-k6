import { expect, test } from '../fixtures';
import { products } from '../test-data';

const { mug, notebook, tShirt } = products;

test.describe('Add to cart', () => {
  test('TC-CART-01 Product with chosen size, colour and quantity is added to the cart', { tag: '@smoke' }, async ({ productPage }) => {
    await productPage.open(tShirt);
    await productPage.selectSize('M');
    await productPage.selectColor('Black');
    await productPage.setQuantity(2);
    await productPage.addToCart();

    const modal = productPage.cartModal;
    await expect(modal.message).toHaveText(`${tShirt.name} has been added to your cart.`);
    await expect(modal.dialog).toContainText('Size: M');
    await expect(modal.dialog).toContainText('Color: Black');
    await expect(modal.dialog).toContainText('There are 2 items in your cart.');
    await expect(productPage.header.cartCount).toHaveText('2');
  });

  test('TC-CART-02 Product can be added straight from search results', async ({ catalogPage }) => {
    await catalogPage.openSearchResults('mug');
    await catalogPage.addToCart(mug.name);

    await expect(catalogPage.cartModal.message).toHaveText(`${mug.name} has been added to your cart.`);
    await expect(catalogPage.header.cartCount).toHaveText('1');
  });

  test('TC-CART-03 Cart total is the sum of all products in it', async ({ productPage, cartPage }) => {
    await productPage.open(mug);
    await productPage.addToCart();
    await productPage.cartModal.continueShopping();
    await productPage.open(notebook);
    await productPage.addToCart();
    await productPage.cartModal.goToCart();

    await expect(cartPage.lines).toHaveCount(2);
    await expect(cartPage.itemsLabel).toHaveText('2 items');
    expect(await cartPage.totalAmount()).toBeCloseTo(mug.price + notebook.price, 2);
  });

  test('TC-CART-04 Cart is kept when a guest signs in', async ({ productPage, loginPage, cartPage, registeredCustomer }) => {
    await productPage.open(mug);
    await productPage.addToCart();
    await productPage.cartModal.continueShopping();

    await loginPage.open();
    await loginPage.login(registeredCustomer.email, registeredCustomer.password);
    await expect(loginPage.header.accountButton).toBeVisible();

    await cartPage.open();
    await expect(cartPage.line(mug.name)).toBeVisible();
    await expect(cartPage.header.cartCount).toHaveText('1');
  });
});

test.describe('Change the cart', () => {
  test.beforeEach(async ({ productPage, cartPage }) => {
    await productPage.open(mug);
    await productPage.addToCart();
    await productPage.cartModal.goToCart();
    await expect(cartPage.quantityInput(mug.name)).toHaveValue('1');
  });

  test('TC-CART-05 Increasing the quantity updates line total and cart total', async ({ cartPage }) => {
    await cartPage.increaseQuantity(mug.name);

    await expect(cartPage.quantityInput(mug.name)).toHaveValue('2');
    await expect(cartPage.itemsLabel).toHaveText('2 items');
    await expect.poll(() => cartPage.lineTotalAmount(mug.name)).toBeCloseTo(2 * mug.price, 2);
    await expect.poll(() => cartPage.totalAmount()).toBeCloseTo(2 * mug.price, 2);
  });

  test('TC-CART-06 Typing a quantity updates the totals and the header counter', async ({ cartPage }) => {
    await cartPage.setQuantity(mug.name, 5);

    await expect(cartPage.itemsLabel).toHaveText('5 items');
    await expect.poll(() => cartPage.totalAmount()).toBeCloseTo(5 * mug.price, 2);
    await expect(cartPage.header.cartCount).toHaveText('5');
  });

  test('TC-CART-07 Removing the last product empties the cart', { tag: '@smoke' }, async ({ cartPage }) => {
    await cartPage.remove(mug.name);

    await expect(cartPage.removedAlert).toContainText('has been removed from the cart.');
    await expect(cartPage.emptyCartMessage).toBeVisible();
    await expect(cartPage.total).toHaveText('€0.00');
    await expect(cartPage.proceedToCheckoutButton).toBeDisabled();
    await expect(cartPage.header.cartCount).toHaveText('0');
  });

  test('TC-CART-08 Quantity above the available stock is capped and the customer is told', async ({ cartPage, page }) => {
    await cartPage.setQuantity(mug.name, 99999);

    const message = page.getByText(new RegExp(`You can only buy \\d+ "${mug.name}"`));
    await expect(message).toBeVisible();
    const available = Number((await message.innerText()).match(/\d+/)![0]);

    // The cart is reduced to exactly what is in stock.
    await expect(cartPage.quantityInput(mug.name)).toHaveValue(String(available));
    await expect(cartPage.itemsLabel).toHaveText(`${available} items`);
  });

  // Both decimal separators: most European customers type a comma. The separator is named in the title because
  // Playwright turns both "2.5" and "2,5" into "2-5" in folder names, and the two tests would share one results folder.
  for (const { separator, quantity } of [{ separator: 'point', quantity: '2.5' }, { separator: 'comma', quantity: '2,5' }]) {
    test(`TC-CART-09 Decimal quantity is not turned into a ten times bigger number (decimal ${separator} "${quantity}")`, {
      tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-002' },
    }, async ({ cartPage }) => {
      await cartPage.setQuantity(mug.name, quantity);
      await expect(cartPage.line(mug.name)).toBeVisible();

      test.fail(true, 'Expected to fail until BUG-002 is fixed');
      await expect(cartPage.quantityInput(mug.name)).not.toHaveValue('25', { timeout: 3_000 });
      expect(await cartPage.totalAmount()).toBeLessThan(25 * mug.price);
    });
  }

  test('TC-CART-10 Negative quantity is rejected', {
    tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-003' },
  }, async ({ cartPage }) => {
    await cartPage.setQuantity(mug.name, '-3');
    await expect(cartPage.line(mug.name)).toBeVisible();

    test.fail(true, 'Expected to fail until BUG-003 is fixed');
    await expect(cartPage.quantityInput(mug.name)).toHaveValue('1', { timeout: 3_000 });
    await expect(cartPage.itemsLabel).toHaveText('1 item');
  });
});
