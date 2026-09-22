// Upload the generated CDM metadata blobs to the Bulletin Chain.
//
// Why not the Product SDK: `CloudStorageClient.create()` resolves its chain connection
// through `getChainAPI`/`createChainClient`, which route exclusively through the Product
// host container and have no direct-WebSocket fallback. Uploading from a terminal is
// therefore impossible through that path. The Bulletin chain itself accepts a plain
// signed `TransactionStorage.store` extrinsic over WebSocket, which is what this uses -
// the same approach as the existing `deploy-bulletin.cjs`.
//
// Read-only by default: it checks the account's authorization and reports what it would
// upload. Uploading needs --confirm.
//
// Run:
//   npm run upload:cdm-metadata                      # dry run, dev account
//   BULLETIN_SURI='//Alice' npm run upload:cdm-metadata -- --confirm
//   BULLETIN_MNEMONIC='...' npm run upload:cdm-metadata -- --confirm

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, Binary, Enum } from 'polkadot-api';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { bulletin } from '@polkadot-api/descriptors';
import { getPolkadotSigner } from 'polkadot-api/signer';
import { sr25519CreateDerive } from '@polkadot-labs/hdkd';
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Address } from '@polkadot-labs/hdkd-helpers';
import { calculateCid } from '@parity/product-sdk-cloud-storage';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const metadataDir = resolve(scriptDir, '../src/generated/contracts/cdm-metadata');

// Product DevNet Bulletin (Paseo Bulletin, para 1010).
const BULLETIN_WS = process.env.VITE_BULLETIN_WS_URL || 'wss://bulletin-paseo.tservices.es:8443';
const UPLOAD_TIMEOUT_MS = 180_000;

const CID_CODEC_RAW = 0x55;
const HASH_BLAKE2B_256 = 45600;

const confirm = process.argv.includes('--confirm');

function loadSigner() {
  const mnemonic = process.env.BULLETIN_MNEMONIC;
  const suri = process.env.BULLETIN_SURI || '//Alice';
  const phrase = mnemonic || DEV_PHRASE;
  const derive = sr25519CreateDerive(entropyToMiniSecret(mnemonicToEntropy(phrase)));
  const keypair = derive(mnemonic ? '' : suri);
  return {
    address: ss58Address(keypair.publicKey),
    signer: getPolkadotSigner(keypair.publicKey, 'Sr25519', keypair.sign),
    source: mnemonic ? 'BULLETIN_MNEMONIC' : `dev account ${suri}`
  };
}

function loadBlobs() {
  const index = JSON.parse(readFileSync(resolve(metadataDir, 'cids.json'), 'utf8'));
  const files = readdirSync(metadataDir).filter(name => name.endsWith('.json') && name !== 'cids.json');

  return files.map(file => {
    const bytes = new Uint8Array(readFileSync(resolve(metadataDir, file)));
    const entry = Object.entries(index).find(([, value]) => value.file === file);
    if (!entry) throw new Error(`${file} is not listed in cids.json. Re-run npm run generate:cdm-metadata.`);
    return { name: entry[0], file, bytes, expectedCid: entry[1].cid };
  });
}

async function main() {
  const blobs = loadBlobs();
  const { address, signer, source } = loadSigner();

  // Recompute every CID from the bytes on disk. A blob edited after generation would
  // otherwise be uploaded under a CID the registry no longer matches, and the registry
  // entry is immutable once published.
  let drifted = false;
  for (const blob of blobs) {
    const actual = (await calculateCid(blob.bytes, CID_CODEC_RAW, HASH_BLAKE2B_256)).toString();
    blob.actualCid = actual;
    if (actual !== blob.expectedCid) drifted = true;
  }

  console.log(`\nBulletin:  ${BULLETIN_WS}`);
  console.log(`Account:   ${address}  (${source})`);
  console.log(`Blobs:     ${blobs.length}\n`);

  for (const blob of blobs) {
    const ok = blob.actualCid === blob.expectedCid;
    console.log(`${blob.name}`);
    console.log(`  file: ${blob.file} (${blob.bytes.length} bytes)`);
    console.log(`  cid:  ${blob.actualCid}${ok ? '' : `  MISMATCH — cids.json says ${blob.expectedCid}`}`);
    console.log('');
  }

  if (drifted) {
    throw new Error('A blob no longer matches its recorded CID. Re-run npm run generate:cdm-metadata before uploading.');
  }

  const totalBytes = blobs.reduce((sum, blob) => sum + blob.bytes.length, 0);
  const client = createClient(withPolkadotSdkCompat(getWsProvider(BULLETIN_WS)));

  try {
    const api = client.getTypedApi(bulletin);

    let authorized = false;
    let detail = 'no authorization found';
    try {
      const auth = await api.query.TransactionStorage.Authorizations.getValue(Enum('Account', address));
      if (auth) {
        const haveTx = BigInt(auth.extent.transactions ?? 0n);
        const haveBytes = BigInt(auth.extent.bytes ?? 0n);
        authorized = haveTx >= BigInt(blobs.length) && haveBytes >= BigInt(totalBytes);
        detail = `${haveTx} transactions / ${haveBytes} bytes remaining; need ${blobs.length} / ${totalBytes}`;
      }
    } catch (error) {
      detail = `authorization query failed: ${error.message}`;
    }

    console.log(`Authorization: ${authorized ? 'OK' : 'INSUFFICIENT'} — ${detail}\n`);

    if (!authorized) {
      throw new Error(
        `${address} cannot store ${totalBytes} bytes on Bulletin.\n` +
          'Grant a quota first, then re-run:\n' +
          '  dotns bulletin authorize ' +
          address +
          ' --transactions 1000 --bytes 104857600 --env devnet\n' +
          '  or use the Bulletin console: https://paritytech.github.io/polkadot-bulletin-chain/ (Products Devnet)'
      );
    }

    if (!confirm) {
      console.log('Dry run. Re-run with --confirm to upload.');
      console.log(
        'After uploading, register the names with: cd contracts/evm && npx hardhat cdm:publish --network polkadotTestnet --confirm --private-key <key>'
      );
      return;
    }

    for (const blob of blobs) {
      process.stdout.write(`Uploading ${blob.name} … `);
      const tx = api.tx.TransactionStorage.store({ data: Binary.fromBytes(blob.bytes) });

      await new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(() => {
          subscription.unsubscribe();
          rejectPromise(new Error(`upload of ${blob.name} timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`));
        }, UPLOAD_TIMEOUT_MS);

        const subscription = tx.signSubmitAndWatch(signer).subscribe({
          next: event => {
            if (event.type === 'txBestBlocksState' && event.found) {
              clearTimeout(timer);
              subscription.unsubscribe();
              if (event.ok === false) {
                rejectPromise(new Error(`${blob.name} rejected on chain: ${JSON.stringify(event.dispatchError ?? 'unknown')}`));
                return;
              }
              resolvePromise();
            }
          },
          error: error => {
            clearTimeout(timer);
            rejectPromise(error);
          }
        });
      });

      console.log(`stored as ${blob.actualCid}`);
    }

    console.log('\nAll blobs uploaded. The CIDs above are what cdm:publish will register.');
  } finally {
    client.destroy();
  }
}

main().catch(error => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
