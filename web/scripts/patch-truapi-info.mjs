// Explicit, version/hash-bound upstream workaround. No wire routing or signer
// injection; only system.info's response decoder changes. See the migration note.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function patchInfoClient(source) {
  const expectedHash = '8936b91edc3e0a14ccaac984d7bd82c405b86a6394035ebebdd1a6050f1cd234';
  if (createHash('sha256').update(source).digest('hex') !== expectedHash) throw new Error('Review the TrUAPI info patch: upstream client changed');
  const before = 'const result = S.Result(T.VersionedHostInfoResponse, S.CallError(T.VersionedHostInfoError)).dec(payload);';
  if (source.split(before).length !== 2) throw new Error('Expected exactly one Host info decoder');
  return `import { decodeDotifyHostInfo } from './dotify-host-info.mjs';\n${source.replace(before, 'const result = decodeDotifyHostInfo(payload);')}`;
}

export async function installInfoPatch(root = new URL('../', import.meta.url)) {
  const generated = new URL('node_modules/@parity/truapi/dist/generated/', root);
  const manifest = JSON.parse(await readFile(new URL('../../package.json', generated), 'utf8'));
  if (manifest.version !== '0.31.0') throw new Error('Review the Host info patch before changing TrUAPI version');
  const client = new URL('client.js', generated);
  const helper = await readFile(new URL('../patches/truapi-0.31-host-info.mjs', import.meta.url), 'utf8');
  const installed = await readFile(client, 'utf8');
  const marker = "import { decodeDotifyHostInfo } from './dotify-host-info.mjs';\n";
  // Idempotency still verifies all remaining upstream bytes and the helper.
  if (installed.startsWith(marker)) {
    const restored = installed
      .slice(marker.length)
      .replace(
        'const result = decodeDotifyHostInfo(payload);',
        'const result = S.Result(T.VersionedHostInfoResponse, S.CallError(T.VersionedHostInfoError)).dec(payload);'
      );
    if (patchInfoClient(restored) !== installed || (await readFile(new URL('dotify-host-info.mjs', generated), 'utf8')) !== helper) {
      throw new Error('Installed Host info patch differs from its reviewed source');
    }
    return;
  }
  const patched = patchInfoClient(installed);
  await writeFile(new URL('dotify-host-info.mjs', generated), helper);
  await writeFile(client, patched);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await installInfoPatch();
