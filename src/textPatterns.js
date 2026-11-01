// src/textPatterns.js
//
// Patterns shared by the inspector and the sanitizer. They live apart from
// sanctifyText.js so that importing an inspector does not pull in the sanitizer
// engine and its presets (see the size probes in scripts/check-size.js).


/**
 * Matches any character that is NOT:
 * - Printable ASCII (U+0020–U+007E)
 * - Newline characters: \n (LF), \r (CR)
 * This allows for \n, \r, and \r\n line endings.
 */
export const ASCII_KEYBOARD_SAFE_REGEX = /[^\x20-\x7E\r\n]+/gu;


// Smart apostrophes (single quote variations)
const SMART_SINGLE_QUOTES_REGEX = /[\u2018\u2019\u201A\u201B\u2032\u2035]/g;

// Smart double quotes (including primes and guillemets)
const SMART_DOUBLE_QUOTES_REGEX = /[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB]/g;

// Dash variants: en dash, em dash, horizontal bar, figure dash, minus
const UNICODE_DASHES_REGEX = /[\u2012\u2013\u2014\u2015\u2212]/g;

// Ellipsis character
const ELLIPSIS_REGEX = /\u2026/g;

// Bullets and middle dot
const BULLETS_REGEX = /[\u2022\u00B7]/g;

// Full-width ASCII punctuation: U+FF01 - U+FF5E
const FULLWIDTH_PUNCTUATION_REGEX = /[\uFF01-\uFF5E]/g;

/**
 * Normalizes typographic Unicode punctuation into ASCII equivalents.
 * @param {string} text
 * @returns {string}
 */
export function normalizeTypographicJank(text) {
    return text
        .replace(SMART_SINGLE_QUOTES_REGEX, "'")
        .replace(SMART_DOUBLE_QUOTES_REGEX, '"')
        .replace(UNICODE_DASHES_REGEX, '-')
        .replace(ELLIPSIS_REGEX, '...')
        .replace(BULLETS_REGEX, '*')
        .replace(FULLWIDTH_PUNCTUATION_REGEX, m =>
            String.fromCharCode(m.charCodeAt(0) - 0xFEE0)
        );
}


/**
 * Try Unicode property escape regex (preferred).
 * Fallback to basic emoji ranges if unsupported.
 * Built in a function marked pure, so bundlers drop it when nothing uses it.
 * @returns {RegExp}
 */
function buildEmojiRegex() {
    try {
        return new RegExp(
            '(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\u200D(?:\\p{Extended_Pictographic}|\\w)+)*)',
            'gu'
        );
    } catch {
        // Fallback: wide-range emoji component match (flags, tones, symbols)
        //   * Covers:
        //   * - Emoji base chars (1F300–1FAFF)
        //   * - Dingbats (2700–27BF) like ❌, ✅, ☑
        //   * - Skin tones (1F3FB–1F3FF)
        //   * - ZWJ (200D), variation selectors (FE0F)
        //   * - Regional indicators (1F1E6–1F1FF)
        return /[\u{2700}-\u{27BF}\u{1F300}-\u{1FAFF}\u{1F3FB}-\u{1F3FF}\u200D\uFE0F\u{1F1E6}-\u{1F1FF}]/gu;
    }
}

/** @type {RegExp} */
export const EMOJI_REGEX = /* @__PURE__ */ buildEmojiRegex();
