import { describe, expect, it, vi } from 'vitest';
import { createDonationFlow } from './donationFlow';
import { SupportNotSubmittedError } from '../payments/supportPayment';
const hash = `0x${'ab'.repeat(32)}` as const;
function fixture() {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (k: string) => entries.get(k) ?? null,
    setItem: (k: string, v: string) => {
      entries.set(k, v);
    },
    removeItem: (k: string) => {
      entries.delete(k);
    }
  };
  const port = {
    asset: { symbol: 'PAS', decimals: 10, network: 'native:test' },
    send: vi.fn(async () => ({ hash, finalized: false })),
    confirm: vi.fn(async () => {}),
    destroy: vi.fn()
  };
  const input = { port, amount: 12n, sender: `0x${'11'.repeat(20)}` as const, recipient: `0x${'22'.repeat(20)}` as const, currentAccount: vi.fn(() => true) };
  return { storage, entries, port, input, flow: createDonationFlow(() => storage) };
}
describe('artist gifts', () => {
  it('coalesces overlapping approvals and confirms the exact transfer', async () => {
    const f = fixture();
    const first = f.flow.run(f.input);
    expect(f.flow.run(f.input)).toBe(first);
    await expect(first).resolves.toMatchObject({ status: 'confirmed', amount: 12n, hash });
    expect(f.port.send).toHaveBeenCalledExactlyOnceWith(f.input.recipient, 12n);
    expect(f.port.confirm).toHaveBeenCalledExactlyOnceWith({ hash, amount: 12n }, f.input.recipient);
    expect(f.entries.size).toBe(0);
  });
  it('reload recovers the original amount without sending another gift', async () => {
    const f = fixture();
    f.port.confirm.mockRejectedValueOnce(new Error('Timeout'));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain', hash });
    await expect(createDonationFlow(() => f.storage).run({ ...f.input, amount: 999n })).resolves.toMatchObject({ status: 'confirmed', amount: 12n });
    expect(f.port.send).toHaveBeenCalledTimes(1);
    expect(f.port.confirm).toHaveBeenLastCalledWith({ hash, amount: 12n }, f.input.recipient);
  });
  it('blocks another send when native approval disconnects without a hash', async () => {
    const f = fixture();
    f.port.send.mockRejectedValue(new Error('Host disconnected'));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain' });
    await expect(createDonationFlow(() => f.storage).run(f.input)).resolves.toMatchObject({ status: 'uncertain' });
    expect(f.port.send).toHaveBeenCalledTimes(1);
  });
  it.each([Object.assign(new Error('Rejected'), { code: 4001 }), new SupportNotSubmittedError(new Error('Wrong account'))])(
    'allows a deliberate retry only after proven non-submission: %s',
    async error => {
      const f = fixture();
      f.port.send.mockRejectedValueOnce(error);
      await f.flow.run(f.input);
      expect(f.entries.size).toBe(0);
      await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'confirmed' });
    }
  );
  it('does not clear a reservation after an endpoint permission denial', async () => {
    const f = fixture();
    f.port.send.mockRejectedValue(new Error('Permission denied'));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain' });
    expect(f.entries.size).toBe(1);
  });
  it('accepts finalized native success without an EVM receipt lookup', async () => {
    const f = fixture();
    f.port.send.mockResolvedValue({ hash, finalized: true });
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'confirmed' });
    expect(f.port.confirm).not.toHaveBeenCalled();
  });
  it('refuses to send after an account change or without durable storage', async () => {
    const f = fixture();
    f.input.currentAccount.mockReturnValue(false);
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'failed' });
    f.input.currentAccount.mockReturnValue(true);
    await expect(
      createDonationFlow(() => {
        throw new Error('Storage unavailable');
      }).run(f.input)
    ).resolves.toMatchObject({ status: 'failed' });
    expect(f.port.send).not.toHaveBeenCalled();
  });
  it('malformed stored amounts fail closed without throwing from recovery', async () => {
    const f = fixture();
    f.port.send.mockRejectedValue(new Error('Disconnected'));
    await f.flow.run(f.input);
    f.entries.set([...f.entries.keys()][0], JSON.stringify({ amount: 'NaN' }));
    await expect(createDonationFlow(() => f.storage).run(f.input)).resolves.toMatchObject({ status: 'failed' });
    expect(f.port.send).toHaveBeenCalledTimes(1);
  });
});
