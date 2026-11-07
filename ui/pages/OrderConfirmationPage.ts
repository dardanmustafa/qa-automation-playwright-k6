import { BasePage, parsePrice } from './BasePage';

export class OrderConfirmationPage extends BasePage {
  readonly confirmedHeading = this.main.getByRole('heading', { name: 'Your order is confirmed' });
  readonly emailNotice = this.main.getByText(/An email has been sent to the .+ address\./);
  readonly paymentMethodItem = this.main.getByRole('listitem').filter({ hasText: /^Payment method:/ });
  readonly shippingMethodItem = this.main.getByRole('listitem').filter({ hasText: /^Shipping method:/ });

  orderedProduct(productName: string) {
    return this.main.getByRole('paragraph').filter({ hasText: new RegExp(`^${productName}$`) });
  }

  async orderReference(): Promise<string> {
    const text = await this.main.getByRole('listitem').filter({ hasText: /^Order reference:/ }).innerText();
    return text.replace('Order reference:', '').trim();
  }

  /** Bank wire only: the transfer details under "Payment information", by label (e.g. "Bank name"). */
  async bankWireDetails(): Promise<Record<string, string>> {
    const labels = await this.main.getByRole('term').allInnerTexts();
    const values = await this.main.getByRole('definition').allInnerTexts();
    return Object.fromEntries(labels.map((label, i) => [label.trim(), (values[i] ?? '').trim()]));
  }

  async totalAmount(): Promise<number> {
    const match = (await this.main.innerText()).match(/Total\s*\(tax incl\.\)\s*(€[\d.,]+)/);
    if (!match) throw new Error('No "Total (tax incl.)" on the confirmation page');
    return parsePrice(match[1]);
  }
}
