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
import { buildBrowserFile } from './browser-build.js';

const outDir = resolve('dist');
const outFile = resolve(outDir, 'text-sanctifier.min.js');

mkdirSync(outDir, { recursive: true });

const { code, gzipped } = await buildBrowserFile();
writeFileSync(outFile, code);

console.log('✅ Built dist/text-sanctifier.min.js');
console.log(`- Minified: ${code.length} bytes (${(code.length / 1024).toFixed(2)} KB)`);
console.log(`- Gzipped : ${gzipped.length} bytes (${(gzipped.length / 1024).toFixed(2)} KB)`);
