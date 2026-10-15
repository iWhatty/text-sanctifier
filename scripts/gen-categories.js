// scripts/gen-categories.js
//
// Builds everything that depends on the category table in scripts/categories.js:
//   - src/categories.generated.js (purge regexes and the inspectTextDetailed classifier)
//   - the category list in the inspectTextDetailed JSDoc (src/inspectText.js)
//   - the category table in README.md
//
//   node scripts/gen-categories.js          write the files
//   node scripts/gen-categories.js --check  exit 1 if any file is out of date (used by `npm run ci`)
//
// The generated JavaScript is pure ASCII: every character outside printable ASCII is
// written as a \u escape, never raw.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { CATEGORIES, PURGE_REGEXES } from './categories.js';

const CHECK = process.argv.includes('--check');

const GENERATED_FILE = resolve('src/categories.generated.js');
const INSPECT_FILE = resolve('src/inspectText.js');
const README_FILE = resolve('README.md');

const JSDOC_START = ' * Categories (generated from scripts/categories.js by `npm run gen`):';
const JSDOC_END = ' *';
const README_START = '<!-- categories:start (generated from scripts/categories.js by `npm run gen`; do not edit) -->';
const README_END = '<!-- categories:end -->';

const EN_DASH = '–';
const MAX_CODE_POINT = 0x10FFFF;

// --- Validate the table ---

function fail(message) {
    console.error(`gen-categories: ${message}`);
    process.exit(2);
}

/** @type {{ lo: number, hi: number, name: string }[]} */
const allRanges = [];
const names = new Set();
for (const category of CATEGORIES) {
    if (!/^[a-z][a-z0-9_]*$/.test(category.name)) fail(`bad category name ${category.name}`);
    if (names.has(category.name)) fail(`duplicate category ${category.name}`);
    names.add(category.name);
    if (!category.removedBy.length) fail(`${category.name} is removed by no regex`);
    for (const regexName of category.removedBy) {
        if (!PURGE_REGEXES[regexName]) fail(`${category.name}: unknown regex ${regexName}`);
    }
    for (const [lo, hi] of category.ranges) {
        if (!(Number.isInteger(lo) && Number.isInteger(hi) && 0 <= lo && lo <= hi && hi <= MAX_CODE_POINT)) {
            fail(`${category.name}: bad range ${lo}-${hi}`);
        }
        if (lo <= 0xDFFF && hi >= 0xD800) fail(`${category.name}: range overlaps the surrogates`);
        // inspectTextDetailed skips these before classifying, so they can never be reported
        for (const skipped of [0x09, 0x0A, 0x0D]) {
            if (lo <= skipped && skipped <= hi) fail(`${category.name}: contains ${hex(skipped)}, which is whitespace`);
        }
        if (lo <= 0x7E && hi >= 0x20) fail(`${category.name}: overlaps printable ASCII`);
        allRanges.push({ lo, hi, name: category.name });
    }
}
allRanges.sort((a, b) => a.lo - b.lo);
for (let k = 1; k < allRanges.length; k++) {
    if (allRanges[k].lo <= allRanges[k - 1].hi) {
        fail(`${allRanges[k - 1].name} and ${allRanges[k].name} overlap at ${hex(allRanges[k].lo)}`);
    }
}

// inspectTextDetailed decodes a surrogate pair only for one high surrogate.
const astral = allRanges.filter(r => r.lo > 0xFFFF);
const highSurrogate = (cp) => 0xD800 + ((cp - 0x10000) >> 10);
const TRASH_HIGH_SURROGATE = astral.length ? highSurrogate(astral[0].lo) : 0;
for (const r of astral) {
    if (highSurrogate(r.lo) !== TRASH_HIGH_SURROGATE || highSurrogate(r.hi) !== TRASH_HIGH_SURROGATE) {
        fail(`astral ranges must share one high surrogate; inspectTextDetailed needs updating for ${hex(r.lo)}`);
    }
}

// --- Helpers ---

function hex(cp) {
    return cp.toString(16).toUpperCase().padStart(4, '0');
}

/** Merges sorted, non-overlapping ranges that touch. */
function mergeAdjacent(ranges, same = () => true) {
    const out = [];
    for (const r of ranges) {
        const last = out[out.length - 1];
        if (last && last.hi + 1 === r.lo && same(last, r)) last.hi = r.hi;
        else out.push({ ...r });
    }
    return out;
}

/** "U+00A0", "U+200E, U+200F" or "U+2000–U+200A". */
function describeRange(lo, hi) {
    if (lo === hi) return `U+${hex(lo)}`;
    if (hi === lo + 1) return `U+${hex(lo)}, U+${hex(hi)}`;
    return `U+${hex(lo)}${EN_DASH}U+${hex(hi)}`;
}

function describeCodePoints(category) {
    const list = category.ranges
        .map(([lo, hi, label]) => describeRange(lo, hi) + (label ? ` (${label})` : ''))
        .join(', ');
    return category.note ? `${list} (${category.note})` : list;
}

// --- src/categories.generated.js ---

function regexSource(regexName) {
    const { flags } = PURGE_REGEXES[regexName];
    const unicode = flags.includes('u');
    const ranges = mergeAdjacent(allRanges.filter(r => CATEGORIES.find(c => c.name === r.name).removedBy.includes(regexName)));
    const esc = (cp) => {
        if (cp <= 0xFFFF) return `\\u${hex(cp)}`;
        if (!unicode) fail(`${regexName} has no u flag, so it cannot hold ${hex(cp)}`);
        return `\\u{${hex(cp)}}`;
    };
    const parts = ranges.map(({ lo, hi }) => {
        if (lo === hi) return esc(lo);
        if (hi === lo + 1) return esc(lo) + esc(hi);
        return `${esc(lo)}-${esc(hi)}`;
    });
    return `/[${parts.join('')}]+/${flags}`;
}

/** [from, to] cut into runs of one category (or null), in order. */
function segmentsOf(from, to) {
    const segments = [];
    let next = from;
    for (const r of allRanges) {
        if (r.hi < from || r.lo > to) continue;
        if (r.lo > next) segments.push({ lo: next, hi: r.lo - 1, name: null });
        segments.push({ lo: r.lo, hi: r.hi, name: r.name });
        next = r.hi + 1;
    }
    if (next <= to) segments.push({ lo: next, hi: to, name: null });
    return mergeAdjacent(segments, (a, b) => a.name === b.name);
}

/**
 * A binary decision tree over segments: a few number comparisons per code unit,
 * no regex and no lookup table.
 */
function treeBody(segments, indent) {
    const lines = [];
    const emit = (segs, depth) => {
        const pad = ' '.repeat(indent + 4 * depth);
        if (segs.length === 1) {
            lines.push(`${pad}return ${segs[0].name === null ? 'null' : `'${segs[0].name}'`};`);
            return;
        }
        const mid = segs.length >> 1;
        lines.push(`${pad}if (c < 0x${hex(segs[mid].lo)}) {`);
        emit(segs.slice(0, mid), depth + 1);
        lines.push(`${pad}}`);
        emit(segs.slice(mid), depth);
    };
    emit(segments, 0);
    return lines.join('\n');
}

function categoryList(regexName) {
    return CATEGORIES.filter(c => c.removedBy.includes(regexName)).map(c => c.name).join(', ');
}

const BMP_SEGMENTS = segmentsOf(0, 0xFFFF);
const BMP_PIVOT = BMP_SEGMENTS[BMP_SEGMENTS.length >> 1].lo;
// About 5 bytes of bytecode per segment: past this, each half stops being inlined.
if (BMP_SEGMENTS.length > 70) fail(`${BMP_SEGMENTS.length} BMP segments; split classifyCodeUnit into more parts`);

function generatedModule() {
    const regexDoc = (name) => [
        '/**',
        ` * Removed by \`${PURGE_REGEXES[name].option}\`. Categories: ${categoryList(name)}.`,
        ' * Global: reset `lastIndex` before calling `.test()`.',
        ' * @type {RegExp}',
        ' */',
        `export const ${name} = ${regexSource(name)};`,
    ].join('\n');

    return `// src/categories.generated.js
//
// Generated by scripts/gen-categories.js from the table in scripts/categories.js.
// Do not edit: change the table and run \`npm run gen\`. \`npm run ci\` fails while this file is stale.

/** @typedef {import('./inspectText.js').TrashCategory} TrashCategory */

${Object.keys(PURGE_REGEXES).map(regexDoc).join('\n\n')}

/** High surrogate of every astral code point in a category (U+${hex(astral[0].lo)}-U+${hex(astral[astral.length - 1].hi)}). */
export const TRASH_HIGH_SURROGATE = 0x${hex(TRASH_HIGH_SURROGATE)};

/**
 * Category of one BMP code point (one UTF-16 code unit), or null when it is not trash.
 * Surrogates return null; the caller pairs them and uses classifyAstral.
 * @param {number} c
 * @returns {TrashCategory|null}
 */
export function classifyCodeUnit(c) {
    return c < 0x${hex(BMP_PIVOT)} ? classifyBelow${hex(BMP_PIVOT)}(c) : classifyFrom${hex(BMP_PIVOT)}(c);
}

// Two halves rather than one tree: V8 inlines a function only while its bytecode is
// small (460 bytes by default), and the single pass is much faster when it does.

/** @param {number} c @returns {TrashCategory|null} */
function classifyBelow${hex(BMP_PIVOT)}(c) {
${treeBody(BMP_SEGMENTS.slice(0, BMP_SEGMENTS.length >> 1), 4)}
}

/** @param {number} c @returns {TrashCategory|null} */
function classifyFrom${hex(BMP_PIVOT)}(c) {
${treeBody(BMP_SEGMENTS.slice(BMP_SEGMENTS.length >> 1), 4)}
}

/**
 * Category of a code point above U+FFFF, or null when it is not trash.
 * @param {number} c
 * @returns {TrashCategory|null}
 */
export function classifyAstral(c) {
${treeBody(segmentsOf(0x10000, MAX_CODE_POINT), 4)}
}
`.replace(/[^\x20-\x7E\n]/g, (ch) => `\\u${hex(ch.charCodeAt(0))}`);
}

// --- Docs ---

function inspectJsdoc() {
    return CATEGORIES.map(c => ` * - \`${c.name}\`: ${describeCodePoints(c)}`).join('\n');
}

function readmeTable() {
    const removedBy = (c) => c.removedBy.map(name => `\`${PURGE_REGEXES[name].option}\``).join(', ');
    return [
        '| Category | Code points | Removed by |',
        '| --- | --- | --- |',
        ...CATEGORIES.map(c => `| \`${c.name}\` | ${describeCodePoints(c)} | ${removedBy(c)} |`),
    ].join('\n');
}

/** Replaces the lines strictly between the start line and the next end line. */
function replaceBetween(text, file, start, end, body) {
    const lines = text.split('\n');
    const from = lines.indexOf(start);
    if (from === -1) fail(`${file}: start marker not found: ${start}`);
    const to = lines.indexOf(end, from + 1);
    if (to === -1) fail(`${file}: end marker not found after the start marker`);
    return [...lines.slice(0, from + 1), body, ...lines.slice(to)].join('\n');
}

// --- Write or check ---

function readLf(file) {
    return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const outputs = [
    [GENERATED_FILE, generatedModule()],
    [INSPECT_FILE, replaceBetween(readLf(INSPECT_FILE), 'src/inspectText.js', JSDOC_START, JSDOC_END, inspectJsdoc())],
    [README_FILE, replaceBetween(readLf(README_FILE), 'README.md', README_START, README_END, readmeTable())],
];

let stale = 0;
for (const [file, content] of outputs) {
    let current = null;
    let crlf = false;
    try {
        const raw = readFileSync(file, 'utf8');
        crlf = raw.includes('\r\n');
        current = raw.replace(/\r\n/g, '\n');
    } catch { /* not generated yet */ }
    if (current === content) continue;
    if (CHECK) {
        console.error(`gen-categories: ${file} is out of date; run \`npm run gen\`.`);
        stale++;
    } else {
        writeFileSync(file, crlf ? content.replace(/\n/g, '\r\n') : content);
        console.log(`gen-categories: wrote ${file}`);
    }
}
if (stale) process.exit(1);
if (CHECK) console.log('gen-categories: generated files are up to date.');
