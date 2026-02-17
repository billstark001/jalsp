/* eslint-disable @typescript-eslint/no-explicit-any */
import { Parser } from './parser';
import { LRGrammarBuilder } from './builder';
import { LexerBuilder } from '../lexer/builder';
import { parseEbnf } from '../ebnf/ebnf-parser';

describe('Parser with EBNF Support', () => {

  const eofOptions = { eofName: 'eof' };

  describe('Optional Elements', () => {
    // Test parser with optional semicolon
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('id', /[a-zA-Z]+/);
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('eq', /=/);
    lexerBuilder.t('semi', /;/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.registerEbnfParser(parseEbnf);

    // S -> id = num [;]
    grammarBuilder.ebnf('S = id eq num [semi]', (id: string, _eq: string, val: number, semi?: string) => ({
      name: id,
      value: val,
      terminated: semi !== undefined
    }));

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'S', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse statement with semicolon', () => {
      const result = parse('x = 42;');
      expect(result).toEqual({
        name: 'x',
        value: 42,
        terminated: true
      });
    });

    it('should parse statement without semicolon', () => {
      const result = parse('x = 42');
      expect(result).toEqual({
        name: 'x',
        value: 42,
        terminated: false
      });
    });
  });

  describe('Repetition Elements', () => {
    // Test parser with repetition
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('comma', /,/);
    lexerBuilder.t('lbracket', /\[/);
    lexerBuilder.t('rbracket', /\]/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.registerEbnfParser(parseEbnf);

    // L -> [ {num ,} ]
    // This represents a list with optional trailing comma pattern
    grammarBuilder.ebnf('L = lbracket rbracket', () => []);
    grammarBuilder.ebnf('L = lbracket num {comma num} rbracket', 
      (_l: string, first: number, rest: any[], _r: string) => {
        const result = [first];
        // rest is an array of arrays, each containing [comma, num]
        if (Array.isArray(rest)) {
          rest.forEach(item => {
            if (Array.isArray(item) && item.length >= 2) {
              result.push(item[1]);
            }
          });
        }
        return result;
      }
    );

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'L', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse empty list', () => {
      const result = parse('[]');
      expect(result).toEqual([]);
    });

    it('should parse single element list', () => {
      const result = parse('[1]');
      expect(result).toEqual([1]);
    });

    it('should parse multi-element list', () => {
      const result = parse('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('Grouping and Alternation', () => {
    // Test parser with grouped alternatives
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('if', /if/);
    lexerBuilder.t('then', /then/);
    lexerBuilder.t('else', /else/);
    lexerBuilder.t('id', /[a-zA-Z]+/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.registerEbnfParser(parseEbnf);

    // S -> if id then id [else id]
    grammarBuilder.ebnf('S = if id then id', 
      (_if: string, cond: string, _then: string, body: string) => ({
        type: 'if',
        condition: cond,
        then: body,
        else: undefined
      })
    );
    grammarBuilder.ebnf('S = if id then id else id', 
      (_if: string, cond: string, _then: string, thenBody: string, _else: string, elseBody: string) => ({
        type: 'if',
        condition: cond,
        then: thenBody,
        else: elseBody
      })
    );

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'S', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse if-then statement', () => {
      const result = parse('if x then y');
      expect(result).toEqual({
        type: 'if',
        condition: 'x',
        then: 'y',
        else: undefined
      });
    });

    it('should parse if-then-else statement', () => {
      const result = parse('if x then y else z');
      expect(result).toEqual({
        type: 'if',
        condition: 'x',
        then: 'y',
        else: 'z'
      });
    });
  });

  describe('Multiplication Operator', () => {
    // Test parser with exact repetition count
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('a', /a/);
    lexerBuilder.t('b', /b/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.registerEbnfParser(parseEbnf);

    // S -> a * 3 b  (exactly 3 a's followed by b)
    grammarBuilder.ebnf('S = a a a b', (a1: string, a2: string, a3: string, b: string) => `${a1}${a2}${a3}${b}`);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'S', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse exactly three a followed by b', () => {
      const result = parse('aaab');
      expect(result).toBe('aaab');
    });

    it('should reject wrong number of a', () => {
      expect(() => parse('aab')).toThrow();
      expect(() => parse('aaaab')).toThrow();
    });
  });

  describe('Nested EBNF Constructs', () => {
    // Test parser with nested optional and repetition
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('plus', /\+/);
    lexerBuilder.t('lparen', /\(/);
    lexerBuilder.t('rparen', /\)/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.registerEbnfParser(parseEbnf);

    // E -> num {+ num}
    grammarBuilder.ebnf('E = num', (n: number) => n);
    grammarBuilder.ebnf('E = num plus E', (n1: number, _: string, n2: number) => n1 + n2);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'E', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse single number', () => {
      const result = parse('42');
      expect(result).toBe(42);
    });

    it('should parse addition chain', () => {
      const result = parse('1 + 2 + 3');
      expect(result).toBe(6);
    });

    it('should parse longer addition chain', () => {
      const result = parse('10 + 20 + 30 + 40');
      expect(result).toBe(100);
    });
  });

  describe('Complex Expression Parser with EBNF', () => {
    // Test a more realistic expression parser using EBNF
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('id', /[a-zA-Z]+/);
    lexerBuilder.t('plus', /\+/);
    lexerBuilder.t('times', /\*/);
    lexerBuilder.t('lparen', /\(/);
    lexerBuilder.t('rparen', /\)/);
    lexerBuilder.t('comma', /,/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.registerEbnfParser(parseEbnf);

    // Expression grammar with function calls
    // E -> T {+ T}
    grammarBuilder.bnf('E = T', (t: any) => t);
    grammarBuilder.bnf('E = E plus T', (e: number, _: string, t: number) => e + t);

    // T -> F {* F}
    grammarBuilder.bnf('T = F', (f: any) => f);
    grammarBuilder.bnf('T = T times F', (t: number, _: string, f: number) => t * f);

    // F -> num | id | (E) | id(args)
    grammarBuilder.bnf('F = num', (n: number) => n);
    grammarBuilder.bnf('F = id', (id: string) => id);
    grammarBuilder.bnf('F = lparen E rparen', (_l: string, e: number, _r: string) => e);

    grammarBuilder.opr('left', 'plus');
    grammarBuilder.opr('left', 'times');

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'E', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse number', () => {
      const result = parse('42');
      expect(result).toBe(42);
    });

    it('should parse addition', () => {
      const result = parse('1 + 2 + 3');
      expect(result).toBe(6);
    });

    it('should parse multiplication and addition with precedence', () => {
      const result = parse('2 + 3 * 4');
      expect(result).toBe(14);
    });

    it('should parse parenthesized expression', () => {
      const result = parse('(2 + 3) * 4');
      expect(result).toBe(20);
    });
  });
});
