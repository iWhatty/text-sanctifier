// src/index.d.ts

export interface SanctifyOptions {
    /** Preserve paragraph breaks by collapsing 3+ newlines into 2 */
    preserveParagraphs?: boolean;
  
    /** Collapse multiple spaces into a single space */
    collapseSpaces?: boolean;
  
    /** Nuke hidden control characters (excluding whitespace like \n and \t) */
    nukeControls?: boolean;
  }
  
  /** Preconfigured sanitizer function */
  export type Sanctifier = (text: string) => string;
  
  /**
   * Brutally normalizes and cleans a string of text.
   */
  export interface SanctifyText {
    (text: string, options?: SanctifyOptions): string;
  
    /**
     * Creates a strict sanitizer:
     * - Collapse multiple spaces
     * - Collapse all newlines
     * - Purge all control/invisible characters
     */
    strict(): Sanctifier;
  
    /**
     * Creates a loose sanitizer:
     * - Preserve paragraph breaks
     * - Collapse spaces
     * - Purge invisible characters (but not controls)
     */
    loose(): Sanctifier;
  }
  
  export const sanctifyText: SanctifyText;
  
  /**
   * Creates a pre-configured text sanitizer function with default options.
   */
  export function summonSanctifier(
    defaultOptions?: SanctifyOptions
  ): Sanctifier;
  