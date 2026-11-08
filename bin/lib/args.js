import { readFileSync } from 'node:fs';
import { excludeRegExp, STDIN } from './inputs.js';

const VERSION = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

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

export { VERSION, USAGE, UsageError, parseArgs };
