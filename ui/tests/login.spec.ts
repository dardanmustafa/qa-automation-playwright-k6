import { expect, test } from '../fixtures';
import { newCustomer } from '../test-data';

test.describe('Sign in', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
  });

  test('TC-LOGIN-01 Registered customer can sign in with valid credentials', { tag: '@smoke' }, async ({ loginPage, registeredCustomer, page }) => {
    await loginPage.login(registeredCustomer.email, registeredCustomer.password);

    await expect(loginPage.header.accountButton).toContainText(`${registeredCustomer.firstName} ${registeredCustomer.lastName}`);
    await expect(loginPage.header.signInLink).toBeHidden();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('TC-LOGIN-02 Sign in fails with a wrong password', async ({ loginPage, registeredCustomer, page }) => {
    await loginPage.login(registeredCustomer.email, 'WrongPassword!123');

    await expect(loginPage.errorAlert).toContainText('Authentication failed.');
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.header.signInLink).toBeVisible();
  });

  test('TC-LOGIN-03 Sign in fails for an email that has no account', async ({ loginPage }) => {
    await loginPage.login(newCustomer().email, 'SomePassword!123');

    await expect(loginPage.errorAlert).toContainText('Authentication failed.');
    await expect(loginPage.header.signInLink).toBeVisible();
  });

  test('TC-LOGIN-04 Empty form is not submitted', async ({ loginPage, page }) => {
    await loginPage.login('', '');

    // The browser's own validation stops the form: nothing is sent, no server error is shown.
    expect(await loginPage.emailInput.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    await expect(loginPage.errorAlert).toBeHidden();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-LOGIN-05 Email with an invalid format is rejected', async ({ loginPage }) => {
    await loginPage.login('not-an-email', 'SomePassword!123');

    expect(await loginPage.emailInput.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);
    await expect(loginPage.header.signInLink).toBeVisible();
  });

  test('TC-LOGIN-06 Email address is not case-sensitive', async ({ loginPage, registeredCustomer }) => {
    await loginPage.login(registeredCustomer.email.toUpperCase(), registeredCustomer.password);

    await expect(loginPage.header.accountButton).toBeVisible();
  });

  test('TC-LOGIN-07 Password is masked and can be revealed', async ({ loginPage }) => {
    await loginPage.passwordInput.fill('Secret!123');
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

    await loginPage.showPasswordButton.click();
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
  });

  // A few hand-written SQL injection strings, no scanner: the demo shop is not ours to attack.
  test('TC-LOGIN-13 SQL injection in the sign-in form does not sign anyone in', async ({ loginPage, registeredCustomer, page }) => {
    const attempts = [
      // Still a valid email format, so the browser sends the form and the server has to deal with it.
      { field: 'email', email: "x'OR'1'='1@example.com", password: 'SomePassword!123' },
      { field: 'password', email: registeredCustomer.email, password: "' OR '1'='1' -- " },
    ];

    for (const attempt of attempts) {
      await loginPage.open(); // a clean page, so the error checked below belongs to this attempt
      const formSent = page.waitForResponse((response) => response.request().isNavigationRequest() && response.request().method() === 'POST');
      await loginPage.login(attempt.email, attempt.password);

      expect((await formSent).status(), `injection in the ${attempt.field} field must not cause a server error`).toBeLessThan(500);
      await expect(loginPage.errorAlert).toContainText('Authentication failed.');
      await expect(loginPage.main).not.toContainText(/SQL/i);
      await expect(loginPage.header.signInLink).toBeVisible();
    }
  });
});

test.describe('Sign out', () => {
  test('TC-LOGIN-08 Signed-in customer can sign out and loses access to the account', { tag: '@smoke' }, async ({ loginPage, registeredCustomer, page }) => {
    await loginPage.open();
    await loginPage.login(registeredCustomer.email, registeredCustomer.password);
    await expect(loginPage.header.accountButton).toBeVisible();

    await loginPage.header.signOut();
    await expect(loginPage.header.signInLink).toBeVisible();

    // The account area is protected again: the shop sends us to the sign-in page.
    await page.goto('/my-account');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Create account', () => {
  test.beforeEach(async ({ registrationPage }) => {
    await registrationPage.open();
  });

  test('TC-LOGIN-09 New visitor can create an account and is signed in straight away', async ({ registrationPage }) => {
    await registrationPage.register(newCustomer({ firstName: 'Anna', lastName: 'Smith' }));

    await expect(registrationPage.header.accountButton).toContainText('Anna Smith');
  });

  test('TC-LOGIN-10 Account cannot be created twice with the same email', async ({ registrationPage, registeredCustomer }) => {
    await registrationPage.register(newCustomer({ email: registeredCustomer.email }));

    await expect(registrationPage.main.getByText('The email is already used, please choose another one or sign in')).toBeVisible();
    await expect(registrationPage.header.signInLink).toBeVisible();
  });

  test('TC-LOGIN-11 Birth date in the future gets an error that explains the real problem', {
    tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-004' },
  }, async ({ registrationPage }) => {
    await registrationPage.birthdateInput.fill('12/31/2099'); // valid MM/DD/YYYY format, but in the future
    await registrationPage.register(newCustomer());

    // The account must not be created, and an error must be shown ...
    await expect(registrationPage.header.signInLink).toBeVisible();
    const error = registrationPage.main.getByRole('alert').first();
    await expect(error).toBeVisible();

    // ... that does not claim the format is wrong, because it is not.
    test.fail(true, 'Expected to fail until BUG-004 is fixed');
    await expect(error).not.toContainText('Format should be', { timeout: 3_000 });
  });

  test('TC-LOGIN-12 Birth date in the past with the right format is accepted', async ({ registrationPage }) => {
    await registrationPage.birthdateInput.fill('05/31/1970');
    await registrationPage.register(newCustomer());

    await expect(registrationPage.header.accountButton).toBeVisible();
  });
});
