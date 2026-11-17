import * as v025 from 'truapi-v0250';
import * as v026 from 'truapi-v0260';
import * as v029 from 'truapi-v0290';
import * as v031 from 'truapi-v0310';

// These are published codecs, not implementations of a phone or Desktop Host.
export const protocols = [
  { version: '0.25.0', api: v025 },
  { version: '0.26.0', api: v026 },
  { version: '0.29.0', api: v029 },
  { version: '0.31.0', api: v031 }
];

function wire() {
  const listeners = new Set();
  const sent = [];
  return {
    sent,
    provider: {
      postMessage: bytes => sent.push(Array.from(bytes)),
      subscribe(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
      }
    },
    receive: bytes => listeners.forEach(callback => callback(Uint8Array.from(bytes)))
  };
}

export function probeHandshake(protocol) {
  const host = wire();
  const transport = protocol.api.createTransport(host.provider);
  try {
    // Fixed codec-3 request, deliberately no schema fingerprint negotiation.
    host.receive([4, 104, 1, 0, 0, 0, 3]);
    return { codec: protocol.api.TRUAPI_CODEC_VERSION, frames: host.sent };
  } finally {
    transport.dispose();
  }
}

export async function probeInfo(clientProtocol, hostProtocol) {
  const host = wire();
  const transport = clientProtocol.api.createTransport(host.provider);
  let sent;
  try {
    const client = clientProtocol.api.createClient(transport);
    const pending = Promise.resolve(client.system.info());
    // Disposal after synchronous decode failure cancels the outstanding lookup.
    void pending.catch(() => {});
    sent = host.sent[0];
    if (host.sent.length !== 1 || JSON.stringify(sent.slice(-4)) !== '[1,3,0,0]') {
      throw new Error('Probe attempted an unexpected method');
    }
    const payload = hostProtocol.api.VersionedHostInfoResponse.enc({
      tag: 'V1',
      value: {
        platform: 'Desktop',
        name: 'Offline fixture',
        version: '0.0.0',
        truapiVersion: hostProtocol.version
      }
    });
    // Same correlation id, system.info Response, Ok, then the real Host codec.
    host.receive([...sent.slice(0, -4), 1, 3, 1, 0, ...payload]);
    const result = await pending;
    return { decoded: result.isOk(), fields: result.isOk() ? Object.keys(result.value).sort() : [], method: 'system.info' };
  } catch (error) {
    if (!sent || JSON.stringify(sent.slice(-4)) !== '[1,3,0,0]') throw error;
    return { decoded: false, failure: 'decode-or-response-error', method: 'system.info' };
  } finally {
    transport.dispose();
  }
}

/** Whole-API fingerprints describe declared schemas, not per-method support or CASH capability. */
export function selectPair(client, host) {
  return {
    sameCodec: client.api.TRUAPI_CODEC_VERSION === host.api.TRUAPI_CODEC_VERSION,
    sameSchema: client.api.TRUAPI_WIRE_SCHEMA_HASH === host.api.TRUAPI_WIRE_SCHEMA_HASH,
    cashEnabled: false,
    paymentMethodsCalled: 0
  };
}

export async function compatibilityReport() {
  const cells = [];
  for (const client of protocols) {
    for (const host of protocols) {
      cells.push({ client: client.version, fixtureHost: host.version, ...selectPair(client, host), info: await probeInfo(client, host) });
    }
  }
  return {
    schema: 'dotify.offline-host-compatibility.v1',
    evidence: 'real-published-codecs-with-in-memory-fixture-hosts; not device acceptance',
    protocols: protocols.map(p => ({ version: p.version, codec: p.api.TRUAPI_CODEC_VERSION, schema: p.api.TRUAPI_WIRE_SCHEMA_HASH })),
    cells,
    liveHostMethodsCalled: 0,
    networkCalls: 0,
    paymentsSubmitted: 0,
    cashEnabled: false
  };
}
