import { ECDH, randomBytes } from 'node:crypto';

function publicKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(value)) return null;
  try {
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length !== 65 || bytes[0] !== 4 || bytes.toString('base64url') !== value) return null;
    // Reject points off the curve before relaying them to other participants.
    ECDH.convertKey(bytes, 'prime256v1', undefined, undefined, 'uncompressed');
    return value;
  } catch {
    return null;
  }
}

/** Socket admission authenticates ephemeral keys, never a Product allowance signer. */
export function createRoomRealtimeMembers() {
  const states = new WeakMap();
  function snapshot(state) {
    return { scope: state.scope, revision: state.revision, peers: [...state.members.values()] };
  }
  return {
    register(room, socketId, role, input) {
      const key = publicKey(input?.publicKey);
      if (!key || !['host', 'listener'].includes(role)) return null;
      let state = states.get(room);
      if (!state) {
        state = { scope: randomBytes(16).toString('hex'), revision: 0, members: new Map() };
        states.set(room, state);
      }
      const previous = state.members.get(socketId);
      // A key cannot silently change while peers still bind it to this membership.
      if (previous && previous.publicKey !== key) return null;
      if (!previous) {
        if (state.members.size >= 128) return null;
        if ([...state.members.values()].some(peer => peer.publicKey === key)) return null;
        state.members.set(socketId, { id: randomBytes(8).toString('hex'), role, publicKey: key });
        state.revision++;
      }
      return { self: state.members.get(socketId).id, ...snapshot(state) };
    },
    remove(room, socketId, expected) {
      const state = states.get(room);
      if (expected && (state?.scope !== expected.scope || state?.members.get(socketId)?.id !== expected.self)) return null;
      if (!state?.members.delete(socketId)) return null;
      state.revision++;
      return snapshot(state);
    },
    recipients(room) {
      return [...(states.get(room)?.members.keys() ?? [])];
    }
  };
}
