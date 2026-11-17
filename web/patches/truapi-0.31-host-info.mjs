// Installed beside TrUAPI's generated client by patch-truapi-info.mjs.
// Narrow decode-only compatibility for public labels from 0.25/0.26 Hosts.
import * as S from '../scale.js';
import * as T from './types.js';

const modern = S.Result(T.VersionedHostInfoResponse, S.CallError(T.VersionedHostInfoError));
const legacy = S.Result(
  S.indexedTaggedUnion({ V1: [0, S.Struct({ platform: T.HostPlatform, name: S.str, version: S.str })] }),
  S.CallError(T.VersionedHostInfoError)
);
const exact = (codec, result, payload) => {
  const encoded = codec.enc(result);
  return encoded.length === payload.length && encoded.every((byte, i) => byte === payload[i]);
};

export function decodeDotifyHostInfo(payload) {
  try {
    const result = modern.dec(payload);
    if (!exact(modern, result, payload)) throw new Error('Malformed Host info response');
    return result;
  } catch (cause) {
    // Only a complete, canonical legacy success is eligible. Never repair a
    // denial, partial string, malformed suffix or another method's response.
    const result = legacy.dec(payload);
    if (!result.success || !exact(legacy, result, payload)) throw cause;
    return { success: true, value: { tag: 'V1', value: { ...result.value.value, truapiVersion: '' } } };
  }
}
