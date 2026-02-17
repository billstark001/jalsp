import { Parser } from './parser';
import { LRGrammarBuilder } from './builder';
import { LexerBuilder } from '../lexer/builder';

describe('Parser', () => {

  describe('Arithmetic Expression Parser', () => {
    // Build lexer for arithmetic expressions
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('plus', /\+/);
    lexerBuilder.t('minus', /-/);
    lexerBuilder.t('times', /\*/);
    lexerBuilder.t('divide', /\//);
    lexerBuilder.t('lparen', /\(/);
    lexerBuilder.t('rparen', /\)/);
    lexerBuilder.t(() => undefined, /\s+/); // skip whitespace

    const lexer = lexerBuilder.build('eof');

    // Build grammar for arithmetic expressions
    const grammarBuilder = new LRGrammarBuilder();

    // E -> E + T | E - T | T
    grammarBuilder.bnf('E = E plus T', (e: number, _: string, t: number) => e + t);
    grammarBuilder.bnf('E = E minus T', (e: number, _: string, t: number) => e - t);
    grammarBuilder.bnf('E = T', (t: number) => t);

    // T -> T * F | T / F | F
    grammarBuilder.bnf('T = T times F', (t: number, _: string, f: number) => t * f);
    grammarBuilder.bnf('T = T divide F', (t: number, _: string, f: number) => Math.floor(t / f));
    grammarBuilder.bnf('T = F', (f: number) => f);

    // F -> ( E ) | num
    grammarBuilder.bnf('F = lparen E rparen', (_1: string, e: number, _2: string) => e);
    grammarBuilder.bnf('F = num', (n: number) => n);

    // Set operator precedence
    grammarBuilder.opr('left', 'plus', 'minus');
    grammarBuilder.opr('left', 'times', 'divide');

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'E', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    }

    it('should parse simple addition', () => {
      const input = '2 + 3';
      const result = parse(input);
      expect(result).toBe(5);
    });

    it('should parse simple multiplication', () => {
      const input = '4 * 5';
      const result = parse(input);
      expect(result).toBe(20);
    });

    it('should respect operator precedence', () => {
      const input = '2 + 3 * 4';
      const result = parse(input);
      expect(result).toBe(14); // 2 + (3 * 4) = 14
    });

    it('should handle parentheses', () => {
      const input = '(2 + 3) * 4';
      const result = parse(input);
      expect(result).toBe(20); // (2 + 3) * 4 = 20
    });

    it('should handle complex expressions', () => {
      const input = '10 + 2 * 6 / 3';
      const result = parse(input);
      expect(result).toBe(14); // 10 + ((2 * 6) / 3) = 10 + 4 = 14
    });

    it('should handle nested parentheses', () => {
      const input = '((2 + 3) * (4 + 5))';
      const result = parse(input);
      expect(result).toBe(45); // (5 * 9) = 45
    });

    it('should handle subtraction and division', () => {
      const input = '20 - 10 / 2';
      const result = parse(input);
      expect(result).toBe(15); // 20 - (10 / 2) = 15
    });
  });

  describe('Simple Parentheses Parser', () => {
    // Build lexer
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('a', /a/);
    lexerBuilder.t('lparen', /\(/);
    lexerBuilder.t('rparen', /\)/);
    lexerBuilder.t(() => undefined, /\s+/);

    const lexer = lexerBuilder.build('eof');

    // Build grammar: S -> a | (S)
    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.bnf('S = a', (a: string) => a);
    grammarBuilder.bnf('S = lparen S rparen', (_1: string, s: string, _2: string) => `(${s})`);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'S', eofToken: 'eof' });
    const parser = new Parser(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    }

    it('should parse single "a"', () => {
      const input = 'a';
      const result = parse(input);
      expect(result).toBe('a');
    });

    it('should parse "(a)"', () => {
      const input = '(a)';
      const result = parse(input);
      expect(result).toBe('(a)');
    });

    it('should parse nested parentheses', () => {
      const input = '((a))';
      const result = parse(input);
      expect(result).toBe('((a))');
    });

    it('should parse deeply nested parentheses', () => {
      const input = '(((a)))';
      const result = parse(input);
      expect(result).toBe('(((a)))');
    });
  });

  describe('List Parser', () => {
    // Build lexer for list syntax
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('comma', /,/);
    lexerBuilder.t('lbracket', /\[/);
    lexerBuilder.t('rbracket', /\]/);
    lexerBuilder.t(() => undefined, /\s+/);

    const lexer = lexerBuilder.build('eof');

    // Build grammar for lists
    const grammarBuilder = new LRGrammarBuilder();

    // L -> [ ] | [ E ]
    grammarBuilder.bnf('L = lbracket rbracket', () => []);
    grammarBuilder.bnf('L = lbracket E rbracket', (_1: string, e: number[], _2: string) => e);

    // E -> E , num | num
    grammarBuilder.bnf('E = E comma num', (e: number[], _: string, n: number) => [...e, n]);
    grammarBuilder.bnf('E = num', (n: number) => [n]);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'L', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    }

    it('should parse empty list', () => {
      const input = '[]';
      const result = parse(input);
      expect(result).toEqual([]);
    });

    it('should parse single element list', () => {
      const input = '[42]';
      const result = parse(input);
      expect(result).toEqual([42]);
    });

    it('should parse multi-element list', () => {
      const input = '[1, 2, 3]';
      const result = parse(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should parse list with whitespace', () => {
      const input = '[ 10 , 20 , 30 ]';
      const result = parse(input);
      expect(result).toEqual([10, 20, 30]);
    });
  });

  describe('Identifier and Assignment Parser', () => {
    interface Assignment {
      type: 'assignment';
      name: string;
      value: number;
    }

    // Build lexer
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('id', /[a-zA-Z_][a-zA-Z0-9_]*/, (raw) => raw);
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('eq', /=/);
    lexerBuilder.t(() => undefined, /\s+/);

    const lexer = lexerBuilder.build('eof');

    // Build grammar for assignment
    const grammarBuilder = new LRGrammarBuilder();

    // S -> id = num
    grammarBuilder.bnf('S = id eq num', (name: string, _: string, value: number): Assignment => ({
      type: 'assignment',
      name,
      value
    }));

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'S', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined, Assignment>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    }

    it('should parse simple assignment', () => {
      const input = 'x = 42';
      const result = parse(input);
      expect(result).toEqual({
        type: 'assignment',
        name: 'x',
        value: 42
      });
    });

    it('should parse assignment with different identifier', () => {
      const input = 'myVar = 100';
      const result = parse(input);
      expect(result).toEqual({
        type: 'assignment',
        name: 'myVar',
        value: 100
      });
    });
  });

  describe('Boolean Expression Parser', () => {
    // Build lexer
    const lexerBuilder = new LexerBuilder<boolean>();
    lexerBuilder.t('true', /true/, () => true);
    lexerBuilder.t('false', /false/, () => false);
    lexerBuilder.t('and', /&&/);
    lexerBuilder.t('or', /\|\|/);
    lexerBuilder.t('not', /!/);
    lexerBuilder.t('lparen', /\(/);
    lexerBuilder.t('rparen', /\)/);
    lexerBuilder.t(() => undefined, /\s+/);

    const lexer = lexerBuilder.build('eof');

    // Build grammar for boolean expressions
    const grammarBuilder = new LRGrammarBuilder();

    // E -> E || T | T
    grammarBuilder.bnf('E = E or T', (e: boolean, _: string, t: boolean) => e || t);
    grammarBuilder.bnf('E = T', (t: boolean) => t);

    // T -> T && F | F
    grammarBuilder.bnf('T = T and F', (t: boolean, _: string, f: boolean) => t && f);
    grammarBuilder.bnf('T = F', (f: boolean) => f);

    // F -> ! F | ( E ) | true | false
    grammarBuilder.bnf('F = not F', (_: string, f: boolean) => !f);
    grammarBuilder.bnf('F = lparen E rparen', (_1: string, e: boolean, _2: string) => e);
    grammarBuilder.bnf('F = true', (t: boolean) => t);
    grammarBuilder.bnf('F = false', (f: boolean) => f);

    grammarBuilder.opr('left', 'or');
    grammarBuilder.opr('left', 'and');
    grammarBuilder.opr('right', 'not');

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'E', eofToken: 'eof' });
    const parser = new Parser<boolean | undefined>(parsedGrammar);


    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    }

    it('should parse true', () => {
      const input = 'true';
      const result = parse(input);
      expect(result).toBe(true);
    });

    it('should parse false', () => {
      const input = 'false';
      const result = parse(input);
      expect(result).toBe(false);
    });

    it('should parse AND operation', () => {
      const input = 'true && false';
      const result = parse(input);
      expect(result).toBe(false);
    });

    it('should parse OR operation', () => {
      const input = 'true || false';
      const result = parse(input);
      expect(result).toBe(true);
    });

    it('should parse NOT operation', () => {
      const input = '!false';
      const result = parse(input);
      expect(result).toBe(true);
    });

    it('should respect operator precedence', () => {
      const input = 'true || false && false';
      const result = parse(input);
      expect(result).toBe(true); // true || (false && false)
    });

    it('should handle parentheses', () => {
      const input = '(true || false) && false';
      const result = parse(input);
      expect(result).toBe(false); // (true || false) && false = true && false
    });

    it('should handle complex boolean expressions', () => {
      const input = '!false && (true || false)';
      const result = parse(input);
      expect(result).toBe(true); // true && true
    });

    it('should handle double negation', () => {
      const input = '!!true';
      const result = parse(input);
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    // Build simple lexer
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('num', /[0-9]+/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('plus', /\+/);
    lexerBuilder.t(() => undefined, /\s+/);

    const lexer = lexerBuilder.build('eof');

    // Build simple grammar
    const grammarBuilder = new LRGrammarBuilder();
    grammarBuilder.bnf('E = E plus E', (e1: number, _: string, e2: number) => e1 + e2);
    grammarBuilder.bnf('E = num', (n: number) => n);

    // Set operator precedence to resolve ambiguity
    grammarBuilder.opr('left', 'plus');

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'E', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);


    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    }

    it('should throw error on unexpected token', () => {
      const input = '2 + + 3';
      expect(() => parse(input)).toThrow();
    });

    it('should throw error on incomplete expression', () => {
      const input = '2 +';
      expect(() => parse(input)).toThrow();
    });
  });
});
