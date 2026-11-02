// scripts/check-size.js
//
// What a bundler user pays for each import. Each probe imports one export from the
// package's own entry points, is bundled, tree-shaken and minified by esbuild, and its
// gzipped size is checked against a budget. `npm run ci` fails when a probe goes over
// budget, or when a probe pulls in code it must not contain (leaks).
//
// Budgets are about 10% above the size when they were set. Raising one is a deliberate
// decision: change it in the same commit as the growth, with a reason.
//
// `--worst-case` also bundles every probe with esbuild's `ignoreAnnotations`, which
// ignores `sideEffects: false` and pure annotations, to show what a bundler that ignores
// them would include. That run is informational and never fails.

import { build } from 'esbuild';
import { gzipSync } from 'zlib';
import { resolve } from 'path';

const ROOT = resolve('.');

// Strings that mark the sanitizer engine and the emoji tables: detection-only imports
// must not contain them. inspectText reports emoji, so it may contain the emoji table,
// but not the sanitizer.
const SANITIZER = 'sanctifyText expects';
const EMOJI_TABLE = 'Extended_Pictographic';

/** @type {Array<{ name: string, code: string, budget: number, mustNotContain?: string[] }>} */
const PROBES = [
    { name: 'inspectTextDetailed', code: "import { inspectTextDetailed } from './src/index.js'; inspectTextDetailed('');", budget: 1100, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'revealInvisible', code: "import { revealInvisible } from './src/index.js'; revealInvisible('');", budget: 1250, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'getNewlineStats', code: "import { getNewlineStats } from './src/index.js'; getNewlineStats('');", budget: 350, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'getRecommendedSanctifierOptions', code: "import { getRecommendedSanctifierOptions } from './src/index.js'; getRecommendedSanctifierOptions({});", budget: 250, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'inspectText', code: "import { inspectText } from './src/index.js'; inspectText('');", budget: 1250, mustNotContain: [SANITIZER] },
    { name: 'summonSanctifier', code: "import { summonSanctifier } from './src/index.js'; summonSanctifier({})('');", budget: 1600 },
    { name: 'summonSanctifier.pasted', code: "import { summonSanctifier } from './src/index.js'; summonSanctifier.pasted('');", budget: 1600 },
    { name: 'sanctifyPasted', code: "import { sanctifyPasted } from './src/index.js'; sanctifyPasted('');", budget: 1250 },
    { name: 'sanctifyStrict', code: "import { sanctifyStrict } from './src/index.js'; sanctifyStrict('');", budget: 1250 },
    // 593 -> 912 for line/column, maxRuns, maxDecodedLength and exact counts on each run;
    // 943 -> 996 for the reserved_tag_plane kind and code-point totals.
    { name: 'text-sanctifier/hidden', code: "import { findHiddenRuns, decodeTagText } from './src/hiddenText.js'; findHiddenRuns(''); decodeTagText('');", budget: 1100, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    // inspectTextDetailed (959) plus the context rules (1695 in all) and two property-escape regexes;
    // 1695 -> 2074 for the IDNA ContextJ joiner rules, most of it the 69-code-point virama table.
    { name: 'text-sanctifier/context', code: "import { inspectTextInContext } from './src/context.js'; inspectTextInContext('');", budget: 2250, mustNotContain: [SANITIZER] },
    { name: 'VERSION', code: "import { VERSION } from './src/index.js'; console.log(VERSION);", budget: 60, mustNotContain: [SANITIZER, EMOJI_TABLE] },
    { name: 'everything', code: "export * from './src/index.js';", budget: 3072 },
];

/** @param {string} code @param {boolean} ignoreAnnotations */
async function bundledSize(code, ignoreAnnotations) {
    const result = await build({
        stdin: { contents: code, resolveDir: ROOT, loader: 'js' },
        bundle: true,
        minify: true,
        format: 'esm',
        target: ['es2020'],
        charset: 'ascii',
        legalComments: 'none',
        ignoreAnnotations,
        write: false,
    });
    const text = result.outputFiles[0].text;
    return { text, gzipped: gzipSync(text, { level: 9 }).length };
}

const worstCase = process.argv.includes('--worst-case');
let failed = 0;

console.log('Bundled, tree-shaken, minified and gzipped size per import:');
for (const probe of PROBES) {
    const { text, gzipped } = await bundledSize(probe.code, false);
    const leaks = (probe.mustNotContain || []).filter((s) => text.includes(s));
    const over = gzipped > probe.budget;
    if (over || leaks.length) failed++;

    let line = `${over || leaks.length ? '❌' : '✅'} ${probe.name.padEnd(32)} ${String(gzipped).padStart(5)} / ${probe.budget} bytes`;
    if (over) line += `  over budget by ${gzipped - probe.budget}`;
    if (leaks.length) line += `  leaks: ${leaks.map((s) => JSON.stringify(s)).join(', ')}`;
    if (worstCase) line += `  (ignoring sideEffects and annotations: ${(await bundledSize(probe.code, true)).gzipped})`;
    console.log(line);
}

if (failed) {
    console.error(`❌ ${failed} size check${failed === 1 ? '' : 's'} failed (budgets in scripts/check-size.js).`);
    process.exitCode = 1;
}
