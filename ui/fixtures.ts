import { test as base, expect } from '@playwright/test';
import { CartPage } from './pages/CartPage';
import { CatalogPage } from './pages/CatalogPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { LoginPage } from './pages/LoginPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { ProductPage } from './pages/ProductPage';
import { RegistrationPage } from './pages/RegistrationPage';
import { newCustomer, type Customer } from './test-data';

type ShopFixtures = {
  loginPage: LoginPage;
  registrationPage: RegistrationPage;
  catalogPage: CatalogPage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  confirmationPage: OrderConfirmationPage;
  /** An account that exists in the shop. The test's own browser is NOT signed in. */
  registeredCustomer: Customer;
  /** A new account, already signed in in the test's own browser. */
  signedInCustomer: Customer;
};

export const test = base.extend<ShopFixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registrationPage: async ({ page }, use) => use(new RegistrationPage(page)),
  catalogPage: async ({ page }, use) => use(new CatalogPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  confirmationPage: async ({ page }, use) => use(new OrderConfirmationPage(page)),

  // Each test gets its own customer, so carts and orders of parallel tests never mix.
  registeredCustomer: async ({ browser, baseURL }, use) => {
    const customer = newCustomer();
    const context = await browser.newContext({ baseURL });
    const registrationPage = new RegistrationPage(await context.newPage());
    await registrationPage.open();
    await registrationPage.register(customer);
    await registrationPage.header.accountButton.waitFor();
    await context.close();
    await use(customer);
  },

  signedInCustomer: async ({ registrationPage }, use) => {
    const customer = newCustomer();
    await registrationPage.open();
    await registrationPage.register(customer);
    await registrationPage.header.accountButton.waitFor();
    await use(customer);
  },
});

export { expect };
