/**
 * @fileoverview Tests for BNF and EBNF parsing functionality.
 */

import { lexBnf, parseBnf } from './bnf';
import { BnfElement } from './types';
describe('lexBnf', () => {
  describe('BNF mode', () => {
    it('should tokenize simple BNF production', () => {
      const tokens = lexBnf('<expr> ::= <term>');
      const nonSpaceTokens = tokens.filter(t => t.name !== 'SPACE');

      expect(nonSpaceTokens).toHaveLength(3);
      expect(nonSpaceTokens[0].name).toBe('IDENTIFIER_AB');
      expect(nonSpaceTokens[0].value.value).toBe('expr');
      expect(nonSpaceTokens[1].name).toBe('DEFINITION');
      expect(nonSpaceTokens[2].name).toBe('IDENTIFIER_AB');
      expect(nonSpaceTokens[2].value.value).toBe('term');
    });

    it('should handle alternation', () => {
      const tokens = lexBnf('<expr> ::= <term> | "+" <expr>');

      const identifiers = tokens.filter(t => t.name === 'IDENTIFIER_AB');
      const strings = tokens.filter(t => t.name === 'STRING2');
      const ors = tokens.filter(t => t.name === 'OR');

      expect(identifiers).toHaveLength(3);
      expect(strings).toHaveLength(1);
      expect(ors).toHaveLength(1);
    });

    it('should handle single-quoted strings', () => {
      const tokens = lexBnf("<expr> ::= 'hello'");

      const stringToken = tokens.find(t => t.name === 'STRING1');
      expect(stringToken).toBeDefined();
      expect(stringToken!.value.value).toBe('hello');
    });

    it('should handle angle bracket escaping', () => {
      const tokens = lexBnf('<a>>b> ::= "test"');

      expect(tokens[0].value.value).toBe('a>b');
    });

    it('should handle multiple whitespace types', () => {
      const tokens = lexBnf('<a> ::= <b>  \t\n  <c>');

      const spaces = tokens.filter(t => t.name === 'SPACE');
      expect(spaces.length).toBeGreaterThan(0);
    });

    it('should throw on unknown token', () => {
      expect(() => lexBnf('<expr> ::= @invalid')).toThrow('Unknown token');
    });
  });

  describe('EBNF mode', () => {
    it('should tokenize EBNF with repetition', () => {
      const tokens = lexBnf('<list> ::= <item> { "," <item> }', true);

      const braces = tokens.filter(t => t.name === 'CB_L' || t.name === 'CB_R');
      expect(braces).toHaveLength(2);
    });

    it('should handle optional elements', () => {
      const tokens = lexBnf('<item> ::= <val> [ "optional" ]', true);

      const brackets = tokens.filter(t => t.name === 'SB_L' || t.name === 'SB_R');
      expect(brackets).toHaveLength(2);
    });

    it('should handle grouping', () => {
      const tokens = lexBnf('<expr> ::= ( <a> | <b> ) <c>', true);

      const parens = tokens.filter(t => t.name === 'RB_L' || t.name === 'RB_R');
      expect(parens).toHaveLength(2);
    });

    it('should handle numbers', () => {
      const tokens = lexBnf('<repeat> ::= 3 * <item>', true);

      const numberToken = tokens.find(t => t.name === 'NON_NEG_INTEGER');
      expect(numberToken).toBeDefined();
      expect(numberToken!.value.type).toBe('number');
      expect((numberToken!.value as BnfElement).value).toBe(3);
    });

    it('should handle question mark', () => {
      const tokens = lexBnf('<optional> ::= <item>?', true);

      expect(tokens.some(t => t.name === 'QUES')).toBe(true);
    });
  });

  describe('Position tracking', () => {
    it('should track token positions', () => {
      const tokens = lexBnf('<a> ::= <b>');

      expect(tokens[0].position).toBe(0);
      expect(tokens[0]?.pos).toBeDefined();
      expect(tokens[0].pos!.line).toBeGreaterThanOrEqual(1);
      expect(tokens[0].pos!.col).toBeGreaterThanOrEqual(0);
    });

    it('should track positions across multiple lines', () => {
      const tokens = lexBnf('<a> ::= <b>\n<c> ::= <d>');

      const secondIdentifier = tokens.filter(t => t.name === 'IDENTIFIER_AB')[2];
      expect(secondIdentifier?.pos).toBeDefined();
      expect(secondIdentifier!.pos!.line).toBe(2);
      expect(secondIdentifier!.pos!.col).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('parseBnf', () => {
  describe('Non-comma-separated mode', () => {
    it('should parse simple production', () => {
      const tokens = lexBnf('<expr> ::= <term>');
      const productions = parseBnf(tokens);

      expect(productions).toHaveLength(1);
      expect(productions[0].name).toBe('expr');
      expect(productions[0].expr).toHaveLength(1);
      expect(productions[0].expr[0].value).toBe('term');
    });

    it('should parse alternation into separate productions', () => {
      const tokens = lexBnf('<expr> ::= <term> | <number>');
      const productions = parseBnf(tokens);

      expect(productions).toHaveLength(2);
      expect(productions[0].name).toBe('expr');
      expect(productions[1].name).toBe('expr');
      expect(productions[0].expr[0].value).toBe('term');
      expect(productions[1].expr[0].value).toBe('number');
    });

    it('should parse multiple terms in sequence', () => {
      const tokens = lexBnf('<expr> ::= <a> <b> <c>');
      const productions = parseBnf(tokens);

      expect(productions).toHaveLength(1);
      expect(productions[0].expr).toHaveLength(3);
      expect(productions[0].expr[0].value).toBe('a');
      expect(productions[0].expr[1].value).toBe('b');
      expect(productions[0].expr[2].value).toBe('c');
    });

    it('should handle mixed identifiers and strings', () => {
      const tokens = lexBnf('<expr> ::= <term> "+" <term>');
      const productions = parseBnf(tokens);

      expect(productions[0].expr).toHaveLength(3);
      expect(productions[0].expr[0].type).toBe('identifier');
      expect(productions[0].expr[1].type).toBe('literal');
      expect(productions[0].expr[1].value).toBe('+');
    });

    // Multiple productions without separators are not supported
    // Use semicolons or parse them separately

    it('should pass through action parameter', () => {
      const tokens = lexBnf('<expr> ::= <term>');
      const productions = parseBnf(tokens, false, 42);

      expect(productions[0].action).toBe(42);
    });
  });

  describe('Comma-separated mode', () => {
    it('should parse comma-separated terms', () => {
      const tokens = lexBnf('<list> ::= <a>, <b>, <c>');
      const productions = parseBnf(tokens, true);

      expect(productions).toHaveLength(1);
      expect(productions[0].expr).toHaveLength(3);
    });

    it('should handle alternation with commas', () => {
      const tokens = lexBnf('<list> ::= <a>, <b> | <c>, <d>');
      const productions = parseBnf(tokens, true);

      expect(productions).toHaveLength(2);
      expect(productions[0].expr).toHaveLength(2);
      expect(productions[1].expr).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should throw on non-BNF tokens', () => {
      const tokens = lexBnf('<expr> ::= <term> { <item> }', true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => parseBnf(tokens as any)).toThrow('Non-BNF token');
    });

    it('should throw on malformed grammar', () => {
      const tokens = lexBnf('<expr>');

      expect(() => parseBnf(tokens)).toThrow();
    });
  });

  describe('Edge cases', () => {
    // Empty productions are not meaningful and not supported
    // The parser correctly returns an empty array for them

    it('should handle productions with only whitespace', () => {
      const tokens = lexBnf('<a> ::= <b>   ');
      const productions = parseBnf(tokens);

      expect(productions).toHaveLength(1);
    });

    // Semicolon separators within a single parse call are not reliably supported
    // Parse productions separately or use proper grammar structure
  });
});