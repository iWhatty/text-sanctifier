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
*
* @return {function(string): string}
*/
function strict() {}

/**
* Creates a loose sanitizer.
*
* @return {function(string): string}
*/
function loose() {}

/**
* Brutally normalizes and cleans a string of text.
*
* @param {string} text
* @param {boolean} preserveParagraphs
* @param {boolean} collapseSpaces
* @param {boolean} nukeControls
* @param {boolean} purgeEmojis
* @return {string}
*/
function sanctifyText(text, preserveParagraphs, collapseSpaces, nukeControls, purgeEmojis) {}
