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

import { scanHiddenSpans, decodeRange } from './hiddenScan.js';

export { VERSION } from './version.generated.js';

/** @typedef {'tag' | 'variation_selector' | 'invisible_operator' | 'reserved_tag_plane'} HiddenRunKind */

/** @typedef {'ideographic' | 'mongolian'} HiddenRunSequence */

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
 * @property {HiddenRunSequence} [sequence] - a lone selector in a form text-sanctifier/context calls
 *   benign: U+E0100–U+E01EF after an ideograph, or U+180B–U+180D or U+180F after a Mongolian letter.
 *   Still a run, because these can carry data: up to a byte per ideograph.
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
 * @property {HiddenRunCounts} codePointCounts - code points in those runs per kind, listed or not
 * @property {number} supplementarySelectorCount - code points U+E0100–U+E01EF in those runs, which
 *   (unlike the emoji selectors U+FE00–U+FE0F) can carry data; included in codePointCounts.variation_selector
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

/**
 * Decodes tag characters to the ASCII they shadow: U+E0020–U+E007E become
 * U+0020–U+007E. Anything else (U+E0001 LANGUAGE TAG, U+E007F CANCEL TAG, unassigned
 * tags, other characters) is written as `<U+XXXX>`, so the result is printable.
 * @param {string} text
 * @returns {string}
 */
export function decodeTagText(text) {
    if (typeof text !== 'string') throw new TypeError('decodeTagText expects a string input.');
    return decodeRange(text, 0, text.length, Infinity).decoded;
}

/**
 * Finds runs of tag characters, variation selectors, invisible operators and reserved
 * tag-plane code points (U+E0080–U+E00FF, U+E01F0–U+E0FFF).
 * Consecutive characters of the same kind form one run. Two kinds of sequence are
 * legitimate and listed under `benign` instead of `runs`:
 *  - the subdivision flags of England, Scotland and Wales: U+1F3F4 followed by the
 *    tags for "gbeng", "gbsct" or "gbwls" and U+E007F
 *  - a single U+FE0E or U+FE0F (text or emoji presentation) after an
 *    Extended_Pictographic character, or between #, * or a digit and U+20E3 (a keycap),
 *    the same rule as text-sanctifier/context. After a letter it is a run: one selector
 *    per letter can carry a bit each.
 * Lone ideographic and Mongolian selectors stay runs, marked with `sequence`.
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
    return scanHiddenSpans(text, options);
}
