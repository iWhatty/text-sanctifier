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

import { resolve } from 'path';
import { CHECK, generator, readLf } from './gen-lib.js';

const { fail, writeOrCompare } = generator('gen-version');
const FILE = resolve('src/version.generated.js');

const { version } = JSON.parse(readLf(resolve('package.json')));
if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`unexpected version in package.json: ${JSON.stringify(version)}`);
}

const content =
    '// src/version.generated.js\n' +
    '// Generated from package.json by scripts/gen-version.js (`npm run gen`); do not edit.\n' +
    '\n' +
    '/** The installed version of text-sanctifier, as in its package.json. */\n' +
    `export const VERSION = '${version}';\n`;

writeOrCompare(FILE, content);
if (CHECK && !process.exitCode) console.log('gen-version: generated file is up to date.');
