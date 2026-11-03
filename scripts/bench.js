// scripts/bench.js
//
// Measures the speed and memory figures quoted in README.md ("Choosing `maxFindings`") and
// DESIGN.md ("Known limits"), so they are re-measured instead of retyped:
//
//   npm run bench
//
// Not part of `npm run ci`: timings depend on the machine, so they would make it flaky.
// Paste the figures into the docs by hand when they move, and name the Node version.

import { inspectTextDetailed } from '../src/index.js';
import { inspectTextInContext } from '../src/context.js';

const UNITS = 16 * 1024 * 1024;
const ch = (cp) => String.fromCharCode(cp);
const NBSP = ch(0x00A0);
const ZWJ = ch(0x200D);
const ZWNJ = ch(0x200C);
const KA_VIRAMA = ch(0x0915) + ch(0x094D); // DEVANAGARI KA, DEVANAGARI SIGN VIRAMA
const BEH = ch(0x0628); // ARABIC LETTER BEH, joins on both sides

/** @param {string} unit */
const fill = (unit) => unit.repeat(Math.floor(UNITS / unit.length));

const gc = /** @type {any} */ (globalThis).gc;
if (!gc) {
    console.error('bench: run with node --expose-gc (`npm run bench` does).');
    process.exit(2);
}

/** @param {string} label @param {string} text @param {(text: string) => unknown} fn */
function bench(label, text, fn) {
    fn(text.slice(0, 4096)); // warm up
    gc();
    const before = process.memoryUsage().heapUsed;
    const start = process.hrtime.bigint();
    const result = fn(text);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const mb = (process.memoryUsage().heapUsed - before) / (1024 * 1024);
    const time = ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
    console.log(`| ${label} | ${(text.length / 1e6).toFixed(1)} M | ${time} | ${mb.toFixed(1)} MB |`);
    return result;
}

const capped = { maxFindings: 20 };
console.log(`Node ${process.versions.node}, Unicode ${process.versions.unicode}, maxFindings: 20\n`);
console.log('| Case | UTF-16 units | Time | Heap growth |');
console.log('| --- | ---: | ---: | ---: |');
bench('inspectTextDetailed, non-breaking spaces', fill(NBSP), (t) => inspectTextDetailed(t, capped));
bench('inspectTextInContext, clean prose', fill('The quick brown fox jumps. '), (t) => inspectTextInContext(t, capped));
bench('inspectTextInContext, virama + ZWJ', fill(KA_VIRAMA + ZWJ), (t) => inspectTextInContext(t, capped));
bench('inspectTextInContext, Arabic ZWNJ', fill(BEH + ZWNJ), (t) => inspectTextInContext(t, capped));
