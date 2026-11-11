// Wire-shape and resource limits only. Membership/roles remain server-owned.
export const SIGNAL_LIMITS = Object.freeze({
  windowMs: 10_000,
  readiness: 4,
  descriptions: 128,
  candidates: 1024,
  peerNotices: 128,
  sdpBytes: 64 * 1024,
  candidateBytes: 4096
});

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function validScalarFields(payload, fields) {
  return fields.every(field => payload[field] == null || ['string', 'number', 'boolean'].includes(typeof payload[field]));
}

const scalarFieldsByEvent = new Map([
  ['room:create', ['displayName']],
  ['room:resume', ['roomId']],
  ['room:join', ['roomId', 'displayName']],
  ['room:rename', ['displayName']]
]);

/** Reject malformed envelopes before a handler can leave/mutate its room.
 * Null track/state and array lineup have separate handlers and are not wrapped. */
export function onObjectEvent(socket, event, handler, onError = () => {}) {
  socket.on(event, (payload = {}, ack) => {
    let replied = false;
    const reply = value => {
      if (replied || typeof ack !== 'function') return;
      replied = true;
      ack(value);
    };
    if (!record(payload) || !validScalarFields(payload, scalarFieldsByEvent.get(event) ?? [])) {
      reply({ ok: false, code: 'INVALID_PAYLOAD', error: 'Invalid room request.' });
      return;
    }
    const failed = () => {
      // No payload, token, SDP, address or exception text is logged here.
      onError();
      reply({ ok: false, code: 'REQUEST_FAILED', error: 'The room request could not be completed.' });
    };
    try {
      const task = handler(payload, reply);
      if (task?.then) task.catch(failed);
    } catch {
      failed();
    }
  });
}

export function boundedDescription(value, type) {
  if (
    !record(value) ||
    Object.keys(value).some(key => !['type', 'sdp'].includes(key)) ||
    value.type !== type ||
    typeof value.sdp !== 'string' ||
    !value.sdp.length ||
    Buffer.byteLength(value.sdp, 'utf8') > SIGNAL_LIMITS.sdpBytes
  )
    return null;
  return { type, sdp: value.sdp };
}

export function boundedCandidate(value) {
  if (
    !record(value) ||
    Object.keys(value).some(key => !['candidate', 'sdpMid', 'sdpMLineIndex', 'usernameFragment'].includes(key)) ||
    typeof value.candidate !== 'string' ||
    Buffer.byteLength(value.candidate, 'utf8') > SIGNAL_LIMITS.candidateBytes ||
    (value.sdpMid != null && (typeof value.sdpMid !== 'string' || value.sdpMid.length > 256)) ||
    (value.usernameFragment != null && (typeof value.usernameFragment !== 'string' || value.usernameFragment.length > 256)) ||
    (value.sdpMLineIndex != null && (!Number.isInteger(value.sdpMLineIndex) || value.sdpMLineIndex < 0 || value.sdpMLineIndex > 65535))
  )
    return null;
  return {
    candidate: value.candidate,
    ...(Object.hasOwn(value, 'sdpMid') ? { sdpMid: value.sdpMid } : {}),
    ...(Object.hasOwn(value, 'sdpMLineIndex') ? { sdpMLineIndex: value.sdpMLineIndex } : {}),
    ...(Object.hasOwn(value, 'usernameFragment') ? { usernameFragment: value.usernameFragment } : {})
  };
}
