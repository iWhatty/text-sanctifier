// src/sequenceRules.js
//
// Internal: the legitimate-sequence rules that text-sanctifier/context and
// text-sanctifier/hidden share, so the two can't disagree. Not a package entry point.
// Each rule looks at the neighbours of one index with sticky regexes, so nothing is
// allocated per character.

/** RGI subdivision flags: U+1F3F4, the tags for these letters, U+E007F */
export const SUBDIVISION_FLAGS = ['gbeng', 'gbsct', 'gbwls'];

export const PICTOGRAPHIC_AT = /\p{Extended_Pictographic}/yu;
const IDEOGRAPHIC_AT = /\p{Ideographic}/yu;

/**
 * @param {RegExp} re - sticky
 * @param {string} text
 * @param {number} index
 */
export function matchesAt(re, text, index) {
    re.lastIndex = index;
    return re.test(text);
}

/**
 * Index where the code point that ends just before `index` starts, or -1.
 * @param {string} text
 * @param {number} index
 */
export function previousStart(text, index) {
    if (index <= 0) return -1;
    const low = text.charCodeAt(index - 1);
    if (low >= 0xDC00 && low <= 0xDFFF && index >= 2) {
        const high = text.charCodeAt(index - 2);
        if (high >= 0xD800 && high <= 0xDBFF) return index - 2;
    }
    return index - 1;
}

/**
 * A U+FE0E or U+FE0F at `index` is legitimate after an Extended_Pictographic code
 * point, or between #, * or a digit and U+20E3 (a keycap).
 * @param {string} text
 * @param {number} index
 */
export function isPresentationSelectorAt(text, index) {
    const p = previousStart(text, index);
    if (p < 0) return false;
    const before = text.charCodeAt(p);
    if ((before === 0x23 || before === 0x2A || (before >= 0x30 && before <= 0x39)) && text.charCodeAt(index + 1) === 0x20E3) return true;
    return matchesAt(PICTOGRAPHIC_AT, text, p);
}

/**
 * One of U+E0100–U+E01EF at `index` is legitimate directly after an ideograph.
 * @param {string} text
 * @param {number} index
 */
export function isIdeographicSelectorAt(text, index) {
    const p = previousStart(text, index);
    return p >= 0 && matchesAt(IDEOGRAPHIC_AT, text, p);
}

/**
 * U+180B–U+180D or U+180F at `index` is legitimate directly after a Mongolian letter.
 * @param {string} text
 * @param {number} index
 */
export function isMongolianSelectorAt(text, index) {
    const c = text.charCodeAt(index - 1);
    return (c >= 0x1820 && c <= 0x1878) || (c >= 0x1880 && c <= 0x1884) || (c >= 0x1887 && c <= 0x18A8) || c === 0x18AA;
}
