/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @fileoverview Tests for ABNF parsing functionality.
 */

import { lexAbnf, parseAbnf } from './abnf';

describe('lexAbnf', () => {
  describe('Basic tokenization', () => {
    it('should tokenize simple ABNF rule', () => {
      const tokens = lexAbnf('rule = value');
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].name).toBe('IDENTIFIER');
      expect(tokens[0].value.value).toBe('rule');
    });

    it('should handle ABNF definition operators', () => {
      const tokens1 = lexAbnf('rule = value');
      const tokens2 = lexAbnf('rule =/ value');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [t10, t11, t12, ..._] = tokens1;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [t20, t21, t22, ...__] = tokens2;

      expect(t10.name).toBe('IDENTIFIER');
      expect(t11.name).toBe('SPACE');
      expect(t12.name).toBe('DEFINITION');
      
      expect(t20.name).toBe('IDENTIFIER');
      expect(t21.name).toBe('SPACE');
      expect(t22.name).toBe('DEFINITION');

      expect(t12.lexeme).toBe('=');
      expect(t22.lexeme).toBe('=/');
    });

    it('should handle rule names with hyphens', () => {
      const tokens = lexAbnf('my-rule-name = value');
      
      expect(tokens[0].value.value).toBe('my-rule-name');
    });

    it('should handle alternation with /', () => {
      const tokens = lexAbnf('rule = value1 / value2');
      
      const slashes = tokens.filter(t => t.name === 'OR');
      expect(slashes).toHaveLength(1);
    });

    it('should tokenize double-quoted strings', () => {
      const tokens = lexAbnf('rule = "test string"');
      
      const stringToken = tokens.find(t => t.name === 'STRING');
      expect(stringToken).toBeDefined();
      expect(stringToken!.value.value).toBe('test string');
    });

    it('should handle prose descriptions', () => {
      const tokens = lexAbnf('rule = <any character>');
      
      const proseToken = tokens.find(t => t.name === 'PROSE');
      expect(proseToken).toBeDefined();
    });
  });

  describe('Numeric values', () => {
    it('should handle hexadecimal values', () => {
      const tokens = lexAbnf('rule = %x0D');
      
      expect(tokens.some(t => t.name === 'HEX')).toBe(true);
      expect(tokens.some(t => t.name === 'NUMBER')).toBe(true);
    });

    it('should handle decimal values', () => {
      const tokens = lexAbnf('rule = %d13');
      
      expect(tokens.some(t => t.name === 'DEC')).toBe(true);
    });

    it('should handle binary values', () => {
      const tokens = lexAbnf('rule = %b1101');
      
      expect(tokens.some(t => t.name === 'BIN')).toBe(true);
    });

    it('should handle value ranges', () => {
      const tokens = lexAbnf('rule = %x30-39');
      
      expect(tokens.some(t => t.name === 'RANGE')).toBe(true);
    });

    it('should handle value concatenation', () => {
      const tokens = lexAbnf('rule = %x0D.0A');
      
      expect(tokens.some(t => t.name === 'DOT')).toBe(true);
    });
  });

  describe('Case sensitivity', () => {
    it('should handle case-sensitive string prefix', () => {
      const tokens = lexAbnf('rule = %s"Test"');
      
      expect(tokens.some(t => t.name === 'CASE_SENSITIVE')).toBe(true);
    });

    it('should handle case-insensitive string prefix', () => {
      const tokens = lexAbnf('rule = %i"test"');
      
      expect(tokens.some(t => t.name === 'CASE_INSENSITIVE')).toBe(true);
    });
  });

  describe('Grouping and repetition', () => {
    it('should handle parentheses', () => {
      const tokens = lexAbnf('rule = (value1 / value2)');
      
      const parens = tokens.filter(t => t.name === 'RB_L' || t.name === 'RB_R');
      expect(parens).toHaveLength(2);
    });

    it('should handle square brackets for optional', () => {
      const tokens = lexAbnf('rule = [ optional ]');
      
      const brackets = tokens.filter(t => t.name === 'SB_L' || t.name === 'SB_R');
      expect(brackets).toHaveLength(2);
    });

    it('should handle variable repetition', () => {
      const tokens = lexAbnf('rule = *value');
      
      expect(tokens.some(t => t.name === 'REPEAT')).toBe(true);
    });

    it('should handle specific repetition', () => {
      const tokens = lexAbnf('rule = 3*5value');
      
      expect(tokens.some(t => t.name === 'REPEAT')).toBe(true);
    });
  });

  describe('Comments and whitespace', () => {
    it('should skip comments', () => {
      const tokens = lexAbnf('rule = value ; this is a comment\nother = test');
      
      // Comments should not appear in tokens
      expect(tokens.every(t => t.name !== 'COMMENT')).toBe(true);
    });

    it('should handle newlines as tokens', () => {
      const tokens = lexAbnf('rule1 = value1\nrule2 = value2');
      
      expect(tokens.some(t => t.name === 'NEWLINE')).toBe(true);
    });

    it('should distinguish spaces from newlines', () => {
      const tokens = lexAbnf('rule = value1 value2\n');
      
      const spaces = tokens.filter(t => t.name === 'SPACE');
      const newlines = tokens.filter(t => t.name === 'NEWLINE');
      
      expect(spaces.length).toBeGreaterThan(0);
      expect(newlines.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world ABNF examples', () => {
    it('should tokenize HTTP CRLF rule', () => {
      const tokens = lexAbnf('CRLF = %x0D.0A');
      
      expect(tokens[0].value.value).toBe('CRLF');
      expect(tokens.some(t => t.name === 'HEX')).toBe(true);
      expect(tokens.some(t => t.name === 'DOT')).toBe(true);
    });

    it('should tokenize ALPHA rule', () => {
      const tokens = lexAbnf('ALPHA = %x41-5A / %x61-7A');
      
      expect(tokens.some(t => t.name === 'RANGE')).toBe(true);
      expect(tokens.some(t => t.name === 'OR')).toBe(true);
    });

    it('should tokenize complex rule with multiple elements', () => {
      const grammar = `
        uri = scheme ":" hier-part [ "?" query ]
        scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
      `;
      
      expect(() => lexAbnf(grammar)).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should throw on invalid tokens', () => {
      expect(() => lexAbnf('rule = @invalid')).toThrow();
    });

    it('should provide position information in errors', () => {
      try {
        lexAbnf('rule = @');
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('position');
      }
    });
  });

  describe('Position tracking', () => {
    it('should track line and column positions', () => {
      const tokens = lexAbnf('rule1 = value1\nrule2 = value2');
      
      const secondRule = tokens.find(
        (t) => t.name === 'IDENTIFIER' && t.value.value === 'rule2'
      );
      
      expect(secondRule?.pos).toBeDefined();
      expect(secondRule!.pos!.line).toBe(2);
    });
  });
});

describe('parseAbnf', () => {
  describe('Basic parsing', () => {
    it('should parse simple ABNF rule', () => {
      const tokens = lexAbnf('rule = value');
      const productions = parseAbnf(tokens);
      
      expect(productions).toHaveLength(1);
      expect(productions[0].name).toBe('rule');
    });

    it('should parse alternation', () => {
      const tokens = lexAbnf('rule = value1 / value2');
      const productions = parseAbnf(tokens);
      
      expect(productions).toHaveLength(2);
      expect(productions[0].name).toBe('rule');
      expect(productions[1].name).toBe('rule');
      expect(productions[0].expr[0].value).toBe('value1');
      expect(productions[1].expr[0].value).toBe('value2');
    });

    it('should parse multiple rules', () => {
      const tokens = lexAbnf('rule1 = value1\nrule2 = value2');
      const productions = parseAbnf(tokens);
      
      expect(productions.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle incremental alternatives', () => {
      const tokens = lexAbnf('rule =/ additional');
      const productions = parseAbnf(tokens);
      
      expect(productions[0].action).toBe(1);
    });

    it('should parse concatenation', () => {
      const tokens = lexAbnf('rule = value1 value2 value3');
      const productions = parseAbnf(tokens);
      
      expect(productions[0].expr.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Complex grammars', () => {
    it('should parse rule with quoted strings', () => {
      const tokens = lexAbnf('rule = "test" value "end"');
      const productions = parseAbnf(tokens);
      
      expect(productions[0].expr.length).toBeGreaterThanOrEqual(3);
    });

    it('should parse rule with optional elements', () => {
      const tokens = lexAbnf('rule = required [ optional ]');
      const productions = parseAbnf(tokens);
      
      expect(productions).toHaveLength(1);
    });

    it('should handle prose descriptions', () => {
      const tokens = lexAbnf('rule = <any OCTET>');
      const productions = parseAbnf(tokens);
      
      expect(productions).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('should throw on missing rule name', () => {
      const tokens = lexAbnf('= value');
      
      expect(() => parseAbnf(tokens)).toThrow('Expected rule name');
    });

    it('should throw on missing definition operator', () => {
      const tokens = lexAbnf('rule value');
      
      expect(() => parseAbnf(tokens)).toThrow();
    });

    it('should throw on empty production', () => {
      const tokens = lexAbnf('rule =\n');
      
      expect(() => parseAbnf(tokens)).toThrow('Empty production');
    });
  });

  describe('Real-world examples', () => {
    it('should parse CRLF rule', () => {
      const tokens = lexAbnf('CRLF = %x0D.0A ; carriage return line feed');
      const productions = parseAbnf(tokens);
      
      expect(productions).toHaveLength(1);
      expect(productions[0].name).toBe('CRLF');
    });

    it('should parse digit range', () => {
      const tokens = lexAbnf('DIGIT = %x30-39');
      const productions = parseAbnf(tokens);
      
      expect(productions).toHaveLength(1);
    });

    it('should parse complex HTTP grammar fragment', () => {
      const grammar = `
        HTTP-message = start-line CRLF
        start-line = request-line / status-line
        request-line = method SP request-target SP HTTP-version CRLF
      `;
      const tokens = lexAbnf(grammar);
      const productions = parseAbnf(tokens);
      
      expect(productions.length).toBeGreaterThanOrEqual(3);
    });
  });
});