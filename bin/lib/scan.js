import { inspectTextDetailed } from '../../src/index.js';
import { scanHiddenSpans } from '../../src/hiddenScan.js';
import { classifyCodeUnit, classifyAstral } from '../../src/categories.generated.js';
import { BOM } from './inputs.js';

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

export { inspect, inspectAiConfig, describeRun, hex, formatCounts, plural };
