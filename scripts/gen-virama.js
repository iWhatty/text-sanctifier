// scripts/gen-virama.js
//
// Writes src/virama.generated.js: a regex for the code points with Canonical_Combining_Class
// 9 (Virama), which IDNA ContextJ (RFC 5892, appendix A.1 and A.2) uses to allow ZWJ and
// ZWNJ in Indic scripts. JavaScript regexes have no property for combining classes, so
// the set is derived from Node's own normalization data: canonical reordering moves a
// mark of class 9 after one of class 8 and before one of class 10. No download needed.
//
//   node scripts/gen-virama.js          write the file
//   node scripts/gen-virama.js --check  exit 1 if it is out of date (used by `npm run ci`)
//
// --check fails when Node's Unicode data gains or loses a virama: run `npm run gen` then.
// The generated JavaScript is pure ASCII.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CHECK = process.argv.includes('--check');
const FILE = resolve('src/virama.generated.js');

const CCC_8 = '\u3099'; // COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK
const CCC_10 = '\u05B0'; // HEBREW POINT SHEVA

/** True when `x` has combining class 9: it sorts after class 8 and before class 10. */
function isVirama(x) {
    if (x === CCC_8 || x === CCC_10) return false;
    return ('a' + x + CCC_8).normalize('NFD') === 'a' + CCC_8 + x &&
        ('a' + CCC_10 + x).normalize('NFD') === 'a' + x + CCC_10;
}

const ranges = [];
for (let cp = 0; cp <= 0x10FFFF; cp++) {
    if (cp >= 0xD800 && cp <= 0xDFFF) continue;
    if (!isVirama(String.fromCodePoint(cp))) continue;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === cp - 1) last[1] = cp;
    else ranges.push([cp, cp]);
}
const count = ranges.reduce((n, [lo, hi]) => n + hi - lo + 1, 0);
if (count < 60 || !isVirama('\u094D')) {
    console.error(`gen-virama: found ${count} viramas; this Node's normalization data looks incomplete.`);
    process.exit(2);
}

const hex = (cp) => cp.toString(16).toUpperCase().padStart(4, '0');
const esc = (cp) => (cp > 0xFFFF ? `\\u{${hex(cp)}}` : `\\u${hex(cp)}`);
const body = ranges.map(([lo, hi]) => (lo === hi ? esc(lo) : hi === lo + 1 ? esc(lo) + esc(hi) : `${esc(lo)}-${esc(hi)}`)).join('');

const content =
    '// src/virama.generated.js\n' +
    "// Generated from Node's normalization data by scripts/gen-virama.js (`npm run gen`); do not edit.\n" +
    '\n' +
    `// The ${count} code points with Canonical_Combining_Class 9 (Virama). Sticky: tested at an index.\n` +
    `export const VIRAMA_AT = /[${body}]/yu;\n`;

let current = null;
try { current = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n'); } catch { /* not generated yet */ }

if (current === content) {
    if (CHECK) console.log(`gen-virama: src/virama.generated.js is up to date (${count} viramas, Unicode ${process.versions.unicode}).`);
} else if (CHECK) {
    console.error(`gen-virama: src/virama.generated.js differs from this Node's Unicode ${process.versions.unicode} data; run \`npm run gen\`.`);
    process.exit(1);
} else {
    writeFileSync(FILE, content);
    console.log(`gen-virama: wrote src/virama.generated.js (${count} viramas, Unicode ${process.versions.unicode})`);
}
