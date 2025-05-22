


import {
    CONTROL_CHARS_REGEX,
    INVISIBLE_TRASH_REGEX,
    EMOJI_REGEX,
    ASCII_KEYBOARD_SAFE_REGEX,
    normalizeTypographicJank
  } from './sanctifyText.js';

  
/**
 * Detects textual "trash" or anomalies in a given string.
 * @param {string} text
 * @returns {{
*   hasControlChars: boolean,
*   hasInvisibleChars: boolean,
*   hasMixedNewlines: boolean,
*   newlineStyle: 'LF' | 'CRLF' | 'CR' | 'Mixed' | null,
*   hasEmojis: boolean,
*   hasNonKeyboardChars: boolean,
*   summary: string[]
* }}
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
   summary
 };

 const flag = (condition, key, message) => {
   if (condition) {
     report[key] = true;
     summary.push(message);
   }
 };

 // === Pattern Checks ===
 flag(CONTROL_CHARS_REGEX.test(text), 'hasControlChars', 'Control characters detected.');
 flag(INVISIBLE_TRASH_REGEX.test(text), 'hasInvisibleChars', 'Invisible Unicode characters detected.');
 flag(EMOJI_REGEX.test(text), 'hasEmojis', 'Emojis detected.');

 // === Newline Analysis ===
 const { mixed, types } = getNewlineStats(text);
 report.hasMixedNewlines = mixed;
 report.newlineStyle = mixed ? 'Mixed' : types[0] || null;

 if (report.newlineStyle) {
   summary.push(
     mixed
       ? 'Mixed newline styles detected.'
       : `Consistent newline style: ${report.newlineStyle}`
   );
 }

 // === Non-keyboard characters (excluding emojis) ===
 const filtered = normalizeTypographicJank(text).replace(ASCII_KEYBOARD_SAFE_REGEX, m =>
    m.match(EMOJI_REGEX) ? '' : '☒'
  );
 flag(/[☒]/.test(filtered), 'hasNonKeyboardChars', 'Non-keyboard characters detected.');

 return report;
}


/**
 * Counts the number of different newline types in a string.
 * @param {string} text
 * @returns {{
*   crlf: number,
*   cr: number,
*   lf: number,
*   types: string[],
*   mixed: boolean
* }}
*/
export function getNewlineStats(text) {
 if (typeof text !== 'string') {
   throw new TypeError('getNewlineStats expects a string input.');
 }

 const crlfMatches = text.match(/\r\n/g) || [];
 const textWithoutCRLF = text.replace(/\r\n/g, '');

 const crMatches = textWithoutCRLF.match(/\r/g) || [];
 const lfMatches = textWithoutCRLF.match(/\n/g) || [];

 const count = {
   crlf: crlfMatches.length,
   cr: crMatches.length,
   lf: lfMatches.length
 };

 const types = [];
 if (count.crlf > 0) types.push('CRLF');
 if (count.cr > 0) types.push('CR');
 if (count.lf > 0) types.push('LF');

 return {
   ...count,
   types,
   mixed: types.length > 1
 };
}