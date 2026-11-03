// scripts/build.js
//
// Builds dist/text-sanctifier.min.js, the prebuilt file behind `text-sanctifier/browser`,
// for pages with no build step (a <script type="module"> from a CDN). Bundlers should
// import `text-sanctifier` itself: the ESM source tree-shakes, and this file does not.
//
// esbuild minifies without renaming properties, so public field and option names survive
// as written; the dist test checks them anyway. Size budgets per import are checked
// separately by scripts/check-size.js; the build options and the budget are in
// scripts/browser-build.js.

import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { GZIP_BUDGET_BYTES, buildBrowserFile } from './browser-build.js';

const outDir = resolve('dist');
const outFile = resolve(outDir, 'text-sanctifier.min.js');

mkdirSync(outDir, { recursive: true });

const { code, gzipped } = await buildBrowserFile();
writeFileSync(outFile, code);
writeFileSync(outFile + '.gz', gzipped);

console.log('✅ Built dist/text-sanctifier.min.js');
console.log(`- Minified: ${code.length} bytes (${(code.length / 1024).toFixed(2)} KB)`);
console.log(`- Gzipped : ${gzipped.length} bytes (${(gzipped.length / 1024).toFixed(2)} KB)`);

const headroom = GZIP_BUDGET_BYTES - gzipped.length;
if (headroom < 0) {
    console.error(`❌ Gzipped bundle is ${-headroom} bytes over the ${GZIP_BUDGET_BYTES}-byte budget (GZIP_BUDGET_BYTES in scripts/browser-build.js).`);
    process.exitCode = 1;
} else {
    console.log(`- Budget  : ${gzipped.length} / ${GZIP_BUDGET_BYTES} bytes gzipped (${headroom} bytes headroom)`);
}
