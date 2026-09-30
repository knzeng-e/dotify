import { ROOM_REACTIONS } from '../../shared/social';
import type { RealtimePeer, RealtimeRoster } from './celerityPrivateTypes';

const utf8 = new TextEncoder();
const TTL = 10_000;
const MAX_BYTES = 512;
const idPattern = /^[a-f0-9]{16}$/;
const scopePattern = /^[a-f0-9]{32}$/;

export type PrivateRoomEvent = { kind: 'reaction'; text: string } | { kind: 'chat' | 'request'; text: string };
// Room code, wallet, socket ID and display name never enter the public envelope.
export type PrivateEnvelope = [2, string, string, string, number, number, string, string];

function encode(bytes: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  const result = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
  if (encode(result) !== value) throw new Error('Noncanonical encoding');
  return result;
}

function validEvent(value: unknown): value is PrivateRoomEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (Object.keys(event).length !== 2 || typeof event.text !== 'string') return false;
  if (event.kind === 'reaction') return (ROOM_REACTIONS as readonly string[]).includes(event.text);
  // Full messages that do not fit remain on Socket.IO; never silently truncate.
  return (event.kind === 'chat' || event.kind === 'request') && event.text.trim().length > 0 && utf8.encode(event.text).length <= 160;
}

function validRoster(roster: RealtimeRoster): boolean {
  return (
    !!roster &&
    typeof roster === 'object' &&
    scopePattern.test(roster.scope) &&
    Number.isSafeInteger(roster.revision) &&
    roster.revision > 0 &&
    Array.isArray(roster.peers) &&
    roster.peers.length <= 128 &&
    roster.peers.every(peer => !!peer && typeof peer === 'object') &&
    roster.peers.filter(peer => peer.role === 'host').length <= 1 &&
    new Set(roster.peers.map(peer => peer.id)).size === roster.peers.length &&
    new Set(roster.peers.map(peer => peer.publicKey)).size === roster.peers.length &&
    roster.peers.every(peer => idPattern.test(peer.id) && ['host', 'listener'].includes(peer.role) && /^[A-Za-z0-9_-]{87}$/.test(peer.publicKey))
  );
}

/** Pairwise keys authenticated by the admitted Socket.IO roster, not by gossip.
 * Ephemeral/non-extractable private keys; no persistence or media-key access.
 */
export async function createPrivateRoomIdentity() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const publicKey = encode(await crypto.subtle.exportKey('raw', pair.publicKey));
  return {
    publicKey,
    bind(self: string, initial: RealtimeRoster) {
      if (!validRoster(initial) || initial.peers.find(peer => peer.id === self)?.publicKey !== publicKey) throw new Error('Unbound realtime identity');
      let roster = initial;
      let closed = false;
      let sequence = 0;
      const keys = new Map<string, Promise<CryptoKey>>();
      const received = new Map<string, { highest: number; seen: Set<number> }>();
      const peerById = (id: string) => roster.peers.find(peer => peer.id === id);

      async function keyFor(peer: RealtimePeer, sender: string, recipient: string) {
        const cacheId = `${sender}/${recipient}`;
        let cached = keys.get(cacheId);
        if (!cached) {
          const scope = roster.scope;
          cached = (async () => {
            const remote = await crypto.subtle.importKey('raw', decode(peer.publicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
            const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: remote }, pair.privateKey, 256);
            const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
            return crypto.subtle.deriveKey(
              { name: 'HKDF', hash: 'SHA-256', salt: utf8.encode(scope), info: utf8.encode(`dotify-private-v2/${sender}/${recipient}`) },
              material,
              { name: 'AES-GCM', length: 256 },
              false,
              ['encrypt', 'decrypt']
            );
          })();
          keys.set(cacheId, cached);
        }
        return cached;
      }

      return {
        self,
        scope: initial.scope,
        active: () => !closed,
        peers: () => (closed ? [] : roster.peers.filter(peer => peer.id !== self)),
        update(next: RealtimeRoster) {
          if (closed || !validRoster(next) || next.scope !== roster.scope || next.revision <= roster.revision) return false;
          if (next.peers.find(peer => peer.id === self)?.publicKey !== publicKey) {
            this.close();
            return false;
          }
          // Identities are immutable within a membership; replacement needs a fresh ID.
          if (
            next.peers.some(peer => {
              const old = peerById(peer.id);
              return old && (old.publicKey !== peer.publicKey || old.role !== peer.role);
            })
          )
            return false;
          roster = next;
          keys.clear();
          for (const id of received.keys()) if (!peerById(id)) received.delete(id);
          return true;
        },
        async seal(recipient: string, event: PrivateRoomEvent, now = Date.now()): Promise<PrivateEnvelope | null> {
          const peer = peerById(recipient);
          if (closed || !peer || recipient === self || !validEvent(event) || !Number.isSafeInteger(now) || now < 0) return null;
          const revision = roster.revision;
          const seq = ++sequence;
          if (!Number.isSafeInteger(seq)) return null;
          const header = [2, roster.scope, self, recipient, seq, now] as const;
          const nonce = crypto.getRandomValues(new Uint8Array(12));
          const key = await keyFor(peer, self, recipient);
          const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce, additionalData: utf8.encode(JSON.stringify(header)) },
            key,
            utf8.encode(JSON.stringify(event))
          );
          if (closed || roster.revision !== revision) return null;
          const envelope: PrivateEnvelope = [...header, encode(nonce), encode(ciphertext)];
          return utf8.encode(JSON.stringify(envelope)).length <= MAX_BYTES ? envelope : null;
        },
        async open(
          value: unknown,
          sdkExpiry: bigint | undefined,
          now = Date.now()
        ): Promise<{ event: PrivateRoomEvent; sender: RealtimePeer; seq: number; ageMs: number } | null> {
          if (closed || !Array.isArray(value) || value.length !== 8 || utf8.encode(JSON.stringify(value)).length > MAX_BYTES) return null;
          const [version, scope, sender, recipient, seq, created, nonce, ciphertext] = value;
          const peer = peerById(sender);
          if (version !== 2 || scope !== roster.scope || recipient !== self || sender === self || !peer) return null;
          if (!Number.isSafeInteger(seq) || seq < 1 || !Number.isSafeInteger(created) || created < 0 || created > now + 5000 || created + TTL <= now)
            return null;
          if (typeof sdkExpiry !== 'bigint' || typeof nonce !== 'string' || typeof ciphertext !== 'string') return null;
          const expiry = Number(sdkExpiry >> 32n) * 1000;
          if (expiry <= now || Math.abs(expiry - (created + TTL)) > 1000) return null;
          const revision = roster.revision;
          try {
            const iv = decode(nonce);
            if (iv.length !== 12) return null;
            const key = await keyFor(peer, sender, self);
            const clear = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv, additionalData: utf8.encode(JSON.stringify(value.slice(0, 6))) },
              key,
              decode(ciphertext)
            );
            if (closed || roster.revision !== revision) return null;
            const event: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(clear));
            if (!validEvent(event)) return null;
            // Commit only after authentication, with no await between replay check and write.
            const window = received.get(sender) ?? { highest: 0, seen: new Set<number>() };
            if (window.seen.has(seq) || seq <= window.highest - 64) return null;
            window.highest = Math.max(window.highest, seq);
            window.seen.add(seq);
            for (const old of window.seen) if (old <= window.highest - 64) window.seen.delete(old);
            received.set(sender, window);
            return { event, sender: peer, seq, ageMs: now - created };
          } catch {
            return null;
          }
        },
        close() {
          closed = true;
          keys.clear();
          received.clear();
        }
      };
    }
  };
}

export type PrivateRoomChannel = ReturnType<Awaited<ReturnType<typeof createPrivateRoomIdentity>>['bind']>;
