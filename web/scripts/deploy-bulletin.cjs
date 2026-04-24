'use strict';
// Uploads dist-bulletin/index.html to Paseo Bulletin Chain.
// Outputs the CID and gateway URL for DotNS registration.
//
// Usage (from web/ directory):
//   npm run deploy:bulletin
//   BULLETIN_ACCOUNT=Bob npm run deploy:bulletin

const fs = require('node:fs');
const path = require('node:path');

// polkadot-api exposes CJS from dist/reexports – use those directly so the
// script works with Node without an ESM transform step.
const nm = path.resolve(__dirname, '../node_modules');

const { createClient, Binary, Enum } = require(path.join(nm, 'polkadot-api'));
const { withPolkadotSdkCompat } = require(path.join(nm, 'polkadot-api/dist/reexports/polkadot-sdk-compat.js'));
const { getWsProvider } = require(path.join(nm, 'polkadot-api/dist/reexports/ws-provider_node.js'));
const { bulletin } = require(path.join(nm, '@polkadot-api/descriptors'));
const { blake2b } = require(path.join(nm, 'blakejs'));
const { sr25519CreateDerive } = require(path.join(nm, '@polkadot-labs/hdkd'));
const { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Address } = require(path.join(nm, '@polkadot-labs/hdkd-helpers'));
const { getPolkadotSigner } = require(path.join(nm, 'polkadot-api/dist/reexports/signer.js'));

const BULLETIN_WS = process.env.VITE_BULLETIN_WS_URL || 'wss://paseo-bulletin-rpc.polkadot.io';
const GATEWAY = 'https://paseo-ipfs.polkadot.io/ipfs/';
const UPLOAD_TIMEOUT_MS = 120_000;
const HTML_PATH = path.resolve(__dirname, '../dist-bulletin/index.html');

// ── CID v1, raw codec, blake2b-256 ──────────────────────────────────────────

function base32lower(bytes) {
  const alpha = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, acc = 0, out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) { bits -= 5; out += alpha[(acc >> bits) & 31]; }
  }
  if (bits > 0) out += alpha[(acc << (5 - bits)) & 31];
  return out;
}

function cidFromBytes(bytes) {
  const hash = blake2b(bytes, null, 32);
  const mh = new Uint8Array([0x1e, 0x20, ...hash]); // blake2b-256 multihash
  const cid = new Uint8Array([0x01, 0x55, ...mh]);   // CIDv1 + raw codec
  return 'b' + base32lower(cid);
}

// ── Dev account (mirrors useDevAccounts.ts) ─────────────────────────────────

function createDevAccount(derivationPath) {
  const entropy = mnemonicToEntropy(DEV_PHRASE);
  const miniSecret = entropyToMiniSecret(entropy);
  const derive = sr25519CreateDerive(miniSecret);
  const kp = derive(derivationPath);
  return {
    address: ss58Address(kp.publicKey),
    signer: getPolkadotSigner(kp.publicKey, 'Sr25519', kp.sign)
  };
}

const ACCOUNTS = { Alice: '//Alice', Bob: '//Bob', Charlie: '//Charlie' };
const accountName = process.env.BULLETIN_ACCOUNT || 'Alice';
if (!ACCOUNTS[accountName]) {
  console.error(`Unknown BULLETIN_ACCOUNT="${accountName}". Use Alice, Bob, or Charlie.`);
  process.exit(1);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(HTML_PATH)) {
    console.error('dist-bulletin/index.html not found. Run: npm run build:bulletin');
    process.exit(1);
  }

  const htmlBytes = new Uint8Array(fs.readFileSync(HTML_PATH));
  const cid = cidFromBytes(htmlBytes);

  console.log(`File:    dist-bulletin/index.html (${(htmlBytes.length / 1024).toFixed(1)} KB)`);
  console.log(`CID:     ${cid}`);
  console.log(`Account: ${accountName}`);

  const client = createClient(withPolkadotSdkCompat(getWsProvider(BULLETIN_WS)));
  const api = client.getTypedApi(bulletin);
  const { address, signer } = createDevAccount(ACCOUNTS[accountName]);
  console.log(`Address: ${address}`);

  // Authorization check
  process.stdout.write('Checking Bulletin authorization… ');
  let authorized = false;
  try {
    const auth = await api.query.TransactionStorage.Authorizations.getValue(
      Enum('Account', address)
    );
    authorized = Boolean(auth && auth.extent.transactions > 0n && auth.extent.bytes >= BigInt(htmlBytes.length));
  } catch (e) {
    console.warn('\nAuthorization check failed:', e.message);
  }

  if (!authorized) {
    console.error(
      'NOT AUTHORIZED\n\n' +
      `Account ${address} has no upload quota on Paseo Bulletin Chain.\n` +
      'Options:\n' +
      '  1. Get authorization from the PBP program resources / faucet\n' +
      '  2. BULLETIN_ACCOUNT=Bob npm run deploy:bulletin\n'
    );
    client.destroy();
    process.exit(1);
  }
  console.log('OK');

  console.log('Uploading to Bulletin Chain…');
  const tx = api.tx.TransactionStorage.store({ data: Binary.fromBytes(htmlBytes) });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.unsubscribe();
      client.destroy();
      reject(new Error('Upload timed out after 120 s'));
    }, UPLOAD_TIMEOUT_MS);

    const sub = tx.signSubmitAndWatch(signer).subscribe({
      next: ev => {
        process.stdout.write(`  ${ev.type}          \r`);
        if (ev.type === 'txBestBlocksState' && ev.found) {
          clearTimeout(timer);
          sub.unsubscribe();
          resolve();
        }
      },
      error: err => {
        clearTimeout(timer);
        sub.unsubscribe();
        client.destroy();
        reject(err);
      }
    });
  });

  client.destroy();

  console.log('\n\n✓ Deployed to Bulletin Chain');
  console.log(`\nCID:         ${cid}`);
  console.log(`Gateway URL: ${GATEWAY}${cid}`);
  console.log('\nNext — register your DotNS name pointing to this CID.');
}

main().catch(err => {
  console.error('\nDeploy failed:', err.message || err);
  process.exit(1);
});
