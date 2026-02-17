import { LexerBuilder, LexerBuilderDefineOptions } from './builder';
import { Lexer } from './lexer';

describe('Lexer', () => {

  const eofOptions = {
    eofName: 'EOF',
  }

  const testLexer = new LexerBuilder<string | undefined>()
    .t(null, / +/)
    .t((v, l) => 'T' + l, /[\+\-\*\/]/)
    .build(eofOptions);

  describe('Basic Lexing', () => {
    it('Discards tokens where an undefined is returned in the first function', () => {
      expect(testLexer.reset('      ').nextToken().name).toBe('EOF');
    });

    it('Determines tokens\' name according to the passed function', () => {
      expect(testLexer.reset('+').nextToken().name).toBe('T+');
    });
  });

  describe('Basic Tokenization', () => {
    let lexer: Lexer<string | number>;

    beforeEach(() => {
      lexer = new LexerBuilder<string | number>()
        .t('NUMBER', /\d+/, (lexeme) => parseInt(lexeme))
        .t('IDENTIFIER', /[a-zA-Z_]\w*/)
        .t('PLUS', '+')
        .t('MINUS', '-')
        .t('MULTIPLY', '*')
        .t('DIVIDE', '/')
        .t('LPAREN', '(')
        .t('RPAREN', ')')
        .t(null, /\s+/) // whitespace
        .build(eofOptions as LexerBuilderDefineOptions<string | number>);
    });

    it('should tokenize a sequence of numbers and operators', () => {
      lexer.reset('42 + 17 - 3');

      const token1 = lexer.nextToken();
      expect(token1.name).toBe('NUMBER');
      expect(token1.value).toBe(42);
      expect(token1.lexeme).toBe('42');

      const token2 = lexer.nextToken();
      expect(token2.name).toBe('PLUS');

      const token3 = lexer.nextToken();
      expect(token3.name).toBe('NUMBER');
      expect(token3.value).toBe(17);

      const token4 = lexer.nextToken();
      expect(token4.name).toBe('MINUS');

      const token5 = lexer.nextToken();
      expect(token5.name).toBe('NUMBER');
      expect(token5.value).toBe(3);

      const token6 = lexer.nextToken();
      expect(token6.name).toBe('EOF');
    });

    it('should tokenize identifiers and string operators', () => {
      lexer.reset('foo + bar');

      expect(lexer.nextToken().name).toBe('IDENTIFIER');
      expect(lexer.nextToken().name).toBe('PLUS');
      expect(lexer.nextToken().name).toBe('IDENTIFIER');
      expect(lexer.nextToken().name).toBe('EOF');
    });

    it('should tokenize expressions with parentheses', () => {
      lexer.reset('(a + b) * c');

      expect(lexer.nextToken().name).toBe('LPAREN');
      expect(lexer.nextToken().name).toBe('IDENTIFIER');
      expect(lexer.nextToken().name).toBe('PLUS');
      expect(lexer.nextToken().name).toBe('IDENTIFIER');
      expect(lexer.nextToken().name).toBe('RPAREN');
      expect(lexer.nextToken().name).toBe('MULTIPLY');
      expect(lexer.nextToken().name).toBe('IDENTIFIER');
    });

    it('should handle empty input', () => {
      lexer.reset('');
      const token = lexer.nextToken();
      expect(token.name).toBe('EOF');
      expect(lexer.isEOF(token)).toBe(true);
    });

    it('should handle whitespace-only input', () => {
      lexer.reset('   \t  \n  ');
      expect(lexer.nextToken().name).toBe('EOF');
    });
  });

  describe('Token Handlers', () => {
    it('should apply token handlers to transform values', () => {
      const lexer = new LexerBuilder<string | number>()
        .t('HEX', /0x[0-9a-fA-F]+/, (lexeme) => parseInt(lexeme, 16))
        .t('FLOAT', /\d+\.\d+/, (lexeme) => parseFloat(lexeme))
        .t('UPPER', /[a-z]+/, (lexeme) => lexeme.toUpperCase())
        .build();

      lexer.reset('0xff');
      expect(lexer.nextToken().value).toBe(255);

      lexer.reset('3.14');
      expect(lexer.nextToken().value).toBe(3.14);

      lexer.reset('hello');
      expect(lexer.nextToken().value).toBe('HELLO');
    });

    it('should use lexeme as value when handler returns undefined', () => {
      const lexer = new LexerBuilder<string | undefined>()
        .t('WORD', /\w+/, () => 'ignored')
        .build();

      lexer.reset('test');
      const token = lexer.nextToken();
      expect(token.value).toBe('ignored');
    });
  });

  describe('Token Name Selectors', () => {
    it('should discard tokens when name selector returns undefined', () => {
      const lexer = new LexerBuilder()
        .t('WORD', /\w+/)
        .t(null, /\s+/)  // whitespace
        .t(null, /\/\/.*/)  // comments
        .build();

      lexer.reset('hello // this is a comment');
      expect(lexer.nextToken().name).toBe('WORD');
      expect(lexer.nextToken().name).toBe(Lexer.DEFAULT_EOF_TOKEN);
    });

    it('should rename tokens based on value', () => {
      const keywords = new Set(['if', 'else', 'while', 'for']);
      const lexer = new LexerBuilder()
        .t((value) => keywords.has(value) ? 'KEYWORD' : 'IDENTIFIER', /[a-zA-Z_]\w*/)
        .t(null, /\s+/)
        .build();

      lexer.reset('if x while y foo');

      expect(lexer.nextToken().name).toBe('KEYWORD');
      expect(lexer.nextToken().name).toBe('IDENTIFIER');
      expect(lexer.nextToken().name).toBe('KEYWORD');
      expect(lexer.nextToken().name).toBe('IDENTIFIER');
      expect(lexer.nextToken().name).toBe('IDENTIFIER');
    });
  });

  describe('Position Tracking', () => {
    it('should track token positions correctly', () => {
      const lexer = new LexerBuilder()
        .t('WORD', /\w+/)
        .t(null, /\s+/)
        .build();

      lexer.reset('hello world');

      const token1 = lexer.nextToken();
      expect(token1.position).toBe(0);
      expect(token1.pos).toBeDefined();
      expect(token1.pos!.line).toBe(1);
      expect(token1.pos!.col).toBe(0);

      const token2 = lexer.nextToken();
      expect(token2.position).toBe(6);
      expect(token2.pos).toBeDefined();
      expect(token2.pos!.line).toBe(1);
      expect(token2.pos!.col).toBe(6);
    });

    it('should track line and column numbers in multiline input', () => {
      const lexer = new LexerBuilder()
        .t('WORD', /\w+/)
        .t(null, /\s+/)
        .build();

      lexer.reset('first\nsecond\nthird');

      const token1 = lexer.nextToken();
      expect(token1.lexeme).toBe('first');
      expect(token1.pos).toBeDefined();
      expect(token1.pos!.line).toBe(1);
      expect(token1.pos!.col).toBe(0);

      const token2 = lexer.nextToken();
      expect(token2.lexeme).toBe('second');
      expect(token2.pos).toBeDefined();
      expect(token2.pos!.line).toBe(2);
      expect(token2.pos!.col).toBe(0);

      const token3 = lexer.nextToken();
      expect(token3.lexeme).toBe('third');
      expect(token3.pos).toBeDefined();
      expect(token3.pos!.line).toBe(3);
      expect(token3.pos!.col).toBe(0);
    });

    it('should report current position correctly', () => {
      const lexer = new LexerBuilder()
        .t('NUM', /\d+/)
        .t(null, / /)
        .build();

      lexer.reset('12 34');

      expect(lexer.currentPosition()).toBe(0);
      lexer.nextToken();
      expect(lexer.currentPosition()).toBe(2);
      lexer.nextToken();
      expect(lexer.currentPosition()).toBe(5);
    });

    it('should report current file position correctly', () => {
      const lexer = new LexerBuilder()
        .t('WORD', /\w+/)
        .t(null, /\s+/)
        .build();

      lexer.reset('foo\nbar');
      lexer.nextToken(); // consume 'foo'
      lexer.nextToken(); // consume 'bar'

      const pos = lexer.currentFilePosition();
      expect(pos.line).toBe(2);
      expect(pos.col).toBe(3);
    });
  });

  describe('Seek Operations', () => {
    let lexer: Lexer<string>;

    beforeEach(() => {
      lexer = new LexerBuilder()
        .t('CHAR', /[a-z]/)
        .build();
    });

    it('should seek from the beginning', () => {
      lexer.reset('abcdef');
      lexer.seek(3);

      const token = lexer.nextToken();
      expect(token.lexeme).toBe('d');
      expect(token.position).toBe(3);
    });

    it('should seek from current position', () => {
      lexer.reset('abcdef');
      lexer.nextToken(); // advance to position 1
      lexer.seek(2, 'current');

      const token = lexer.nextToken();
      expect(token.lexeme).toBe('d');
    });

    it('should seek from the end', () => {
      lexer.reset('abcdef');
      lexer.seek(-2, 'end');

      const token = lexer.nextToken();
      expect(token.lexeme).toBe('e');
    });
  });

  describe('Reset Operations', () => {
    it('should reset with new string', () => {
      const lexer = new LexerBuilder()
        .t('NUM', /\d+/)
        .build();

      lexer.reset('123');
      expect(lexer.nextToken().lexeme).toBe('123');

      lexer.reset('456');
      expect(lexer.nextToken().lexeme).toBe('456');
    });

    it('should reset position when reusing same string', () => {
      const lexer = new LexerBuilder()
        .t('NUM', /\d+/)
        .t(null, / /)
        .build();

      lexer.reset('1 2 3');
      lexer.nextToken();
      lexer.nextToken();

      lexer.reset(); // reset without changing string
      expect(lexer.currentPosition()).toBe(0);
      expect(lexer.nextToken().lexeme).toBe('1');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown tokens', () => {
      const lexer = new LexerBuilder()
        .t('LETTER', /[a-z]/)
        .build();

      lexer.reset('a1b');
      lexer.nextToken(); // 'a'

      expect(() => lexer.nextToken()).toThrow('Unknown token');
    });

    it('should throw error when no input string is assigned', () => {
      const lexer = new LexerBuilder()
        .t('WORD', /\w+/)
        .build();

      expect(() => lexer.nextToken()).toThrow('No input string assigned');
    });

    it('should throw error for zero-length tokens', () => {
      const lexer = new LexerBuilder()
        .t('EMPTY', /a*/)  // can match empty string
        .build();

      lexer.reset('b');
      expect(() => lexer.nextToken()).toThrow('Zero-length token');
    });

    it('should throw error for invalid pointer position', () => {
      const lexer = new LexerBuilder()
        .t('CHAR', /[a-z]/)
        .build();

      lexer.reset('abc');
      lexer.seek(-5);

      expect(() => lexer.nextToken()).toThrow('Invalid pointer position');
    });
  });

  describe('EOF Handling', () => {
    it('should return EOF token at end of input', () => {
      const lexer = new LexerBuilder()
        .t('WORD', /\w+/)
        .build(eofOptions);

      lexer.reset('test');
      lexer.nextToken();

      const eof = lexer.nextToken();
      expect(eof.name).toBe('EOF');
      expect(eof.value).toBe('EOF');
      expect(eof.lexeme).toBe('EOF');
      expect(lexer.isEOF(eof)).toBe(true);
    });

    it('should use custom EOF token', () => {
      const lexer = new LexerBuilder()
        .t('NUM', /\d+/)
        .build({ eofName: 'END_OF_INPUT' });

      lexer.reset('42');
      lexer.nextToken();

      const eof = lexer.nextToken();
      expect(eof.name).toBe('END_OF_INPUT');
      expect(lexer.isEOF(eof)).toBe(true);
    });

    it('should return multiple EOF tokens when called repeatedly at end', () => {
      const lexer = new LexerBuilder()
        .t('X', 'x')
        .build();

      lexer.reset('x');
      lexer.nextToken();

      const [t1, t2, t3] = lexer.nextTokens(3);
      expect(t1.name).toBe(Lexer.DEFAULT_EOF_TOKEN);
      expect(t2.name).toBe(Lexer.DEFAULT_EOF_TOKEN);
      expect(t3.name).toBe(Lexer.DEFAULT_EOF_TOKEN);
    });
  });

  describe('Advanced Pattern Matching', () => {
    it('should handle regex with capture groups', () => {
      const lexer = new LexerBuilder()
        .t('TAG', /<([a-z]+)>/, (lexeme, pos, arr) => arr ? arr[1] : lexeme)
        .build();

      lexer.reset('<div>');
      const token = lexer.nextToken();
      expect(token.lexeme).toBe('<div>');
      expect(token.value).toBe('div'); // captured group
    });

    it('should prefer earlier rules when multiple patterns match', () => {
      const lexer = new LexerBuilder()
        .t('KEYWORD', 'if')
        .t('SPACE', / +/)
        .t('IDENTIFIER', /[a-z]+/)
        .build();

      lexer.reset('if');
      expect(lexer.nextToken().name).toBe('KEYWORD');

      lexer.reset('if x');
      const [t1, , t2, t3] = lexer.nextTokens(4);
      expect(t1.name).toBe('KEYWORD');
      expect(t1.lexeme).toBe('if');
      expect(t2.name).toBe('IDENTIFIER');
      expect(t2.lexeme).toBe('x');
      expect(t3.name).toBe(Lexer.DEFAULT_EOF_TOKEN);
    });
  });

  describe('Non-advancing Token Retrieval', () => {
    it('should peek at next token without advancing', () => {
      const lexer = new LexerBuilder()
        .t('CHAR', /[a-z]/)
        .build();

      lexer.reset('abc');

      const peek1 = lexer.nextToken(false);
      expect(peek1.lexeme).toBe('a');
      expect(lexer.currentPosition()).toBe(0);

      const actual1 = lexer.nextToken(true);
      expect(actual1.lexeme).toBe('a');
      expect(lexer.currentPosition()).toBe(1);

      const peek2 = lexer.nextToken(false);
      expect(peek2.lexeme).toBe('b');
      expect(lexer.currentPosition()).toBe(1);
    });
  });

  describe('Complex Lexers', () => {
    it('should tokenize a simple programming language', () => {
      const lexer = new LexerBuilder()
        .t('NUMBER', /\d+/)
        .t('STRING', /"[^"]*"/, (lexeme) => lexeme.slice(1, -1))
        .t((value) => ['if', 'else', 'while', 'return'].includes(value) ? 'KEYWORD' : 'IDENTIFIER', /[a-zA-Z_]\w*/)
        .t('EQ', '==')
        .t('NEQ', '!=')
        .t('ASSIGN', '=')
        .t('PLUS', '+')
        .t('MINUS', '-')
        .t('SEMICOLON', ';')
        .t('LBRACE', '{')
        .t('RBRACE', '}')
        .t('LPAREN', '(')
        .t('RPAREN', ')')
        .t(null, /\s+/)
        .build();

      const code = 'if (x == 42) { return "success"; }';
      lexer.reset(code);

      const tokens = [];
      let token;
      do {
        token = lexer.nextToken();
        tokens.push(token.name);
      } while (!lexer.isEOF(token));

      expect(tokens).toEqual([
        'KEYWORD',     // if
        'LPAREN',      // (
        'IDENTIFIER',  // x
        'EQ',          // ==
        'NUMBER',      // 42
        'RPAREN',      // )
        'LBRACE',      // {
        'KEYWORD',     // return
        'STRING',      // "success"
        'SEMICOLON',   // ;
        'RBRACE',      // }
        Lexer.DEFAULT_EOF_TOKEN
      ]);
    });
  });

});