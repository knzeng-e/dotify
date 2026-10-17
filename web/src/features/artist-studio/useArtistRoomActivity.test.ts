import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useArtistRoomActivity } from './useArtistRoomActivity';

const h = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  updates: [] as unknown[],
  callbacks: [] as ((error: Error | null, reply: unknown) => void)[],
  token: 'signed-session',
  connected: true,
  wallet: { connectedWallet: { evmAddress: '0x1111111111111111111111111111111111111111', method: 'evm' }, expectedChainId: 42, getActiveWalletClient: vi.fn() },
  clearStoredSession: vi.fn(),
  artistVisitSession: vi.fn()
}));
vi.mock('react', () => ({
  useRef: (initial: unknown) => h.refs[h.cursor++] ?? (h.refs[h.cursor - 1] = { current: initial }),
  useState: (initial: unknown) => [initial, (value: unknown) => h.updates.push(value)],
  useLayoutEffect: (effect: () => void) => effect(),
  useEffect: (effect: () => () => void) => h.cleanups.push(effect())
}));
vi.mock('../../app/providers', () => ({
  useWalletContext: () => h.wallet,
  useSessionContext: () => ({
    socketStatus: 'online',
    connectSocket: () => ({
      connected: h.connected,
      request: (_event: unknown, _payload: unknown, _options: unknown, callback: (error: Error | null, reply: unknown) => void) => h.callbacks.push(callback)
    })
  })
}));
vi.mock('../donations/roomContributionSession', () => ({ resolveRoomContributionSessionToken: () => h.token }));
vi.mock('../../services/keyService', () => ({ clearStoredSession: h.clearStoredSession }));
vi.mock('./artistVisitSession', () => ({ artistVisitSession: h.artistVisitSession }));
const runtime = '0x2222222222222222222222222222222222222222';
const snapshot = { ok: true, roomCount: 2, connectedCount: 3, rooms: [], updatedAt: 1000 };
let visibility: string;
let documentTarget: EventTarget;
function ActivityHarness() {
  h.cursor = 0;
  return useArtistRoomActivity(runtime);
}
function cleanup() {
  h.cleanups.splice(0).forEach(stop => stop());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.refs = [];
  h.cursor = 0;
  h.cleanups = [];
  h.updates = [];
  h.callbacks = [];
  h.token = 'signed-session';
  h.connected = true;
  h.wallet.connectedWallet.evmAddress = '0x1111111111111111111111111111111111111111';
  visibility = 'visible';
  documentTarget = new EventTarget();
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility;
    },
    addEventListener: documentTarget.addEventListener.bind(documentTarget),
    removeEventListener: documentTarget.removeEventListener.bind(documentTarget)
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('silently reuses an existing session and ignores late results after account change or unmount', () => {
  ActivityHarness();
  const first = h.callbacks[0];
  cleanup();
  h.wallet.connectedWallet.evmAddress = '0x3333333333333333333333333333333333333333';
  ActivityHarness();
  h.updates = [];
  first(null, snapshot);
  expect(h.updates).toEqual([]);
  h.callbacks[1](null, snapshot);
  expect(h.updates).toContainEqual(expect.objectContaining({ snapshot }));
  cleanup();
  h.updates = [];
  h.callbacks[1](null, snapshot);
  expect(h.updates).toEqual([]);
  expect(h.artistVisitSession).not.toHaveBeenCalled();
});

it('does not overlap scans and stops polling while hidden', () => {
  ActivityHarness();
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  expect(h.callbacks).toHaveLength(1);
  h.callbacks[0](null, snapshot);
  visibility = 'hidden';
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(30000);
  expect(h.callbacks).toHaveLength(1);
  visibility = 'visible';
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  expect(h.callbacks).toHaveLength(2);
});

it('clears only the rejected session and never treats verification failure as zero activity', () => {
  ActivityHarness();
  h.callbacks[0](null, { ok: false, code: 'SESSION_INVALID' });
  expect(h.clearStoredSession).toHaveBeenCalledWith(h.wallet.connectedWallet.evmAddress, 'signed-session');
  expect(h.updates).toContainEqual(expect.objectContaining({ snapshot: null, needsSession: true }));
  vi.advanceTimersByTime(30000);
  expect(h.callbacks).toHaveLength(1);
});

it('shows a session action without automatically triggering wallet approval', () => {
  h.token = '';
  ActivityHarness();
  expect(h.callbacks).toHaveLength(0);
  expect(h.updates).toContainEqual(expect.objectContaining({ snapshot: null, needsSession: true }));
  expect(h.artistVisitSession).not.toHaveBeenCalled();
});
