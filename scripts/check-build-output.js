import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const ASSETS_DIR = join(DIST_DIR, 'assets');
const MAX_JS_CHUNK_BYTES = 500 * 1024;

const indexHtml = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');

if (!indexHtml.includes('src="./assets/')) {
  throw new Error('dist/index.html is missing relative ./assets script URLs.');
}

if (!indexHtml.includes('href="./assets/')) {
  throw new Error('dist/index.html is missing relative ./assets link URLs.');
}

const jsChunks = readdirSync(ASSETS_DIR)
  .filter((fileName) => fileName.endsWith('.js'))
  .map((fileName) => {
    const size = statSync(join(ASSETS_DIR, fileName)).size;
    return { fileName, size };
  })
  .sort((a, b) => b.size - a.size);

const oversizedChunks = jsChunks.filter((chunk) => chunk.size > MAX_JS_CHUNK_BYTES);

if (oversizedChunks.length > 0) {
  const summary = oversizedChunks
    .map((chunk) => `${chunk.fileName}: ${(chunk.size / 1024).toFixed(2)} KiB`)
    .join('\n');

  throw new Error(`JS chunks exceed 500 KiB:\n${summary}`);
}

console.log('Build output check passed.');
console.table(
  jsChunks.map((chunk) => ({
    chunk: chunk.fileName,
    'size KiB': (chunk.size / 1024).toFixed(2),
  })),
);
