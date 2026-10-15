// ./src/inspectText.js

import {
    CONTROL_CHARS_REGEX,
    INVISIBLE_TRASH_REGEX,
    EMOJI_REGEX,
    ASCII_KEYBOARD_SAFE_REGEX,
    normalizeTypographicJank,
} from './sanctifyText.js';

/** @typedef {import('./sanctifyText.js').SanctifyOptions} SanctifyOptions */


/**
* @typedef {Object} UnicodeTrashReport
* @property {boolean} hasControlChars
* @property {boolean} hasInvisibleChars
* @property {boolean} hasMixedNewlines
* @property {'LF'|'CRLF'|'CR'|'Mixed'|null} newlineStyle
* @property {boolean} hasEmojis
* @property {boolean} hasNonKeyboardChars
* @property {string[]} summary
*/


/**
 * Safe `.test()` for global/sticky regexes.
 * Global regexes mutate `lastIndex`, which makes `.test()` unreliable across calls.
 * @param {RegExp} re
 * @param {string} s
 */
function stableTest(re, s) {
    re.lastIndex = 0;
    return re.test(s);
}

/**
 * Returns true if text contains any non-keyboard characters (excluding emojis),
 * after typographic normalization.
 *
 * "Keyboard" here means:
 * - Printable ASCII (0x20–0x7E)
 * - CR/LF
 * - Emojis (per EMOJI_REGEX)
 *
 * @param {string} text
 * @returns {boolean}
 */
function hasNonKeyboardCharsExcludingEmoji(text) {
    const normalized = normalizeTypographicJank(text);

    // Fast path: no non-ascii runs => no non-keyboard chars
    if (!stableTest(ASCII_KEYBOARD_SAFE_REGEX, normalized)) return false;

    // Walk code points so we can distinguish emoji from other non-ascii safely
    for (const ch of normalized) {
        // allowed: ASCII printable + newlines
        if (ch === '\n' || ch === '\r' || (ch >= ' ' && ch <= '~')) continue;

        // allowed: emoji
        if (stableTest(EMOJI_REGEX, ch)) continue;

        // anything else non-ascii is "non-keyboard"
        return true;
    }

    return false;
}

/**
 * Detects textual "trash" or anomalies in a given string.
 * @param {string} text @returns {UnicodeTrashReport}
 */
export function inspectText(text) {
    if (typeof text !== 'string') {
        throw new TypeError('inspectText expects a string input.');
    }

    const summary = [];
    const report = {
        hasControlChars: false,
        hasInvisibleChars: false,
        hasMixedNewlines: false,
        newlineStyle: null,
        hasEmojis: false,
        hasNonKeyboardChars: false,
        summary,
    };

    const flag = (condition, key, message) => {
        if (condition) {
            report[key] = true;
            summary.push(message);
        }
    };

    // === Pattern Checks ===
    flag(stableTest(CONTROL_CHARS_REGEX, text), 'hasControlChars', 'Control characters detected.');
    flag(stableTest(INVISIBLE_TRASH_REGEX, text), 'hasInvisibleChars', 'Invisible Unicode characters detected.');
    flag(stableTest(EMOJI_REGEX, text), 'hasEmojis', 'Emojis detected.');

    // === Newline Analysis ===
    const { mixed, types } = getNewlineStats(text);
    report.hasMixedNewlines = mixed;
    report.newlineStyle = mixed ? 'Mixed' : types[0] || null;

    if (report.newlineStyle) {
        summary.push(
            mixed ? 'Mixed newline styles detected.' : `Consistent newline style: ${report.newlineStyle}`
        );
    }

    // === Non-keyboard characters (excluding emojis) ===
    flag(
        hasNonKeyboardCharsExcludingEmoji(text),
        'hasNonKeyboardChars',
        'Non-keyboard characters detected.'
    );

    return report;
}

/**
 * @typedef {'bidi_control'|'zero_width'|'nonbreaking_space'|'bom'|'nul'|'c0_control'|'c1_control'|'invisible_format'|'hangul_filler'|'variation_selector'|'tag'} TrashCategory
 */

/**
 * One located character.
 * - `offset`: 0-based UTF-16 index into the input (a JS string index); for a code point
 *   above U+FFFF, the index of its high surrogate.
 * - `line`: 1-based; lines end at LF, CR, or CRLF (counted once).
 * - `column`: 1-based, in UTF-16 code units from the start of the line.
 * - `atStart`: present on `bom` findings only; true at offset 0, where a BOM is legitimate.
 *
 * @typedef {Object} TrashFinding
 * @property {number} offset
 * @property {number} line
 * @property {number} column
 * @property {number} codePoint
 * @property {TrashCategory} category
 * @property {boolean} [atStart]
 */

/**
 * @typedef {Object} TrashCounts
 * @property {number} bidi_control
 * @property {number} zero_width
 * @property {number} nonbreaking_space
 * @property {number} bom
 * @property {number} nul
 * @property {number} c0_control
 * @property {number} c1_control
 * @property {number} invisible_format
 * @property {number} hangul_filler
 * @property {number} variation_selector
 * @property {number} tag
 */

/**
 * @typedef {Object} DetailedTrashReport
 * @property {TrashFinding[]} findings - In offset order, at most `maxFindings` long.
 * @property {TrashCounts} counts - Every occurrence per category, listed or not.
 * @property {number} total - Sum of `counts`.
 * @property {boolean} truncated - True when `total` exceeds `findings.length`.
 */

/**
 * @typedef {Object} InspectDetailedOptions
 * @property {number} [maxFindings=100] - Cap on listed findings (non-negative integer or Infinity).
 *   Each listed finding is an object, so memory grows with the number listed; 0 builds none (counts only).
 */

const DEFAULT_MAX_FINDINGS = 100;

/**
 * Category of one BMP code point (one UTF-16 code unit), or null when it is not trash.
 * Tab, LF and CR are whitespace, not trash. DEL (U+007F) is counted with the C0 controls.
 * Surrogates return null; the caller pairs them and uses classifyAstral.
 * @param {number} c
 * @returns {TrashCategory|null}
 */
function classifyCodeUnit(c) {
    if (c < 0x80) {
        if (c === 0) return 'nul';
        if (c < 0x20) return c === 0x09 || c === 0x0A || c === 0x0D ? null : 'c0_control';
        return c === 0x7F ? 'c0_control' : null;
    }
    if (c <= 0x9F) return 'c1_control';
    if (c === 0xA0) return 'nonbreaking_space';
    if (c === 0xAD || c === 0x034F || c === 0x180E) return 'invisible_format';
    if (c === 0x061C) return 'bidi_control';
    if (c === 0x115F || c === 0x1160) return 'hangul_filler';
    if (c < 0x2000) return null;
    if (c <= 0x200A) return 'nonbreaking_space';
    if (c <= 0x200D) return 'zero_width';
    if (c <= 0x200F) return 'bidi_control';
    if (c >= 0x202A && c <= 0x202E) return 'bidi_control';
    if (c === 0x202F || c === 0x205F) return 'nonbreaking_space';
    if (c === 0x2060) return 'zero_width';
    if (c >= 0x2061 && c <= 0x2064) return 'invisible_format';
    if (c >= 0x2066 && c <= 0x2069) return 'bidi_control';
    if (c === 0x3000) return 'nonbreaking_space';
    if (c === 0x3164 || c === 0xFFA0) return 'hangul_filler';
    if (c >= 0xFE00 && c <= 0xFE0F) return 'variation_selector';
    if (c === 0xFEFF) return 'bom';
    return null;
}

/**
 * Category of a code point above U+FFFF, or null when it is not trash.
 * @param {number} cp
 * @returns {TrashCategory|null}
 */
function classifyAstral(cp) {
    if (cp >= 0xE0000 && cp <= 0xE007F) return 'tag';
    if (cp >= 0xE0100 && cp <= 0xE01EF) return 'variation_selector';
    return null;
}

/** High surrogate of U+E0000–U+E03FF, the only astral block with trash (tags, VS17–VS256). */
const TRASH_HIGH_SURROGATE = 0xDB40;

/**
 * Locates invisible and control characters, one finding per character.
 *
 * Categories:
 * - `bidi_control`: U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069
 * - `zero_width`: U+200B–U+200D, U+2060
 * - `nonbreaking_space`: non-breaking and typographic spaces U+00A0, U+2000–U+200A, U+202F, U+205F, U+3000
 * - `bom`: U+FEFF (`atStart` says whether it sits at offset 0)
 * - `nul`: U+0000
 * - `c0_control`: U+0001–U+001F except tab, LF and CR; and U+007F
 * - `c1_control`: U+0080–U+009F
 * - `invisible_format`: soft hyphen U+00AD, U+034F, U+180E, invisible operators U+2061–U+2064
 * - `hangul_filler`: U+115F, U+1160, U+3164, U+FFA0 (letters that render blank)
 * - `variation_selector`: U+FE00–U+FE0F, U+E0100–U+E01EF (including VS16 in emoji)
 * - `tag`: U+E0000–U+E007F (tag characters, used for "ASCII smuggling")
 *
 * `codePoint` is the full code point; `offset` and `column` count UTF-16 units.
 * Every occurrence is counted; only the first `maxFindings` are listed.
 * One pass over the string, no regex, no copy.
 *
 * @param {string} text
 * @param {InspectDetailedOptions} [options]
 * @returns {DetailedTrashReport}
 */
export function inspectTextDetailed(text, options = {}) {
    if (typeof text !== 'string') {
        throw new TypeError('inspectTextDetailed expects a string input.');
    }

    const requested = options && options.maxFindings;
    const maxFindings =
        requested === Infinity || (Number.isInteger(requested) && requested >= 0)
            ? requested
            : DEFAULT_MAX_FINDINGS;

    /** @type {TrashCounts} */
    const counts = {
        bidi_control: 0,
        zero_width: 0,
        nonbreaking_space: 0,
        bom: 0,
        nul: 0,
        c0_control: 0,
        c1_control: 0,
        invisible_format: 0,
        hangul_filler: 0,
        variation_selector: 0,
        tag: 0,
    };
    /** @type {TrashFinding[]} */
    const findings = [];
    let total = 0;
    let line = 1;
    let lineStart = 0;

    for (let i = 0, n = text.length; i < n; i++) {
        const c = text.charCodeAt(i);

        // Printable ASCII: the common case
        if (c >= 0x20 && c < 0x7F) continue;

        if (c === 0x0A) {
            line++;
            lineStart = i + 1;
            continue;
        }
        if (c === 0x0D) {
            // CRLF ends the line at its LF
            if (text.charCodeAt(i + 1) !== 0x0A) {
                line++;
                lineStart = i + 1;
            }
            continue;
        }

        const offset = i;
        let codePoint = c;
        let category;
        if (c === TRASH_HIGH_SURROGATE) {
            const low = text.charCodeAt(i + 1);
            if (!(low >= 0xDC00 && low <= 0xDFFF)) continue; // lone surrogate
            codePoint = 0x10000 + ((c - 0xD800) << 10) + (low - 0xDC00);
            category = classifyAstral(codePoint);
            i++; // the low surrogate is part of this code point
        } else {
            category = classifyCodeUnit(c);
        }
        if (category === null) continue;

        counts[category]++;
        total++;
        if (findings.length < maxFindings) {
            /** @type {TrashFinding} */
            const finding = { offset, line, column: offset - lineStart + 1, codePoint, category };
            if (category === 'bom') finding.atStart = offset === 0;
            findings.push(finding);
        }
    }

    return { findings, counts, total, truncated: total > findings.length };
}

/**
 * @typedef {Object} NewlineStats
 * @property {number} crlf - CR LF pairs.
 * @property {number} cr - CRs not followed by LF.
 * @property {number} lf - LFs not preceded by CR.
 * @property {('CRLF'|'CR'|'LF')[]} types - Styles present, in the order CRLF, CR, LF.
 * @property {boolean} mixed - True when more than one style is present.
 */

/**
 * Counts each newline style in one pass, with no regex and no copy.
 * @param {string} text
 * @returns {NewlineStats}
 */
export function getNewlineStats(text) {
    if (typeof text !== 'string') {
        throw new TypeError('getNewlineStats expects a string input.');
    }

    // One counting pass: a CR followed by LF is one CRLF; any other CR or LF stands alone.
    let crlf = 0;
    let cr = 0;
    let lf = 0;

    for (let i = 0, n = text.length; i < n; i++) {
        const c = text.charCodeAt(i);
        if (c === 0x0D) {
            if (text.charCodeAt(i + 1) === 0x0A) {
                crlf++;
                i++;
            } else {
                cr++;
            }
        } else if (c === 0x0A) {
            lf++;
        }
    }

    const count = { crlf, cr, lf };

    const types = [];
    if (count.crlf > 0) types.push('CRLF');
    if (count.cr > 0) types.push('CR');
    if (count.lf > 0) types.push('LF');

    return {
        ...count,
        types,
        mixed: types.length > 1,
    };
}

/**
 * Creates defaultOptions for summonSanctifier based on inspectText result
 * @param {!UnicodeTrashReport} report
 * @return {!SanctifyOptions}
 */
export function getRecommendedSanctifierOptions(report) {
    return {
        purgeInvisibleChars: report.hasInvisibleChars,
        purgeEmojis: report.hasEmojis,
        nukeControls: report.hasControlChars,
        keyboardOnlyFilter: report.hasNonKeyboardChars,
        normalizeNewlines:
            report.hasMixedNewlines || report.newlineStyle === 'CRLF' || report.newlineStyle === 'CR',
    };
}