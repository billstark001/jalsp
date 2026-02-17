/**
 * @fileoverview Token definitions and syntax constants for BNF, EBNF, and ABNF parsing.
 * @module bnf-syntax
 */

/**
 * Regular expression patterns for BNF (Backus-Naur Form) tokens.
 * These patterns use the 'y' (sticky) flag for efficient sequential matching.
 */
export const BNF_SET = {
  /** Matches whitespace characters including space, non-breaking space, ideographic space, carriage return, newline, and tab */
  T_SPACE: /[ \xa0\u3000\r\n\t]+/y,

  /** Matches definition operators: ::=, =, or : */
  T_DEFINITION: /(?:::=|=|:)/y,

  /** Matches angle-bracketed identifiers like <identifier> with support for escaped >> inside */
  T_IDENTIFIER_AB: /<(?:>>|[^>])*>/y,

  /** Matches standard identifiers starting with letter, underscore, or $ */
  T_IDENTIFIER: /[a-zA-Z_$][0-9a-zA-Z_$]*/y,

  /** Matches single-quoted strings with escape sequence support */
  T_STRING1: /'(?:\\.|[^'\\])*'/y,

  /** Matches double-quoted strings with escape sequence support */
  T_STRING2: /"(?:\\.|[^"\\])*"/y,

  /** Matches the alternation operator | */
  T_OR: /\|/y,

  /** Matches the production separator ; */
  T_SEP: /;/y,

  /** Matches the comma separator */
  T_COMMA: /,/y,
} as const;

/**
 * Regular expression patterns for EBNF (Extended Backus-Naur Form) tokens.
 * Extends BNF with repetition and grouping operators.
 */
export const EBNF_SET = {
  /** Matches non-negative integers */
  T_NON_NEG_INTEGER: /[0-9]+/y,

  /** Matches the minus/range operator - */
  T_MINUS: /-/y,

  /** Matches the repetition operator * (zero or more) */
  T_MULT: /\*/y,

  /** Matches the optional operator ? (zero or one) */
  T_QUES: /\?/y,

  /** Matches left parenthesis for grouping */
  T_RB_L: /\(/y,

  /** Matches right parenthesis */
  T_RB_R: /\)/y,

  /** Matches left square bracket for optional groups */
  T_SB_L: /\[/y,

  /** Matches right square bracket */
  T_SB_R: /\]/y,

  /** Matches left curly brace for repetition groups */
  T_CB_L: /\{/y,

  /** Matches right curly brace */
  T_CB_R: /\}/y,

  ...BNF_SET,
} as const;

/**
 * Regular expression patterns for ABNF (Augmented Backus-Naur Form) tokens.
 * ABNF is defined in RFC 5234 and commonly used in IETF specifications.
 */
export const ABNF_SET = {
  /** Matches whitespace (spaces and tabs, but not newlines in ABNF) */
  T_SPACE: /[ \t]+/y,

  /** Matches line breaks (CRLF or LF) which are significant in ABNF */
  T_NEWLINE: /\r?\n/y,

  /** Matches ABNF definition operators: = or =/ (incremental alternatives) */
  T_DEFINITION: /=\/?/y,

  /** Matches ABNF rule names (case-insensitive identifiers with hyphens) */
  T_IDENTIFIER: /[a-zA-Z][a-zA-Z0-9-]*/y,

  /** Matches double-quoted strings (ABNF uses only double quotes) */
  T_STRING: /"(?:[!#-~\t ])*"/y,

  /** Matches case-sensitive string prefix %s */
  T_CASE_SENSITIVE: /%s/y,

  /** Matches case-insensitive string prefix %i (default) */
  T_CASE_INSENSITIVE: /%i/y,

  /** Matches binary literal prefix %b */
  T_BIN: /%b/y,

  /** Matches decimal literal prefix %d */
  T_DEC: /%d/y,

  /** Matches hexadecimal literal prefix %x */
  T_HEX: /%x/y,

  /** Matches prose description <prose goes here> */
  T_PROSE: /<[^>]*>/y,

  /** Matches specific repetition count or range like 3*5, *5, 3*, or * */
  T_REPEAT: /[0-9]*\*[0-9]*/y,

  /** Matches hexadecimal or decimal digits */
  T_NUMBER: /[0-9A-Fa-f]+/y,

  /** Matches range operator - */
  T_RANGE: /-/y,

  /** Matches value concatenation dot . */
  T_DOT: /\./y,

  /** Matches alternation operator / */
  T_OR: /\//y,

  /** Matches ABNF comment starting with ; */
  T_COMMENT: /;[^\r\n]*/y,

  /** Matches left parenthesis */
  T_RB_L: /\(/y,

  /** Matches right parenthesis */
  T_RB_R: /\)/y,

  /** Matches left square bracket for optional elements */
  T_SB_L: /\[/y,

  /** Matches right square bracket */
  T_SB_R: /\]/y,
} as const;

/**
 * Internal regex for carriage return and newline detection.
 */
export const T_RET = /\r?\n/;

/**
 * Regex patterns for parsing productions in different formats.
 */

/** Pattern for non-comma-separated productions */
export const P_NON_COMMA = /(i)(\s*=\s*)((?:\s*(?:[is]\s*)*\|?)*)/y;

/** Pattern for comma-separated productions */
export const P_COMMA = /(i)(\s*=\s*)((?:\s*(?:[is]\s*,?\s*)*\|?)*)/y;

/** Pattern for matching whitespace in parsed token streams */
export const P_SPACE = /\s+/y;

// Freeze objects to prevent modifications
Object.freeze(BNF_SET);
Object.freeze(EBNF_SET);
Object.freeze(ABNF_SET);

/**
 * Type representing all possible token sets
 */
export type TokenSet = typeof BNF_SET | typeof EBNF_SET | typeof ABNF_SET;

/**
 * Extract token names from a token set
 */
export type TokenNames<T extends TokenSet> = keyof T;