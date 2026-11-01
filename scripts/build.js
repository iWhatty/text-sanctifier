// scripts/build.js
//
// Builds dist/text-sanctifier.min.js, the prebuilt file behind `text-sanctifier/browser`,
// for pages with no build step (a <script type="module"> from a CDN). Bundlers should
// import `text-sanctifier` itself: the ESM source tree-shakes, and this file does not.
//
// esbuild minifies without renaming properties, so public field and option names survive
// as written; the dist test checks them anyway. Size budgets per import are checked
// separately by scripts/check-size.js.

import { build } from 'esbuild';
import { gzipSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const entryFile = resolve('src/index.js');
const outDir = resolve('dist');
const outFile = resolve(outDir, 'text-sanctifier.min.js');

// Size budget for the whole prebuilt file (web track, see DESIGN.md). Raising it is a
// deliberate decision: change this number in the same commit as the growth, with a reason.
export const GZIP_BUDGET_BYTES = 3072;

mkdirSync(outDir, { recursive: true });

const result = await build({
    entryPoints: [entryFile],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2020'],
    charset: 'ascii', // keep \u escapes; never emit raw invisible characters
    legalComments: 'none',
    write: false,
});

const code = result.outputFiles[0].contents;
writeFileSync(outFile, code);
const gzipped = gzipSync(code, { level: 9 });
writeFileSync(outFile + '.gz', gzipped);

console.log('✅ Built dist/text-sanctifier.min.js');
console.log(`- Minified: ${code.length} bytes (${(code.length / 1024).toFixed(2)} KB)`);
console.log(`- Gzipped : ${gzipped.length} bytes (${(gzipped.length / 1024).toFixed(2)} KB)`);

const headroom = GZIP_BUDGET_BYTES - gzipped.length;
if (headroom < 0) {
    console.error(`❌ Gzipped bundle is ${-headroom} bytes over the ${GZIP_BUDGET_BYTES}-byte budget (GZIP_BUDGET_BYTES in scripts/build.js).`);
    process.exitCode = 1;
} else {
    console.log(`- Budget  : ${gzipped.length} / ${GZIP_BUDGET_BYTES} bytes gzipped (${headroom} bytes headroom)`);
}
