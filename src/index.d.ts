// src/index.d.ts

export interface SanctifyOptions {
    /** Preserve paragraph breaks by collapsing 3+ newlines into 2 */
    preserveParagraphs?: boolean;
    
    /** Collapse multiple spaces into a single space */
    collapseSpaces?: boolean;
    
    /** Nuke hidden control characters (excluding whitespace like \n and \t) */
    nukeControls?: boolean;
  }
  
  /**
   * Brutally normalizes and cleans a string of text.
   * 
   * @param text The text to sanitize.
   * @param options Options to configure the sanitization behavior.
   * @returns A cleaned and normalized string.
   */
  export function sanctifyText(
    text: string,
    options?: SanctifyOptions
  ): string;
  
  /**
   * Creates a pre-configured text sanitizer function with default options.
   * 
   * @param defaultOptions Default options to pre-bind to the sanitizer.
   * @returns A function that takes raw text and returns cleaned text.
   */
  export function summonSanctifier(
    defaultOptions?: SanctifyOptions
  ): (text: string) => string;
  