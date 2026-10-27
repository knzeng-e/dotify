// Synthetic browser interoperability fixture only. Excluded from the API image.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { blake2b } from '@noble/hashes/blake2';
import { encodeStreamingRelease } from '../services/streamingEncoder.js';
import { initializeStreamingNonceLedger, StreamingNonceLedger } from '../services/streamingNonces.js';

const output = process.argv[2];
if (!output) throw new Error('Provide an explicit synthetic fixture output path');
const directory = await mkdtemp(path.join(os.tmpdir(), 'dotify-browser-codec-'));
try {
  // Long enough to observe both an ABR upgrade and a congested downshift.
  const frames = Math.floor(48_000 * 24.2);
  const master = Buffer.alloc(44 + frames * 2);
  master.write('RIFF', 0);
  master.writeUInt32LE(master.length - 8, 4);
  master.write('WAVEfmt ', 8);
  master.writeUInt32LE(16, 16);
  master.writeUInt16LE(1, 20);
  master.writeUInt16LE(1, 22);
  master.writeUInt32LE(48_000, 24);
  master.writeUInt32LE(96_000, 28);
  master.writeUInt16LE(2, 32);
  master.writeUInt16LE(16, 34);
  master.write('data', 36);
  master.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index += 1) master.writeInt16LE(Math.round(Math.sin((index * 2 * Math.PI * 440) / 48_000) * 2000), 44 + index * 2);
  const key = Buffer.alloc(32, 71);
  const scope = {
    chainId: 420420417,
    runtimeAddress: `0x${'12'.repeat(20)}`,
    contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`,
    keyVersion: 'dotify-content-key-v2'
  };
  const ledgerPath = path.join(directory, 'ledger');
  await initializeStreamingNonceLedger(ledgerPath);
  const result = await encodeStreamingRelease({
    master,
    key,
    scope,
    ledger: new StreamingNonceLedger(ledgerPath),
    ffmpegPath: process.env.DOTIFY_TEST_FFMPEG
  });
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(
    output,
    JSON.stringify({
      schema: 'dotify.synthetic-streaming-fixture.v1',
      keyHex: key.toString('hex'),
      scope,
      manifest: result.files.find(file => file.name === 'manifest.json')!.bytes.toString('base64'),
      files: Object.fromEntries(
        result.files.filter(file => file.name !== 'manifest.json' && !file.name.startsWith('archive/')).map(file => [file.name, file.bytes.toString('base64')])
      )
    })
  );
  console.log('Synthetic streaming fixture generated; archive intentionally excluded.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
