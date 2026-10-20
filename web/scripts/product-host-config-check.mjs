import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Product Desktop's public Firebase client profile, observed 2026-10-03.
// Product's channel is "paseo", even though pad calls this environment "devnet".
export const PRODUCT_HOST_PROFILE = Object.freeze({
  projectId: 'polkadot-community-foundation',
  appId: '1:165923692956:web:6d276319025b5b29d72859',
  channel: 'paseo'
});

export function readProductHostApiKey(env = process.env, localFile = new URL('../.product-host-check.local.json', import.meta.url)) {
  let apiKey = env.PRODUCT_HOST_FIREBASE_API_KEY;
  if (!apiKey) {
    try {
      apiKey = JSON.parse(readFileSync(localFile, 'utf8')).apiKey;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Invalid .product-host-check.local.json; expected {"apiKey":"..."}.');
    }
  }
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error(
      'Live Product verification requires PRODUCT_HOST_FIREBASE_API_KEY or web/.product-host-check.local.json. Use the Product Firebase client API key, never a wallet seed or service-account credential.'
    );
  }
  return apiKey.trim();
}

function address(value) {
  if (typeof value !== 'string' || !/^(0x)?[a-f\d]{40}$/i.test(value)) return null;
  const hex = value.replace(/^0x/i, '').toLowerCase();
  return /^0+$/.test(hex) ? null : `0x${hex}`;
}

function gateway(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    // The host includes /ipfs/, whereas pad stores the gateway base URL.
    return `${url.origin}${url.pathname.replace(/\/+$/, '').replace(/\/ipfs$/, '')}`;
  } catch {
    return null;
  }
}

export function evaluateProductHostConfig(payload, environment) {
  const errors = [];
  if (payload?.state !== 'UPDATE') return ['Product Remote Config did not return a fresh configuration (UPDATE).'];
  let dotns;
  try {
    dotns = JSON.parse(payload.entries?.dot_ns_config);
  } catch {
    return ['Product Remote Config dot_ns_config is missing or malformed.'];
  }
  const contracts = {
    DOTNS_REGISTRY: dotns?.registryContractAddress,
    DOTNS_RESOLVER: dotns?.resolverContractAddress,
    DOTNS_CONTENT_RESOLVER: dotns?.resolverContractAddress
  };
  for (const [name, value] of Object.entries(contracts)) {
    const actual = address(value);
    const expected = address(environment?.contracts?.[name]);
    if (!actual || !expected || actual !== expected) {
      errors.push(
        `Product ${name} mismatch: host=${actual ?? 'invalid/missing'}, deploy=${expected ?? 'invalid/missing'}. Review the host override before publishing.`
      );
    }
  }
  const actualGateway = gateway(payload.entries?.ipfs_gateway_url);
  const expectedGateway = gateway(environment?.ipfs);
  if (!actualGateway || !expectedGateway || actualGateway !== expectedGateway)
    errors.push('Product IPFS gateway differs from the deploy profile or is invalid.');
  return errors;
}

export async function verifyProductHostConfig(environment, { apiKey = readProductHostApiKey(), fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  // Fresh anonymous client ID, not the user's Product/Firebase identity. No
  // installations registration, login, signing, cached response or admin API.
  const bytes = randomBytes(17);
  bytes[0] = 0x70 | (bytes[0] & 0x0f);
  const clientId = bytes.toString('base64url').slice(0, 22);
  const url = new URL(`https://firebaseremoteconfig.googleapis.com/v1/projects/${PRODUCT_HOST_PROFILE.projectId}/namespaces/firebase:fetch`);
  url.searchParams.set('key', apiKey);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      signal: globalThis.AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        app_id: PRODUCT_HOST_PROFILE.appId,
        app_instance_id: clientId,
        custom_signals: { environment: PRODUCT_HOST_PROFILE.channel }
      })
    });
  } catch (error) {
    // Do not log request URLs, client identifiers or untrusted server bodies.
    const reason = ['TimeoutError', 'AbortError'].includes(error?.name) ? 'timed out' : 'network request failed';
    throw new Error(`Live Product Remote Config ${reason}. No cached fallback is accepted; retry the read-only check before deploying.`);
  }
  if (!response.ok)
    throw new Error(`Live Product Remote Config returned HTTP ${response.status}. Check client-key access and service availability before deploying.`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Live Product Remote Config response was interrupted or was not valid JSON. No cached fallback is accepted.');
  }
  const errors = evaluateProductHostConfig(payload, environment);
  if (errors.length) throw new Error(errors.join('\n'));
  return { checkedAt: new Date().toISOString(), channel: PRODUCT_HOST_PROFILE.channel };
}

export async function withProductHostVerification(environment, publish, verify = verifyProductHostConfig) {
  await verify(environment);
  const result = await publish();
  try {
    await verify(environment);
  } catch (error) {
    throw new Error(
      `Publication completed, but post-publication host verification failed. Do not blindly republish: inspect the printed CID and transactions first. ${error.message}`
    );
  }
  return result;
}
