// Internal hidden-span scanner; not a package entry point.

/**
 * @typedef {import('./hiddenText.js').HiddenRunKind} HiddenRunKind
 * @typedef {import('./hiddenText.js').HiddenRun} HiddenRun
 * @typedef {import('./hiddenText.js').HiddenRunSequence} HiddenRunSequence
 * @typedef {import('./hiddenText.js').HiddenRunCounts} HiddenRunCounts
 * @typedef {import('./hiddenText.js').HiddenTextScan} HiddenTextScan
 * @typedef {import('./hiddenText.js').HiddenScanOptions} HiddenScanOptions
 */

import { SUBDIVISION_FLAGS, isPresentationSelectorAt, isIdeographicSelectorAt, isMongolianSelectorAt } from './sequenceRules.js';

const TAG_FIRST = 0xE0000;
const TAG_LAST = 0xE007F;
const CANCEL_TAG = 0xE007F;
const BLACK_FLAG = 0x1F3F4;

/**
 * @param {number} cp
 * @returns {HiddenRunKind | null}
 */
function kindOf(cp) {
    if (cp >= TAG_FIRST && cp <= TAG_LAST) return 'tag';
    if ((cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF) ||
        (cp >= 0x180B && cp <= 0x180D) || cp === 0x180F) return 'variation_selector';
    if (cp >= 0x2061 && cp <= 0x2064) return 'invisible_operator';
    // Unassigned and default ignorable: U+E0080-U+E00FF and U+E01F0-U+E0FFF
    if (cp >= 0xE0080 && cp <= 0xE0FFF) return 'reserved_tag_plane';
    return null;
}

/** @param {number} cp */
const hex = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/**
 * Decodes text[start, end) as decodeTagText does, stopping before the output would
 * pass `limit` UTF-16 units. A `<U+XXXX>` marker is written whole or not at all.
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {number} limit
 * @returns {{ decoded: string, truncated: boolean }}
 */
export function decodeRange(text, start, end, limit) {
    let out = '';
    let i = start;
    while (i < end) {
        const cp = /** @type {number} */ (text.codePointAt(i));
        const piece = cp >= 0xE0020 && cp <= 0xE007E ? String.fromCharCode(cp - TAG_FIRST) : `<${hex(cp)}>`;
        if (out.length + piece.length > limit) return { decoded: out, truncated: true };
        out += piece;
        i += cp > 0xFFFF ? 2 : 1;
    }
    return { decoded: out, truncated: false };
}

/**
 * The legitimate sequence a lone selector at `index` could belong to, by the same rules
 * as text-sanctifier/context. It stays a run: unlike U+FE0E and U+FE0F, these selectors
 * have enough values to spell data, up to a byte per ideograph.
 * @param {string} text
 * @param {number} index
 * @param {number} cp - the selector
 * @returns {HiddenRunSequence | null}
 */
function sequenceOf(text, index, cp) {
    if (cp >= 0xE0100 && cp <= 0xE01EF) return isIdeographicSelectorAt(text, index) ? 'ideographic' : null;
    if (cp > 0x180F) return null;
    return isMongolianSelectorAt(text, index) ? 'mongolian' : null;
}

/**
 * A cap option: a non-negative integer or Infinity; anything else means no cap.
 * @param {unknown} value
 * @returns {number}
 */
function cap(value) {
    return typeof value === 'number' && (value === Infinity || (Number.isInteger(value) && value >= 0))
        ? value
        : Infinity;
}

/**
 * @param {string} text
 * @param {HiddenScanOptions} [options]
 * @param {(span: {offset: number, end: number, benign: boolean, kind: HiddenRunKind}) => void} [onSpan] - internal streaming visitor
 * @returns {HiddenTextScan}
 */
export function scanHiddenSpans(text, options = {}, onSpan) {
    if (typeof text !== 'string') throw new TypeError('findHiddenRuns expects a string input.');
    const maxRuns = cap(options && options.maxRuns);
    const maxDecodedLength = cap(options && options.maxDecodedLength);

    /** @type {HiddenRun[]} */
    const runs = [];
    /** @type {Array<[number, number]>} */
    const benign = [];
    /** @type {HiddenRunCounts} */
    const counts = { tag: 0, variation_selector: 0, invisible_operator: 0, reserved_tag_plane: 0 };
    /** @type {HiddenRunCounts} */
    const codePointCounts = { tag: 0, variation_selector: 0, invisible_operator: 0, reserved_tag_plane: 0 };
    let supplementarySelectorCount = 0;
    let total = 0;
    let benignTotal = 0;
    let line = 1;
    let lineStart = 0;

    let i = 0;
    while (i < text.length) {
        const cp = /** @type {number} */ (text.codePointAt(i));
        const kind = kindOf(cp);
        if (kind === null) {
            if (cp === 0x0A || (cp === 0x0D && text.charCodeAt(i + 1) !== 0x0A)) { // CRLF ends at its LF
                line++;
                lineStart = i + 1;
            }
            i += cp > 0xFFFF ? 2 : 1;
            continue;
        }

        const offset = i;
        let count = 0;
        let supplementary = 0;
        let last = cp;
        while (i < text.length) {
            const c = /** @type {number} */ (text.codePointAt(i));
            if (kindOf(c) !== kind) break;
            last = c;
            count++;
            if (c >= 0xE0100 && c <= 0xE01EF) supplementary++;
            i += c > 0xFFFF ? 2 : 1;
        }
        const end = i;

        // A subdivision flag is exactly five tag letters and CANCEL TAG after U+1F3F4.
        const isBenign = kind === 'tag'
            ? count === 6 && last === CANCEL_TAG && offset >= 2 && text.codePointAt(offset - 2) === BLACK_FLAG &&
              SUBDIVISION_FLAGS.includes(decodeRange(text, offset, end - 2, Infinity).decoded)
            : kind === 'variation_selector' && count === 1 && (cp === 0xFE0E || cp === 0xFE0F) &&
              isPresentationSelectorAt(text, offset);
        if (onSpan) onSpan({ offset, end, benign: isBenign, kind });
        if (isBenign) {
            benignTotal++;
            if (benign.length < maxRuns) benign.push([offset, end]);
            continue;
        }

        counts[kind]++;
        codePointCounts[kind] += count;
        supplementarySelectorCount += supplementary;
        total++;
        if (runs.length < maxRuns) {
            /** @type {HiddenRun} */
            const run = { kind, offset, end, line, column: offset - lineStart + 1, count };
            if (kind === 'tag') {
                const { decoded, truncated } = decodeRange(text, offset, end, maxDecodedLength);
                run.decoded = decoded;
                run.decodedTruncated = truncated;
            } else if (kind === 'variation_selector' && count === 1) {
                const sequence = sequenceOf(text, offset, cp);
                if (sequence) run.sequence = sequence;
            }
            runs.push(run);
        }
    }
    return { runs, benign, counts, codePointCounts, supplementarySelectorCount, total, benignTotal, truncated: total > runs.length || benignTotal > benign.length };
}
