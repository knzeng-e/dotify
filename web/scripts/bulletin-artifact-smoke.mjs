import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(webRoot, 'dist-bulletin');
const htmlPath = path.join(outputDir, 'index.html');
const html = await readFile(htmlPath, 'utf8');
const outputFiles = await readdir(outputDir);
if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
  throw new Error('Bulletin index contains an external script reference');
}

console.log(`Bulletin artifact smoke passed: scripts are self-contained; ${outputFiles.length} output file(s).`);
