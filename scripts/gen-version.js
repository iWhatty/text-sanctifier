// scripts/gen-version.js
//
// Writes src/version.generated.js from the version in package.json, so the package
// can export its own version without reading JSON at run time (which browsers and
// the prebuilt file can't do).
//
//   node scripts/gen-version.js          write the file
//   node scripts/gen-version.js --check  exit 1 if it is out of date (used by `npm run ci`)
//
// Part of `npm run gen`: bumping package.json needs `npm run gen` before committing.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CHECK = process.argv.includes('--check');
const FILE = resolve('src/version.generated.js');

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`gen-version: unexpected version in package.json: ${JSON.stringify(version)}`);
    process.exit(2);
}

const content =
    '// src/version.generated.js\n' +
    '// Generated from package.json by scripts/gen-version.js (`npm run gen`); do not edit.\n' +
    '\n' +
    '/** The installed version of text-sanctifier, as in its package.json. */\n' +
    `export const VERSION = '${version}';\n`;

let current = null;
try { current = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n'); } catch { /* not generated yet */ }

if (current === content) {
    if (CHECK) console.log('gen-version: src/version.generated.js is up to date.');
} else if (CHECK) {
    console.error('gen-version: src/version.generated.js is out of date; run `npm run gen`.');
    process.exit(1);
} else {
    writeFileSync(FILE, content);
    console.log('gen-version: wrote src/version.generated.js');
}
