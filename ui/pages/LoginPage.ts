import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput = this.main.getByRole('textbox', { name: 'Email' });
  readonly passwordInput = this.main.getByRole('textbox', { name: 'Password' });
  readonly showPasswordButton = this.main.getByRole('button', { name: 'Show password' });
  readonly errorAlert = this.main.getByRole('alert');

  async open() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.main.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
}
