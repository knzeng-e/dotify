import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, link, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';
import { blake2b } from '@noble/hashes/blake2';
import { fixture as recoveryFixture, tree } from './bulletinPreparedRecovery.fixture.js';
import { capturePublishedBulletinArchive as capture, verifyPublishedBulletinArchive as verify } from './bulletinPublishedArchive.js';
import { checkpointHash } from './bulletinCheckpointFiles.js';
import { BULLETIN_BLOCK_MAX, BULLETIN_GRAPH_MAX } from './bulletinGraph.js';
const fixture = async (t: Parameters<typeof recoveryFixture>[0], mode: 'standard' | 'compact' = 'standard') =>
  recoveryFixture(t, mode, await realpath(tmpdir()));
const signal = () => new AbortController().signal;
const id = (bytes: Uint8Array, codec = 0x55) => CID.createV1(codec, digest(0xb220, blake2b(bytes, { dkLen: 32 })));
const encoded = (node: dagPB.PBNode) => {
  const bytes: unknown = dagPB.encode(node);
  assert.ok(bytes instanceof Uint8Array);
  return Buffer.from(bytes);
};
const directory = (links: dagPB.PBLink[]) => encoded(dagPB.prepare({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: links }));
async function created(t: Parameters<typeof fixture>[0], mode: 'standard' | 'compact' = 'standard') {
  const c = await fixture(t, mode),
    blocks = new Map(c.graph.blocks.map(b => [b.cid, b.bytes]));
  const destination = join(c.root, 'published-archive');
  const result = await capture({
    root: c.graph.root,
    destination,
    readBlock: async cid => {
      const b = blocks.get(cid);
      assert.ok(b);
      return b;
    },
    signal: signal()
  });
  return { ...c, blocks, destination, result };
}
for (const mode of ['standard', 'compact'] as const)
  test(`${mode}: complete published archive survives source loss without custody or keys`, async t => {
    const c = await created(t, mode);
    assert.equal(c.result.blocks, c.blocks.size);
    const manifest = JSON.parse(await readFile(join(c.destination, 'archive.json'), 'utf8'));
    assert.deepEqual(new Set(manifest.blocks.map((b: { cid: string }) => b.cid)), new Set(c.blocks.keys()));
    assert.deepEqual(
      manifest.blocks.map((b: { cid: string }) => b.cid),
      [...c.blocks.keys()].sort()
    );
    c.blocks.clear();
    await rm(c.queue, { recursive: true });
    await rm(c.profile.directory, { recursive: true });
    const before = await tree(c.destination);
    assert.deepEqual(await verify(c.destination, c.result.manifestSha256, signal()), c.result);
    assert.deepEqual(await tree(c.destination), before);
    for (const k of [
      'ciphertextAuthenticated',
      'canonicalHistoryChecked',
      'independentStorageVerified',
      'keyBackupOriginVerified',
      'writerActivationAllowed',
      'contentKeysLoaded'
    ] as const)
      assert.equal(c.result[k], false);
    assert.equal(c.result.networkWrites, 0);
  });

test('changed bytes, missing blocks, hard links and unsafe modes refuse without changing an archive', async t => {
  for (const change of ['changed', 'missing', 'hardlink', 'mode'] as const) {
    const c = await created(t),
      file = join(c.destination, 'objects', (await readdir(join(c.destination, 'objects')))[0]);
    if (change === 'changed') await writeFile(file, Buffer.from('public changed bytes'));
    if (change === 'missing') await rm(file);
    if (change === 'hardlink') await link(file, join(c.root, 'outside-copy'));
    if (change === 'mode') await chmod(file, 0o644);
    const before = await tree(c.destination);
    await assert.rejects(verify(c.destination, c.result.manifestSha256, signal()));
    assert.deepEqual(await tree(c.destination), before);
  }
});
test('wrong expected digest, duplicate/unreachable blocks and manifest tampering refuse', async t => {
  const c = await created(t),
    file = join(c.destination, 'archive.json'),
    raw = await readFile(file),
    original = JSON.parse(raw.toString());
  await assert.rejects(verify(c.destination, '0'.repeat(64), signal()));
  const duplicate = { ...original, blocks: [...original.blocks, original.blocks[0]] };
  await writeFile(file, JSON.stringify(duplicate));
  await assert.rejects(verify(c.destination, checkpointHash(JSON.stringify(duplicate)), signal()), /Duplicate/);
  const extra = Buffer.from('public unreachable block'),
    row = { cid: id(extra).toString(), bytes: extra.length, sha256: checkpointHash(extra) };
  const unreachable = { ...original, blocks: [...original.blocks, row].sort((a, b) => a.cid.localeCompare(b.cid)) };
  await writeFile(join(c.destination, 'objects', row.sha256 + '.bin'), extra, { mode: 0o600 });
  await writeFile(file, JSON.stringify(unreachable));
  await assert.rejects(verify(c.destination, checkpointHash(JSON.stringify(unreachable)), signal()), /Unreachable/);
  await rm(join(c.destination, 'objects', row.sha256 + '.bin'));
  await writeFile(file, raw);
  await writeFile(file, Buffer.concat([raw, Buffer.from(' ')]));
  await assert.rejects(verify(c.destination, c.result.manifestSha256, signal()), /manifest changed/);
});
test('aliases, symlinks and unexpected files refuse; existing destinations are preserved', async t => {
  const c = await created(t),
    alias = join(c.root, 'alias');
  await symlink(c.destination, alias);
  await assert.rejects(verify(alias, c.result.manifestSha256, signal()));
  const before = await tree(c.destination);
  await assert.rejects(
    capture({
      root: c.graph.root,
      destination: c.destination,
      readBlock: async () => {
        throw Error('Must not read');
      },
      signal: signal()
    }),
    /EEXIST/
  );
  assert.deepEqual(await tree(c.destination), before);
  const object = join(c.destination, 'objects', (await readdir(join(c.destination, 'objects')))[0]),
    outside = join(c.root, 'outside.bin');
  await writeFile(outside, await readFile(object), { mode: 0o600 });
  await rm(object);
  await symlink(outside, object);
  await assert.rejects(verify(c.destination, c.result.manifestSha256, signal()));
  await writeFile(join(c.destination, 'unexpected'), Buffer.from('public extra'), { mode: 0o600 });
  await assert.rejects(verify(c.destination, c.result.manifestSha256, signal()));
});
test('missing/changed/oversized transport bytes leave a private visibly incomplete capture', async t => {
  for (const kind of ['missing', 'changed', 'oversized'] as const) {
    const c = await fixture(t, 'standard'),
      destination = join(c.root, 'capture-' + kind);
    await assert.rejects(
      capture({
        root: c.graph.root,
        destination,
        readBlock: async () => {
          if (kind === 'missing') throw Error('public unavailable');
          return Buffer.alloc(kind === 'oversized' ? BULLETIN_BLOCK_MAX + 1 : 4);
        },
        signal: signal()
      })
    );
    assert.ok((await readdir(destination)).includes('.incomplete'));
    await assert.rejects(verify(destination, '0'.repeat(64), signal()), /Incomplete/);
  }
});
test('valid but different transport content is refused by its trusted CID', async t => {
  const c = await fixture(t, 'standard');
  const root = c.graph.blocks.find(b => b.cid === c.graph.root)!;
  const node = dagPB.decode(root.bytes);
  node.Links[0].Name = 'other-name';
  const changed = encoded(dagPB.prepare(node));
  const blocks = new Map(c.graph.blocks.map(b => [b.cid, b.bytes]));
  await assert.rejects(
    capture({
      root: c.graph.root,
      destination: join(c.root, 'different-valid-root'),
      readBlock: async cid => (cid === c.graph.root ? changed : blocks.get(cid)!),
      signal: signal()
    }),
    /CID does not match/
  );
});

test('abort wins over an uncooperative transport and late completion never commits', async t => {
  const c = await fixture(t, 'standard'),
    owner = new AbortController(),
    destination = join(c.root, 'cancelled');
  let settle!: (bytes: Uint8Array) => void;
  let announce!: () => void;
  const entered = new Promise<void>(r => {
    announce = r;
  });
  const pending = capture({
    root: c.graph.root,
    destination,
    readBlock: () => {
      announce();
      return new Promise(r => {
        settle = r;
      });
    },
    signal: owner.signal
  });
  const rejected = assert.rejects(pending);
  await entered;
  owner.abort();
  await rejected;
  const before = await tree(destination);
  settle(c.graph.blocks.find(b => b.cid === c.graph.root)!.bytes);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await tree(destination), before);
  assert.ok((await readdir(destination)).includes('.incomplete'));
  const early = new AbortController();
  early.abort();
  await assert.rejects(
    capture({
      root: c.graph.root,
      destination: join(c.root, 'not-created'),
      readBlock: async () => {
        throw Error('No read');
      },
      signal: early.signal
    })
  );
  assert.ok(!(await readdir(c.root)).includes('not-created'));
});
test('unsupported CIDs, root file and excessive depth stop without arbitrary traversal', async t => {
  const c = await fixture(t, 'standard');
  let reads = 0;
  await assert.rejects(
    capture({
      root: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      destination: join(c.root, 'unsupported'),
      readBlock: async () => {
        reads++;
        return Buffer.from('x');
      },
      signal: signal()
    })
  );
  assert.equal(reads, 0);
  const raw = Buffer.from('public leaf');
  await assert.rejects(
    capture({
      root: id(raw).toString(),
      destination: join(c.root, 'raw-root'),
      readBlock: async () => {
        reads++;
        return raw;
      },
      signal: signal()
    })
  );
  assert.equal(reads, 0);
  const file = encoded({ Data: new UnixFS({ type: 'file', data: raw }).marshal(), Links: [] });
  await assert.rejects(
    capture({ root: id(file, dagPB.code).toString(), destination: join(c.root, 'file-root'), readBlock: async () => file, signal: signal() }),
    /directory/
  );
  const blocks = new Map<string, Buffer>();
  let child = id(raw);
  blocks.set(child.toString(), raw);
  for (let n = 0; n < 10; n++) {
    const b = directory([{ Name: 'nested', Hash: child, Tsize: raw.length }]);
    child = id(b, dagPB.code);
    blocks.set(child.toString(), b);
  }
  await assert.rejects(
    capture({ root: child.toString(), destination: join(c.root, 'too-deep'), readBlock: async cid => blocks.get(cid)!, signal: signal() }),
    /depth bound/
  );
});
test('duplicate or unsafe directory links cannot become a committed graph', async t => {
  const c = await fixture(t, 'standard'),
    raw = Buffer.from('public leaf'),
    child = id(raw);
  for (const names of [['same', 'same'], ['../escape']]) {
    const b = directory(names.map(Name => ({ Name, Hash: child, Tsize: raw.length }))),
      root = id(b, dagPB.code).toString();
    await assert.rejects(
      capture({ root, destination: join(c.root, 'links-' + names.length), readBlock: async cid => (cid === root ? b : raw), signal: signal() }),
      /directory name/
    );
  }
});
test('block-count and total-byte caps are enforced independently', async t => {
  const c = await fixture(t, 'standard');
  for (const kind of ['count', 'bytes'] as const) {
    const count = kind === 'count' ? 2048 : Math.ceil(BULLETIN_GRAPH_MAX / BULLETIN_BLOCK_MAX),
      lookup = new Map<string, number>();
    const make = (n: number) => {
      const b = Buffer.alloc(kind === 'count' ? 4 : BULLETIN_BLOCK_MAX);
      b.writeUInt32BE(n);
      return b;
    };
    const links = Array.from({ length: count }, (_, n) => {
        const b = make(n),
          cid = id(b);
        lookup.set(cid.toString(), n);
        return { Name: 'block-' + n, Hash: cid, Tsize: b.length };
      }),
      rootBytes = directory(links),
      root = id(rootBytes, dagPB.code).toString();
    await assert.rejects(
      capture({
        root,
        destination: join(c.root, 'bound-' + kind),
        readBlock: async cid => (cid === root ? rootBytes : make(lookup.get(cid)!)),
        signal: signal()
      }),
      kind === 'count' ? /block bound/ : /byte bound/
    );
    assert.ok((await readdir(join(c.root, 'bound-' + kind))).includes('.incomplete'));
  }
});
test('CLI offline verify performs no fetch and errors never expose input details', async t => {
  const c = await created(t),
    guard = join(c.root, 'no-network.mjs');
  await writeFile(guard, 'globalThis.fetch=()=>{throw Error("Unexpected network")};', { mode: 0o600 });
  const cli = 'src/scripts/backupPublishedBulletin.ts';
  const ok = spawnSync(process.execPath, ['--import', 'tsx', '--import', guard, cli, 'verify', c.destination, c.result.manifestSha256], {
    encoding: 'utf8',
    timeout: 30000
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).blocks, c.result.blocks);
  for (const args of [
    [],
    ['verify', '/private-do-not-log', 'not-a-digest'],
    ['capture', c.destination, c.graph.root, 'https://private-do-not-log.invalid/path']
  ]) {
    const bad = spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], { encoding: 'utf8', timeout: 30000 });
    assert.notEqual(bad.status, 0);
    assert.ok(bad.stderr.startsWith('BULLETIN_PUBLISHED_ARCHIVE_STOPPED'));
    assert.ok(!bad.stderr.includes('private-do-not-log') && !bad.stderr.includes(c.graph.root));
  }
});
