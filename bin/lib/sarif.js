import { resolve, relative, sep, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectTextDetailed } from '../../src/index.js';
import { VERSION } from './args.js';
import { STDIN_LABEL, toSlash } from './inputs.js';
import { describeRun, hex } from './scan.js';

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
const fingerprints = new WeakMap();

function fingerprintFindings(label, text, findings, cwd) {
    const path = label === STDIN_LABEL ? 'stdin' : toSlash(relative(cwd, resolve(cwd, label)));
    let previousLine = 0, start = 0, end = 0;
    let occurrences = new Map();
    let lineHashes = new Map();
    const hashOccurrences = new Map();
    for (const finding of findings) {
        if (finding.line !== previousLine) {
            start = finding.offset - finding.column + 1;
            end = start;
            while (end < text.length && text.charCodeAt(end) !== 10 && text.charCodeAt(end) !== 13) end++;
            occurrences = new Map();
            lineHashes = new Map();
            previousLine = finding.line;
        }
        const index = occurrences.get(finding.category) || 0;
        occurrences.set(finding.category, index + 1);
        // Hash long line content once per category, then append each occurrence.
        // This is byte-for-byte the original JSON-array fingerprint input.
        let prefix = lineHashes.get(finding.category);
        if (!prefix) {
            const fields = JSON.stringify([finding.category, path, text.slice(start, end)]);
            prefix = createHash('sha256').update(fields.slice(0, -1)).update(',');
            lineHashes.set(finding.category, prefix);
        }
        const hash = prefix.copy().update(String(index)).update(']').digest('hex');
        const count = (hashOccurrences.get(hash) || 0) + 1;
        hashOccurrences.set(hash, count);
        fingerprints.set(finding, count === 1 ? hash :
            createHash('sha256').update(JSON.stringify([hash, count])).digest('hex'));
    }
}

/** @param {string} label @param {string} cwd */
function sarifArtifact(label, cwd) {
    if (label === STDIN_LABEL) return { uri: 'stdin', description: { text: 'standard input' } };
    const path = relative(cwd, resolve(cwd, label));
    // Windows paths on another drive cannot be relative to SRCROOT.
    if (isAbsolute(path)) return { uri: pathToFileURL(path).href };
    return { uri: toSlash(path).split('/').map(encodeURIComponent).join('/'), uriBaseId: '%SRCROOT%' };
}

/**
 * Builds a SARIF 2.1.0 log with one result per listed finding; the rule is the category.
 * @param {Array<{ path: string, findings: Array<{ offset: number, line: number, column: number, codePoint: number, category: string }>, hiddenRuns?: Array<{ offset: number, kind: string, count: number, decoded?: string }>, truncated: boolean }>} files
 * @param {{ cwd: string, total: number, filesScanned: number, skipped: Array<{ path: string, reason: string }>, excluded: string[], notUtf8: string[], errors: Array<{ path: string|null, code: string, message: string }> }} info
 */
function sarifLog(files, { cwd, total, filesScanned, skipped, excluded, notUtf8, errors }) {
    const ruleIds = Object.keys(inspectTextDetailed('', { maxFindings: 0 }).counts);
    const rules = ruleIds.map((id) => ({
        id,
        shortDescription: { text: CATEGORY_RULES[id][1] },
        defaultConfiguration: { level: CATEGORY_RULES[id][0] },
    }));

    const results = [];
    for (const f of files) {
        const runAt = new Map((f.hiddenRuns || []).map((run) => [run.offset, run]));
        const artifactLocation = sarifArtifact(f.path, cwd);
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
            tool: { driver: {
                name: 'text-sanctifier', version: VERSION, semanticVersion: VERSION,
                informationUri: INFORMATION_URI, rules,
                notifications: [...new Set(errors.map((error) => error.code))].map((id) => ({ id })),
            } },
            originalUriBaseIds: { '%SRCROOT%': { uri: pathToFileURL(cwd.endsWith(sep) ? cwd : cwd + sep).href } },
            columnKind: 'utf16CodeUnits',
            invocations: [{
                executionSuccessful: errors.length === 0,
                toolExecutionNotifications: errors.map((error) => ({
                    descriptor: { id: error.code },
                    level: 'error',
                    message: { text: error.message },
                    ...(error.path ? { locations: [{ physicalLocation: { artifactLocation: sarifArtifact(error.path, cwd) } }] } : {}),
                })),
            }],
            results,
            properties: {
                total,
                filesScanned,
                filesWithFindings: files.length,
                truncated: files.filter((f) => f.truncated).map((f) => f.path),
                skipped,
                excluded,
                notUtf8,
            },
        }],
    };
}

export { fingerprintFindings, sarifLog };
