import { QUALIFICATION_APP_VERSION, QUALIFICATION_PRODUCT_ID } from './scripts/qualification-profile.mjs';

// Separate candidate configuration. Loading it does not publish a Product.
export default {
  domain: QUALIFICATION_PRODUCT_ID,
  displayName: 'Dotify qualification',
  description: 'Read-only Host information before fresh artist onboarding.',
  icon: { path: './product-icon.png', format: 'png' },
  executables: [{ kind: 'app', path: './dist-qualification', appVersion: QUALIFICATION_APP_VERSION }]
};
