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
import { benignCategoryAt } from './contextRules.js';

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
 * @throws {RangeError} If maxFindings is invalid, as in inspectTextDetailed.
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
        if (text.charCodeAt(i) < 0x180B) continue;
        const category = benignCategoryAt(text, i);
        if (category) {
            markBenign(i, category);
            if (text.charCodeAt(i) === 0xDB40 && text.charCodeAt(i + 1) >= 0xDD00) benignSupplementarySelectorCount++;
        }
    }

    return { findings, counts: report.counts, total: report.total, truncated: report.truncated, benignCounts, benignTotal, benignSupplementarySelectorCount };
}
