export interface Customer {
  socialTitle: 'Mr.' | 'Mrs.';
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface Address {
  address: string;
  postcode: string;
  city: string;
  country: string;
  phone: string;
}

export interface Product {
  name: string;
  path: string;
  price: number;
}

/**
 * A brand new customer every time. The demo shop is thrown away after the run,
 * so these accounts never outlive the test run. example.com never receives mail.
 */
export function newCustomer(overrides: Partial<Customer> = {}): Customer {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
  return {
    socialTitle: 'Mrs.',
    firstName: 'Jane',
    lastName: 'Tester',
    email: `qa.${unique}@example.com`,
    password: `Qa!${unique}Pw`,
    ...overrides,
  };
}

export const address: Address = { address: '10 Rue de Rivoli', postcode: '75001', city: 'Paris', country: 'France', phone: '0102030405' };

/** Products from the standard PrestaShop demo catalogue. Prices are tax included, as shown in the shop. */
export const products = {
  mug: { name: 'Mug The best is yet to come', path: '/6-mug-the-best-is-yet-to-come.html', price: 14.28 },
  tShirt: { name: 'Hummingbird printed t-shirt', path: '/1-1-hummingbird-printed-t-shirt.html', price: 22.94 },
  notebook: { name: 'Mountain fox notebook', path: '/16-28-mountain-fox-notebook.html', price: 15.48 },
} satisfies Record<string, Product>;

export const categories = {
  clothes: '/3-clothes',
  women: '/5-women',
  accessories: '/6-accessories',
};

export const carriers = {
  clickAndCollect: { name: 'Click and collect', price: 0 },
  myCarrier: { name: 'My carrier', price: 8.4 },
};

export const paymentMethods = {
  bankWire: { option: 'Pay by bank wire', confirmationLabel: 'Bank transfer' },
  check: { option: 'Pay by Check', confirmationLabel: 'Payments by check' },
};
