import { readFileSync, statSync, fstatSync, readdirSync } from 'node:fs';
import { resolve, join, sep, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const BOM = 0xFEFF;
const STDIN = '-';
const STDIN_LABEL = '<stdin>';
const BINARY_SNIFF_BYTES = 8000;
const BINARY_CONTROL_SHARE = 0.05;
const BINARY_MIN_ASCII_CONTROLS = 8;
const WALK_SKIP_DIRS = new Set(['.git', 'node_modules']);
const CASE_INSENSITIVE_FS = process.platform === 'win32' || process.platform === 'darwin';


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
 * Lists tracked and untracked-but-not-ignored files under the given pathspecs.
 * Returns null when git cannot answer (for example a path outside the work tree).
 * @param {string} cwd
 * @param {string[]} pathspecs
 * @returns {string[]|null}
 */
function gitListFiles(cwd, pathspecs) {
    const r = spawnSync(
        'git',
        ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...pathspecs],
        { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }
    );
    if (r.error || r.status !== 0) return null;
    // --cached also lists tracked files deleted from the work tree, submodules and
    // symlinks to directories; keep only what can be read as a file
    return r.stdout.split('\0').filter((f) => {
        if (!f) return false;
        try { return statSync(resolve(cwd, f)).isFile(); } catch { return false; }
    });
}

/**
 * Expands `{a,b}` into one glob per alternative: git pathspecs have no brace syntax.
 * @param {string} glob
 * @returns {string[]}
 */
function expandBraces(glob) {
    const m = /\{([^{}]*)\}/.exec(glob);
    if (!m) return [glob];
    return m[1].split(',').flatMap((alt) => expandBraces(glob.slice(0, m.index) + alt + glob.slice(m.index + m[0].length)));
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
function globToRegExp(glob, flags = '') {
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
    return new RegExp(`^${re}$`, flags);
}

/** @param {string} glob - an --exclude pattern */
const excludeRegExp = (glob) => globToRegExp(toSlash(glob).replace(/^\.\//, '').replace(/\/$/, ''), CASE_INSENSITIVE_FS ? 'i' : '');

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
 * Agent instruction and configuration files, relative to the directory searched.
 * Matched case-insensitively. Keep .pre-commit-hooks.yaml (the text-sanctifier-ai-config
 * hook's `files`) in step; tests/cli.test.js checks both against the same paths.
 */
const AI_CONFIG_GLOBS = [
    '**/CLAUDE.md', '**/CLAUDE.local.md', '**/AGENTS.md', '**/AGENT.md', '**/GEMINI.md', '**/SKILL.md',
    '.claude/**',
    '.cursorrules', '.cursor/rules/**', '.cursor/mcp.json',
    '.windsurfrules', '.windsurf/rules/**',
    '.clinerules', '.clinerules/**',
    '.roorules', '.roo/rules/**',
    '.github/copilot-instructions.md', '.github/instructions/**', '.github/prompts/**',
    '.github/chatmodes/**', '.github/agents/**',
    '.mcp.json', 'mcp.json', '.vscode/mcp.json',
];

const AI_CONFIG_RES = AI_CONFIG_GLOBS.map((g) => new RegExp(globToRegExp(g).source, 'i'));

/** @param {string} rel - slash-separated path relative to the directory searched */
const isAiConfigPath = (rel) => AI_CONFIG_RES.some((re) => re.test(rel));

/**
 * Expands the path arguments into a de-duplicated input list. With `aiConfig`,
 * directories contribute only agent instruction files (AI_CONFIG_GLOBS).
 * @param {string[]} args
 * @param {string} cwd
 * @param {(path: string|null, code: string, message: string) => void} addError
 * @param {boolean} [aiConfig]
 * @returns {Array<{ path: string, explicit: boolean }>}
 */
function collectInputs(args, cwd, addError, aiConfig = false) {
    const inputs = [];
    const seen = new Set();
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
            addError(arg, 'not_found', `${arg}: no such file or directory`);
            continue;
        }

        if (inGit === undefined) inGit = isGitWorkTree(cwd);
        let listed =
            (inGit && gitListFiles(cwd, isGlob ? expandBraces(toSlash(arg)).map((g) => `:(glob)${g}`) : [toSlash(arg)])) ||
            (isGlob ? walkGlob(cwd, arg) : walk(cwd, arg));

        if (aiConfig && !isGlob) {
            const base = resolve(cwd, arg);
            listed = listed.filter((f) => isAiConfigPath(toSlash(relative(base, resolve(cwd, f)))));
        } else if (listed.length === 0) {
            addError(arg, 'no_match', `${arg}: no files matched`);
        }
        for (const f of listed) add(f, false);
    }
    return inputs;
}


// --- Reading ---

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const utf8Lenient = new TextDecoder('utf-8', { ignoreBOM: true });
const utf16 = new TextDecoder('utf-16le', { ignoreBOM: true });

/**
 * A NUL plus a share of control bytes that text does not have, in the first
 * BINARY_SNIFF_BYTES. One stray NUL is not enough, or it would hide a file from `check`.
 * @param {Uint8Array} bytes
 * @param {number} [minControls] - fewest control bytes that count
 */
function looksBinary(bytes, minControls = 0) {
    const sample = bytes.subarray(0, BINARY_SNIFF_BYTES);
    if (!sample.includes(0)) return false;
    let controls = 0;
    for (const b of sample) if (b < 9 || (b > 13 && b < 32)) controls++;
    return controls >= minControls && controls / sample.length > BINARY_CONTROL_SHARE;
}

/**
 * Decodes UTF-8, or UTF-16 with a BOM (setting `wide`), keeping a leading BOM. With
 * `sniff`, data that looks binary is not decoded if it is not UTF-8, or if it is entirely
 * ASCII with at least BINARY_MIN_ASCII_CONTROLS control bytes, so a short file with a stray
 * NUL is still read. Invisible Unicode needs non-ASCII bytes in UTF-8, so ASCII-only data has
 * only controls to hide. Other bytes that are not UTF-8 become U+FFFD and set `lossy`, so
 * one bad byte cannot hide the rest of a file.
 * @param {Buffer} bytes
 * @param {boolean} sniff
 * @returns {{ text: string|null, reason?: string, lossy?: boolean, wide?: boolean }}
 */
function decode(bytes, sniff) {
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return { text: utf16.decode(bytes), wide: true };
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return { text: utf16.decode(Buffer.from(bytes.subarray(0, bytes.length & ~1)).swap16()), wide: true };
    }
    try {
        const text = utf8.decode(bytes);
        if (sniff && looksBinary(bytes, BINARY_MIN_ASCII_CONTROLS) && bytes.every((b) => b < 0x80)) return { text: null, reason: 'binary' };
        return { text };
    } catch (e) {
        if (!(e instanceof TypeError)) throw e; // too large for a string, not bad UTF-8
        if (sniff && looksBinary(bytes)) return { text: null, reason: 'binary' };
        return { text: utf8Lenient.decode(bytes), lossy: true };
    }
}

/**
 * True when stdin may hold input for check with no paths: anything but a terminal,
 * the null device or an empty file. Pipes must be read to detect empty input;
 * Windows pipes do not report isFIFO().
 */
function stdinHasInput() {
    try {
        const stat = fstatSync(0);
        return !stat.isCharacterDevice() && !(stat.isFile() && stat.size === 0);
    } catch {
        return false;
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

export { BOM, STDIN, STDIN_LABEL, BINARY_SNIFF_BYTES, toSlash, excludeRegExp, collectInputs, decode, stdinHasInput, readStdin };
