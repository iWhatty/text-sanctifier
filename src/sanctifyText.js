// src/sanctifyText.js


/**
 * @typedef {Object} SanctifyOptions
 * @property {boolean} [purgeInvisibleChars]
 * @property {boolean} [purgeEmojis]
 * @property {boolean} [nukeControls]
 * @property {boolean} [keyboardOnlyFilter]
 * @property {boolean} [normalizeNewlines]
 * @property {boolean} [trimSpacesAroundNewlines]
 * @property {boolean} [collapseNewLines]
 * @property {boolean} [preserveParagraphs]
 * @property {boolean} [collapseSpaces]
 * @property {boolean} [finalTrim]
 */


/**
 * Summons a customized sanctifier function with pre-bound booleans.
 *
 * Accepts full flag names and returns a text-cleaning function.
 *
 * @param {Object} [defaultOptions={}]
 * @param {boolean} [defaultOptions.purgeInvisibleChars]
 * @param {boolean} [defaultOptions.purgeEmojis]
 * @param {boolean} [defaultOptions.nukeControls]
 * @param {boolean} [defaultOptions.keyboardOnlyFilter]
 * @param {boolean} [defaultOptions.normalizeNewlines]
 * @param {boolean} [defaultOptions.trimSpacesAroundNewlines]
 * @param {boolean} [defaultOptions.collapseNewLines]
 * @param {boolean} [defaultOptions.preserveParagraphs]
 * @param {boolean} [defaultOptions.collapseSpaces]
 * @param {boolean} [defaultOptions.finalTrim]
 * @returns {(text: string) => string}
 */
export function summonSanctifier(defaultOptions = {}) {
    const purgeInvisibleChars = !!defaultOptions.purgeInvisibleChars;
    const purgeEmojis = !!defaultOptions.purgeEmojis;
    const nukeControls = !!defaultOptions.nukeControls;
    const keyboardOnlyFilter = !!defaultOptions.keyboardOnlyFilter;
    const normalizeNewlines = !!defaultOptions.normalizeNewlines;
    const trimSpacesAroundNewlines = !!defaultOptions.trimSpacesAroundNewlines;
    const collapseNewLines = !!defaultOptions.collapseNewLines;
    const preserveParagraphs = !!defaultOptions.preserveParagraphs;
    const collapseSpaces = !!defaultOptions.collapseSpaces;
    const finalTrim = !!defaultOptions.finalTrim;

    return text => sanctifyText(
        text,
        purgeInvisibleChars,
        purgeEmojis,
        nukeControls,
        keyboardOnlyFilter,
        normalizeNewlines,
        trimSpacesAroundNewlines,
        collapseNewLines,
        preserveParagraphs,
        collapseSpaces,
        finalTrim
    );
}

// --- Added Presets ---

/**
 * Strict sanitizer:
 * - Purge emojis
 * - Collapse all newlines
 * - Collapse spaces
 * - Nuke control characters
 */
summonSanctifier.strict = text => sanctifyText(
    text,
    true,   // purgeInvisibleChars
    true,   // purgeEmojis
    true,   // nukeControls
    false,  // keyboardOnlyFilter
    true,   // normalizeNewlines
    true,   // trimSpacesAroundNewlines
    true,   // collapseNewLines
    false,  // preserveParagraphs
    true,   // collapseSpaces
    true    // finalTrim
);


/**
 * Loose sanitizer:
 * - Collapse spaces
 * - Preserve paragraphs
 * - Normalize newlines
 */
summonSanctifier.loose = text => sanctifyText(
    text,
    false,  // purgeInvisibleChars
    false,  // purgeEmojis
    false,  // nukeControls
    false,  // keyboardOnlyFilter
    true,   // normalizeNewlines
    true,   // trimSpacesAroundNewlines
    true,   // collapseNewLines
    true,   // preserveParagraphs
    true,   // collapseSpaces
    true    // finalTrim
);


/**
 * Keyboard-only (with emojis):
 * - Keeps emojis and printable ASCII
 * - Strips non-standard characters
 * - Normalizes typographic trash
 */
summonSanctifier.keyboardOnlyEmoji = text => sanctifyText(
    text,
    false,  // purgeInvisibleChars
    false,  // purgeEmojis
    false,  // nukeControls
    true,   // keyboardOnlyFilter
    true,   // normalizeNewlines
    true,   // trimSpacesAroundNewlines
    false,  // collapseNewLines
    false,  // preserveParagraphs
    false,  // collapseSpaces
    true    // finalTrim
);


/**
 * Keyboard-only (strict):
 * - Removes emojis
 * - Collapses all whitespace
 * - Restricts to printable ASCII only
 */
summonSanctifier.keyboardOnly = text => sanctifyText(
    text,
    true,  // purgeInvisibleChars
    true,   // purgeEmojis
    true,   // nukeControls
    true,   // keyboardOnlyFilter
    true,   // normalizeNewlines
    true,   // trimSpacesAroundNewlines
    true,   // collapseNewLines
    false,  // preserveParagraphs
    true,   // collapseSpaces
    true    // finalTrim
);


/**
 * Text Sanctifier
 * 
 * Brutal text normalizer and invisible trash scrubber,
 * configurable to kill whatever ghosts you want dead.
 * 
 * @param {string | null | undefined} text
 * @param {boolean} [purgeInvisibleChars=false] - Remove ZWSP, NBSP, bidi, etc.
 * @param {boolean} [purgeEmojis=false] - Remove emoji characters entirely.
 * @param {boolean} [nukeControls=false] - Remove non-whitespace control characters.
 * @param {boolean} [keyboardOnlyFilter=false] - Keep printable ASCII and emojis only.
 * @param {boolean} [normalizeNewlines=false] - Convert all newlines to `\n`.
 * @param {boolean} [trimSpacesAroundNewlines=false] - Remove spaces/tabs around newlines.
 * @param {boolean} [collapseNewLines=false] - Collapse `\n` runs (optionally preserve paragraphs).
 * @param {boolean} [preserveParagraphs=false] - Preserve paragraph breaks when collapsing newlines.
 * @param {boolean} [collapseSpaces=false] - Collapse multiple spaces into one.
 * @param {boolean} [finalTrim=false] - `.trim()` the final output (head/tail).
 * @returns {string}
 */
export function sanctifyText(
    text,
    purgeInvisibleChars = false,
    purgeEmojis = false,
    nukeControls = false,
    keyboardOnlyFilter = false,
    normalizeNewlines = false,
    trimSpacesAroundNewlines = false,
    collapseNewLines = false,
    preserveParagraphs = false,
    collapseSpaces = false,
    finalTrim = false,
) {
    if (typeof text !== 'string') {
        throw new TypeError('sanctifyText expects a string input.');
    }

    let cleaned = text;

    //  Purge invisible Unicode trash (zero-width, non-breaking, bidi junk, etc.)
    if (purgeInvisibleChars) cleaned = purgeInvisibleTrash(cleaned);

    // Remove emojis
    if (purgeEmojis) cleaned = purgeEmojisCharacters(cleaned);

    // Nuke control characters (excluding whitespace)
    if (nukeControls) cleaned = purgeControlCharacters(cleaned);

    // Keep only ASCII/emojis
    if (keyboardOnlyFilter) cleaned = purgeNonKeyboardChars(cleaned, purgeEmojis);

    // Normalize line endings to Unix style (\n)
    if (normalizeNewlines) cleaned = normalizeNewlineChars(cleaned);

    // Remove spaces/tabs around newlines
    if (trimSpacesAroundNewlines) cleaned = trimSpacesAroundNewlineChars(cleaned);

    // Collapse excessive newlines, Optionally preserve Paragraphs
    if (collapseNewLines) cleaned = collapseMultipleNewLines(cleaned, preserveParagraphs);

    // Collapse multiple spaces into a single space
    if (collapseSpaces) cleaned = collapseExtraSpaces(cleaned);

    // Final trim, return Sanctified Text
    return finalTrim ? cleaned.trim() : cleaned;
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
export const INVISIBLE_TRASH_REGEX = /[\u00A0\u2000-\u200D\u202F\u2060\u3000\uFEFF\u200E\u200F\u202A-\u202E]+/g;
function purgeInvisibleTrash(text) {
    return text.replace(INVISIBLE_TRASH_REGEX, '');
}


/**
 * Matches any character that is NOT:
 * - Printable ASCII (U+0020–U+007E)
 * - Newline characters: \n (LF), \r (CR)
 * This allows for \n, \r, and \r\n line endings.
 */
export const ASCII_KEYBOARD_SAFE_REGEX = /[^\x20-\x7E\r\n]+/gu;

/**
 * Removes all non-keyboard characters, preserving:
 * - Printable ASCII (0x20–0x7E)
 * - Emojis (Unicode Emoji_Presentation + FE0F variants)
 */
function purgeNonKeyboardChars(text, purgeEmojis = false) {
    const normalized = normalizeTypographicJank(text);

    if (purgeEmojis) {
        return normalized.replace(ASCII_KEYBOARD_SAFE_REGEX, '');
    }

    // Remove non-ASCII unless it's a valid emoji
    return normalized.replace(ASCII_KEYBOARD_SAFE_REGEX, m =>
        m.match(EMOJI_REGEX) ? m : ''
    );
}


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



export let EMOJI_REGEX;

/**
 * Try Unicode property escape regex (preferred).
 * Fallback to basic emoji range if unsupported.
 */
try {
    EMOJI_REGEX = new RegExp(
        '(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\u200D(?:\\p{Extended_Pictographic}|\\w)+)*)',
        'gu'
    );
} catch {
    // Fallback: less precise but safe
    EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}]/gu;
}


/**
 * Removes all emoji characters using Unicode property escapes.
 * Supports modern environments (Unicode v13+) with fallback.
 *
 * @param {string} text
 * @returns {string}
 */
function purgeEmojisCharacters(text) {
    return text.replace(EMOJI_REGEX, '');
}


/**
 * Normalizes all line endings to a consistent format.
 * 
 * Converts:
 * - Windows ("\r\n"), Old Mac ("\r"), Unix ("\n")
 * Into the specified newline format (default: Unix "\n").
 *
 * @param {string} text - Input string to normalize.
 * @param {string} [normalized='\n'] - Target newline style (e.g. '\n', '\r\n').
 * @returns {string}
 */
const NORMALIZE_NEWLINES_REGEX = /\r\n|\r|\n/g;
function normalizeNewlineChars(text, normalized = '\n') {
    return text.replace(NORMALIZE_NEWLINES_REGEX, normalized);
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
function trimSpacesAroundNewlineChars(text) {
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

function collapseMultipleNewLines(text, preserveParagraphs) {
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
export const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F\u200E\u200F\u202A-\u202E]+/g;
function purgeControlCharacters(text) {
    return text.replace(CONTROL_CHARS_REGEX, '');
}
