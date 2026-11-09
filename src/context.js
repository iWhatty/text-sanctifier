// src/context.js
//
// inspectTextInContext: inspectTextDetailed plus which findings belong to legitimate
// sequences (emoji joiners and selectors, joiners in Indic and Arabic-script text,
// ideographic variation sequences, Mongolian selectors, subdivision flags), counted
// exactly per category. The categories are
// unchanged; see "Context-aware findings" in DESIGN.md.
//
// Exported as `text-sanctifier/context`. It needs Unicode property escapes in regexes,
// so it lives apart from the core and the browser file and has its own size budget.

import { inspectTextDetailed } from './inspectText.js';
import { VIRAMA_AT } from './virama.generated.js';
import {
    SUBDIVISION_FLAGS, PICTOGRAPHIC_AT, matchesAt, previousStart,
    isPresentationSelectorAt, isIdeographicSelectorAt, isMongolianSelectorAt,
} from './sequenceRules.js';

/** @typedef {import('./inspectText.js').TrashFinding} TrashFinding */
/** @typedef {import('./inspectText.js').TrashCounts} TrashCounts */
/** @typedef {import('./inspectText.js').InspectDetailedOptions} InspectDetailedOptions */

/**
 * @typedef {TrashFinding & { benign: boolean }} ContextFinding
 * A finding with `benign`: true when the character is part of a legitimate sequence.
 */

/**
 * @typedef {Object} ContextReport
 * @property {ContextFinding[]} findings - As in inspectTextDetailed, each with `benign`.
 * @property {TrashCounts} counts - As in inspectTextDetailed: every occurrence, benign or not.
 * @property {number} total - Sum of `counts`.
 * @property {boolean} truncated - True when `total` exceeds `findings.length`.
 * @property {TrashCounts} benignCounts - Benign occurrences per category, listed or not.
 *   `counts[c] - benignCounts[c]` is the number of suspicious characters in category `c`.
 * @property {number} benignTotal - Sum of `benignCounts`.
 * @property {number} benignSupplementarySelectorCount - Benign U+E0100–U+E01EF (VS17–VS256),
 *   part of `benignCounts.variation_selector`. `supplementarySelectorCount` from findHiddenRuns
 *   minus this is the number of suspicious ones.
 */

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
 * Locates invisible and control characters as inspectTextDetailed does, and marks
 * the ones that belong to legitimate sequences as benign:
 * - U+200D between two emoji (Extended_Pictographic), allowing a skin-tone modifier or
 *   VS16 after the first: an emoji ZWJ sequence
 * - U+200C or U+200D right after a virama (Devanagari, Bengali, Malayalam, Sinhala and
 *   the other scripts with a combining class 9 mark), as IDNA ContextJ allows
 * - U+200C between two Arabic-script letters, nonspacing marks skipped (Persian and
 *   others); an approximation of IDNA's joining-type rule
 * - U+FE0E or U+FE0F directly after an emoji, or between 0-9, # or * and U+20E3 (keycap)
 * - one of U+E0100–U+E01EF directly after an ideograph: an ideographic variation sequence
 * - U+180B–U+180D or U+180F directly after a Mongolian letter
 * - the tags of the England, Scotland and Wales flags after U+1F3F4
 * Nothing else is benign: not U+200B, U+2060, U+FEFF, bidi controls or other tags.
 *
 * `counts`, `total` and `truncated` are exactly those of inspectTextDetailed;
 * `benignCounts` counts every benign character, listed or not. Two passes over the
 * string, no copy; memory is flat with `maxFindings` set.
 *
 * @param {string} text
 * @param {InspectDetailedOptions} [options]
 * @returns {ContextReport}
 */
export function inspectTextInContext(text, options = {}) {
    if (typeof text !== 'string') {
        throw new TypeError('inspectTextInContext expects a string input.');
    }
    const report = inspectTextDetailed(text, options);
    const findings = /** @type {ContextFinding[]} */ (report.findings);
    for (const f of findings) f.benign = false;

    /** @type {TrashCounts} */
    const benignCounts = /** @type {TrashCounts} */ ({});
    for (const key of Object.keys(report.counts)) benignCounts[/** @type {keyof TrashCounts} */ (key)] = 0;
    let benignTotal = 0;
    let benignSupplementarySelectorCount = 0;
    let next = 0; // first listed finding not yet passed

    /**
     * @param {number} offset
     * @param {keyof TrashCounts} category
     */
    const markBenign = (offset, category) => {
        benignCounts[category]++;
        benignTotal++;
        while (next < findings.length && findings[next].offset < offset) next++;
        if (next < findings.length && findings[next].offset === offset) findings[next].benign = true;
    };

    for (let i = 0, n = text.length; i < n; i++) {
        const c = text.charCodeAt(i);
        if (c < 0x180B) continue; // the common case: nothing below can be benign

        if (c === 0x200D) {
            if (isEmojiJoiner(text, i) || isScriptJoiner(text, i, false)) markBenign(i, 'zero_width');
        } else if (c === 0x200C) {
            if (isScriptJoiner(text, i, true)) markBenign(i, 'zero_width');
        } else if (c === 0xFE0E || c === 0xFE0F) {
            if (isPresentationSelectorAt(text, i)) markBenign(i, 'variation_selector');
        } else if ((c >= 0x180B && c <= 0x180D) || c === 0x180F) {
            if (isMongolianSelectorAt(text, i)) markBenign(i, 'variation_selector');
        } else if (c === 0xD83C && text.charCodeAt(i + 1) === 0xDFF4) { // U+1F3F4
            const length = flagTagsAt(text, i + 2);
            for (let k = 0; k < length; k += 2) markBenign(i + 2 + k, 'tag');
            i += 1 + length;
        } else if (c === 0xDB40) { // plane 14: U+E0000-U+E03FF
            const low = text.charCodeAt(i + 1);
            if (low >= 0xDD00 && low <= 0xDDEF) { // U+E0100-U+E01EF
                if (isIdeographicSelectorAt(text, i)) {
                    markBenign(i, 'variation_selector');
                    benignSupplementarySelectorCount++;
                }
            }
            if (low >= 0xDC00 && low <= 0xDFFF) i++;
        }
    }

    return { findings, counts: report.counts, total: report.total, truncated: report.truncated, benignCounts, benignTotal, benignSupplementarySelectorCount };
}
