#!/usr/bin/env node
// bin/text-sanctifier.js
//
// Command-line front end for coding agents and CI:
//   text-sanctifier check [paths...]   report invisible and control characters
//   text-sanctifier fix [paths...]     remove them in place
//
// Plain Node (>=18), no dependencies. Exit codes: 0 clean, 1 findings (check,
// or fix --dry-run with changes pending), 2 usage or I/O error.

import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectTextDetailed, summonSanctifier } from '../src/index.js';
import { getNewlineStats } from '../src/inspectText.js';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const USAGE = `text-sanctifier ${VERSION}

Usage:
  text-sanctifier check [options] [paths...]
  text-sanctifier fix [options] [paths...]

Paths may be files, directories or globs (quote globs so the shell leaves them
alone). "-", or no paths with piped input, reads stdin. Directories and globs
skip files ignored by git (inside a git work tree) and skip binary files.

check options:
  --json               JSON report on stdout
  --max-findings N     findings listed per file (default 100, "all" for no cap)
  --strip-bom          also report a BOM at the start of a file

fix options:
  --purge-invisible    remove zero-width, non-breaking space, bidi and BOM characters
  --nuke-controls      remove C0/C1 control characters and bidi controls
  --normalize-newlines convert CRLF and CR to LF
  --strip-bom          also remove a BOM at the start of a file (kept by default)
  --dry-run            report what would change; write nothing
  --json               JSON report
  With no cleaning flag, fix uses --purge-invisible --nuke-controls.
  stdin is cleaned to stdout; the report then goes to stderr.

Other:
  -h, --help           show this help
  -v, --version        show the version

Exit codes: 0 clean, 1 findings (check) or changes pending (fix --dry-run),
2 usage or I/O error.
`;

const BOM = 0xFEFF;
const STDIN = '-';
const STDIN_LABEL = '<stdin>';
const BINARY_SNIFF_BYTES = 8000;
const WALK_SKIP_DIRS = new Set(['.git', 'node_modules']);
const CASE_INSENSITIVE_FS = process.platform === 'win32' || process.platform === 'darwin';

class UsageError extends Error {}


// --- Arguments ---

const BOOLEAN_FLAGS = {
    '--json': 'json',
    '--strip-bom': 'stripBom',
    '--purge-invisible': 'purgeInvisible',
    '--nuke-controls': 'nukeControls',
    '--normalize-newlines': 'normalizeNewlines',
    '--dry-run': 'dryRun',
};
const FIX_ONLY_FLAGS = new Set(['purgeInvisible', 'nukeControls', 'normalizeNewlines', 'dryRun']);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    const opts = {
        command: null,
        paths: [],
        json: false,
        stripBom: false,
        purgeInvisible: false,
        nukeControls: false,
        normalizeNewlines: false,
        dryRun: false,
        maxFindings: 100,
        help: false,
        version: false,
    };
    let endOfOptions = false;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (endOfOptions || arg === STDIN || !arg.startsWith('-')) {
            if (opts.command === null && !endOfOptions) opts.command = arg;
            else opts.paths.push(arg);
            continue;
        }
        if (arg === '--') { endOfOptions = true; continue; }
        if (arg === '-h' || arg === '--help') { opts.help = true; continue; }
        if (arg === '-v' || arg === '--version') { opts.version = true; continue; }

        const [name, inline] = arg.split(/=(.*)/s, 2);
        if (name === '--max-findings') {
            const value = inline !== undefined ? inline : argv[++i];
            opts.maxFindings = parseMaxFindings(value);
            continue;
        }
        if (name in BOOLEAN_FLAGS && inline === undefined) {
            opts[BOOLEAN_FLAGS[name]] = true;
            continue;
        }
        throw new UsageError(`Unknown option: ${arg}`);
    }

    if (opts.help || opts.version) return opts;
    if (opts.command !== 'check' && opts.command !== 'fix') {
        throw new UsageError(opts.command === null ? 'Missing command.' : `Unknown command: ${opts.command}`);
    }
    if (opts.command === 'check') {
        for (const [flag, key] of Object.entries(BOOLEAN_FLAGS)) {
            if (FIX_ONLY_FLAGS.has(key) && opts[key]) throw new UsageError(`${flag} only applies to fix.`);
        }
    }
    if (opts.command === 'fix' && !opts.purgeInvisible && !opts.nukeControls && !opts.normalizeNewlines) {
        opts.purgeInvisible = true;
        opts.nukeControls = true;
    }
    return opts;
}

/** @param {string|undefined} value */
function parseMaxFindings(value) {
    if (value === 'all') return Infinity;
    const n = Number(value);
    if (value === undefined || value === '' || !Number.isInteger(n) || n < 0) {
        throw new UsageError(`--max-findings expects a non-negative integer or "all", got ${value === undefined ? 'nothing' : JSON.stringify(value)}.`);
    }
    return n;
}


// --- File collection ---

const GLOB_CHARS = /[*?[{]/;

/** @param {string} p */
const toSlash = (p) => p.split(sep).join('/');

/** @param {string} cwd */
function isGitWorkTree(cwd) {
    const r = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, encoding: 'utf8' });
    return !r.error && r.status === 0 && r.stdout.trim() === 'true';
}

/**
 * Lists tracked and untracked-but-not-ignored files under one pathspec.
 * Returns null when git cannot answer (for example a path outside the work tree).
 * @param {string} cwd
 * @param {string} pathspec
 * @returns {string[]|null}
 */
function gitListFiles(cwd, pathspec) {
    const r = spawnSync(
        'git',
        ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', pathspec],
        { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }
    );
    if (r.error || r.status !== 0) return null;
    // --cached lists tracked files deleted from the work tree; drop them
    return r.stdout.split('\0').filter((f) => f && existsSync(resolve(cwd, f)));
}

/**
 * Recursive file walk used outside git. Skips .git and node_modules.
 * @param {string} cwd
 * @param {string} dir - relative or absolute, as the user typed it
 * @returns {string[]}
 */
function walk(cwd, dir) {
    const out = [];
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        let entries;
        try {
            entries = readdirSync(resolve(cwd, current), { withFileTypes: true });
        } catch {
            continue;
        }
        entries.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
        for (const e of entries) {
            const p = current === '.' ? e.name : join(current, e.name);
            if (e.isDirectory()) {
                if (!WALK_SKIP_DIRS.has(e.name)) stack.push(p);
            } else if (e.isFile()) {
                out.push(toSlash(p));
            }
        }
    }
    return out.sort();
}

/**
 * Glob to RegExp for the non-git fallback: `**`, `*`, `?`, `[...]` and `{a,b}`.
 * @param {string} glob
 */
function globToRegExp(glob) {
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
            if (glob[i + 1] === '*') {
                const slashAfter = glob[i + 2] === '/';
                re += slashAfter ? '(?:.*/)?' : '.*';
                i += slashAfter ? 2 : 1;
            } else {
                re += '[^/]*';
            }
        } else if (c === '?') {
            re += '[^/]';
        } else if (c === '[') {
            const close = glob.indexOf(']', i + 1);
            if (close === -1) { re += '\\['; continue; }
            let body = glob.slice(i + 1, close).replace(/\\/g, '\\\\');
            if (body[0] === '!') body = '^' + body.slice(1);
            re += `[${body}]`;
            i = close;
        } else if (c === '{') {
            const close = glob.indexOf('}', i + 1);
            if (close === -1) { re += '\\{'; continue; }
            const alts = glob.slice(i + 1, close).split(',').map((a) => a.replace(/[.+^$()|\\]/g, '\\$&'));
            re += `(?:${alts.join('|')})`;
            i = close;
        } else {
            re += c.replace(/[.+^$()|\\\]}]/g, '\\$&');
        }
    }
    return new RegExp(`^${re}$`);
}

/**
 * @param {string} cwd
 * @param {string} glob
 */
function walkGlob(cwd, glob) {
    const pattern = toSlash(glob).replace(/^\.\//, '');
    const segments = pattern.split('/');
    const firstGlob = segments.findIndex((s) => GLOB_CHARS.test(s));
    const base = segments.slice(0, firstGlob).join('/') || '.';
    const re = globToRegExp(pattern);
    return walk(cwd, base).filter((f) => re.test(f));
}

/**
 * Expands the path arguments into a de-duplicated input list.
 * @param {string[]} args
 * @param {string} cwd
 * @param {(msg: string) => void} warn
 * @returns {{ inputs: Array<{ path: string, explicit: boolean }>, errors: number }}
 */
function collectInputs(args, cwd, warn) {
    const inputs = [];
    const seen = new Set();
    let errors = 0;
    let inGit;

    const add = (path, explicit) => {
        const abs = resolve(cwd, path);
        const key = path === STDIN ? STDIN : CASE_INSENSITIVE_FS ? abs.toLowerCase() : abs;
        if (seen.has(key)) return;
        seen.add(key);
        inputs.push({ path, explicit });
    };

    for (const arg of args) {
        if (arg === STDIN) { add(STDIN, true); continue; }

        let stat = null;
        try { stat = statSync(resolve(cwd, arg)); } catch { /* not a plain path */ }

        if (stat && stat.isFile()) { add(arg, true); continue; }

        const isGlob = !stat && GLOB_CHARS.test(arg);
        if (!stat && !isGlob) {
            warn(`${arg}: no such file or directory`);
            errors++;
            continue;
        }

        if (inGit === undefined) inGit = isGitWorkTree(cwd);
        const listed =
            (inGit && gitListFiles(cwd, isGlob ? `:(glob)${toSlash(arg)}` : toSlash(arg))) ||
            (isGlob ? walkGlob(cwd, arg) : walk(cwd, arg));

        if (listed.length === 0) warn(`${arg}: no files matched`);
        for (const f of listed) add(f, false);
    }
    return { inputs, errors };
}


// --- Reading ---

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Decodes UTF-8, keeping a leading BOM. Returns null for binary or non-UTF-8 data.
 * @param {Uint8Array} bytes
 * @returns {{ text: string|null, reason?: string }}
 */
function decode(bytes) {
    if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return { text: null, reason: 'binary' };
    try {
        return { text: utf8.decode(bytes) };
    } catch {
        return { text: null, reason: 'not UTF-8' };
    }
}

/** @returns {Promise<Buffer>} */
function readStdin() {
    return new Promise((res, rej) => {
        const chunks = [];
        process.stdin.on('data', (c) => chunks.push(c));
        process.stdin.on('end', () => res(Buffer.concat(chunks)));
        process.stdin.on('error', rej);
    });
}


// --- check ---

/**
 * inspectTextDetailed, minus a BOM at offset 0 unless stripBom.
 * @param {string} text
 * @param {number} maxFindings
 * @param {boolean} stripBom
 */
function inspect(text, maxFindings, stripBom) {
    const leadingBom = !stripBom && text.charCodeAt(0) === BOM;
    const report = inspectTextDetailed(text, { maxFindings: leadingBom ? maxFindings + 1 : maxFindings });
    if (leadingBom) {
        report.findings.shift();
        report.counts.bom--;
        report.total--;
        report.truncated = report.total > report.findings.length;
    }
    return report;
}

/** @param {number} cp */
const hex = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/**
 * @param {Record<string, number>} counts
 */
const formatCounts = (counts) =>
    Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ');


// --- Main ---

/**
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
async function main(argv) {
    const out = (s) => process.stdout.write(s + '\n');
    const err = (s) => process.stderr.write(s + '\n');

    let opts;
    try {
        opts = parseArgs(argv);
    } catch (e) {
        if (!(e instanceof UsageError)) throw e;
        err(`text-sanctifier: ${e.message}\nRun "text-sanctifier --help" for usage.`);
        return 2;
    }
    if (opts.help) { out(USAGE); return 0; }
    if (opts.version) { out(VERSION); return 0; }

    const cwd = process.cwd();
    let paths = opts.paths;
    if (paths.length === 0) {
        if (process.stdin.isTTY) {
            err('text-sanctifier: no paths given and nothing piped on stdin.\nRun "text-sanctifier --help" for usage.');
            return 2;
        }
        paths = [STDIN];
    }

    const warn = (msg) => err(`text-sanctifier: ${msg}`);
    const { inputs, errors: pathErrors } = collectInputs(paths, cwd, warn);
    let errors = pathErrors;
    /** @type {Array<{ path: string, reason: string }>} */
    const skipped = [];

    /**
     * Reads every input in order, calling `visit(label, text, input)` for each decodable one.
     * @param {(label: string, text: string, input: { path: string, explicit: boolean }) => void} visit
     */
    const forEachText = async (visit) => {
        for (const input of inputs) {
            const label = input.path === STDIN ? STDIN_LABEL : input.path;
            let bytes;
            try {
                bytes = input.path === STDIN ? await readStdin() : readFileSync(resolve(cwd, input.path));
            } catch (e) {
                warn(`${label}: ${e.code || e.message}`);
                errors++;
                continue;
            }
            const { text, reason } = decode(bytes);
            if (text === null) {
                skipped.push({ path: label, reason });
                if (input.explicit) warn(`${label}: skipped (${reason})`);
                continue;
            }
            visit(label, text, input);
        }
    };

    if (opts.command === 'check') {
        const files = [];
        let scanned = 0;
        let total = 0;

        await forEachText((label, text) => {
            scanned++;
            const report = inspect(text, opts.maxFindings, opts.stripBom);
            total += report.total;
            if (report.total > 0) files.push({ path: label, ...report });
        });

        if (opts.json) {
            out(JSON.stringify({ files, total, filesScanned: scanned, filesWithFindings: files.length, skipped }, null, 2));
        } else {
            for (const f of files) {
                for (const x of f.findings) out(`${f.path}:${x.line}:${x.column}  ${hex(x.codePoint)}  ${x.category}`);
                if (f.truncated) out(`${f.path}: ${f.total - f.findings.length} more not listed (--max-findings)`);
            }
            out(total === 0
                ? `No invisible or control characters in ${scanned} file${scanned === 1 ? '' : 's'}.`
                : `${total} finding${total === 1 ? '' : 's'} in ${files.length} of ${scanned} file${scanned === 1 ? '' : 's'}.`);
        }
        return errors > 0 ? 2 : total > 0 ? 1 : 0;
    }

    // fix
    const clean = summonSanctifier({
        purgeInvisibleChars: opts.purgeInvisible,
        nukeControls: opts.nukeControls,
        normalizeNewlines: opts.normalizeNewlines,
    });
    const writesStdout = !opts.dryRun && inputs.some((i) => i.path === STDIN);
    const report = writesStdout ? err : out;
    const files = [];
    let scanned = 0;

    await forEachText((label, text, input) => {
        scanned++;
        // The BOM at offset 0 is set aside so purgeInvisibleChars cannot take it
        const leadingBom = text.charCodeAt(0) === BOM;
        let cleaned = clean(leadingBom ? text.slice(1) : text);
        if (leadingBom && !opts.stripBom) cleaned = String.fromCharCode(BOM) + cleaned;

        if (input.path === STDIN && !opts.dryRun) process.stdout.write(cleaned);
        if (cleaned === text) return;

        const before = inspectTextDetailed(text, { maxFindings: 0 }).counts;
        const after = inspectTextDetailed(cleaned, { maxFindings: 0 }).counts;
        const removed = {};
        let removedTotal = 0;
        for (const k of Object.keys(before)) {
            const n = before[k] - (after[k] || 0);
            if (n > 0) { removed[k] = n; removedTotal += n; }
        }
        const nl = getNewlineStats(text);
        const newlinesNormalized = opts.normalizeNewlines && nl.crlf + nl.cr > 0;

        if (input.path !== STDIN && !opts.dryRun) {
            try {
                writeFileSync(resolve(cwd, input.path), cleaned, 'utf8');
            } catch (e) {
                warn(`${label}: ${e.code || e.message}`);
                errors++;
                return;
            }
        }
        files.push({ path: label, removed, removedTotal, newlinesNormalized });
    });

    if (opts.json) {
        report(JSON.stringify({ files, dryRun: opts.dryRun, filesScanned: scanned, filesChanged: files.length, skipped }, null, 2));
    } else {
        const verb = opts.dryRun ? 'would fix' : 'fixed';
        for (const f of files) {
            const parts = [];
            if (f.removedTotal > 0) parts.push(`removed ${f.removedTotal} (${formatCounts(f.removed)})`);
            if (f.newlinesNormalized) parts.push('normalized newlines');
            report(`${verb} ${f.path}: ${parts.join('; ')}`);
        }
        report(files.length === 0
            ? `Nothing to fix in ${scanned} file${scanned === 1 ? '' : 's'}.`
            : `${opts.dryRun ? 'Would change' : 'Changed'} ${files.length} of ${scanned} file${scanned === 1 ? '' : 's'}.`);
    }
    return errors > 0 ? 2 : opts.dryRun && files.length > 0 ? 1 : 0;
}

main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => {
        process.stderr.write(`text-sanctifier: ${e && e.stack ? e.stack : e}\n`);
        process.exitCode = 2;
    }
);
