// src/hiddenText.js
//
// Finds runs of the characters used to hide instructions in text a model reads:
// tag characters, variation selectors, invisible operators and the reserved code points
// of the tag plane. Tag runs are decoded
// to the ASCII they spell. Used by `text-sanctifier check --ai-config`, and exported
// as `text-sanctifier/hidden`.
//
// Plain JavaScript with no Node APIs, so it also runs in a browser. src/index.js does
// not import this file, so it stays out of the browser bundle and its size budget.

export { VERSION } from './version.generated.js';

/** @typedef {'tag' | 'variation_selector' | 'invisible_operator' | 'reserved_tag_plane'} HiddenRunKind */

/**
 * @typedef {Object} HiddenRun
 * @property {HiddenRunKind} kind
 * @property {number} offset - UTF-16 index of the first character
 * @property {number} end - UTF-16 index just past the last character
 * @property {number} count - number of code points in the run
 * @property {number} line - 1-based line of the first character (as in inspectTextDetailed)
 * @property {number} column - 1-based column of the first character, in UTF-16 units
 * @property {string} [decoded] - tag runs only: the ASCII the tags spell (see decodeTagText),
 *   at most `maxDecodedLength` UTF-16 units
 * @property {boolean} [decodedTruncated] - tag runs only: true when `decoded` stops short of the run
 */

/**
 * @typedef {Object} HiddenRunCounts
 * @property {number} tag
 * @property {number} variation_selector
 * @property {number} invisible_operator
 * @property {number} reserved_tag_plane
 */

/**
 * @typedef {Object} HiddenTextScan
 * @property {HiddenRun[]} runs - runs that may hide text, in order, at most `maxRuns` long
 * @property {Array<[number, number]>} benign - [offset, end) spans of legitimate
 *   sequences (subdivision flags, a single emoji or text presentation selector), at most `maxRuns` long
 * @property {HiddenRunCounts} counts - every run per kind, listed or not
 * @property {number} total - sum of `counts`
 * @property {number} benignTotal - every benign span, listed or not
 * @property {boolean} truncated - true when runs or benign spans were left out of the lists
 */

/**
 * @typedef {Object} HiddenScanOptions
 * @property {number} [maxRuns=Infinity] - cap on listed runs, and separately on listed benign spans
 *   (non-negative integer or Infinity). Counts stay exact.
 * @property {number} [maxDecodedLength=Infinity] - cap on each run's `decoded` text, in UTF-16 units.
 *   For both, any other value (negative, fractional, NaN, a string) means the default, no cap.
 */

const TAG_FIRST = 0xE0000;
const TAG_LAST = 0xE007F;
const CANCEL_TAG = 0xE007F;
const BLACK_FLAG = 0x1F3F4;

// RGI subdivision flags: U+1F3F4, the tag letters, U+E007F
const SUBDIVISION_FLAGS = new Set(['gbeng', 'gbsct', 'gbwls']);

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
 * Decodes tag characters to the ASCII they shadow: U+E0020–U+E007E become
 * U+0020–U+007E. Anything else (U+E0001 LANGUAGE TAG, U+E007F CANCEL TAG, unassigned
 * tags, other characters) is written as `<U+XXXX>`, so the result is printable.
 * @param {string} text
 * @returns {string}
 */
export function decodeTagText(text) {
    return decodeRange(text, 0, text.length, Infinity).decoded;
}

/**
 * Decodes text[start, end) as decodeTagText does, stopping before the output would
 * pass `limit` UTF-16 units. A `<U+XXXX>` marker is written whole or not at all.
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {number} limit
 * @returns {{ decoded: string, truncated: boolean }}
 */
function decodeRange(text, start, end, limit) {
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

// Whitespace as JavaScript's \s defines it, tested at an index of the text itself,
// so the check allocates nothing.
const SPACE_AT = /\s/y;

/**
 * @param {string} text
 * @param {number} index
 * @returns {boolean}
 */
function isSpaceAt(text, index) {
    SPACE_AT.lastIndex = index;
    return SPACE_AT.test(text);
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
 * Finds runs of tag characters, variation selectors, invisible operators and reserved
 * tag-plane code points (U+E0080–U+E00FF, U+E01F0–U+E0FFF).
 * Consecutive characters of the same kind form one run. Two kinds of sequence are
 * legitimate and listed under `benign` instead of `runs`:
 *  - the subdivision flags of England, Scotland and Wales: U+1F3F4 followed by the
 *    tags for "gbeng", "gbsct" or "gbwls" and U+E007F
 *  - a single U+FE0E or U+FE0F (text or emoji presentation) after another character
 *
 * `line` and `column` are counted as in inspectTextDetailed. Every run and benign
 * span is counted; only the first `maxRuns` of each are listed. With the caps set,
 * memory stays flat however large the input is. One pass over the string, no copy.
 * Set both caps for untrusted input: without them, results grow with the input.
 *
 * @param {string} text
 * @param {HiddenScanOptions} [options]
 * @returns {HiddenTextScan}
 */
export function findHiddenRuns(text, options = {}) {
    const maxRuns = cap(options && options.maxRuns);
    const maxDecodedLength = cap(options && options.maxDecodedLength);

    /** @type {HiddenRun[]} */
    const runs = [];
    /** @type {Array<[number, number]>} */
    const benign = [];
    /** @type {HiddenRunCounts} */
    const counts = { tag: 0, variation_selector: 0, invisible_operator: 0, reserved_tag_plane: 0 };
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
        let last = cp;
        while (i < text.length) {
            const c = /** @type {number} */ (text.codePointAt(i));
            if (kindOf(c) !== kind) break;
            last = c;
            count++;
            i += c > 0xFFFF ? 2 : 1;
        }
        const end = i;

        // A subdivision flag is exactly five tag letters and CANCEL TAG after U+1F3F4.
        const isBenign = kind === 'tag'
            ? count === 6 && last === CANCEL_TAG && offset >= 2 && text.codePointAt(offset - 2) === BLACK_FLAG &&
              SUBDIVISION_FLAGS.has(decodeRange(text, offset, end - 2, Infinity).decoded)
            : kind === 'variation_selector' && count === 1 && (cp === 0xFE0E || cp === 0xFE0F) &&
              offset > 0 && !isSpaceAt(text, offset - 1);
        if (isBenign) {
            benignTotal++;
            if (benign.length < maxRuns) benign.push([offset, end]);
            continue;
        }

        counts[kind]++;
        total++;
        if (runs.length < maxRuns) {
            /** @type {HiddenRun} */
            const run = { kind, offset, end, line, column: offset - lineStart + 1, count };
            if (kind === 'tag') {
                const { decoded, truncated } = decodeRange(text, offset, end, maxDecodedLength);
                run.decoded = decoded;
                run.decodedTruncated = truncated;
            }
            runs.push(run);
        }
    }
    return { runs, benign, counts, total, benignTotal, truncated: total > runs.length || benignTotal > benign.length };
}
