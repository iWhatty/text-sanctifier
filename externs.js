/**
 * @fileoverview Public API externs for text-sanctifier.
 * @externs
 */

/**
 * @typedef {{
*   purgeInvisibleChars: (boolean|undefined),
*   purgeEmojis: (boolean|undefined),
*   nukeControls: (boolean|undefined),
*   keyboardOnlyFilter: (boolean|undefined),
*   normalizeNewlines: (boolean|undefined),
*   trimSpacesAroundNewlines: (boolean|undefined),
*   collapseNewLines: (boolean|undefined),
*   preserveParagraphs: (boolean|undefined),
*   collapseSpaces: (boolean|undefined),
*   finalTrim: (boolean|undefined)
* }}
*/
var SanctifyOptions;

/**
* Summon a reusable text sanitizer.
*
* @param {!SanctifyOptions=} defaultOptions
* @return {function(string): string}
*/
function summonSanctifier(defaultOptions) { }

/**
* Creates a strict sanitizer.
* @type {function(string): string}
*/
summonSanctifier.strict;

/**
* Creates a loose sanitizer.
* @type {function(string): string}
*/
summonSanctifier.loose;

/**
* Creates a keyboard-only sanitizer that retains emojis.
* @type {function(string): string}
*/
summonSanctifier.keyboardOnlyEmoji;

/**
* Creates a keyboard-only ASCII-only sanitizer (no emojis).
* @type {function(string): string}
*/
summonSanctifier.keyboardOnly;

/**
* Brutally normalizes and cleans a string of text.
*
* @param {string} text
* @param {boolean=} purgeInvisibleChars
* @param {boolean=} purgeEmojis
* @param {boolean=} nukeControls
* @param {boolean=} keyboardOnlyFilter
* @param {boolean=} normalizeNewlines
* @param {boolean=} trimSpacesAroundNewlines
* @param {boolean=} collapseNewLines
* @param {boolean=} preserveParagraphs
* @param {boolean=} collapseSpaces
* @param {boolean=} finalTrim
* @return {string}
*/
function sanctifyText(
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
) { }

/**
 * @typedef {string} NewlineStyle
 * One of: 'LF', 'CRLF', 'CR', 'Mixed', or null
 */
var NewlineStyle;

/**
 * @typedef {{
*   hasControlChars: boolean,
*   hasInvisibleChars: boolean,
*   hasMixedNewlines: boolean,
*   newlineStyle: (NewlineStyle|null),
*   hasEmojis: boolean,
*   hasNonKeyboardChars: boolean,
*   summary: !Array<string>
* }}
*/
var UnicodeTrashReport;

/**
* Analyze a string for textual anomalies or "trash".
* @param {string} text
* @return {!UnicodeTrashReport}
*/
function inspectText(text) { }

/**
* Suggests recommended flags for summonSanctifier based on a UnicodeTrashReport.
* @param {!UnicodeTrashReport} report
* @return {!SanctifyOptions}
*/
function getRecommendedSanctifierOptions(report) { }