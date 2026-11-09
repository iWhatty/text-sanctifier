import { readFileSync, writeFileSync, lstatSync, fstatSync, chmodSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectTextDetailed, summonSanctifier, revealInvisible } from '../../src/index.js';
import { getNewlineStats } from '../../src/inspectText.js';
import { SPACE_LOOKALIKES_REGEX, INVISIBLE_TRASH_REGEX } from '../../src/sanctifyText.js';
import { benignCategoryAt } from '../../src/contextRules.js';
import { VERSION, USAGE, UsageError, parseArgs } from './args.js';
import { BOM, STDIN, STDIN_LABEL, BINARY_SNIFF_BYTES, toSlash, excludeRegExp, collectInputs, decode, readStdin } from './inputs.js';
import { inspect, inspectAiConfig, describeRun, hex, formatCounts, plural } from './scan.js';
import { fingerprintFindings, sarifLog } from './sarif.js';

/** True when stdin is a pipe or a non-empty file; never reads it. */
function pipedStdin() {
    try {
        const stat = fstatSync(0);
        // Windows reports a pipe as none of the stat kinds, so test what stdin is not.
        return !stat.isCharacterDevice() && !(stat.isFile() && stat.size === 0);
    } catch {
        return false;
    }
}

function textVisitor({ inputs, cwd, opts, addError, warn, skipped, excluded, notUtf8, errors }) {
    /**
     * Reads every input in order, calling `visit(label, text, input)` for each decodable one.
     * @param {(label: string, text: string, input: { path: string, explicit: boolean }) => void} visit
     */
    return async (visit) => {
        let visited = 0;
        for (const input of inputs) {
            const label = input.path === STDIN ? STDIN_LABEL : input.path;
            let bytes;
            try {
                if (input.path !== STDIN && !input.explicit && lstatSync(resolve(cwd, input.path)).isSymbolicLink()) {
                    skipped.push({ path: label, reason: 'symlink' });
                    continue;
                }
                bytes = input.path === STDIN ? await readStdin() : readFileSync(resolve(cwd, input.path));
            } catch (e) {
                addError(label, 'read_failed', `${label}: ${e.code || e.message}`, e.code);
                continue;
            }
            // Stdin and AI configuration text are not skipped merely for a NUL.
            // Known binary signatures and extensions are still reported as skipped.
            let decoded;
            try {
                const signature = bytes.subarray(0, 12).toString('hex');
                const binary = /^(89504e470d0a1a0a|ffd8ff|474946383761|474946383961|255044462d|504b0304|504b0506|504b0708|0061736d|1f8b)/.test(signature) || (signature.startsWith('52494646') && signature.slice(16, 24) === '57454250');
                const extension = /\.(?:png|jpe?g|gif|webp|ico|bmp|tiff?|avif|svgz|woff2?|ttf|otf|eot|zip|gz|tgz|tar|7z|rar|pdf|wasm)$/i.test(label);
                decoded = opts.aiConfig && input.path !== STDIN && (binary || extension) ? { text: null, reason: 'binary' } : decode(bytes, input.path !== STDIN && !opts.aiConfig);
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
                if (wide) reason = 'UTF-16';
                else if (lossy) reason = 'not UTF-8';
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
                warn(`${label}: not valid ${wide ? 'UTF-16' : 'UTF-8'}; checked with invalid bytes read as U+FFFD`);
            }
            visited++;
            visit(label, text, input);
        }
        // A clean result must mean something was read. Finding no AI configuration files is
        // an answer; --ai-config reports that itself.
        if (visited === 0 && errors.length === 0 && !opts.aiConfig && !(excluded.length && !inputs.length)) addError(null, 'nothing_checked', 'Nothing checked.', undefined, false);
    };
}

async function check({ opts, cwd, forEachText, skipped, excluded, notUtf8, errors, out, skippedNote }) {
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
        out(JSON.stringify(sarifLog(files, { cwd, total, filesScanned: scanned, skipped, excluded, notUtf8, errors }), null, 2));
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

async function reveal({ inputs, forEachText, errors }) {
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

async function fix({ opts, inputs, forEachText, cwd, addError, err, out, skipped, excluded, errors, skippedNote }) {
    const clean = summonSanctifier({
        normalizeSpaces: opts.normalizeSpaces,
        purgeInvisibleChars: opts.purgeInvisible && !opts.keepBenign,
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
            // Normalize lone surrogates before deletion can join them. Context is
            // always tested against this whole string, never a chunk's neighbours.
            const safe = summonSanctifier({ normalizeSpaces: opts.normalizeSpaces })(body);
            const parts = [];
            for (let start = 0; start < safe.length;) {
                let end = Math.min(start + 65536, safe.length);
                const last = safe.charCodeAt(end - 1);
                if (last >= 0xD800 && last <= 0xDBFF) end--;
                // Bound V8's temporary match storage even on all-invisible input.
                parts.push(safe.slice(start, end).replace(INVISIBLE_TRASH_REGEX, (run, offset) => {
                    let kept = '';
                    for (const character of run) {
                        if (benignCategoryAt(safe, start + offset)) kept += character;
                        offset += character.length;
                    }
                    return kept;
                }));
                start = end;
            }
            cleaned = clean(parts.join(''));
        } else cleaned = clean(body);
        if (leadingBom && !opts.stripBom) cleaned = String.fromCharCode(BOM) + cleaned;

        if (input.path === STDIN && !opts.dryRun) process.stdout.write(cleaned);
        if (cleaned === text) return;

        const before = inspectTextDetailed(text, { maxFindings: 0 }).counts;
        const after = inspectTextDetailed(cleaned, { maxFindings: 0 }).counts;
        // Look-alike spaces that became ordinary spaces were replaced, not removed
        SPACE_LOOKALIKES_REGEX.lastIndex = 0;
        let spacesReplaced = 0;
        if (opts.normalizeSpaces) while (SPACE_LOOKALIKES_REGEX.exec(text)) spacesReplaced++;
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
            let temp;
            let created = false;
            try {
                const target = resolve(cwd, input.path);
                const stat = lstatSync(target);
                if (stat.isSymbolicLink()) throw new Error('symlink');
                temp = join(dirname(target), `.text-sanctifier-${randomUUID()}`);
                writeFileSync(temp, cleaned, { encoding: 'utf8', flag: 'wx' });
                created = true;
                chmodSync(temp, stat.mode);
                renameSync(temp, target);
            } catch (e) {
                addError(label, 'write_failed', `${label}: ${e.code || e.message}`, e.code);
                return;
            } finally {
                if (created) { try { unlinkSync(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
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

/**
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
export async function main(argv) {
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
    // Never probe a pipe: an agent may leave it open forever. Stdin needs "-".
    if (paths.length === 0 && opts.command === 'check') {
        paths = ['.'];
        // Piped text is not read here, so say so rather than let a clean directory look like a clean pipe.
        if (!opts.aiConfig && pipedStdin()) warn('stdin is not read without "-"; checking the current directory. To check piped text: text-sanctifier check -');
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

    const forEachText = textVisitor({ inputs, cwd, opts, addError, warn, skipped, excluded, notUtf8, errors });
    const skippedNote = () => (skipped.length > 0 ? `; ${plural(skipped.length, 'file')} skipped` : '') + (excluded.length > 0 ? `; ${plural(excluded.length, 'file')} excluded` : '');

    const context = { opts, cwd, inputs, forEachText, skipped, excluded, notUtf8, errors, out, err, addError, skippedNote };
    if (opts.command === 'check') return check(context);
    if (opts.command === 'reveal') return reveal(context);
    return fix(context);
}
