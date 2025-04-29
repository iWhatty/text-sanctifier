// src/sanctifyText.js


/**
 * @typedef {Object} SanctifyOptions
 * @property {boolean} [preserveParagraphs=false]
 * @property {boolean} [collapseSpaces=false]
 * @property {boolean} [nukeControls=false]
*  @property {boolean} [purgeEmojis=false]
 */


/**
 * Summons a customized sanctifier function with pre-bound booleans.
 * 
 * @param {Object} [o={}]
 * @param {boolean} [o.preserveParagraphs=false]
 * @param {boolean} [o.collapseSpaces=false]
 * @param {boolean} [o.nukeControls=false]
 * @param {boolean} [o.purgeEmojis=false]
 * @returns {(text: string) => string}
 */
export function summonSanctifier(defaultOptions = {}) {
    const p = !!defaultOptions.preserveParagraphs;
    const c = !!defaultOptions.collapseSpaces;
    const n = !!defaultOptions.nukeControls;
    const e = !!defaultOptions.purgeEmojis;

    return text => sanctifyText(text, p, c, n, e);
}


// --- Added Presets ---

/**
 * Strict sanitizer:
 * - Collapse spaces
 * - Collapse all newlines
 * - Nuke control characters
 */
summonSanctifier.strict = text => sanctifyText(text, false, true, true, true);


/**
 * Loose sanitizer:
 * - Collapse spaces
 * - Preserve paragraphs
 * - Skip nuking control characters
 */
summonSanctifier.loose = text => sanctifyText(text, true, true);


/**
 * Text Sanctifier
 * 
 * Brutal text normalizer and invisible trash scrubber,
 * configurable to kill whatever ghosts you want dead.
 * 
 * Usage:
 * 
 *   import { sanctifyText } from './utils/sanctifyText';
 * 
 *   const cleaned = sanctifyText(rawText, FLAG_COLLAPSE_SPACES | FLAG_NUKE_CONTROLS);
 * 
 * @param {string | null | undefined} text
 * @param {boolean} [preserveParagraphs=false] - Preserve paragraph breaks (2 newlines) instead of collapsing all.
 * @param {boolean} [collapseSpaces=false] - Collapse multiple spaces into a single space.
 * @param {boolean} [nukeControls=false] - Remove hidden control characters (except whitespace).
 * @param {boolean} [purgeEmojis=false] - Remove emoji characters from the text.
 * @returns {string}
 */
export function sanctifyText(
    text,
    preserveParagraphs = false,
    collapseSpaces = false,
    nukeControls = false,
    purgeEmojis = false
) {

    if (typeof text !== 'string') {
        throw new TypeError('sanctifyText expects a string input.');
    }

    let cleaned = text;

    // Purge invisible Unicode trash (zero-width, non-breaking, bidi junk, etc.)
    cleaned = purgeInvisibleTrash(cleaned);

    // Optionally, remove emojis
    if (purgeEmojis) {
        cleaned = purgeEmojisCharacters(cleaned);
    }

    // Optionally, nuke control characters (excluding whitespace)
    if (nukeControls) {
        cleaned = purgeControlCharacters(cleaned);
    }

    // Normalize line endings to Unix style (\n)
    cleaned = normalizeNewlines(cleaned);

    // Remove spaces/tabs around newlines
    cleaned = trimSpacesAroundNewlines(cleaned);

    // Collapse excessive newlines, Optionally preserve Paragraphs
    cleaned = collapseParagraphs(cleaned, preserveParagraphs);

    // Optionally, Collapse multiple spaces into a single space
    if (collapseSpaces) {
        cleaned = collapseExtraSpaces(cleaned);
    }

    // Final trim
    return cleaned.trim();
}


// --- Micro helpers ---

/**
 * Purges invisible Unicode "trash" characters and removes them.
 * 
 * Targets:
 * - Non-breaking spaces (\u00A0)
 * - Zero-width spaces and miscellaneous Unicode spaces (\u2000–\u200D, \u202F, \u2060, \u3000, \uFEFF)
 * - Left-to-right/right-to-left markers and overrides (\u200E, \u200F, \u202A–\u202E)
 *
 * @param {string} text
 * @returns {string}
 */
const INVISIBLE_TRASH_REGEX = /[\u00A0\u2000-\u200D\u202F\u2060\u3000\uFEFF\u200E\u200F\u202A-\u202E]+/g;
function purgeInvisibleTrash(text) {
    return text.replace(INVISIBLE_TRASH_REGEX, '');
}


/**
 * Removes all emoji characters using Unicode property escapes.
 * Requires support for ES2018+.
 * 
 * @param {string} text
 * @returns {string}
 */
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
function purgeEmojisCharacters(text) {
    return text.replace(EMOJI_REGEX, '');
}


/**
 * Normalizes all line endings to Unix-style (\n).
 * 
 * Converts:
 * - Windows line endings ("\r\n") → "\n"
 * - Old Mac line endings ("\r") → "\n"
 * 
 * Example:
 * "Line1\r\nLine2\rLine3" → "Line1\nLine2\nLine3"
 *
 * @param {string} text
 * @returns {string}
 */
const NORMALIZE_NEWLINES_REGEX = /\r\n?/g;
function normalizeNewlines(text) {
    return text.replace(NORMALIZE_NEWLINES_REGEX, '\n');
}


/**
 * Trims spaces and tabs immediately before and after newlines.
 * 
 * Example: "hello   \n   world" → "hello\nworld"
 *
 * Preserves the newline itself, just removes whitespace around it.
 *
 * @param {string} text
 * @returns {string}
 */
const TRIM_SPACES_AROUND_NEWLINES_REGEX = /[ \t]*(\n+)[ \t]*/g;
function trimSpacesAroundNewlines(text) {
    return text.replace(TRIM_SPACES_AROUND_NEWLINES_REGEX, '$1');
}


/**
 * Collapses excessive newlines based on paragraph preservation settings.
 *
 * - If preserveParagraphs = true:
 *     Collapses 3 or more consecutive newlines → exactly two ("\n\n")
 * - If preserveParagraphs = false:
 *     Collapses 2 or more consecutive newlines → exactly one ("\n")
 * 
 * Example (preserveParagraphs = true):
 * "Line1\n\n\n\nLine2" → "Line1\n\nLine2"
 *
 * @param {string} text
 * @param {boolean} preserveParagraphs - Whether to preserve paragraph breaks (double newlines).
 * @returns {string}
 */
const MULTIPLE_NEWLINES_REGEX = /\n{2,}/g;
const TRIPLE_NEWLINES_REGEX = /\n{3,}/g;

function collapseParagraphs(text, preserveParagraphs) {
    return preserveParagraphs
        ? text.replace(TRIPLE_NEWLINES_REGEX, '\n\n')
        : text.replace(MULTIPLE_NEWLINES_REGEX, '\n');
}


/**
 * Collapses multiple consecutive spaces into a single space.
 * (Does not touch tabs or newlines.)
 * 
 * Example: "hello   world" → "hello world"
 *
 * @param {string} text
 * @returns {string}
 */
const MULTIPLE_SPACES_REGEX = / {2,}/g;
function collapseExtraSpaces(text) {
    return text.replace(MULTIPLE_SPACES_REGEX, ' ');
}


/**
 * Nukes hidden control characters that are invisible and often dangerous.
 * (Excludes necessary whitespace like \n and \t.)
 * 
 * Control characters nuked: 
 *   - ASCII control range (0x00-0x1F, 0x7F)
 *   - Unicode control range (0x80-0x9F)
 *   - RTL/LTR markers (U+200E, U+200F, U+202A–U+202E)
 * 
 * @param {string} text
 * @returns {string}
 */
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F\u200E\u200F\u202A-\u202E]+/g;
function purgeControlCharacters(text) {
    return text.replace(CONTROL_CHARS_REGEX, '');
}
