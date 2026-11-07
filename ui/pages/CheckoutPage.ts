import type { Address, Customer } from '../test-data';
import { BasePage, parsePrice } from './BasePage';

type CheckoutStep = 'Personal Information' | 'Addresses' | 'Shipping Method' | 'Payment';

/** The 4-step checkout on /order: personal information > addresses > shipping method > payment. */
export class CheckoutPage extends BasePage {
  /** The step that is open at the moment. */
  readonly activeStep = this.main.getByRole('tabpanel').first();
  readonly stepAlerts = this.activeStep.getByRole('alert');
  readonly termsOfServiceCheckbox = this.main.getByRole('checkbox', { name: /^I agree to the terms of service/ });
  readonly placeOrderButton = this.main.getByRole('button', { name: 'Place Order' });

  stepTab(step: CheckoutStep) {
    return this.main.getByRole('tab', { name: step, exact: true });
  }

  field(label: string) {
    return this.activeStep.getByRole('textbox', { name: label, exact: true });
  }

  /** Order total in the summary next to the steps. */
  async totalAmount(): Promise<number> {
    return parsePrice(await this.main.locator('.cart-summary__total .cart-summary__value').innerText());
  }

  /** Step 1 for shoppers who are not signed in ("Order as a guest"). */
  async continueAsGuest(customer: Customer) {
    await this.activeStep.getByRole('radio', { name: customer.socialTitle }).check();
    await this.field('First name').fill(customer.firstName);
    await this.field('Last name').fill(customer.lastName);
    await this.field('Email').fill(customer.email);
    await this.activeStep.getByRole('checkbox', { name: /^I agree to the terms and conditions/ }).check();
    await this.activeStep.getByRole('checkbox', { name: /^Customer data privacy/ }).check();
    await this.activeStep.getByRole('button', { name: 'Continue', exact: true }).click();
    await this.waitForStep('Addresses');
  }

  /** Step 2, without submitting it. */
  async fillAddress(address: Address) {
    await this.field('Address').fill(address.address);
    await this.field('Zip/Postal Code').fill(address.postcode);
    await this.field('City').fill(address.city);
    await this.activeStep.getByRole('combobox', { name: 'Country' }).selectOption({ label: address.country });
    await this.field('Phone').fill(address.phone);
  }

  async submitAddress() {
    await this.activeStep.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  async enterAddress(address: Address) {
    await this.fillAddress(address);
    await this.submitAddress();
    await this.waitForStep('Shipping Method');
  }

  /** Step 3. */
  async chooseCarrier(carrierName: string) {
    await this.activeStep.getByRole('radio', { name: new RegExp(`^${carrierName}`) }).check();
    // Let the page settle: the order summary is refreshed in the background after a carrier change.
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  async continueToPayment() {
    await this.activeStep.getByRole('button', { name: 'Continue to Payment' }).click();
    await this.waitForStep('Payment');
  }

  /** Step 4. */
  async choosePayment(option: string) {
    await this.activeStep.getByRole('radio', { name: option, exact: true }).check();
  }

  async acceptTermsOfService() {
    await this.termsOfServiceCheckbox.check();
  }

  async placeOrder() {
    await this.placeOrderButton.click();
    await this.page.waitForURL(/order-confirmation/);
  }

  private async waitForStep(step: CheckoutStep) {
    await this.main.getByRole('tab', { name: step, exact: true, selected: true }).waitFor();
  }
}
