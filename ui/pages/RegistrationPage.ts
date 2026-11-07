import type { Customer } from '../test-data';
import { BasePage } from './BasePage';

/** "Create an account" page. */
export class RegistrationPage extends BasePage {
  readonly birthdateInput = this.main.getByRole('textbox', { name: 'Birthdate' });

  async open() {
    await this.page.goto('/registration');
  }

  /** Fills in the form and clicks "Create account". The test checks the result, so it can also send invalid data. */
  async register(customer: Customer) {
    await this.main.getByRole('radio', { name: customer.socialTitle }).check();
    await this.main.getByRole('textbox', { name: 'First name' }).fill(customer.firstName);
    await this.main.getByRole('textbox', { name: 'Last name' }).fill(customer.lastName);
    await this.main.getByRole('textbox', { name: 'Email' }).fill(customer.email);
    await this.main.getByRole('textbox', { name: 'Password' }).fill(customer.password);
    // The shop scores the password in the background, then shows a strength meter above "Create account".
    // Clicking before it appears can miss the button as it moves down (seen once in WebKit).
    await this.main.getByText('Enter a password between 8 and 72 characters').waitFor();
    await this.main.getByRole('checkbox', { name: /^I agree to the terms and conditions/ }).check();
    await this.main.getByRole('checkbox', { name: /^Customer data privacy/ }).check();
    await this.main.getByRole('button', { name: 'Create account' }).click();
  }
}
