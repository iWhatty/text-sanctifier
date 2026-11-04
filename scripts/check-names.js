// Public-repo guard. Local list: .git/info/private-names (never committed).
// Plain entries match whole words; *entries match substrings, ignoring case.
// Spaces also match line breaks. Missing/empty lists skip outside release:prep.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const git = (...args) => execFileSync('git', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
});
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function main() {
    const listFile = resolve(git('rev-parse', '--git-common-dir').trim(), 'info', 'private-names');
    if (!existsSync(listFile)) {
        console.log('check-names: no .git/info/private-names in this checkout; skipped.');
        return;
    }
    const names = readFileSync(listFile, 'utf8').split(/\r?\n/)
        .map((line) => line.replace(/#.*/, '').trim()).filter(Boolean);
    if (!names.length) {
        console.log('check-names: .git/info/private-names is empty; skipped.');
        return;
    }
    const pattern = new RegExp(names.map((entry) => {
        const substring = entry.startsWith('*');
        const body = (substring ? entry.slice(1) : entry).split(/ +/).map(escape).join('\\s+');
        if (!body) throw new Error('a * entry needs a name');
        return substring ? body : `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`;
    }).join('|'), 'giu');
    const hits = new Set();
    function scan(where, text) {
        for (const match of text.matchAll(pattern)) {
            hits.add(`${where}:${text.slice(0, match.index).split('\n').length}`);
        }
    }
    function paths(where, text) {
        for (const file of text.split('\0').filter(Boolean)) scan(where, file);
    }
    function additions(where, patch) {
        let block = [];
        let inHunk = false;
        const flush = () => { scan(where, block.join('\n')); block = []; };
        for (const line of patch.split('\n')) {
            if (line.startsWith('diff --git ')) inHunk = false;
            if (line.startsWith('@@ ')) inHunk = true;
            if (inHunk && line.startsWith('+')) block.push(line.slice(1));
            else flush();
        }
        flush();
    }
    const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
    for (const file of new Set(files)) {
        scan('file path', file);
        if (file === 'package-lock.json') continue;
        let buf;
        try { buf = readFileSync(resolve(file)); } catch { continue; }
        if (!buf.subarray(0, 8000).includes(0)) scan(file, buf.toString('utf8'));
    }
    additions('staged additions', git('diff', '--cached', '--no-ext-diff', '--no-textconv', '--unified=0'));
    paths('staged path', git('diff', '--cached', '--name-only', '-z'));

    let ranges = [['HEAD', '--not', '--remotes']];
    if (process.argv.includes('--pre-push')) {
        ranges = readFileSync(0, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
            const [, localSha, , remoteSha] = line.trim().split(/\s+/);
            if (!/^[a-f\d]{40,64}$/i.test(localSha) || !/^[a-f\d]{40,64}$/i.test(remoteSha)) {
                throw new Error('invalid pre-push object IDs');
            }
            if (/^0+$/.test(localSha)) return [];
            if (!/^0+$/.test(remoteSha)) {
                try {
                    git('cat-file', '-e', `${remoteSha}^{commit}`);
                    return [[`${remoteSha}..${localSha}`]];
                } catch { /* Remote object missing locally: check all unpushed commits. */ }
            }
            return [[localSha, '--not', '--remotes']];
        });
    }
    for (const range of ranges) {
        scan('unpushed commit messages', git('log', '--format=%h%x00%B%x01', ...range, '--'));
        additions('unpushed additions', git('log', '-p', '-m', '--format=', '--no-ext-diff', '--no-textconv', '--unified=0', ...range, '--'));
        paths('unpushed path', git('log', '--format=', '--name-only', '-z', ...range, '--'));
    }
    if (hits.size) {
        console.error(`check-names: a name from .git/info/private-names appears in:\n  ${[...hits].join('\n  ')}`);
        console.error('check-names: reword files and commit history before pushing; this repo is public.');
        process.exitCode = 1;
    } else console.log(`check-names: no private names (${names.length} checked).`);
}
try { main(); } catch (error) {
    console.error(`check-names: could not scan the repository: ${error.message}`);
    process.exitCode = 2;
}
