// src/index.d.ts

export interface SanctifyOptions {
  /** Remove ZWSP, NBSP, bidi, and other invisible Unicode trash */
  purgeInvisibleChars?: boolean;

  /** Remove emoji characters */
  purgeEmojis?: boolean;

  /** Nuke hidden control characters (excluding whitespace like \n and \t) */
  nukeControls?: boolean;

  /** Restrict to printable ASCII (+ emoji if `purgeEmojis` is false) */
  keyboardOnlyFilter?: boolean;

  /** Normalize all newline sequences to LF (`\n`) */
  normalizeNewlines?: boolean;

  /** Remove tabs and spaces before/after newline characters */
  trimSpacesAroundNewlines?: boolean;

  /** Collapse multiple consecutive newlines */
  collapseNewLines?: boolean;

  /** When collapsing newlines, preserve paragraph breaks as double `\n\n` */
  preserveParagraphs?: boolean;

  /** Collapse multiple spaces into a single space */
  collapseSpaces?: boolean;

  /** Trim leading and trailing whitespace from final result */
  finalTrim?: boolean;
}

/** Preconfigured sanitizer function */
export type Sanctifier = (text: string) => string;

/**
 * Summon a reusable text sanitizer.
 */
export function summonSanctifier(
  defaultOptions?: SanctifyOptions,
): Sanctifier;

/**
 * Strict sanitizer preset:
 * - Collapse spaces
 * - Collapse all newlines
 * - Nuke control characters
 * - Purge emojis
 */
export namespace summonSanctifier {
  const strict: Sanctifier;
  const loose: Sanctifier;

  /**
   * Keeps printable ASCII and emoji.
   * Leaves spacing soft and preserves emoji.
   */
  const keyboardOnlyEmoji: Sanctifier;

  /**
   * Keeps printable ASCII only.
   * Collapses whitespace and purges emoji.
   */
  const keyboardOnly: Sanctifier;
}

/**
 * Brutally normalizes and cleans a string of text.
 */
export function sanctifyText(
  text: string,
  purgeInvisibleChars?: boolean,
  purgeEmojis?: boolean,
  nukeControls?: boolean,
  keyboardOnlyFilter?: boolean,
  normalizeNewlines?: boolean,
  trimSpacesAroundNewlines?: boolean,
  collapseNewLines?: boolean,
  preserveParagraphs?: boolean,
  collapseSpaces?: boolean,
  finalTrim?: boolean,
): string;

/** Style of newline characters detected in a string */
export type NewlineStyle = 'LF' | 'CRLF' | 'CR' | 'Mixed' | null;

/**
 * A structural report of anomalies found in text.
 */
export interface UnicodeTrashReport {
  hasControlChars: boolean;
  hasInvisibleChars: boolean;
  hasMixedNewlines: boolean;
  newlineStyle: NewlineStyle;
  hasEmojis: boolean;
  hasNonKeyboardChars: boolean;
  summary: string[];
}

/**
 * Analyze a string and return a report of Unicode/control character issues,
 * invisible characters, newline styles, emojis, and more.
 */
export function inspectText(text: string): UnicodeTrashReport;
