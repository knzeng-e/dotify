import type { DonationPort } from '../features/donations/donationModel';
import { E2E_CLASSIC_TX_HASH } from './classicUnlockMock';

export function donationE2ePort(): DonationPort {
  const state = { sends: 0, confirmed: false };
  Reflect.set(window, '__DOTIFY_E2E_DONATION__', state);
  return {
    asset: { symbol: 'PAS', decimals: 18, network: 'e2e:donation' },
    async send() {
      state.sends++;
      if (new URLSearchParams(location.search).get('e2eGift') === 'reject') throw Object.assign(new Error('User rejected'), { code: 4001 });
      return { hash: E2E_CLASSIC_TX_HASH, finalized: false };
    },
    async confirm() {
      if (new URLSearchParams(location.search).get('e2eGift') === 'delayed' && !state.confirmed) throw new Error('Confirmation delayed');
      state.confirmed = true;
    },
    destroy() {}
  };
}
