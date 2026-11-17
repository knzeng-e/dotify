import { resolve } from 'node:path';
import { prepare } from './canary.mjs';
import { addressingFixture } from './addressing.mjs';
try {
  if (process.argv.length !== 3) throw new Error('Usage: node --import tsx addressing-fixture.mjs NEW_PRIVATE_DIRECTORY');
  console.log(JSON.stringify(await prepare(resolve(process.argv[2]), addressingFixture), null, 2));
} catch (error) { console.error(String(error.message).slice(0, 500)); process.exitCode = 1; }
