import { LexerBuilder } from './builder';
import { Lexer, SerializedLexer } from './lexer';

describe('Lexer Serialization', () => {
  const eofOptions = { eofName: 'EOF' };

  // Shared builder for round-trip tests
  function makeArithLexer() {
    return new LexerBuilder<string | number>()
      .t('NUM', /[0-9]+/, (s) => parseInt(s, 10))
      .t('PLUS', '+')
      .t('MINUS', '-')
      .t('STAR', /\*/)
      .t('SLASH', /\//)
      .t('LPAREN', '(')
      .t('RPAREN', ')')
      .t(null, /\s+/)
      .build(eofOptions as never);
  }

  describe('serialize()', () => {
    it('returns a plain-object SerializedLexer', () => {
      const lexer = makeArithLexer();
      const data = lexer.serialize();
      expect(typeof data).toBe('object');
      expect(Array.isArray(data.records)).toBe(true);
      expect(typeof data.eofName).toBe('string');
    });

    it('contains one record per token rule (ignoring null-name rules)', () => {
      const lexer = makeArithLexer();
      const data = lexer.serialize();
      // 7 named rules + 1 whitespace-skip rule = 8 total records
      expect(data.records.length).toBe(8);
    });

    it('captures regex pattern and flags', () => {
      const lexer = makeArithLexer();
      const data = lexer.serialize();
      const num = data.records.find(r => r.name === 'NUM')!;
      expect(num).toBeDefined();
      expect(num.isRegExp).toBe(true);
      expect(num.pattern).toBe('[0-9]+');
    });

    it('captures plain-string patterns as non-regex', () => {
      const lexer = makeArithLexer();
      const data = lexer.serialize();
      const plus = data.records.find(r => r.name === 'PLUS')!;
      expect(plus.isRegExp).toBeFalsy();
      expect(plus.pattern).toBe('+');
    });

    it('captures eofName correctly', () => {
      const lexer = makeArithLexer();
      expect(lexer.serialize().eofName).toBe('EOF');
    });
  });

  describe('toJSON()', () => {
    it('returns a valid JSON string', () => {
      const lexer = makeArithLexer();
      const json = lexer.toJSON();
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('round-trips through JSON.parse', () => {
      const lexer = makeArithLexer();
      const parsed = JSON.parse(lexer.toJSON()) as SerializedLexer;
      expect(parsed.eofName).toBe('EOF');
      expect(parsed.records.length).toBe(8);
    });
  });

  describe('Lexer.deserialize()', () => {
    it('reconstructs a working lexer', () => {
      const original = makeArithLexer();
      const restored = Lexer.deserialize<string | number>(original.serialize());

      restored.reset('42 + 7');
      expect(restored.nextToken().name).toBe('NUM');
      expect(restored.nextToken().name).toBe('PLUS');
      expect(restored.nextToken().name).toBe('NUM');
      expect(restored.nextToken().name).toBe('EOF');
    });

    it('preserves numeric handler values', () => {
      const original = makeArithLexer();
      const restored = Lexer.deserialize<string | number>(original.serialize());

      const tok = restored.reset('123').nextToken();
      expect(tok.name).toBe('NUM');
      expect(tok.value).toBe(123);
    });

    it('preserves null-name (skip) rules', () => {
      const original = makeArithLexer();
      const restored = Lexer.deserialize<string | number>(original.serialize());

      // Whitespace should be skipped, first token should be NUM
      const tok = restored.reset('   42').nextToken();
      expect(tok.name).toBe('NUM');
    });

    it('preserves eofName', () => {
      const original = makeArithLexer();
      const restored = Lexer.deserialize<string | number>(original.serialize());

      restored.reset('');
      const tok = restored.nextToken();
      expect(restored.isEOF(tok)).toBe(true);
      expect(tok.name).toBe('EOF');
    });
  });

  describe('Lexer.fromJSON()', () => {
    it('round-trips through JSON', () => {
      const original = makeArithLexer();
      const json = original.toJSON();
      const restored = Lexer.fromJSON<string | number>(json);

      restored.reset('3 * 5');
      expect(restored.nextToken().name).toBe('NUM');
      expect(restored.nextToken().name).toBe('STAR');
      expect(restored.nextToken().name).toBe('NUM');
    });

    it('handles full tokenization identically to original', () => {
      const original = makeArithLexer();
      const restored = Lexer.fromJSON<string | number>(original.toJSON());

      const collect = (lexer: Lexer<string | number>, src: string) => {
        lexer.reset(src);
        const tokens: string[] = [];
        let t = lexer.nextToken();
        while (!lexer.isEOF(t)) {
          tokens.push(t.name);
          t = lexer.nextToken();
        }
        return tokens;
      };

      const src = '(1 + 2) * 3 / 4 - 5';
      expect(collect(restored, src)).toEqual(collect(original, src));
    });
  });

  describe('Lexer with nameSelector', () => {
    it('serializes and restores nameSelector-based token naming', () => {
      const original = new LexerBuilder<string>()
        .t((_v, lexeme) => 'OP_' + lexeme, /[\+\-\*\/]/)
        .t('NUM', /[0-9]+/)
        .build({ eofName: 'EOF' });

      const restored = Lexer.fromJSON<string>(original.toJSON());
      restored.reset('+');
      const tok = restored.nextToken();
      expect(tok.name).toBe('OP_+');
    });
  });
});
