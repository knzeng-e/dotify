import { open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { privateDirectory, sync } from './bulletinMediaState.js';
import type { BulletinPublisherProfile } from './bulletinPublisherProfile.js';

/** Shared by custody and maintenance. Never remove another owner's lock. */
export async function acquireBulletinPublisherLock(profile: BulletinPublisherProfile): Promise<() => Promise<void>> {
  await privateDirectory(profile.directory);
  const lock = await open(join(profile.directory, 'publisher.lock'), 'wx', 0o600);
  const release = async () => {
    await lock.close();
    await rm(join(profile.directory, 'publisher.lock'));
    await sync(profile.directory);
  };
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
    await lock.sync();
    await sync(profile.directory);
    return release;
  } catch (error) {
    await release();
    throw error;
  }
}
