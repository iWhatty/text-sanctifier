// src/sanctifyText.js

import { CONTROL_CHARS_REGEX, INVISIBLE_TRASH_REGEX } from './categories.generated.js';
export { CONTROL_CHARS_REGEX, INVISIBLE_TRASH_REGEX };
import { ASCII_KEYBOARD_SAFE_REGEX, EMOJI_REGEX, normalizeTypographicJank } from './textPatterns.js';
export { ASCII_KEYBOARD_SAFE_REGEX, EMOJI_REGEX, normalizeTypographicJank };


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
 * @property {number} [maxLength]
 * @property {'throw'|'truncate'|'noop'} [onMaxLength]
 * @property {boolean} [normalizeSpaces] - Replace look-alike spaces with an ordinary space (runs first).
 * @property {boolean} [purgeZeroWidthSpaces] - Remove U+200B, U+2060 and U+FEFF only, keeping joiners and selectors.
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
 * @param {number} [defaultOptions.maxLength=Infinity] - Hard input length cap (UTF-16 code units).
 * @param {'throw' | 'truncate' | 'noop'} [defaultOptions.onMaxLength='throw'] - Behavior when input exceeds maxLength.
 * @param {boolean} [defaultOptions.normalizeSpaces]
 * @param {boolean} [defaultOptions.purgeZeroWidthSpaces]
 * @returns {(text: string) => string}
 */
export function summonSanctifier(defaultOptions = {}) {
    const normalizeSpaces = !!defaultOptions.normalizeSpaces;
    const purgeZeroWidthSpaces = !!defaultOptions.purgeZeroWidthSpaces;
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

    const maxLength =
        Number.isFinite(defaultOptions.maxLength) && defaultOptions.maxLength >= 0
            ? defaultOptions.maxLength
            : Infinity;

    const onMaxLength =
        defaultOptions.onMaxLength === 'truncate' ||
            defaultOptions.onMaxLength === 'noop' ||
            defaultOptions.onMaxLength === 'throw'
            ? defaultOptions.onMaxLength
            : 'throw';

    return (text) =>
        sanctifyText(
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
            finalTrim,
            maxLength,
            onMaxLength,
            normalizeSpaces,
            purgeZeroWidthSpaces
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
/** @param {string} text @returns {string} */
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
/** @param {string} text @returns {string} */
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
/** @param {string} text @returns {string} */
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
/** @param {string} text @returns {string} */
summonSanctifier.keyboardOnly = text => sanctifyText(
    text,
    true,   // purgeInvisibleChars
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
 * Pasted text and model output:
 * - Look-alike spaces (NBSP, narrow NBSP, typographic spaces) become ordinary spaces,
 *   so words never run together
 * - Zero-width spaces, word joiners and BOMs are removed
 * - Newlines are normalized to `\n`
 * Keeps emoji joiners, variation selectors, bidi marks, indentation and line breaks.
 */
/** @param {string} text @returns {string} */
summonSanctifier.pasted = text => sanctifyText(
    text,
    false,  // purgeInvisibleChars
    false,  // purgeEmojis
    false,  // nukeControls
    false,  // keyboardOnlyFilter
    true,   // normalizeNewlines
    false,  // trimSpacesAroundNewlines
    false,  // collapseNewLines
    false,  // preserveParagraphs
    false,  // collapseSpaces
    false,  // finalTrim
    Infinity, // maxLength
    'throw',  // onMaxLength
    true,   // normalizeSpaces
    true    // purgeZeroWidthSpaces
);


/**
 * Text Sanctifier
 *
 * Brutal text normalizer and invisible trash scrubber,
 * configurable to kill whatever ghosts you want dead.
 *
 * ⚠️ Note: This is plain-text normalization/filtering — not an HTML/XSS sanitizer.
 *
 * @param {string} text
 * @param {boolean} [purgeInvisibleChars=false] - Remove ZWSP, NBSP, bidi, tags, variation selectors, etc.
 * @param {boolean} [purgeEmojis=false] - Remove emoji characters entirely.
 * @param {boolean} [nukeControls=false] - Remove non-whitespace control characters.
 * @param {boolean} [keyboardOnlyFilter=false] - Keep printable ASCII + full emoji sequences only (drops other Unicode).
 * @param {boolean} [normalizeNewlines=false] - Convert all newlines to `\n`.
 * @param {boolean} [trimSpacesAroundNewlines=false] - Remove spaces/tabs around newlines.
 * @param {boolean} [collapseNewLines=false] - Collapse `\n` runs (optionally preserve paragraphs).
 * @param {boolean} [preserveParagraphs=false] - Preserve paragraph breaks when collapsing newlines.
 * @param {boolean} [collapseSpaces=false] - Collapse multiple spaces into one.
 * @param {boolean} [finalTrim=false] - `.trim()` the final output (head/tail).
 * @param {number} [maxLength=Infinity] - Hard input length cap (UTF-16 code units via `text.length`).
 * @param {'throw'|'truncate'|'noop'} [onMaxLength='throw'] - Behavior when `text.length` exceeds `maxLength`:
 *   - `'throw'`: throw a `RangeError`
 *   - `'truncate'`: slice to `maxLength` before processing
 *   - `'noop'`: return the original input unchanged (skips processing)
 * @param {boolean} [normalizeSpaces=false] - Replace look-alike spaces with an ordinary space. Runs first,
 *   so `purgeInvisibleChars` no longer joins the words around them.
 * @param {boolean} [purgeZeroWidthSpaces=false] - Remove zero-width spaces, word joiners and BOMs only.
 * @returns {string}
 * @throws {TypeError} If `text` is not a string.
 * @throws {RangeError} If input exceeds `maxLength` and `onMaxLength` is `'throw'`.
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
    maxLength = Infinity,
    onMaxLength = 'throw',
    normalizeSpaces = false,
    purgeZeroWidthSpaces = false
) {
    if (typeof text !== 'string') {
        throw new TypeError('sanctifyText expects a string input.');
    }

    if (onMaxLength !== 'truncate' && onMaxLength !== 'noop' && onMaxLength !== 'throw') {
        onMaxLength = 'throw';
    }

    if (text.length > maxLength) {
        switch (onMaxLength) {
            case 'truncate':
                text = text.slice(0, maxLength);
                break;
            case 'noop':
                return text;
            case 'throw':
            default:
                throw new RangeError(
                    `sanctifyText input length ${text.length} exceeds maxLength ${maxLength}.`
                );
        }
    }

    let cleaned = text;

    // Look-alike spaces become ordinary spaces, before anything can delete them
    if (normalizeSpaces) cleaned = cleaned.replace(SPACE_LOOKALIKES_REGEX, ' ');

    // Zero-width spaces, word joiners and BOMs (not joiners or selectors)
    if (purgeZeroWidthSpaces) cleaned = cleaned.replace(ZERO_WIDTH_SPACES_REGEX, '');

    //  Purge invisible Unicode trash (zero-width, non-breaking, bidi junk, etc.)
    if (purgeInvisibleChars) cleaned = purgeInvisibleTrash(cleaned);

    // Remove emojis
    if (purgeEmojis) cleaned = purgeEmojiCharacters(cleaned);

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
 * Look-alike spaces: the `nonbreaking_space` category except U+3000, the ordinary
 * space of CJK text. A test checks this against the category table.
 */
export const SPACE_LOOKALIKES_REGEX = /[\u00A0\u2000-\u200A\u202F\u205F]/g;

/** Zero-width space, word joiner and BOM: invisible and never needed in plain text. */
export const ZERO_WIDTH_SPACES_REGEX = /[\u200B\u2060\uFEFF]/g;


/**
 * Removes the invisible Unicode characters in INVISIBLE_TRASH_REGEX: non-breaking and
 * typographic spaces, zero-width characters, bidi controls, invisible format characters,
 * Hangul fillers, variation selectors (including VS16 in emoji), the BOM and tag characters.
 * The code points come from the table in scripts/categories.js.
 *
 * @param {string} text
 * @returns {string}
 */
function purgeInvisibleTrash(text) {
    return text.replace(INVISIBLE_TRASH_REGEX, '');
}


/**
 * Extracts and preserves complete emoji sequences from a string.
 *
 * Uses the global `EMOJI_REGEX` to match full emoji grapheme sequences,
 * including:
 *   - Extended pictographic characters
 *   - Zero-width joiner (ZWJ) sequences (e.g. 👨‍👩‍👧‍👦)
 *   - Variation Selector-16 (VS16) emoji presentation forms (e.g. ✌️, ‼️)
 *
 * Any non-emoji characters are ignored.
 *
 * Important:
 * `EMOJI_REGEX` is global (`/g`), so `lastIndex` is reset before matching
 * to ensure deterministic behavior across repeated calls.
 *
 * @param {string} text - Input string potentially containing emoji sequences.
 * @returns {string} A string containing only the matched emoji sequences,
 *                   concatenated in original order.
 */
function extractEmojiSequences(text) {
    EMOJI_REGEX.lastIndex = 0;
    if (!EMOJI_REGEX.test(text)) return ''; // quick reject
    EMOJI_REGEX.lastIndex = 0;

    let out = '';
    for (const match of text.matchAll(EMOJI_REGEX)) out += match[0];
    return out;
}


/**
 * Removes all non-keyboard characters, preserving:
 * - Printable ASCII (0x20–0x7E)
 * - Emojis (Unicode Emoji_Presentation + FE0F variants)
 */
function purgeNonKeyboardChars(text, purgeEmojis = false) {
    const normalized = normalizeTypographicJank(text);

    // If emojis are being purged, keyboard-only becomes "ASCII + CR/LF only"
    if (purgeEmojis) {
        return normalized.replace(ASCII_KEYBOARD_SAFE_REGEX, '');
    }

    // Replace each non-ASCII run with ONLY the emoji sequences inside it.
    // This preserves ZWJ sequences and VS16 variants (e.g. 👨‍👩‍👧‍👦, ✌️, ‼️),
    // while dropping non-emoji non-ASCII (e.g. 𝌆).
    return normalized.replace(ASCII_KEYBOARD_SAFE_REGEX, (run) => extractEmojiSequences(run));
}



/**
 * Removes all emoji characters using Unicode property escapes.
 * Supports modern environments (Unicode v13+) with fallback.
 *
 * @param {string} text
 * @returns {string}
 */
function purgeEmojiCharacters(text) {
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
 * Control characters nuked (the code points come from the table in scripts/categories.js):
 *   - NUL and the C0 controls except tab, LF and CR; DEL (U+007F)
 *   - C1 controls (U+0080-U+009F)
 *   - Bidi controls
 * 
 * @param {string} text
 * @returns {string}
 */
function purgeControlCharacters(text) {
    return text.replace(CONTROL_CHARS_REGEX, '');
}
