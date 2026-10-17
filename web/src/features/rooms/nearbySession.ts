import { requiresExplicitProductRoomEntry } from '../productHost/productHost';
import { NEARBY_RADII, NEARBY_REFRESH_MS } from '../../../shared/nearby-v2.mjs';
import type { RoomRealtimePort, RoomRequests } from './roomRealtimePort';
import type { NearbyResult } from './nearbyTypes';
import { safeNearbyReply } from './nearbyTypes';
import {
  authorizeNearbyDeviceLocation,
  canRefreshNearbyDeviceLocation,
  canUseNearbyDeviceLocation,
  locateNearbyCell,
  queryNearbyLocationPermission
} from './nearbyLocation';

export type NearbyState = {
  phase: 'off' | 'locating' | 'checking' | 'active' | 'empty' | 'stale' | 'denied' | 'disconnected';
  message: string;
  results: NearbyResult[];
  retryInSeconds?: number;
  revocationPending?: boolean;
  locationIssue?: 'host-unavailable';
};
type Source = { kind: 'device' } | { kind: 'manual'; cell: string } | { kind: 'worldwide' };
type Environment = {
  visible: () => boolean;
  supported: () => boolean;
  authorize?: (signal: AbortSignal) => Promise<void>;
  continuousDevice?: () => boolean;
  reauthorizeOnRefresh?: () => boolean;
  locate: (signal: AbortSignal, onCoarseFix?: () => void) => Promise<string>;
  permission: (signal: AbortSignal) => Promise<PermissionStatus | null>;
};
const initial: NearbyState = { phase: 'off', message: '', results: [] };
const copy: Record<string, string> = {
  DENIED: 'Location access was not granted. Check location permissions for Dotify and your Polkadot app or browser, then try again.',
  TIMEOUT: 'Your location took too long. Worldwide rooms are still available. Try again.',
  INACCURATE: 'Your location is too uncertain. Try near a window or check device location settings.',
  UNAVAILABLE: 'Location is unavailable here. You can still explore worldwide rooms or use a room link.',
  RATE_LIMITED: 'Too many nearby requests. Wait a minute, then try again.',
  DISABLED: 'Nearby is not available on this room service yet.',
  HOST_REQUIRED: 'Reconnect to your room, then enable nearby again.',
  HOST_LOCATION_UNAVAILABLE: 'This Polkadot app could not provide location access. You can still explore worldwide rooms or use a room link.',
  HOST_TIMEOUT: 'The Polkadot app did not answer the location request. Try again or use a room link.'
};

/** Owns only ephemeral discovery. It never creates a room, wallet or media peer. */
export class NearbySession {
  private revision = 0;
  private nextSearchAt = 0;
  private cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  private source: Source | null = null;
  // The host's explicit room-lifetime choice is independent of a short network lease.
  private desiredSource: Source | null = null;
  private permissionBlocked = false;
  private hostLocationFailed = false;
  private searchVersion: 2 | 3 | 4 = 4;
  private pendingVisibilityScope: 'nearby' | 'worldwide' | null = null;
  private radius = 5;
  private deviceSnapshotOnly = false;
  private reauthorizeOnRefresh = false;
  private abort: AbortController | null = null;
  private refresh: ReturnType<typeof setTimeout> | undefined;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private resultExpiry: ReturnType<typeof setTimeout> | undefined;
  private resultDeadlines = new Map<string, number>();
  private permission: PermissionStatus | null = null;
  private state = initial;
  private listeners = new Set<(state: NearbyState) => void>();
  private hidden = new Set<string>();
  private env: Environment;

  constructor(
    private port: RoomRealtimePort,
    private host: boolean,
    private enabled: boolean,
    env?: Environment
  ) {
    this.env = env ?? {
      visible: () => document.visibilityState === 'visible',
      supported: canUseNearbyDeviceLocation,
      authorize: authorizeNearbyDeviceLocation,
      continuousDevice: canRefreshNearbyDeviceLocation,
      reauthorizeOnRefresh: requiresExplicitProductRoomEntry,
      locate: locateNearbyCell,
      permission: queryNearbyLocationPermission
    };
  }
  snapshot = () => this.state;
  selection = () => ({ radius: this.radius, source: this.host ? this.desiredSource : this.source });
  subscribe = (listener: (state: NearbyState) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(state: NearbyState) {
    this.state = { ...state, ...(this.hostLocationFailed ? { locationIssue: 'host-unavailable' as const } : {}) };
    this.listeners.forEach(listener => listener(this.state));
  }
  private request<K extends keyof RoomRequests>(event: K, payload: RoomRequests[K]['input']): Promise<RoomRequests[K]['output']> {
    return new Promise((resolve, reject) => {
      if (!this.enabled || !this.port.connected) {
        reject(new Error('DISCONNECTED'));
        return;
      }
      // Publishing and revocation must survive connected polling backpressure,
      // especially immediately after room creation. Never queue across reconnect.
      this.port.request(event, payload, { connectedOnly: true, timeoutMs: 6000, volatile: false }, (error, reply) => {
        if (error || !reply) reject(new Error('DISCONNECTED'));
        else resolve(reply);
      });
    });
  }
  stop(message = '', phase: NearbyState['phase'] = 'off', preserveChoice = false) {
    if (!preserveChoice) {
      this.desiredSource = null;
      this.permissionBlocked = false;
      this.hostLocationFailed = false;
    }
    const hadSource = this.source !== null || this.pendingVisibilityScope !== null;
    const scope = this.pendingVisibilityScope ?? (this.source?.kind === 'worldwide' ? 'worldwide' : 'nearby');
    const rev = ++this.revision;
    this.source = null;
    this.deviceSnapshotOnly = false;
    this.abort?.abort();
    this.abort = null;
    clearTimeout(this.refresh);
    clearTimeout(this.cooldownTimer);
    clearTimeout(this.expiry);
    clearTimeout(this.resultExpiry);
    this.resultDeadlines.clear();
    if (this.permission) this.permission.onchange = null;
    this.permission = null;
    if (this.host && hadSource) {
      this.pendingVisibilityScope = scope;
      const pending = `${message ? `${message} ` : ''}${preserveChoice ? 'The previous invitation' : `Visible ${scope} is off on this device. The room`} may remain discoverable for up to 90 seconds.`;
      this.set({ phase, message: pending, results: [], revocationPending: true });
      void this.request('nearby:off', {})
        .then(reply => {
          // A refusal is not revocation. Preserve the expiry warning on both
          // non-OK replies and transport failures, never claim link-only early.
          if (rev !== this.revision || reply.ok !== true) return;
          this.pendingVisibilityScope = null;
          this.set({
            phase,
            message: preserveChoice ? message : message ? `${message} Your room is available by link only.` : `Your room is no longer visible ${scope}.`,
            results: []
          });
        })
        .catch(() => {
          // The already-visible bounded-expiry warning remains authoritative.
        });
    } else this.set({ phase, message, results: [] });
  }

  /** Withdraw the current lease, retaining only the explicit visibility choice. */
  suspend(message = 'Visibility paused. Your choice is saved.', phase: NearbyState['phase'] = 'stale') {
    this.stop(message, phase, this.host);
  }
  async resume() {
    if (!this.host || !this.desiredSource || this.permissionBlocked || this.hostLocationFailed || !this.port.connected || !this.env.visible()) return;
    if (['locating', 'checking', 'active'].includes(this.state.phase)) return;
    await this.start(this.desiredSource, this.radius, true);
  }
  private failed(code: string, message: string, acquiringLocation = false) {
    const phase = code === 'DENIED' ? 'denied' : 'stale';
    const snapshotOnly = this.deviceSnapshotOnly;
    const hostLocationFailed =
      ['HOST_LOCATION_UNAVAILABLE', 'HOST_TIMEOUT'].includes(code) ||
      (acquiringLocation && this.reauthorizeOnRefresh && ['UNAVAILABLE', 'TIMEOUT'].includes(code));
    if (hostLocationFailed) message = 'Your Polkadot app could not return a location. Continue in your browser for Nearby, or explore worldwide rooms here.';
    this.permissionBlocked = code === 'DENIED' || code === 'CONFIRM_LOCATION';
    this.suspend(message, phase);
    this.hostLocationFailed = hostLocationFailed;
    if (hostLocationFailed) this.set(this.state);
    // A failed fix never renews the previous area. Retry only while foregrounded;
    // explicit denial requires a new user action, not repeated permission prompts.
    if (this.host && this.desiredSource && !this.permissionBlocked && !snapshotOnly && !hostLocationFailed)
      this.refresh = setTimeout(() => void this.resume(), code === 'RATE_LIMITED' ? 60_000 : NEARBY_REFRESH_MS);
  }
  pause() {
    this.stop();
    if (!this.host) this.showCooldown();
  }
  async start(source: Source, radius: number, automatic = false) {
    if (this.state.phase === 'locating' || this.state.phase === 'checking') return;
    if (!this.host && Date.now() < this.nextSearchAt) {
      this.showCooldown();
      return;
    }
    if (!this.enabled || !NEARBY_RADII.includes(radius)) return;
    this.stop();
    if (this.host) this.desiredSource = source;
    this.radius = radius;
    if (!this.env.visible()) {
      this.set({ phase: 'stale', message: 'Visibility paused while you were away. Your choice is saved.', results: [] });
      return;
    }
    if (!this.port.connected) {
      this.set({ phase: 'disconnected', message: 'Reconnect, then try Nearby again.', results: [] });
      return;
    }
    this.source = source;
    // Capture the policy before an asynchronous Host handshake. Losing a Host
    // marker/port must never turn a snapshot into continuous browser tracking.
    this.reauthorizeOnRefresh = source.kind === 'device' && this.env.reauthorizeOnRefresh?.() === true;
    this.deviceSnapshotOnly = source.kind === 'device' && this.env.continuousDevice?.() === false;
    const rev = ++this.revision;
    if (source.kind === 'device') {
      if (!this.env.supported()) {
        this.failed('UNAVAILABLE', copy.UNAVAILABLE, true);
        return;
      }
      this.abort = new AbortController();
      this.set({ phase: 'locating', message: 'Allow location to find your approximate area…', results: [] });
      try {
        if (this.env.authorize) await this.env.authorize(this.abort.signal);
        if (rev !== this.revision) return;
        if (!this.env.visible() || !this.port.connected) {
          this.suspend('Visibility paused. Your choice is saved.');
          return;
        }
        const permission = await this.env.permission(this.abort.signal);
        if (rev !== this.revision) return;
        if (permission && !['granted', 'prompt', 'denied'].includes(permission.state)) throw new Error('UNAVAILABLE');
        this.permission = permission;
        if (permission)
          permission.onchange = () => {
            if (permission.state !== 'granted') this.failed('DENIED', copy.DENIED);
          };
        if (permission?.state === 'denied') {
          this.failed('DENIED', copy.DENIED);
          return;
        }
        if (automatic && !this.reauthorizeOnRefresh && permission?.state !== 'granted') {
          this.failed('CONFIRM_LOCATION', 'Your Nearby choice is saved. Confirm location to make your room visible again.');
          return;
        }
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (rev === this.revision) this.failed(code, copy[code] ?? copy.UNAVAILABLE, true);
        return;
      }
    }
    await this.update(rev, true);
  }
  private async update(rev: number, explicit = false) {
    const source = this.source;
    if (!source || rev !== this.revision) return;
    if (!this.env.visible()) {
      this.suspend('Visibility paused while you were away. Your choice is saved.');
      return;
    }
    let acquiringLocation = source.kind === 'device';
    try {
      this.abort = new AbortController();
      if (source.kind === 'device' && !explicit) {
        if (this.reauthorizeOnRefresh) {
          if (!this.env.authorize) throw new Error('UNAVAILABLE');
          await this.env.authorize(this.abort.signal);
        }
        if (rev !== this.revision) return;
        const permission = await this.env.permission(this.abort.signal);
        if (rev !== this.revision) return;
        if (permission?.state === 'denied' || (!this.reauthorizeOnRefresh && permission?.state !== 'granted')) throw new Error('DENIED');
      }
      if (explicit)
        this.set({
          phase: source.kind === 'device' ? 'locating' : 'checking',
          message: source.kind === 'device' ? 'Finding your approximate area…' : 'Checking nearby rooms…',
          results: []
        });
      const coarseFix = () => {
        if (rev === this.revision && this.state.phase === 'locating') this.set({ ...this.state, message: 'Waiting for a more precise location…' });
      };
      const cell = source.kind === 'device' ? await this.env.locate(this.abort.signal, coarseFix) : source.kind === 'manual' ? source.cell : null;
      if (rev !== this.revision) return;
      acquiringLocation = false;
      const area =
        source.kind === 'worldwide'
          ? { schemaVersion: 2 as const, worldwide: true as const }
          : { schemaVersion: 2 as const, cell: cell!, radiusKm: this.radius };
      // Only an explicit start shows progress. Background refreshes keep the
      // current phase so controls do not flicker or swallow a gesture.
      if (explicit)
        this.set({
          ...this.state,
          phase: 'checking',
          message: source.kind === 'device' ? `Location found · scanning within about ${this.radius} km…` : 'Checking live rooms…'
        });
      if (!this.host) this.nextSearchAt = Date.now() + 10_000;
      const requestedAt = performance.now();
      let reply = this.host ? await this.request('nearby:publish', area) : await this.request('nearby:search', { ...area, schemaVersion: this.searchVersion });
      // Older signaling releases reject an unknown version before consuming a
      // search budget. Negotiate once per session; never downgrade on denial or
      // transport failures, and retain the strict reply validator.
      while (!this.host && !reply.ok && reply.code === 'INVALID_AREA' && this.searchVersion > 2 && rev === this.revision) {
        this.searchVersion = this.searchVersion === 4 ? 3 : 2;
        reply = await this.request('nearby:search', { ...area, schemaVersion: this.searchVersion });
      }
      if (rev !== this.revision) return;
      if (!safeNearbyReply(reply, this.host)) throw new Error('UNAVAILABLE');
      if (!reply.ok) {
        if (reply.code === 'RATE_LIMITED' && !this.host) this.nextSearchAt = Date.now() + 60_000;
        throw new Error(reply.code);
      }
      if (this.host) this.pendingVisibilityScope = null;
      const receivedAt = performance.now();
      this.resultDeadlines.clear();
      const results =
        'results' in reply
          ? reply.results.filter(item => {
              const deadline = requestedAt + Math.min(item.expiresInMs, reply.expiresInMs ?? 0);
              if (this.hidden.has(item.roomId) || deadline <= receivedAt) return false;
              this.resultDeadlines.set(item.discoveryId, deadline);
              return true;
            })
          : [];
      this.set({
        phase: this.host || results.length ? 'active' : 'empty',
        results,
        message:
          source.kind === 'worldwide'
            ? this.host
              ? 'Visible worldwide. Anyone can discover this room.'
              : results.length
                ? 'Live rooms shared with the world'
                : 'No worldwide rooms right now.'
            : this.host
              ? source.kind === 'manual'
                ? `Visible around your chosen city centre · about ${this.radius} km`
                : `Visible nearby · about ${this.radius} km`
              : results.length
                ? source.kind === 'manual'
                  ? 'Live rooms around your chosen city centre'
                  : `Scan complete · ${results.length} room${results.length === 1 ? '' : 's'} near your current location`
                : this.emptyMessage()
      });
      if (!this.host) this.showCooldown();
      clearTimeout(this.expiry);
      // Relative, conservative leases tolerate clock skew between devices and
      // server. Subtract the whole round-trip so transit cannot extend a lease.
      // The response owns the snapshot lease; each room owns only its card.
      // A short-lived room must not force a new Host permission/location cycle.
      const remaining = (reply.expiresInMs ?? 0) - (performance.now() - requestedAt);
      const snapshotOnly = this.deviceSnapshotOnly;
      this.expiry = setTimeout(
        () => {
          if (rev !== this.revision) return;
          if (snapshotOnly) this.suspend('This location snapshot has expired. Try location again to update rooms around you.', 'stale');
          else this.set({ phase: 'stale', message: 'Updating nearby availability…', results: [] });
        },
        Math.max(0, remaining)
      );
      this.expireResults(rev);
      if (!snapshotOnly) this.refresh = setTimeout(() => void this.update(rev), this.host || source.kind === 'worldwide' ? NEARBY_REFRESH_MS : 15_000);
    } catch (error) {
      if (rev !== this.revision) return;
      const code = error instanceof Error ? error.message : '';
      this.failed(code, copy[code] ?? 'Visibility is temporarily unavailable. Your choice is saved; we will retry when connected.', acquiringLocation);
      if (!this.host) this.showCooldown();
    }
  }
  private showCooldown() {
    clearTimeout(this.cooldownTimer);
    const retryInSeconds = Math.max(0, Math.ceil((this.nextSearchAt - Date.now()) / 1000));
    this.set({ ...this.state, retryInSeconds });
    if (retryInSeconds) this.cooldownTimer = setTimeout(() => this.showCooldown(), 1000);
  }
  private emptyMessage() {
    if (this.source?.kind === 'worldwide') return 'No worldwide rooms right now.';
    return this.source?.kind === 'manual'
      ? 'No open rooms around this city centre yet. Widen the search, or share a room link.'
      : `Scan complete · no open rooms within about ${this.radius} km yet. Widen the search, or open a room here.`;
  }
  private expireResults(rev: number) {
    if (rev !== this.revision || !this.source) return;
    clearTimeout(this.resultExpiry);
    const now = performance.now();
    for (const [id, deadline] of this.resultDeadlines) {
      if (deadline <= now) this.resultDeadlines.delete(id);
    }
    const results = this.state.results.filter(item => (this.resultDeadlines.get(item.discoveryId) ?? 0) > now);
    if (results.length !== this.state.results.length) {
      this.set({ ...this.state, results, phase: results.length ? 'active' : 'empty', message: results.length ? this.state.message : this.emptyMessage() });
    }
    if (results.length) {
      const next = Math.min(...results.map(item => this.resultDeadlines.get(item.discoveryId)!));
      this.resultExpiry = setTimeout(() => this.expireResults(rev), Math.max(0, next - now));
    }
  }
  hide(roomId: string) {
    if (this.hidden.size < 200) this.hidden.add(roomId);
    const results = this.state.results.filter(item => item.roomId !== roomId);
    this.set({ ...this.state, results });
  }
  async report(item: NearbyResult, reason: 'unwanted' | 'misleading' | 'offensive') {
    this.hide(item.roomId);
    const rev = this.revision;
    try {
      const reply = await this.request('nearby:report', { discoveryId: item.discoveryId, reason });
      if (rev === this.revision)
        this.set({
          ...this.state,
          message: reply.ok
            ? 'Room hidden for this session. A safety signal was counted; this does not open a moderation case.'
            : 'Room hidden. The safety signal could not be sent.'
        });
    } catch {
      if (rev === this.revision) this.set({ ...this.state, message: 'Room hidden. The safety signal could not be sent.' });
    }
  }
}
