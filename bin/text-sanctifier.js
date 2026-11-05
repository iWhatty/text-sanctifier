#!/usr/bin/env node
// bin/text-sanctifier.js
//
// Command-line front end for coding agents and CI:
//   text-sanctifier check [paths...]   report invisible and control characters
//   text-sanctifier check --ai-config  report hidden text in agent instruction files
//   text-sanctifier fix [paths...]     remove them in place
//   text-sanctifier reveal [paths...]  print the text with hidden characters shown as <U+XXXX>
//
// Plain Node (>=18), no dependencies. Exit codes: 0 clean, 1 findings (check,
// or fix --dry-run with changes pending), 2 usage or I/O error.

import { readFileSync, writeFileSync, statSync, fstatSync, readdirSync } from 'node:fs';
import { resolve, join, sep, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectTextDetailed, summonSanctifier, revealInvisible } from '../src/index.js';
import { getNewlineStats } from '../src/inspectText.js';
import { SPACE_LOOKALIKES_REGEX } from '../src/sanctifyText.js';
import { scanHiddenSpans } from '../src/hiddenScan.js';
import { inspectTextInContext } from '../src/context.js';
import { classifyCodeUnit, classifyAstral } from '../src/categories.generated.js';

for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (e) => { if (e.code !== 'EPIPE') throw e; });
}

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const USAGE = `text-sanctifier ${VERSION}

Usage:
  text-sanctifier check [options] [paths...]
  text-sanctifier fix [options] [paths...]
  text-sanctifier reveal [paths...]

Paths may be files, directories or globs (quote globs so the shell leaves them
alone). "-" reads stdin. With no paths, check reads piped input, or scans the current
directory when stdin is a terminal, the null device or empty. Fix and reveal read
piped input. Directories and globs skip files ignored by git (inside
a git work tree). Binary files are skipped; files that are text apart from a stray
NUL or bad byte are not, and UTF-16 files with a BOM are decoded. A path or glob that
matches no files, or a run that checks nothing, exits 2.

check options:
  --format F           text (default), json or sarif (SARIF 2.1.0)
  --json               same as --format json
  --exclude GLOB       exclude matching paths (repeatable)
  --max-findings N     findings listed per file (default 100, "all" for no cap)
  --strip-bom          also report a BOM at the start of a file
  --ai-config          check agent instruction files (CLAUDE.md, AGENTS.md,
                       .cursor/rules, SKILL.md, MCP config, ...) for hidden text;
                       directories, or "." when no paths are given, are searched
                       for those files, and tag text is decoded

fix options:
  --normalize-spaces   replace look-alike spaces (NBSP, narrow NBSP, typographic
                       spaces) with an ordinary space instead of removing them
  --purge-invisible    remove zero-width, non-breaking space, bidi and BOM characters
  --keep-benign        keep contextually legitimate joiners and selectors when purging
  --nuke-controls      remove C0/C1 control characters and bidi controls
  --normalize-newlines convert CRLF and CR to LF
  --strip-bom          also remove a BOM at the start of a file (kept by default)
  --dry-run            report what would change; write nothing
  --exclude GLOB       exclude matching paths (repeatable)
  --format F           text (default) or json
  --json               same as --format json
  With no cleaning flag, fix uses --normalize-spaces --purge-invisible --nuke-controls.
  stdin is cleaned to stdout; the report then goes to stderr.

reveal:
  Prints each input with every character check would report replaced by a
  marker such as <U+200B>; everything else, including newlines, is unchanged.
  Several inputs are printed one after another under "==> path <==" headers.
  Takes no options. Exit code 0 unless an input can't be read.

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
const BINARY_CONTROL_SHARE = 0.05;
const BINARY_MIN_ASCII_CONTROLS = 8;
const WALK_SKIP_DIRS = new Set(['.git', 'node_modules']);
const CASE_INSENSITIVE_FS = process.platform === 'win32' || process.platform === 'darwin';

class UsageError extends Error {}


// --- Arguments ---

const BOOLEAN_FLAGS = {
    '--ai-config': 'aiConfig',
    '--strip-bom': 'stripBom',
    '--normalize-spaces': 'normalizeSpaces',
    '--purge-invisible': 'purgeInvisible',
    '--keep-benign': 'keepBenign',
    '--nuke-controls': 'nukeControls',
    '--normalize-newlines': 'normalizeNewlines',
    '--dry-run': 'dryRun',
};
const FIX_ONLY_FLAGS = new Set(['normalizeSpaces', 'purgeInvisible', 'keepBenign', 'nukeControls', 'normalizeNewlines', 'dryRun']);
const CHECK_ONLY_FLAGS = new Set(['aiConfig']);
const FORMATS = new Set(['text', 'json', 'sarif']);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    const opts = {
        command: null,
        paths: [],
        excludes: [],
        format: null,
        aiConfig: false,
        stripBom: false,
        normalizeSpaces: false,
        purgeInvisible: false,
        keepBenign: false,
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
        if (name === '--exclude') {
            const value = inline !== undefined ? inline : argv[++i];
            if (!value || value.startsWith('-')) throw new UsageError('--exclude expects a non-empty glob.');
            try { excludeRegExp(value); }
            catch (e) { if (e instanceof SyntaxError) throw new UsageError(`Invalid --exclude pattern: ${value}`); throw e; }
            opts.excludes.push(value);
            continue;
        }
        if (name === '--max-findings') {
            const value = inline !== undefined ? inline : argv[++i];
            opts.maxFindings = parseMaxFindings(value);
            continue;
        }
        if (name === '--format' || (name === '--json' && inline === undefined)) {
            const value = name === '--json' ? 'json' : inline !== undefined ? inline : argv[++i];
            if (!FORMATS.has(value)) {
                throw new UsageError(`--format expects text, json or sarif, got ${value === undefined ? 'nothing' : JSON.stringify(value)}.`);
            }
            if (opts.format !== null && opts.format !== value) throw new UsageError(`Conflicting formats: ${opts.format} and ${value}.`);
            opts.format = value;
            continue;
        }
        if (name in BOOLEAN_FLAGS && inline === undefined) {
            opts[BOOLEAN_FLAGS[name]] = true;
            continue;
        }
        throw new UsageError(`Unknown option: ${arg}`);
    }

    if (opts.help || opts.version) return opts;
    if (opts.command !== 'check' && opts.command !== 'fix' && opts.command !== 'reveal') {
        throw new UsageError(opts.command === null ? 'Missing command.' : `Unknown command: ${opts.command}`);
    }
    if (opts.command === 'reveal') {
        if (opts.excludes.length) throw new UsageError('--exclude does not apply to reveal.');
        for (const [flag, key] of Object.entries(BOOLEAN_FLAGS)) {
            if (opts[key]) throw new UsageError(`${flag} does not apply to reveal.`);
        }
        if (opts.format !== null) throw new UsageError('--format does not apply to reveal.');
        if (opts.maxFindings !== 100) throw new UsageError('--max-findings does not apply to reveal.');
        return opts;
    }
    for (const [flag, key] of Object.entries(BOOLEAN_FLAGS)) {
        if (opts.command === 'check' && FIX_ONLY_FLAGS.has(key) && opts[key]) throw new UsageError(`${flag} only applies to fix.`);
        if (opts.command === 'fix' && CHECK_ONLY_FLAGS.has(key) && opts[key]) throw new UsageError(`${flag} only applies to check.`);
    }
    if (opts.aiConfig && opts.excludes.length) throw new UsageError('--exclude does not apply to --ai-config.');
    if (opts.format === null) opts.format = 'text';
    if (opts.command === 'fix' && opts.format === 'sarif') throw new UsageError('--format sarif only applies to check.');
    if (opts.command === 'fix' && !opts.normalizeSpaces && !opts.purgeInvisible && !opts.nukeControls && !opts.normalizeNewlines) {
        opts.normalizeSpaces = true;
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

/**
 * @param {number} n
 * @param {string} word
 */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;


// --- check --ai-config ---

const MAX_DECODED = 1000;
const RUN_NOUNS = { tag: 'tag character', variation_selector: 'variation selector', invisible_operator: 'invisible operator', reserved_tag_plane: 'reserved plane-14 code point' };

/**
 * inspect() for agent instruction files: drops findings that belong to legitimate
 * sequences (subdivision flags, a lone emoji presentation selector) and adds the runs
 * of tag characters, variation selectors and invisible operators, with tag text decoded.
 * @param {string} text
 * @param {number} maxFindings
 * @param {boolean} stripBom
 */
function inspectAiConfig(text, maxFindings, stripBom) {
    const full = inspect(text, 0, stripBom);
    const findings = [];
    const loose = [];
    let looseCount = 0;
    let position = 0, line = 1, lineStart = 0;
    const scan = (end, inRun, benign) => {
        while (position < end) {
            const offset = position;
            const codePoint = text.codePointAt(position);
            position += codePoint > 0xFFFF ? 2 : 1;
            if (codePoint === 10 || (codePoint === 13 && text.charCodeAt(position) !== 10)) {
                line++; lineStart = position; continue;
            }
            const category = codePoint > 0xFFFF ? classifyAstral(codePoint) : classifyCodeUnit(codePoint);
            if (!category || (offset === 0 && codePoint === BOM && !stripBom)) continue;
            if (benign) { full.counts[category]--; full.total--; continue; }
            if (findings.length < maxFindings || (!inRun && loose.length < maxFindings)) {
                const f = { offset, line, column: offset - lineStart + 1, codePoint, category };
                if (category === 'bom') f.atStart = offset === 0;
                if (findings.length < maxFindings) findings.push(f);
                if (!inRun && loose.length < maxFindings) loose.push(f);
            }
            if (!inRun) looseCount++;
        }
    };
    // Decode beyond the cut point by one marker so slicing matches the original output.
    const hidden = scanHiddenSpans(text, { maxRuns: maxFindings, maxDecodedLength: MAX_DECODED + 10 }, (span) => {
        scan(span.offset, false, false);
        scan(span.end, !span.benign, span.benign);
    });
    scan(text.length, false, false);
    const hiddenRuns = hidden.runs.map((run) => {
        const entry = { kind: run.kind, offset: run.offset, line: run.line, column: run.column, codePoint: text.codePointAt(run.offset), count: run.count };
        if (run.decoded !== undefined) {
            entry.decoded = run.decoded.slice(0, MAX_DECODED);
            entry.decodedTruncated = run.decodedTruncated || run.decoded.length > MAX_DECODED;
        }
        return entry;
    });
    return {
        report: {
            ...full,
            findings,
            truncated: full.total > findings.length,
            hiddenRuns,
            hiddenRunCount: hidden.total,
        },
        hiddenRuns,
        loose,
        entryCount: hidden.total + looseCount,
    };
}

/** @param {{ kind: string, count: number, decoded?: string, decodedTruncated?: boolean }} run */
function describeRun(run) {
    const what = plural(run.count, RUN_NOUNS[run.kind]);
    if (run.decoded === undefined) return `run of ${what}`;
    return `run of ${what} spelling ${JSON.stringify(run.decoded)}${run.decodedTruncated ? ' (cut short)' : ''}`;
}


// --- SARIF ---

// Level and description per category, for SARIF rules. Every category needs an entry;
// tests/cli.test.js checks the rules against inspectTextDetailed's counts.
const CATEGORY_RULES = {
    bidi_control: ['error', 'Bidirectional control character, which can make text display in a different order than it is read (Trojan Source)'],
    zero_width: ['warning', 'Zero-width character'],
    nonbreaking_space: ['note', 'Non-breaking or typographic space that looks like an ordinary space'],
    bom: ['warning', 'Byte order mark (U+FEFF) that is not at the start of the file'],
    nul: ['warning', 'NUL character'],
    c0_control: ['warning', 'C0 control character other than tab, LF and CR'],
    c1_control: ['warning', 'C1 control character'],
    invisible_format: ['warning', 'Invisible format character, such as a soft hyphen or an invisible operator'],
    hangul_filler: ['warning', 'Hangul filler, a letter that renders blank'],
    variation_selector: ['warning', 'Variation selector, which can carry hidden data'],
    tag: ['error', 'Tag character, which can hide ASCII text that people cannot see but language models read'],
};

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const INFORMATION_URI = 'https://github.com/iWhatty/text-sanctifier';
const ABSOLUTE_PATH = /^(?:[a-zA-Z]:)?[\\/]/;
const fingerprints = new WeakMap();

function fingerprintFindings(label, text, findings, cwd) {
    const path = label === STDIN_LABEL ? 'stdin' : toSlash(relative(cwd, resolve(cwd, label)));
    let previousLine = 0, start = 0, end = 0;
    let occurrences = new Map();
    const hashOccurrences = new Map();
    for (const finding of findings) {
        if (finding.line !== previousLine) {
            start = finding.offset - finding.column + 1;
            end = start;
            while (end < text.length && text.charCodeAt(end) !== 10 && text.charCodeAt(end) !== 13) end++;
            occurrences = new Map();
            previousLine = finding.line;
        }
        const index = occurrences.get(finding.category) || 0;
        occurrences.set(finding.category, index + 1);
        const hash = createHash('sha256').update(JSON.stringify([finding.category, path, text.slice(start, end), index])).digest('hex');
        const count = (hashOccurrences.get(hash) || 0) + 1;
        hashOccurrences.set(hash, count);
        fingerprints.set(finding, count === 1 ? hash :
            createHash('sha256').update(JSON.stringify([hash, count])).digest('hex'));
    }
}

/** @param {string} label */
function sarifArtifact(label) {
    if (label === STDIN_LABEL) return { uri: 'stdin', description: { text: 'standard input' } };
    if (ABSOLUTE_PATH.test(label)) return { uri: pathToFileURL(label).href };
    return { uri: encodeURI(toSlash(label)).replace(/[?#]/g, encodeURIComponent), uriBaseId: '%SRCROOT%' };
}

/**
 * Builds a SARIF 2.1.0 log with one result per listed finding; the rule is the category.
 * @param {Array<{ path: string, findings: Array<{ offset: number, line: number, column: number, codePoint: number, category: string }>, hiddenRuns?: Array<{ offset: number, kind: string, count: number, decoded?: string }>, truncated: boolean }>} files
 * @param {{ cwd: string, total: number, filesScanned: number, skipped: Array<{ path: string, reason: string }>, excluded: string[], succeeded: boolean }} info
 */
function sarifLog(files, { cwd, total, filesScanned, skipped, excluded, succeeded }) {
    const ruleIds = Object.keys(inspectTextDetailed('', { maxFindings: 0 }).counts);
    const rules = ruleIds.map((id) => ({
        id,
        shortDescription: { text: CATEGORY_RULES[id][1] },
        defaultConfiguration: { level: CATEGORY_RULES[id][0] },
    }));

    const results = [];
    for (const f of files) {
        const runAt = new Map((f.hiddenRuns || []).map((run) => [run.offset, run]));
        const artifactLocation = sarifArtifact(f.path);
        for (const x of f.findings) {
            const run = runAt.get(x.offset);
            results.push({
                ruleId: x.category,
                partialFingerprints: { 'textSanctifier/v1': fingerprints.get(x) },
                ruleIndex: ruleIds.indexOf(x.category),
                level: CATEGORY_RULES[x.category][0],
                message: { text: `${hex(x.codePoint)} ${x.category}${run ? `, start of a ${describeRun(run)}` : ''}` },
                locations: [{
                    physicalLocation: {
                        artifactLocation,
                        region: { startLine: x.line, startColumn: x.column, endColumn: x.column + (x.codePoint > 0xFFFF ? 2 : 1) },
                    },
                }],
            });
        }
    }

    return {
        $schema: SARIF_SCHEMA,
        version: '2.1.0',
        runs: [{
            tool: { driver: { name: 'text-sanctifier', version: VERSION, semanticVersion: VERSION, informationUri: INFORMATION_URI, rules } },
            originalUriBaseIds: { '%SRCROOT%': { uri: pathToFileURL(cwd.endsWith(sep) ? cwd : cwd + sep).href } },
            columnKind: 'utf16CodeUnits',
            invocations: [{ executionSuccessful: succeeded }],
            results,
            properties: {
                total,
                filesScanned,
                filesWithFindings: files.length,
                truncated: files.filter((f) => f.truncated).map((f) => f.path),
                skipped,
                excluded,
            },
        }],
    };
}


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
        if (argv.some((arg, i) => arg === '--json' || arg === '--format=json' || (arg === '--format' && argv[i + 1] === 'json'))) {
            out(JSON.stringify({ errors: [{ path: null, code: 'usage', message: e.message }] }));
        }
        return 2;
    }
    if (opts.help) { out(USAGE); return 0; }
    if (opts.version) { out(VERSION); return 0; }

    const cwd = process.cwd();
    const warn = (msg) => err(`text-sanctifier: ${msg}`);
    const errors = [];
    const addError = (path, code, message, cause, emit = true) => {
        const entry = { path, code, message };
        if (cause) entry.cause = cause;
        errors.push(entry);
        if (emit) warn(message);
    };
    let paths = opts.paths;
    /** @type {Buffer | undefined} */
    let stdinBytes;
    // check with no paths reads nonempty stdin once, otherwise scans the current
    // directory. AI configuration discovery always defaults to the directory.
    if (paths.length === 0 && opts.command === 'check') {
        paths = ['.'];
        if (!opts.aiConfig && stdinHasInput()) {
            try {
                stdinBytes = await readStdin();
            } catch (e) {
                addError(STDIN_LABEL, 'read_failed', `${STDIN_LABEL}: ${e.code || e.message}`, e.code);
                if (opts.format === 'json') out(JSON.stringify({ errors }));
                return 2;
            }
            if (stdinBytes.length > 0) paths = [STDIN];
        }
    } else if (paths.length === 0) {
        if (process.stdin.isTTY) {
            addError(null, 'usage', 'no paths given and nothing piped on stdin.', undefined, false);
            err('text-sanctifier: no paths given and nothing piped on stdin.\nRun "text-sanctifier --help" for usage.');
            if (opts.format === 'json') out(JSON.stringify({ errors }));
            return 2;
        }
        paths = [STDIN];
    }

    const collected = collectInputs(paths, cwd, addError, opts.aiConfig);
    const excluded = [];
    const excludePatterns = opts.excludes.map(excludeRegExp);
    const inputs = collected.filter((input) => {
        if (input.path === STDIN) return true;
        const path = toSlash(relative(cwd, resolve(cwd, input.path)));
        const parts = path.split('/');
        const matches = parts.some((_, i) => excludePatterns.some((re) => re.test(parts.slice(0, i + 1).join('/'))));
        if (matches) excluded.push(input.path);
        return !matches;
    });
    /** @type {Array<{ path: string, reason: string }>} */
    const skipped = [];
    /** @type {string[]} */
    const notUtf8 = [];

    /**
     * Reads every input in order, calling `visit(label, text, input)` for each decodable one.
     * @param {(label: string, text: string, input: { path: string, explicit: boolean }) => void} visit
     */
    const forEachText = async (visit) => {
        let visited = 0;
        for (const input of inputs) {
            const label = input.path === STDIN ? STDIN_LABEL : input.path;
            let bytes;
            try {
                bytes = input.path === STDIN ? (stdinBytes ?? await readStdin()) : readFileSync(resolve(cwd, input.path));
            } catch (e) {
                addError(label, 'read_failed', `${label}: ${e.code || e.message}`, e.code);
                continue;
            }
            // Files that look binary are skipped. Stdin and AI configuration files are text
            // by intent, so a NUL in one is a finding, not a reason to skip it.
            let decoded;
            try {
                decoded = decode(bytes, input.path !== STDIN && !opts.aiConfig);
            } catch (e) {
                addError(label, 'decode_failed', `${label}: ${e.message}`);
                continue;
            }
            const { text, lossy, wide } = decoded;
            let { reason } = decoded;
            // fix writes UTF-8 in place, so it never rewrites what it could not decode or
            // what was not UTF-8. A directory scan also leaves any file with a NUL alone;
            // a file you name is cleaned if it is otherwise UTF-8.
            if (opts.command === 'fix' && !reason) {
                if (lossy) reason = 'not UTF-8';
                else if (wide) reason = 'UTF-16';
                else if (!input.explicit && bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) reason = 'binary';
            }
            if (reason) {
                skipped.push({ path: label, reason });
                if (input.explicit || reason !== 'binary') warn(`${label}: skipped (${reason})`);
                // Asked to clean this input and did not: that must not look like success
                if (opts.command === 'fix' && input.explicit) addError(label, 'refused', `${label}: skipped (${reason})`, undefined, false);
                continue;
            }
            if (lossy) {
                notUtf8.push(label);
                warn(`${label}: not valid UTF-8; checked with invalid bytes read as U+FFFD`);
            }
            visited++;
            visit(label, text, input);
        }
        // A clean result must mean something was read. Finding no AI configuration files is
        // an answer; --ai-config reports that itself.
        if (visited === 0 && errors.length === 0 && !opts.aiConfig) addError(null, 'nothing_checked', 'Nothing checked.', undefined, false);
    };

    const skippedNote = () => (skipped.length > 0 ? `; ${plural(skipped.length, 'file')} skipped` : '') + (excluded.length > 0 ? `; ${plural(excluded.length, 'file')} excluded` : '');

    if (opts.command === 'check') {
        const files = [];
        let scanned = 0;
        let total = 0;

        let hiddenRunCount = 0;
        /** @type {string[]} */
        const lines = [];
        const findingLine = (label, x) => `${label}:${x.line}:${x.column}  ${hex(x.codePoint)}  ${x.category}`;

        await forEachText((label, text) => {
            scanned++;
            if (!opts.aiConfig) {
                const report = inspect(text, opts.maxFindings, opts.stripBom);
                total += report.total;
                if (report.total === 0) return;
                if (opts.format === 'sarif') fingerprintFindings(label, text, report.findings, cwd);
                files.push({ path: label, ...report });
                for (const x of report.findings) lines.push(findingLine(label, x));
                if (report.truncated) lines.push(`${label}: ${report.total - report.findings.length} more not listed (--max-findings)`);
                return;
            }

            const { report, hiddenRuns, loose, entryCount } = inspectAiConfig(text, opts.maxFindings, opts.stripBom);
            total += report.total;
            hiddenRunCount += report.hiddenRunCount;
            if (report.total === 0) return;
            if (opts.format === 'sarif') fingerprintFindings(label, text, report.findings, cwd);
            files.push({ path: label, ...report });
            // Text output lists each run once, in place of its characters
            const entries = [
                ...hiddenRuns.map((run) => ({ offset: run.offset, text: `${label}:${run.line}:${run.column}  ${hex(run.codePoint)}  ${describeRun(run)}` })),
                ...loose.map((x) => ({ offset: x.offset, text: findingLine(label, x) })),
            ].sort((a, b) => a.offset - b.offset);
            for (const e of entries.slice(0, opts.maxFindings)) lines.push(e.text);
            if (entryCount > opts.maxFindings) lines.push(`${label}: ${entryCount - opts.maxFindings} more not listed (--max-findings)`);
        });

        const kind = opts.aiConfig ? 'AI configuration file' : 'file';
        if (opts.format === 'json') {
            const summary = { files, total, filesScanned: scanned, filesWithFindings: files.length, skipped, excluded, notUtf8, errors };
            if (opts.aiConfig) summary.hiddenRunCount = hiddenRunCount;
            out(JSON.stringify(summary, null, 2));
        } else if (opts.format === 'sarif') {
            out(JSON.stringify(sarifLog(files, { cwd, total, filesScanned: scanned, skipped, excluded, succeeded: errors.length === 0 }), null, 2));
        } else {
            for (const line of lines) out(line);
            if (opts.aiConfig && scanned === 0 && skipped.length === 0 && errors.length === 0) {
                out('No AI configuration files found.');
                if (opts.paths.length === 0 && !process.stdin.isTTY) out('To check piped text, pass "-": text-sanctifier check --ai-config -');
            }
            else if (scanned === 0) out(`Nothing checked${skippedNote()}.`);
            else if (total === 0) out(`No ${opts.aiConfig ? 'hidden text, ' : ''}invisible or control characters in ${plural(scanned, kind)}${skippedNote()}.`);
            else out(`${plural(total, 'finding')}${opts.aiConfig ? ` (${plural(hiddenRunCount, 'hidden run')})` : ''} in ${files.length} of ${plural(scanned, kind)}${skippedNote()}.`);
        }
        return errors.length > 0 ? 2 : total > 0 ? 1 : 0;
    }

    if (opts.command === 'reveal') {
        const many = inputs.length > 1;
        let first = true;
        await forEachText((label, text) => {
            if (many) {
                process.stdout.write(`${first ? '' : '\n'}==> ${label} <==\n`);
                first = false;
            }
            process.stdout.write(revealInvisible(text));
        });
        return errors.length > 0 ? 2 : 0;
    }

    // fix
    const clean = summonSanctifier({
        normalizeSpaces: opts.normalizeSpaces,
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
        const body = leadingBom ? text.slice(1) : text;
        let cleaned;
        if (opts.keepBenign && opts.purgeInvisible) {
            const benign = inspectTextInContext(body, { maxFindings: Infinity }).findings.filter((f) => f.benign);
            let start = 0;
            const parts = [];
            for (const f of benign) {
                parts.push(clean(body.slice(start, f.offset)));
                const end = f.offset + (f.codePoint > 0xFFFF ? 2 : 1);
                parts.push(body.slice(f.offset, end));
                start = end;
            }
            parts.push(clean(body.slice(start)));
            cleaned = parts.join('');
        } else cleaned = clean(body);
        if (leadingBom && !opts.stripBom) cleaned = String.fromCharCode(BOM) + cleaned;

        if (input.path === STDIN && !opts.dryRun) process.stdout.write(cleaned);
        if (cleaned === text) return;

        const before = inspectTextDetailed(text, { maxFindings: 0 }).counts;
        const after = inspectTextDetailed(cleaned, { maxFindings: 0 }).counts;
        // Look-alike spaces that became ordinary spaces were replaced, not removed
        SPACE_LOOKALIKES_REGEX.lastIndex = 0;
        const spacesReplaced = opts.normalizeSpaces ? (text.match(SPACE_LOOKALIKES_REGEX) || []).length : 0;
        before.nonbreaking_space -= spacesReplaced;
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
                addError(label, 'write_failed', `${label}: ${e.code || e.message}`, e.code);
                return;
            }
        }
        files.push({ path: label, spacesReplaced, removed, removedTotal, newlinesNormalized });
    });

    if (opts.format === 'json') {
        report(JSON.stringify({ files, dryRun: opts.dryRun, filesScanned: scanned, filesChanged: files.length, skipped, excluded, errors }, null, 2));
    } else {
        const verb = opts.dryRun ? 'would fix' : 'fixed';
        for (const f of files) {
            const parts = [];
            if (f.spacesReplaced > 0) parts.push(`replaced ${plural(f.spacesReplaced, 'look-alike space')}`);
            if (f.removedTotal > 0) parts.push(`removed ${f.removedTotal} (${formatCounts(f.removed)})`);
            if (f.newlinesNormalized) parts.push('normalized newlines');
            report(`${verb} ${f.path}: ${parts.join('; ')}`);
        }
        report(scanned === 0
            ? `Nothing checked${skippedNote()}.`
            : files.length === 0
                ? `Nothing to fix in ${plural(scanned, 'file')}${skippedNote()}.`
                : `${opts.dryRun ? 'Would change' : 'Changed'} ${files.length} of ${plural(scanned, 'file')}${skippedNote()}.`);
    }
    return errors.length > 0 ? 2 : opts.dryRun && files.length > 0 ? 1 : 0;
}

main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => {
        process.stderr.write(`text-sanctifier: ${e && e.stack ? e.stack : e}\n`);
        process.exitCode = 2;
    }
);
