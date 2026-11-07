import { expect, test } from '../fixtures';
import { address, carriers, newCustomer, paymentMethods, products } from '../test-data';

const { mug } = products;

// Every checkout starts with one mug in the cart.
test.beforeEach(async ({ productPage, cartPage }) => {
  await productPage.open(mug);
  await productPage.addToCart();
  await productPage.cartModal.goToCart();
  await expect(cartPage.line(mug.name)).toBeVisible();
});

test.describe('Place an order', () => {
  test('TC-CHK-01 Signed-in customer places an order paid by bank wire', { tag: '@smoke' }, async ({
    signedInCustomer, cartPage, checkoutPage, confirmationPage, page,
  }) => {
    await cartPage.open();
    await cartPage.proceedToCheckout();
    await checkoutPage.enterAddress(address);
    await checkoutPage.chooseCarrier(carriers.clickAndCollect.name);
    await checkoutPage.continueToPayment();
    await checkoutPage.choosePayment(paymentMethods.bankWire.option);
    await checkoutPage.acceptTermsOfService();
    await checkoutPage.placeOrder();

    await expect(confirmationPage.confirmedHeading).toBeVisible();
    await expect(confirmationPage.emailNotice).toContainText(signedInCustomer.email);
    await expect(confirmationPage.paymentMethodItem).toContainText(paymentMethods.bankWire.confirmationLabel);
    await expect(confirmationPage.shippingMethodItem).toContainText(carriers.clickAndCollect.name);
    await expect(confirmationPage.orderedProduct(mug.name)).toBeVisible();
    expect(await confirmationPage.totalAmount()).toBeCloseTo(mug.price, 2);
    const reference = await confirmationPage.orderReference();
    expect(reference).toMatch(/^[A-Z]{9}$/);

    // The order is saved in the customer's order history.
    await page.goto('/order-history');
    await expect(page.getByRole('main').getByText(reference, { exact: true }).first()).toBeVisible();
  });

  test('TC-CHK-02 Guest places an order with paid delivery and pays by check', async ({ cartPage, checkoutPage, confirmationPage }) => {
    const guest = newCustomer({ firstName: 'Guest', lastName: 'Buyer' });

    await cartPage.proceedToCheckout();
    await checkoutPage.continueAsGuest(guest);
    await checkoutPage.enterAddress(address);
    await checkoutPage.chooseCarrier(carriers.myCarrier.name);
    await checkoutPage.continueToPayment();

    // Delivery cost is added to the order total before the customer pays.
    const expectedTotal = mug.price + carriers.myCarrier.price;
    await expect.poll(() => checkoutPage.totalAmount()).toBeCloseTo(expectedTotal, 2);

    await checkoutPage.choosePayment(paymentMethods.check.option);
    await checkoutPage.acceptTermsOfService();
    await checkoutPage.placeOrder();

    await expect(confirmationPage.confirmedHeading).toBeVisible();
    await expect(confirmationPage.emailNotice).toContainText(guest.email);
    await expect(confirmationPage.shippingMethodItem).toContainText(carriers.myCarrier.name);
    expect(await confirmationPage.totalAmount()).toBeCloseTo(expectedTotal, 2);
  });

  test('TC-CHK-06 Bank-wire confirmation shows the bank details the customer needs to pay', {
    tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-006' },
  }, async ({ cartPage, checkoutPage, confirmationPage }) => {
    await cartPage.proceedToCheckout();
    await checkoutPage.continueAsGuest(newCustomer());
    await checkoutPage.enterAddress(address);
    await checkoutPage.chooseCarrier(carriers.clickAndCollect.name);
    await checkoutPage.continueToPayment();
    await checkoutPage.choosePayment(paymentMethods.bankWire.option);
    await checkoutPage.acceptTermsOfService();
    await checkoutPage.placeOrder();

    await expect(confirmationPage.confirmedHeading).toBeVisible();
    await expect(confirmationPage.paymentMethodItem).toContainText(paymentMethods.bankWire.confirmationLabel);
    const details = await confirmationPage.bankWireDetails();
    expect(Object.keys(details)).toEqual(['Amount', 'Name of account owner', 'Please include these details', 'Bank name']);
    expect(details['Amount']).toContain(mug.price.toFixed(2));

    // Today each of these shows "___________" (underscores only, no letter or digit).
    test.fail(true, 'Expected to fail until BUG-006 is fixed');
    for (const label of ['Name of account owner', 'Please include these details', 'Bank name']) {
      expect(details[label], `"${label}" should show the shop's real detail`).toMatch(/[A-Za-z0-9]/);
    }
  });
});

test.describe('Checkout validation', () => {
  test.beforeEach(async ({ cartPage, checkoutPage }) => {
    await cartPage.proceedToCheckout();
    await checkoutPage.continueAsGuest(newCustomer());
  });

  test('TC-CHK-03 Address step cannot be completed with required fields empty', async ({ checkoutPage }) => {
    await checkoutPage.submitAddress();

    await expect(checkoutPage.stepTab('Addresses')).toHaveAttribute('aria-selected', 'true');
    await expect(checkoutPage.stepTab('Shipping Method')).toBeDisabled();
    for (const label of ['Address', 'Zip/Postal Code', 'City']) {
      const missing = await checkoutPage.field(label).evaluate((input: HTMLInputElement) => input.validity.valueMissing);
      expect(missing, `"${label}" should be reported as missing`).toBe(true);
    }
  });

  test('TC-CHK-04 Postcode in the wrong format is rejected', async ({ checkoutPage }) => {
    await checkoutPage.fillAddress({ ...address, postcode: 'ABC12' });
    await checkoutPage.submitAddress();

    await expect(checkoutPage.stepAlerts).toContainText('Invalid postcode - should look like "NNNNN"');
    await expect(checkoutPage.stepTab('Shipping Method')).toBeDisabled();
  });

  test('TC-CHK-05 Order cannot be placed before the terms of service are accepted', async ({ checkoutPage }) => {
    await checkoutPage.enterAddress(address);
    await checkoutPage.continueToPayment();
    await expect(checkoutPage.placeOrderButton).toBeDisabled();

    await checkoutPage.choosePayment(paymentMethods.bankWire.option);
    await expect(checkoutPage.placeOrderButton).toBeDisabled();

    await checkoutPage.acceptTermsOfService();
    await expect(checkoutPage.placeOrderButton).toBeEnabled();
  });
});
