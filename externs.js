/**
 * @fileoverview Public API externs for text-sanctifier.
 * @externs
 */

/**
 * @typedef {{
*   preserveParagraphs: (boolean|undefined),
*   collapseSpaces: (boolean|undefined),
*   nukeControls: (boolean|undefined),
*   purgeEmojis: (boolean|undefined),
*   keyboardOnlyFilter: (boolean|undefined),
* }}
*/
var SanctifyOptions;

/**
* Summon a reusable text sanitizer.
*
* @param {!SanctifyOptions=} defaultOptions
* @return {function(string): string}
*/
function summonSanctifier(defaultOptions) {}

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
* Creates a keyboard-only ASCII-only sanitizer (no emojis).
* @type {function(string): string}
*/
summonSanctifier.keyboardOnly;

/**
* Creates a keyboard-only sanitizer that retains emojis.
* @type {function(string): string}
*/
summonSanctifier.keyboardOnlyEmoji;

/**
* Brutally normalizes and cleans a string of text.
*
* @param {string} text
* @param {boolean} preserveParagraphs
* @param {boolean} collapseSpaces
* @param {boolean} nukeControls
* @param {boolean} purgeEmojis
* @param {boolean} keyboardOnlyFilter
* @return {string}
*/
function sanctifyText(
 text,
 preserveParagraphs,
 collapseSpaces,
 nukeControls,
 purgeEmojis,
 keyboardOnlyFilter
) {}
