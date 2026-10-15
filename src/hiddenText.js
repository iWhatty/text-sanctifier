// src/hiddenText.js
//
// Finds runs of the characters used to hide instructions in text a model reads:
// tag characters, variation selectors and invisible operators. Tag runs are decoded
// to the ASCII they spell. Used by `text-sanctifier check --ai-config`.
//
// Node and command-line only: src/index.js does not import this file, so it never
// reaches the browser bundle.

/** @typedef {'tag' | 'variation_selector' | 'invisible_operator'} HiddenRunKind */

/**
 * @typedef {Object} HiddenRun
 * @property {HiddenRunKind} kind
 * @property {number} offset - UTF-16 index of the first character
 * @property {number} end - UTF-16 index just past the last character
 * @property {number} count - number of code points in the run
 * @property {string} [decoded] - tag runs only: the ASCII the tags spell (see decodeTagText)
 */

/**
 * @typedef {Object} HiddenTextScan
 * @property {HiddenRun[]} runs - runs that may hide text, in order
 * @property {Array<[number, number]>} benign - [offset, end) spans of legitimate
 *   sequences (subdivision flags, a single emoji or text presentation selector)
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
    let out = '';
    for (const ch of text) {
        const cp = /** @type {number} */ (ch.codePointAt(0));
        out += cp >= 0xE0020 && cp <= 0xE007E ? String.fromCharCode(cp - TAG_FIRST) : `<${hex(cp)}>`;
    }
    return out;
}

/**
 * Finds runs of tag characters, variation selectors and invisible operators.
 * Consecutive characters of the same kind form one run. Two kinds of sequence are
 * legitimate and listed under `benign` instead of `runs`:
 *  - the subdivision flags of England, Scotland and Wales: U+1F3F4 followed by the
 *    tags for "gbeng", "gbsct" or "gbwls" and U+E007F
 *  - a single U+FE0E or U+FE0F (text or emoji presentation) after another character
 * @param {string} text
 * @returns {HiddenTextScan}
 */
export function findHiddenRuns(text) {
    /** @type {HiddenRun[]} */
    const runs = [];
    /** @type {Array<[number, number]>} */
    const benign = [];

    let i = 0;
    while (i < text.length) {
        const cp = /** @type {number} */ (text.codePointAt(i));
        const kind = kindOf(cp);
        if (kind === null) { i += cp > 0xFFFF ? 2 : 1; continue; }

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

        if (kind === 'tag') {
            const body = text.slice(offset, end);
            const afterFlag = offset >= 2 && text.codePointAt(offset - 2) === BLACK_FLAG;
            if (afterFlag && last === CANCEL_TAG && SUBDIVISION_FLAGS.has(decodeTagText(body).slice(0, -'<U+E007F>'.length))) {
                benign.push([offset, end]);
            } else {
                runs.push({ kind, offset, end, count, decoded: decodeTagText(body) });
            }
            continue;
        }
        if (kind === 'variation_selector' && count === 1 && (cp === 0xFE0E || cp === 0xFE0F) &&
            offset > 0 && !/\s/.test(text[offset - 1])) {
            benign.push([offset, end]);
            continue;
        }
        runs.push({ kind, offset, end, count });
    }
    return { runs, benign };
}
