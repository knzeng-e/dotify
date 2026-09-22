import { createFakeHost } from '@parity/product-sdk-host/testing';
import { deriveH160 } from '@parity/product-sdk/address';
import { ResultAsync } from 'neverthrow';

// Test-only entry. Exercises the installed SDK host adapter, without a signing
// device or a production fallback signer. No source file imports this fixture.
declare global {
  interface Window {
    identityFixture: {
      requests: number;
      setProfile: (name: string, key?: number, delayed?: boolean, denied?: boolean) => void;
      resolveName: () => void;
      addressForKey: (key: number) => string;
      emitExtension: (event: string, value?: unknown) => void;
    };
  }
}
const extensionEvents = new Map<string, Set<(...args: unknown[]) => void>>();
Object.assign(window, {
  ethereum: {
    request: async ({ method }: { method: string }) => (method === 'eth_chainId' ? '0x1' : ['0x' + '11'.repeat(20)]),
    on: (event: string, callback: (...args: unknown[]) => void) => {
      if (!extensionEvents.has(event)) extensionEvents.set(event, new Set());
      extensionEvents.get(event)!.add(callback);
    },
    removeListener: (event: string, callback: (...args: unknown[]) => void) => extensionEvents.get(event)?.delete(callback)
  }
});
let finishName = () => {};
window.identityFixture = {
  requests: 0,
  setProfile(name, key = 17, delayed = false, denied = false) {
    const host = createFakeHost({ primaryUsername: name, publicKey: new Uint8Array(32).fill(key) });
    const original = host.client.account.getUserId.bind(host.client.account);
    host.client.account.getUserId = () => {
      window.identityFixture.requests++;
      if (denied) return ResultAsync.fromPromise(Promise.reject(new Error('PermissionDenied')), () => ({ tag: 'PermissionDenied' }) as never);
      if (!delayed) return original();
      return ResultAsync.fromPromise(
        new Promise<void>(resolve => {
          finishName = resolve;
        }),
        () => ({ tag: 'Unknown' }) as never
      ).andThen(() => original());
    };
  },
  resolveName: () => finishName(),
  addressForKey: key => deriveH160(new Uint8Array(32).fill(key)),
  emitExtension: (event, value) => extensionEvents.get(event)?.forEach(callback => callback(value))
};
window.identityFixture.setProfile('gaby.dot');
await import('../../src/main');
