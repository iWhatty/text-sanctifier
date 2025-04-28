


/**
 * @typedef {Object} SanctifyOptions
 * @property {boolean} [preserveParagraphs=false]
 * @property {boolean} [collapseSpaces=false]
 * @property {boolean} [nukeControls=false]
 */

/**
 * Summons a customized sanctifier function with default options pre-bound.
 * 
 * Usage:
 * 
 *   const sanitize = summonSanctifier({ preserveParagraphs: true, collapseSpaces: true });
 *   const cleaned = sanitize(rawText);
 *
 * @param {SanctifyOptions} [defaultOptions]
 * @returns {(text: string) => string} A function that sanitizes text with the pre-bound options.
 */
export function summonSanctifier(defaultOptions = {}) {
    return function (text) {
        return sanctifyText(text, defaultOptions);
    };
}



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
 *   const cleaned = sanctifyText(rawText, { preserveParagraphs: true, collapseSpaces: true, nukeControls: true });
 * 
 * @param {string | null | undefined} text
 * @param {Object} [options]
 * @param {boolean} [options.preserveParagraphs=false] - Preserve paragraph breaks (2 newlines) instead of collapsing all.
 * @param {boolean} [options.collapseSpaces=false] - Collapse multiple spaces into a single space.
 * @param {boolean} [options.nukeControls=false] - Remove hidden control characters (except whitespace).
 * @returns {string}
 */
export function sanctifyText(text, {
    preserveParagraphs = false,
    collapseSpaces = false,
    nukeControls = false,
} = {}) {
    if (typeof text !== 'string') {
        throw new TypeError('sanctifyText expects a string input.');
    }

    let cleaned = text;

    // Step 0: Purge invisible Unicode trash (zero-width, non-breaking, etc.)
    cleaned = purgeInvisibleTrash(cleaned);

    // Step 1: Normalize line endings to Unix style (\n)
    cleaned = normalizeNewlines(cleaned);

    // Step 2: Remove spaces/tabs around newlines
    cleaned = trimSpacesAroundNewlines(cleaned);

    // Step 3: Collapse excessive newlines
    cleaned = collapseParagraphs(cleaned, preserveParagraphs);

    if (collapseSpaces) {
        // Step 4: Collapse multiple spaces into single space
        cleaned = collapseExtraSpaces(cleaned);
    }

    if (nukeControls) {
        // Step 5: Nuke hidden control characters (excluding whitespace)
        cleaned = purgeControlCharacters(cleaned);
    }

    // Step 6: Final trim
    return cleaned.trim();
}





// --- Micro helpers ---


/**
 * Purges invisible Unicode "trash" characters and replaces them with a normal space.
 * 
 * Targets:
 * - Non-breaking spaces (\u00A0)
 * - Zero-width spaces and miscellaneous Unicode spaces (\u2000–\u200D, \u202F, \u2060, \u3000, \uFEFF)
 * 
 * Example:
 * "Hello\u200BWorld" → "Hello World"
 *
 * @param {string} text
 * @returns {string}
 */
const INVISIBLE_TRASH_REGEX = /[\u00A0\u2000-\u200D\u202F\u2060\u3000\uFEFF]+/g;
function purgeInvisibleTrash(text) {
    return text.replace(INVISIBLE_TRASH_REGEX, ' ');
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
const TRIM_SPACES_AROUND_NEWLINES_REGEX = /[ \t]*\n+[ \t]*/g;
function trimSpacesAroundNewlines(text) {
    return text.replace(TRIM_SPACES_AROUND_NEWLINES_REGEX, '\n');
}


/**
 * Collapses excessive newlines based on paragraph preservation settings.
 *
 * - If preserveParagraphs = true: 
 *     Collapses 3+ newlines → exactly two ("\n\n")
 * - If preserveParagraphs = false:
 *     Collapses 2+ newlines → exactly one ("\n")
 * 
 * Example (preserveParagraphs = true):
 * "Line1\n\n\n\nLine2" → "Line1\n\nLine2"
 *
 * @param {string} text
 * @param {boolean} preserveParagraphs - Whether to preserve double newlines as paragraph breaks.
 * @returns {string}
 */
const PARAGRAPH_TRIPLE_NEWLINES_REGEX = /\n{3,}/g;
const PARAGRAPH_DOUBLE_NEWLINES_REGEX = /\n+/g;
function collapseParagraphs(text, preserveParagraphs) {
    return preserveParagraphs
        ? text.replace(PARAGRAPH_TRIPLE_NEWLINES_REGEX, '\n\n')
        : text.replace(PARAGRAPH_DOUBLE_NEWLINES_REGEX, '\n');
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
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F\u0080-\u009F\u200E\u200F\u202A-\u202E]+/g;
function purgeControlCharacters(text) {
    return text.replace(CONTROL_CHARS_REGEX, '');
}
