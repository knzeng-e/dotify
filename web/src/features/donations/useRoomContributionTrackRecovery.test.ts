import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogTrack, TrackInfo } from '../../shared/types';
import { useRoomContributionTrackRecovery } from './useRoomContributionTrackRecovery';

// Run the session effect without mounting a player or requiring a browser.
vi.mock('react', () => ({ useEffect: (effect: () => void) => effect() }));

const runtime = '0x000000000000000000000000000000000000b0b0';
const hash = `0x${'71'.repeat(32)}` as const;
const track = { id: `${runtime}:${hash}`, hash, source: 'artist', active: true } as CatalogTrack;
const legacy: TrackInfo = { hash, title: 'Live work', artist: 'Artist', duration: 237, updatedAt: 1, bulletinRef: '' };
const setTrackInfo = vi.fn();
const socketEmit = vi.fn();

function RecoveryHarness(overrides: Partial<Parameters<typeof useRoomContributionTrackRecovery>[0]> = {}) {
  useRoomContributionTrackRecovery({
    mode: 'host',
    roomId: 'ROOM',
    socketStatus: 'online',
    tracks: [track],
    catalogIsAuthoritative: true,
    trackInfo: legacy,
    setTrackInfo,
    socketEmit,
    ...overrides
  });
}

describe('session-owned room contribution recovery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('repairs and broadcasts a unique verified release while no player is mounted', () => {
    RecoveryHarness();
    expect(setTrackInfo).toHaveBeenCalledExactlyOnceWith({ ...legacy, runtimeAddress: runtime });
    expect(socketEmit).toHaveBeenCalledExactlyOnceWith('room:track', { ...legacy, runtimeAddress: runtime });
    RecoveryHarness({ trackInfo: { ...legacy, runtimeAddress: runtime } });
    expect(socketEmit).toHaveBeenCalledTimes(1);
  });

  it('waits for catalog verification and retries when the authoritative catalog arrives', () => {
    RecoveryHarness({ catalogIsAuthoritative: false });
    expect(socketEmit).not.toHaveBeenCalled();
    RecoveryHarness();
    expect(socketEmit).toHaveBeenCalledTimes(1);
  });

  it('waits for a connected host and recovers after reconnect', () => {
    RecoveryHarness({ socketStatus: 'offline' });
    expect(setTrackInfo).not.toHaveBeenCalled();
    RecoveryHarness();
    expect(socketEmit).toHaveBeenCalledTimes(1);
  });

  it.each([
    { mode: 'listener' as const },
    { roomId: null },
    { trackInfo: null },
    { tracks: [] },
    { tracks: [track, { ...track, id: `0x0000000000000000000000000000000000000001:${hash}` }] },
    { trackInfo: { ...legacy, runtimeAddress: '0x0000000000000000000000000000000000000001' as const } }
  ])('keeps ambiguous, conflicting, missing and guest metadata unchanged (%j)', overrides => {
    RecoveryHarness(overrides);
    expect(setTrackInfo).not.toHaveBeenCalled();
    expect(socketEmit).not.toHaveBeenCalled();
  });
});
