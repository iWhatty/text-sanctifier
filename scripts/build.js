// scripts/build.js
import { build } from 'esbuild';
import { gzipSync } from 'zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const entryFile = resolve('src/index.js');
const outDir = resolve('dist');
const outFile = resolve(outDir, 'text-sanctifier.min.js');

// Ensure dist folder exists
mkdirSync(outDir, { recursive: true });

// Step 1: Bundle and minify with esbuild
await build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2018'],
  sourcemap: false,
});

console.log('✅ Minified bundle created:', outFile);

// Step 2: Gzip the output
const minifiedCode = readFileSync(outFile);
const gzipped = gzipSync(minifiedCode);

const gzOutFile = outFile + '.gz';
writeFileSync(gzOutFile, gzipped);
console.log('✅ Gzipped version created:', gzOutFile);

const gzipSizeKb = (gzipped.length / 1024).toFixed(2);
console.log(`🎉 Gzipped size: ${gzipSizeKb} KB`);
