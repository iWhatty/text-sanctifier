// scripts/check-names.js
//
// This repo is public. Names that must never appear in it (private projects that use the
// package) are listed in .git/info/private-names, one per line, `#` for comments. That file
// lives inside .git, so it is never committed and no clone has it.
//
//   node scripts/check-names.js             check every tracked or addable file, and the
//                                           messages of commits not yet on origin (`npm run ci`)
//   node scripts/check-names.js --pre-push  the same, for the commits a push sends
//                                           (scripts/hooks/pre-push; `npm run hooks:install`)
//
// Matching is whole-word and ignores case. Without the list it says so and passes.

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const PRE_PUSH = process.argv.includes('--pre-push');
const ZERO = /^0+$/;

/** @param {string} cmd */
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

const listFile = resolve(sh('git rev-parse --git-common-dir').trim(), 'info', 'private-names');
if (!existsSync(listFile)) {
    console.log('check-names: no .git/info/private-names in this checkout; skipped.');
    process.exit(0);
}
const names = readFileSync(listFile, 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
if (!names.length) {
    console.log('check-names: .git/info/private-names is empty; skipped.');
    process.exit(0);
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'iu');

/** @type {string[]} */
const hits = [];

/** @param {string} where @param {string} text */
function scan(where, text) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) hits.push(`${where}:${i + 1}`);
    }
}

const files = sh('git ls-files -z --cached --others --exclude-standard').split('\0').filter(Boolean);
for (const file of new Set(files)) {
    if (file === 'package-lock.json') continue;
    let buf;
    try { buf = readFileSync(resolve(file)); } catch { continue; } // deleted in the working tree
    if (buf.subarray(0, 8000).includes(0)) continue;
    scan(file, buf.toString('utf8'));
}

/** Commit ranges to check: from the pre-push hook's stdin, or everything not on origin. */
function ranges() {
    if (!PRE_PUSH) return ['HEAD --not --remotes'];
    const input = readFileSync(0, 'utf8');
    return input.split('\n').filter(Boolean).flatMap((line) => {
        const [, localSha, , remoteSha] = line.split(' ');
        if (ZERO.test(localSha)) return []; // deleting a remote ref sends nothing
        return [ZERO.test(remoteSha) ? `${localSha} --not --remotes` : `${remoteSha}..${localSha}`];
    });
}

for (const range of ranges()) {
    for (const entry of sh(`git log --format=%h%x00%B%x01 ${range}`).split('\x01')) {
        const [hash, message] = entry.replace(/^\n/, '').split('\0');
        if (hash && message !== undefined) scan(`commit ${hash} message`, message);
    }
}

if (hits.length) {
    console.error(`check-names: a name from .git/info/private-names appears in:\n  ${hits.join('\n  ')}`);
    console.error('check-names: this repo is public; reword these before pushing (`git commit --amend` for a message).');
    process.exit(1);
}
console.log(`check-names: no private names (${names.length} checked) in ${files.length} files or unpushed commit messages.`);
