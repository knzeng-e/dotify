import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(webRoot, 'dist-bulletin');
const htmlPath = path.join(outputDir, 'index.html');
const html = await readFile(htmlPath, 'utf8');
const outputFiles = await readdir(outputDir);
const workerAssets = outputFiles.filter(file => /^audioV2Decrypt\.worker-.+\.js$/.test(file));
const referencedWorkerAssets = workerAssets.filter(file => html.includes(file));
const externalWorkerReferences = html.match(/(?:assets\/)?audioV2Decrypt\.worker-[A-Za-z0-9_-]+\.js/g) ?? [];

if (referencedWorkerAssets.length > 0 || externalWorkerReferences.length > 0) {
  throw new Error(
    `Bulletin index references external DAV2 worker assets: ${[...new Set([...referencedWorkerAssets, ...externalWorkerReferences])].join(', ')}`
  );
}
if (!html.includes('dotify-dav2-decrypt') || !html.includes('new Blob')) {
  throw new Error('Bulletin index does not contain the inline DAV2 worker bootstrap');
}
if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
  throw new Error('Bulletin index contains an external script reference');
}

console.log(`Bulletin artifact smoke passed: DAV2 worker is inline; ${workerAssets.length} unreferenced build asset(s).`);
