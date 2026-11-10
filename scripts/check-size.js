// scripts/check-size.js
//
// What a bundler user pays for each import. Each probe imports one export from the
// package's own entry points, is bundled, tree-shaken and minified by esbuild, and its
// gzipped size is printed. `npm run ci` fails when a probe pulls in code it must not
// contain (leaks), or when a probe with a budget goes over it.
//
// Only imports a web page ships get a budget, set with room to grow (about 25% above
// their size in 1.3.16); it is there to catch a jump, not to ration bytes. Server-side
// imports (inspectTextDetailed, /hidden, /context) are reported, not budgeted: in Node a
// few hundred bytes buy nothing, and their leak checks still apply.
//
// scripts/gen-docs.js imports PROBES and measure() to write the current sizes into the docs.

import { build } from 'esbuild';
import { gzipSync } from 'zlib';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { GZIP_BUDGET_BYTES, buildBrowserFile } from './browser-build.js';

const ROOT = resolve('.');

// Strings that mark the sanitizer engine and the emoji tables: detection-only imports
// must not contain them. inspectText reports emoji, so it may contain the emoji table,
// but not the sanitizer.
const SANITIZER = 'sanctifyText expects';
// Independent of the emoji regex's grouping. Ignore only the standalone sticky
// neighbour test used by hidden/context; it is not the full emoji matcher.
const EMOJI_TABLE = 'Extended_Pictographic';
const markerText = text => text.replace(/\/\\p\{Extended_Pictographic\}\/(?:yu|uy)\b/g, '');

/** @type {Array<{ name: string, code: string, budget?: number, mustNotContain?: string[], mustContain?: string[] }>} */
export const PROBES = [
    // Server side: reported, not budgeted.
    { name: 'inspectTextDetailed', code: "import { inspectTextDetailed } from './src/index.js'; inspectTextDetailed('');", mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'text-sanctifier/hidden', code: "import { findHiddenRuns, decodeTagText } from './src/hiddenText.js'; findHiddenRuns(''); decodeTagText('');", mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'text-sanctifier/context', code: "import { inspectTextInContext } from './src/context.js'; inspectTextInContext('');", mustNotContain: [SANITIZER] },
    { name: 'VERSION', code: "import { VERSION } from './src/index.js'; console.log(VERSION);", mustNotContain: [SANITIZER, EMOJI_TABLE] },
    // Web: what a page ships.
    { name: 'revealInvisible', code: "import { revealInvisible } from './src/index.js'; revealInvisible('');", budget: 900, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'getNewlineStats', code: "import { getNewlineStats } from './src/index.js'; getNewlineStats('');", budget: 350, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'getRecommendedSanctifierOptions', code: "import { getRecommendedSanctifierOptions } from './src/index.js'; getRecommendedSanctifierOptions({});", budget: 250, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'inspectText', code: "import { inspectText } from './src/index.js'; inspectText('');", budget: 1300, mustNotContain: [SANITIZER], mustContain: [EMOJI_TABLE] },
    { name: 'summonSanctifier', code: "import { summonSanctifier } from './src/index.js'; summonSanctifier({})('');", budget: 1900 },
    { name: 'summonSanctifier.pasted', code: "import { summonSanctifier } from './src/index.js'; summonSanctifier.pasted('');", budget: 1900 },
    { name: 'sanctifyPasted', code: "import { sanctifyPasted } from './src/index.js'; sanctifyPasted('');", budget: 1450 },
    { name: 'sanctifyStrict', code: "import { sanctifyStrict } from './src/index.js'; sanctifyStrict('');", budget: 1450, mustContain: [SANITIZER] },
    { name: 'everything', code: "export * from './src/index.js';", budget: GZIP_BUDGET_BYTES },
];

/** @param {(typeof PROBES)[number]} probe */
async function bundledSize(probe) {
    // Enforce the prebuilt file's budget on exactly the build that writes it.
    if (probe.name === 'everything') {
        const { code, gzipped } = await buildBrowserFile();
        return { text: Buffer.from(code).toString('utf8'), gzipped: gzipped.length };
    }
    const result = await build({
        stdin: { contents: probe.code, resolveDir: ROOT, loader: 'js' },
        bundle: true,
        minify: true,
        format: 'esm',
        target: ['es2020'],
        charset: 'ascii',
        legalComments: 'none',
        write: false,
    });
    const text = result.outputFiles[0].text;
    return { text, gzipped: gzipSync(text, { level: 9 }).length };
}

/**
 * Gzipped size of every probe, by name.
 * @returns {Promise<Map<string, number>>}
 */
export async function measure() {
    const sizes = new Map();
    for (const probe of PROBES) sizes.set(probe.name, (await bundledSize(probe)).gzipped);
    return sizes;
}

async function main() {
    let failed = 0;

    console.log('Bundled, tree-shaken, minified and gzipped size per import:');
    for (const probe of PROBES) {
        const { text, gzipped } = await bundledSize(probe);
        const markers = markerText(text);
        const leaks = (probe.mustNotContain || []).filter((s) => markers.includes(s));
        const missing = (probe.mustContain || []).filter((s) => !markers.includes(s));
        const over = probe.budget !== undefined && gzipped > probe.budget;
        if (over || leaks.length || missing.length) failed++;

        let line = `${over || leaks.length || missing.length ? '❌' : '✅'} ${probe.name.padEnd(32)} ${String(gzipped).padStart(5)} ${probe.budget === undefined ? 'bytes (reported)' : `/ ${probe.budget} bytes`}`;
        if (over) line += `  over budget by ${gzipped - /** @type {number} */ (probe.budget)}`;
        if (leaks.length) line += `  leaks: ${leaks.map((s) => JSON.stringify(s)).join(', ')}`;
        if (missing.length) line += `  POSITIVE CONTROL FAILED: missing ${missing.map((s) => JSON.stringify(s)).join(', ')}; update leak markers explicitly`;
        console.log(line);
    }

    if (failed) {
        console.error(`❌ ${failed} size check${failed === 1 ? '' : 's'} failed (budgets in scripts/check-size.js).`);
        process.exitCode = 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
