// ./src/inspectText.js

import {
    CONTROL_CHARS_REGEX,
    INVISIBLE_TRASH_REGEX,
    EMOJI_REGEX,
    ASCII_KEYBOARD_SAFE_REGEX,
    normalizeTypographicJank,
  } from './sanctifyText.js';
  
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
      lf: lfMatches.length,
    };
  
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