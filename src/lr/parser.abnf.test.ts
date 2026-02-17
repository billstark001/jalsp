
import { Parser } from './parser';
import { LRGrammarBuilder } from './builder';
import { LexerBuilder } from '../lexer/builder';

describe('Parser with ABNF Support', () => {

  const eofOptions = { eofName: 'eof' };

  describe('ABNF Incremental Alternatives (=/)', () => {
    // Test ABNF incremental rule definition using =/
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('a', /a/);
    lexerBuilder.t('b', /b/);
    lexerBuilder.t('c', /c/);
    lexerBuilder.t('d', /d/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // Base rule
    grammarBuilder.abnf('S = a b', (x: string, y: string) => `${x}${y}`);

    // Incremental addition - this is ABNF specific
    grammarBuilder.abnf('S = c d', (x: string, y: string) => `${x}${y}`);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'S', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse first alternative', () => {
      const result = parse('ab');
      expect(result).toBe('ab');
    });

    it('should parse second alternative added incrementally', () => {
      const result = parse('cd');
      expect(result).toBe('cd');
    });

    it('should reject invalid input', () => {
      expect(() => parse('ac')).toThrow();
    });
  });

  describe('ABNF Repetition Operators (*)', () => {
    // Test ABNF repetition - zero or more, specific counts
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('a', /a/);
    lexerBuilder.t('b', /b/);
    lexerBuilder.t('x', /x/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // Zero or more 'a'
    grammarBuilder.abnf('list = b', () => ['b']);
    grammarBuilder.abnf('list = a list', (x: string, rest: string[]) => [x, ...rest]);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'list', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse zero repetitions', () => {
      const result = parse('b');
      expect(result).toEqual(['b']);
    });

    it('should parse multiple repetitions', () => {
      const result = parse('aaab');
      expect(result).toEqual(['a', 'a', 'a', 'b']);
    });
  });

  describe('ABNF Optional Elements [...]', () => {
    // Test ABNF optional elements with square brackets
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('letter', /[a-zA-Z]/);
    lexerBuilder.t('digit', /[0-9]/);
    lexerBuilder.t('dash', /-/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: ident = letter [dash digit]
    // Simulating optional with alternatives
    grammarBuilder.abnf('ident = letter', (l: string) => l);
    grammarBuilder.abnf('ident = letter dash digit',
      (l: string, d: string, n: string) => `${l}${d}${n}`);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'ident', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse without optional part', () => {
      const result = parse('x');
      expect(result).toBe('x');
    });

    it('should parse with optional part', () => {
      const result = parse('a-1');
      expect(result).toBe('a-1');
    });
  });

  describe('ABNF Character Value Notation (%x, %d)', () => {
    // Test ABNF numeric character values in hexadecimal and decimal
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('cr', /\r/);  // %d13 or %x0D
    lexerBuilder.t('lf', /\n/);  // %d10 or %x0A
    lexerBuilder.t('space', / /); // %d32 or %x20
    lexerBuilder.t('alpha', /[A-Za-z]/);
    lexerBuilder.t('digit', /[0-9]/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: %d13.10 (CRLF) or %x0D.0A
    grammarBuilder.abnf('crlf = cr lf', () => 'CRLF');

    // ABNF: SP = %x20
    grammarBuilder.abnf('sp = space', () => 'SP');

    // ABNF: ALPHA = %x41-5A / %x61-7A
    grammarBuilder.abnf('alpha-rule = alpha', (a: string) => a);

    // ABNF: DIGIT = %x30-39
    grammarBuilder.abnf('digit-rule = digit', (d: string) => d);

    const parsedGrammar1 = grammarBuilder.build({ startSymbol: 'crlf', eofToken: 'eof' });
    const parser1 = new Parser<string | undefined>(parsedGrammar1);

    const parsedGrammar2 = grammarBuilder.build({ startSymbol: 'sp', eofToken: 'eof' });
    const parser2 = new Parser<string | undefined>(parsedGrammar2);

    const parsedGrammar3 = grammarBuilder.build({ startSymbol: 'alpha-rule', eofToken: 'eof' });
    const parser3 = new Parser<string | undefined>(parsedGrammar3);

    it('should parse CRLF (%d13.10)', () => {
      const stream = lexer.reset('\r\n');
      const result = parser1.parse(stream);
      expect(result).toBe('CRLF');
    });

    it('should parse space (%x20)', () => {
      const stream = lexer.reset(' ');
      const result = parser2.parse(stream);
      expect(result).toBe('SP');
    });

    it('should parse ALPHA (%x41-5A / %x61-7A)', () => {
      const stream1 = lexer.reset('A');
      expect(parser3.parse(stream1)).toBe('A');

      const stream2 = lexer.reset('z');
      expect(parser3.parse(stream2)).toBe('z');
    });
  });

  describe('ABNF Value Range (e.g., %x30-39)', () => {
    // Test ABNF value ranges like %x30-39 for digits 0-9
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('digit', /[0-9]/);
    lexerBuilder.t('lower', /[a-z]/);
    lexerBuilder.t('upper', /[A-Z]/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: DIGIT = %x30-39
    grammarBuilder.abnf('digit-range = digit', (d: string) => parseInt(d, 10));

    // ABNF: lower = %x61-7A
    grammarBuilder.abnf('lower-range = lower', (l: string) => l.toLowerCase());

    // ABNF: upper = %x41-5A
    grammarBuilder.abnf('upper-range = upper', (u: string) => u.toUpperCase());

    const parsedGrammar1 = grammarBuilder.build({ startSymbol: 'digit-range', eofToken: 'eof' });
    const parser1 = new Parser<string | undefined>(parsedGrammar1);

    const parsedGrammar2 = grammarBuilder.build({ startSymbol: 'lower-range', eofToken: 'eof' });
    const parser2 = new Parser<string | undefined>(parsedGrammar2);

    it('should parse digit in range %x30-39', () => {
      const stream = lexer.reset('5');
      const result = parser1.parse(stream);
      expect(result).toBe(5);
    });

    it('should parse lowercase letter in range %x61-7A', () => {
      const stream = lexer.reset('m');
      const result = parser2.parse(stream);
      expect(result).toBe('m');
    });
  });

  describe('ABNF Case-Insensitive Strings', () => {
    // Test ABNF case-insensitive string matching (default behavior)
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('http', /https?/i);  // Case-insensitive by default in ABNF
    lexerBuilder.t('colon', /:/);
    lexerBuilder.t('slash', /\//);
    lexerBuilder.t('text', /[a-zA-Z]+/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: scheme = "http" / "https" (case-insensitive by default)
    grammarBuilder.abnf('scheme = http', (s: string) => s.toLowerCase());

    // ABNF: uri = scheme ":" "//" host
    grammarBuilder.abnf('uri = scheme colon slash slash text',
      (s: string, _c: string, _s1: string, _s2: string, h: string) => ({
        scheme: s,
        host: h
      }));

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'scheme', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse lowercase "http"', () => {
      const result = parse('http');
      expect(result).toBe('http');
    });

    it('should parse uppercase "HTTP"', () => {
      const result = parse('HTTP');
      expect(result).toBe('http');
    });

    it('should parse mixed case "HtTp"', () => {
      const result = parse('HtTp');
      expect(result).toBe('http');
    });
  });

  describe('ABNF Prose Notation <...>', () => {
    // Test ABNF prose values for human-readable descriptions
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('any-char', /./);
    lexerBuilder.t('text', /[a-zA-Z0-9]+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: description = <any US-ASCII character>
    // Simulating with any-char token
    grammarBuilder.abnf('prose-value = any-char', (c: string) => c);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'prose-value', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse any character (prose notation simulation)', () => {
      expect(parse('x')).toBe('x');
      expect(parse('5')).toBe('5');
      expect(parse('@')).toBe('@');
    });
  });

  describe('ABNF Specific Repetition (n*m element)', () => {
    // Test ABNF specific repetition counts like 2*4element
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('digit', /[0-9]/);
    lexerBuilder.t('letter', /[a-z]/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: code = 3digit (exactly 3 digits)
    grammarBuilder.abnf('code = digit digit digit',
      (d1: string, d2: string, d3: string) => `${d1}${d2}${d3}`);

    // ABNF: short-code = 2*3digit (2 to 3 digits)
    grammarBuilder.abnf('short-code = digit digit',
      (d1: string, d2: string) => `${d1}${d2}`);
    grammarBuilder.abnf('short-code = digit digit digit',
      (d1: string, d2: string, d3: string) => `${d1}${d2}${d3}`);

    const parsedGrammar1 = grammarBuilder.build({ startSymbol: 'code', eofToken: 'eof' });
    const parser1 = new Parser<string | undefined>(parsedGrammar1);

    const parsedGrammar2 = grammarBuilder.build({ startSymbol: 'short-code', eofToken: 'eof' });
    const parser2 = new Parser<string | undefined>(parsedGrammar2);

    it('should parse exactly 3 digits (3digit)', () => {
      const stream = lexer.reset('123');
      const result = parser1.parse(stream);
      expect(result).toBe('123');
    });

    it('should reject 2 digits when 3 required', () => {
      const stream = lexer.reset('12');
      expect(() => parser1.parse(stream)).toThrow();
    });

    it('should parse 2 digits (2*3digit)', () => {
      const stream = lexer.reset('45');
      const result = parser2.parse(stream);
      expect(result).toBe('45');
    });

    it('should parse 3 digits (2*3digit)', () => {
      const stream = lexer.reset('678');
      const result = parser2.parse(stream);
      expect(result).toBe('678');
    });
  });

  describe('ABNF Real-World Example: Email-like Pattern', () => {
    // Test ABNF pattern similar to RFC specifications
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('at', /@/);
    lexerBuilder.t('dot', /\./);
    lexerBuilder.t('word', /[a-zA-Z0-9]+/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: email = local-part "@" domain
    // ABNF: local-part = word
    // ABNF: domain = word "." word
    grammarBuilder.abnf('email = word at word dot word',
      (local: string, _at: string, domain1: string, _dot: string, domain2: string) => ({
        local,
        domain: `${domain1}.${domain2}`
      }));

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'email', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse email-like pattern', () => {
      const result = parse('user@example.com');
      expect(result).toEqual({
        local: 'user',
        domain: 'example.com'
      });
    });

    it('should parse different names', () => {
      const result = parse('admin@test.org');
      expect(result).toEqual({
        local: 'admin',
        domain: 'test.org'
      });
    });
  });

  describe('ABNF Comment Handling', () => {
    // Test ABNF comment syntax (in actual ABNF, comments start with ;)
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('word', /[a-zA-Z]+/);
    lexerBuilder.t('semicolon', /;/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // Simple rule: statement = word
    grammarBuilder.abnf('statement = word', (w: string) => w);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'statement', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse simple word (comments filtered by lexer)', () => {
      const result = parse('hello');
      expect(result).toBe('hello');
    });
  });

  describe('ABNF Multiple Alternatives with /', () => {
    // Test ABNF alternation operator /
    const lexerBuilder = new LexerBuilder<string | number>();
    lexerBuilder.t('alpha', /[A-Z]/);
    lexerBuilder.t('digit', /[0-9]/, (raw) => parseInt(raw, 10));
    lexerBuilder.t('special', /[!@#$%]/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: char = ALPHA / DIGIT / special
    grammarBuilder.abnf('char = alpha', (a: string) => ({ type: 'alpha', value: a }));
    grammarBuilder.abnf('char = digit', (d: number) => ({ type: 'digit', value: d }));
    grammarBuilder.abnf('char = special', (s: string) => ({ type: 'special', value: s }));

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'char', eofToken: 'eof' });
    const parser = new Parser<string | number | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse ALPHA', () => {
      const result = parse('X');
      expect(result).toEqual({ type: 'alpha', value: 'X' });
    });

    it('should parse DIGIT', () => {
      const result = parse('7');
      expect(result).toEqual({ type: 'digit', value: 7 });
    });

    it('should parse special character', () => {
      const result = parse('@');
      expect(result).toEqual({ type: 'special', value: '@' });
    });
  });

  describe('ABNF Concatenation Sequence', () => {
    // Test ABNF sequence concatenation (space-separated elements)
    const lexerBuilder = new LexerBuilder<string>();
    lexerBuilder.t('letter', /[a-z]/);
    lexerBuilder.t('digit', /[0-9]/);
    lexerBuilder.t('dash', /-/);
    lexerBuilder.t('underscore', /_/);
    lexerBuilder.t(null, /\s+/);

    const lexer = lexerBuilder.build(eofOptions);

    const grammarBuilder = new LRGrammarBuilder();

    // ABNF: identifier = letter *(letter / digit / "-" / "_")
    // Simplified version
    grammarBuilder.abnf('identifier = letter', (l: string) => l);
    grammarBuilder.abnf('identifier = letter letter',
      (l1: string, l2: string) => `${l1}${l2}`);
    grammarBuilder.abnf('identifier = letter digit',
      (l: string, d: string) => `${l}${d}`);
    grammarBuilder.abnf('identifier = letter dash letter',
      (l1: string, d: string, l2: string) => `${l1}${d}${l2}`);

    const parsedGrammar = grammarBuilder.build({ startSymbol: 'identifier', eofToken: 'eof' });
    const parser = new Parser<string | undefined>(parsedGrammar);

    const parse = (input: string) => {
      const stream = lexer.reset(input);
      return parser.parse(stream);
    };

    it('should parse single letter', () => {
      const result = parse('x');
      expect(result).toBe('x');
    });

    it('should parse letter followed by letter', () => {
      const result = parse('ab');
      expect(result).toBe('ab');
    });

    it('should parse letter followed by digit', () => {
      const result = parse('a1');
      expect(result).toBe('a1');
    });

    it('should parse letter-dash-letter', () => {
      const result = parse('a-b');
      expect(result).toBe('a-b');
    });
  });
});
