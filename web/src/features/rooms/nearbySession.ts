import { NEARBY_RADII, NEARBY_REFRESH_MS } from '../../../shared/nearby-v2.mjs';
import type { RoomRealtimePort, RoomRequests } from './roomRealtimePort';
import type { NearbyResult } from './nearbyTypes';
import { safeNearbyReply } from './nearbyTypes';
import { canUseNearbyDeviceLocation, locateNearbyCell } from './nearbyLocation';

export type NearbyState = {
  phase: 'off' | 'locating' | 'checking' | 'active' | 'empty' | 'stale' | 'denied' | 'disconnected';
  message: string;
  results: NearbyResult[];
};
type Source = { kind: 'device' } | { kind: 'manual'; cell: string };
type Environment = {
  visible: () => boolean;
  supported: () => boolean;
  locate: (signal: AbortSignal) => Promise<string>;
  permission: () => Promise<PermissionStatus>;
};
const initial: NearbyState = { phase: 'off', message: '', results: [] };
const copy: Record<string, string> = {
  DENIED: 'Location is off. Choose an area or use a room link.',
  TIMEOUT: 'Your location took too long. Choose an area or try again.',
  INACCURATE: 'Your location is too uncertain. Choose an area instead.',
  UNAVAILABLE: 'Location is unavailable here. Choose an area or use a room link.',
  RATE_LIMITED: 'Too many nearby requests. Wait a minute, then try again.',
  DISABLED: 'Nearby is not available on this room service yet.',
  HOST_REQUIRED: 'Reconnect to your room, then enable nearby again.'
};

/** Owns only ephemeral discovery. It never creates a room, wallet or media peer. */
export class NearbySession {
  private revision = 0;
  private source: Source | null = null;
  private radius = 5;
  private abort: AbortController | null = null;
  private refresh: ReturnType<typeof setTimeout> | undefined;
  private expiry: ReturnType<typeof setTimeout> | undefined;
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
      locate: locateNearbyCell,
      permission: () => navigator.permissions.query({ name: 'geolocation' })
    };
  }
  snapshot = () => this.state;
  selection = () => ({ radius: this.radius, source: this.source });
  subscribe = (listener: (state: NearbyState) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(state: NearbyState) {
    this.state = state;
    this.listeners.forEach(listener => listener(state));
  }
  private request<K extends keyof RoomRequests>(event: K, payload: RoomRequests[K]['input']): Promise<RoomRequests[K]['output']> {
    return new Promise((resolve, reject) => {
      if (!this.enabled || !this.port.connected) {
        reject(new Error('DISCONNECTED'));
        return;
      }
      this.port.request(event, payload, { connectedOnly: true, timeoutMs: 6000, volatile: true }, (error, reply) => {
        if (error || !reply) reject(new Error('DISCONNECTED'));
        else resolve(reply);
      });
    });
  }
  stop(message = '', phase: NearbyState['phase'] = 'off') {
    const hadSource = this.source !== null;
    const rev = ++this.revision;
    this.source = null;
    this.abort?.abort();
    this.abort = null;
    clearTimeout(this.refresh);
    clearTimeout(this.expiry);
    if (this.permission) this.permission.onchange = null;
    this.permission = null;
    this.set({ phase, message, results: [] });
    if (this.host && hadSource) {
      const pending = 'Nearby is off on this device. The room may remain discoverable for up to 90 seconds.';
      this.set({ phase, message: message || pending, results: [] });
      void this.request('nearby:off', {})
        .then(reply => {
          if (rev === this.revision && reply.ok) this.set({ phase, message: message || 'Your room is no longer visible nearby.', results: [] });
        })
        .catch(() => {
          if (rev === this.revision) this.set({ phase, message: pending, results: [] });
        });
    }
  }
  async start(source: Source, radius: number) {
    this.stop();
    if (!this.enabled || !NEARBY_RADII.includes(radius) || !this.env.visible()) return;
    if (!this.port.connected) {
      this.set({ phase: 'disconnected', message: 'Reconnect, then try Nearby again.', results: [] });
      return;
    }
    this.source = source;
    this.radius = radius;
    const rev = ++this.revision;
    if (source.kind === 'device') {
      if (!this.env.supported()) {
        this.stop(copy.UNAVAILABLE, 'denied');
        return;
      }
      try {
        const permission = await this.env.permission();
        if (rev !== this.revision) return;
        this.permission = permission;
        permission.onchange = () => {
          if (permission.state !== 'granted') this.stop(copy.DENIED, 'denied');
        };
        if (permission.state === 'denied') {
          this.stop(copy.DENIED, 'denied');
          return;
        }
      } catch {
        if (rev === this.revision) this.stop(copy.UNAVAILABLE, 'denied');
        return;
      }
    }
    await this.update(rev, true);
  }
  private async update(rev: number, explicit = false) {
    const source = this.source;
    if (!source || rev !== this.revision) return;
    if (!this.env.visible()) {
      this.stop('Nearby paused while you were away. Start again to continue.');
      return;
    }
    try {
      if (source.kind === 'device' && !explicit) {
        const permission = await this.env.permission();
        if (rev !== this.revision) return;
        if (permission.state !== 'granted') throw new Error('DENIED');
      }
      this.abort = new AbortController();
      if (explicit)
        this.set({
          phase: source.kind === 'device' ? 'locating' : 'checking',
          message: source.kind === 'device' ? 'Finding your approximate area…' : 'Checking nearby rooms…',
          results: []
        });
      const cell = source.kind === 'device' ? await this.env.locate(this.abort.signal) : source.cell;
      if (rev !== this.revision) return;
      const area = { schemaVersion: 2 as const, cell, radiusKm: this.radius };
      const requestedAt = performance.now();
      const reply = await this.request(this.host ? 'nearby:publish' : 'nearby:search', area);
      if (rev !== this.revision) return;
      if (!safeNearbyReply(reply, this.host)) throw new Error('UNAVAILABLE');
      if (!reply.ok) throw new Error(reply.code);
      const results = 'results' in reply ? reply.results.filter(item => !this.hidden.has(item.roomId)) : [];
      this.set({
        phase: this.host || results.length ? 'active' : 'empty',
        results,
        message: this.host
          ? `Visible nearby · about ${this.radius} km`
          : results.length
            ? 'Live rooms in your approximate area'
            : 'No visible rooms in this area yet. Try a wider search or share a room link.'
      });
      clearTimeout(this.expiry);
      // Relative, conservative leases tolerate clock skew between devices and
      // server. Subtract the whole round-trip so transit cannot extend a lease.
      const remaining = Math.min(reply.expiresInMs ?? 0, ...results.map(item => item.expiresInMs)) - (performance.now() - requestedAt);
      this.expiry = setTimeout(
        () => {
          if (rev === this.revision) this.set({ phase: 'stale', message: 'Updating nearby availability…', results: [] });
        },
        Math.max(0, remaining)
      );
      this.refresh = setTimeout(() => void this.update(rev), NEARBY_REFRESH_MS);
    } catch (error) {
      if (rev !== this.revision) return;
      const code = error instanceof Error ? error.message : '';
      this.stop(copy[code] ?? 'Nearby could not refresh. Reconnect and try again.', code === 'DENIED' ? 'denied' : 'stale');
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
