// Internal context rules; not a package entry point.
import { VIRAMA_AT } from './virama.generated.js';
import {
    SUBDIVISION_FLAGS, PICTOGRAPHIC_AT, matchesAt, previousStart,
    isPresentationSelectorAt, isIdeographicSelectorAt, isMongolianSelectorAt,
} from './sequenceRules.js';

// Tested at an index of the text itself, so nothing is allocated per character.
const ARABIC_LETTER_AT = /(?=\p{Script=Arabic})\p{L}/yu;
const MARK_AT = /\p{Mn}/yu;

/**
 * A U+200D is benign between two Extended_Pictographic code points, allowing a
 * skin-tone modifier or VS16 after the first.
 * @param {string} text
 * @param {number} i - index of the U+200D
 */
function isEmojiJoiner(text, i) {
    let p = previousStart(text, i);
    if (p < 0) return false;
    const before = /** @type {number} */ (text.codePointAt(p));
    if (before === 0xFE0F || (before >= 0x1F3FB && before <= 0x1F3FF)) p = previousStart(text, p);
    return p >= 0 && matchesAt(PICTOGRAPHIC_AT, text, p) && matchesAt(PICTOGRAPHIC_AT, text, i + 1);
}

/**
 * IDNA ContextJ (RFC 5892, appendix A.1 and A.2): a U+200C or U+200D is benign right
 * after a virama, and a U+200C also between two Arabic-script letters, skipping
 * nonspacing marks on either side. The second rule approximates the RFC's joining types
 * (L or D before, R or D after), which JavaScript regexes can't express: it also allows
 * a ZWNJ after a right-joining or non-joining Arabic letter, and none in other joining
 * scripts such as Syriac or N'Ko.
 * @param {string} text
 * @param {number} i - index of the U+200C or U+200D
 * @param {boolean} zwnj - true for U+200C
 */
function isScriptJoiner(text, i, zwnj) {
    let p = previousStart(text, i);
    if (p < 0) return false;
    if (matchesAt(VIRAMA_AT, text, p)) return true;
    if (!zwnj) return false;
    while (p >= 0 && matchesAt(MARK_AT, text, p)) p = previousStart(text, p);
    if (p < 0 || !matchesAt(ARABIC_LETTER_AT, text, p)) return false;
    let q = i + 1;
    while (matchesAt(MARK_AT, text, q)) q = MARK_AT.lastIndex;
    return matchesAt(ARABIC_LETTER_AT, text, q);
}

/**
 * Length in UTF-16 units of the subdivision-flag tags starting at `i` (just after a
 * U+1F3F4), or 0 when they are not exactly one of the RGI flags, as findHiddenRuns decides.
 * @param {string} text
 * @param {number} i
 */
function flagTagsAt(text, i) {
    // five tag letters and CANCEL TAG, each a surrogate pair
    if (text.charCodeAt(i + 10) !== 0xDB40 || text.charCodeAt(i + 11) !== 0xDC7F) return 0;
    // more tags after CANCEL TAG make it one longer tag run, which is not a flag
    const after = text.charCodeAt(i + 13);
    if (text.charCodeAt(i + 12) === 0xDB40 && after >= 0xDC00 && after <= 0xDC7F) return 0;
    let letters = '';
    for (let k = 0; k < 10; k += 2) {
        const low = text.charCodeAt(i + k + 1);
        if (text.charCodeAt(i + k) !== 0xDB40 || low < 0xDC61 || low > 0xDC7A) return 0; // tag a-z
        letters += String.fromCharCode(low - 0xDC00);
    }
    return SUBDIVISION_FLAGS.includes(letters) ? 12 : 0;
}


/**
 * Internal context predicate, shared with CLI cleaning. No finding allocation.
 * @param {string} text
 * @param {number} i - original UTF-16 offset
 * @returns {import('./inspectText.js').TrashCategory | null}
 */
export function benignCategoryAt(text, i) {
    const c = text.charCodeAt(i);
    if (c === 0x200D) return isEmojiJoiner(text, i) || isScriptJoiner(text, i, false) ? 'zero_width' : null;
    if (c === 0x200C) return isScriptJoiner(text, i, true) ? 'zero_width' : null;
    if (c === 0xFE0E || c === 0xFE0F) return isPresentationSelectorAt(text, i) ? 'variation_selector' : null;
    if ((c >= 0x180B && c <= 0x180D) || c === 0x180F) return isMongolianSelectorAt(text, i) ? 'variation_selector' : null;
    if (c !== 0xDB40) return null;
    const low = text.charCodeAt(i + 1);
    if (low >= 0xDD00 && low <= 0xDDEF) return isIdeographicSelectorAt(text, i) ? 'variation_selector' : null;
    if (low < 0xDC00 || low > 0xDC7F) return null;
    // A valid flag has exactly six tags. Inspect at most six preceding pairs.
    for (let start = i - 2; start >= 0 && start >= i - 12; start -= 2) {
        if (text.codePointAt(start) === 0x1F3F4 && flagTagsAt(text, start + 2)) return 'tag';
    }
    return null;
}
