import { ARTIST_QUALIFICATION_APP_VERSION, QUALIFICATION_PRODUCT_ID } from './scripts/qualification-profile.mjs';

export default {
  domain: QUALIFICATION_PRODUCT_ID,
  displayName: 'Dotify artist setup',
  description: 'Create or resume your artist runtime on Paseo.',
  icon: { path: './product-icon.png', format: 'png' },
  executables: [{ kind: 'app', path: './dist-artist-qualification', appVersion: ARTIST_QUALIFICATION_APP_VERSION }]
};
