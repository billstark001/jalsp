import { LexerBuilder } from '../lexer/builder';
import { Parser, SerializedParser } from './parser';
import { LRGrammarBuilder } from './builder';

describe('Parser Serialization', () => {
  const eofToken = 'EOF';

  /** Build a simple arithmetic parser (E → E+T | T, T → num) */
  function makeArithSetup() {
    const lexer = new LexerBuilder<string | number>()
      .t('num', /[0-9]+/, (s) => parseInt(s, 10))
      .t('plus', /\+/)
      .t('minus', /-/)
      .t('star', /\*/)
      .t(null, /\s+/)
      .build({ eofName: eofToken });

    const gb = new LRGrammarBuilder()
      .bnf('E = E plus T', (e: number, _: unknown, t: number) => e + t)
      .bnf('E = E minus T', (e: number, _: unknown, t: number) => e - t)
      .bnf('E = T', (t: number) => t)
      .bnf('T = T star F', (t: number, _: unknown, f: number) => t * f)
      .bnf('T = F', (f: number) => f)
      .bnf('F = num', (n: number) => n)
      .opr('left', 'plus', 'minus')
      .opr('left', 'star');

    const pg = gb.build({ startSymbol: 'E', eofToken });
    const parser = new Parser<string | number>(pg);

    const parse = (p: Parser<string | number>, src: string) =>
      p.parse(lexer.reset(src));

    return { lexer, parser, parse };
  }

  describe('serialize()', () => {    it('returns a plain-object SerializedParser', () => {
      const { parser } = makeArithSetup();
      const data = parser.serialize();
      expect(typeof data).toBe('object');
      expect(typeof data.action).toBe('object');
      expect(typeof data.goto).toBe('object');
      expect(Array.isArray(data.symbols)).toBe(true);
      expect(typeof data.symbolsTable).toBe('object');
    });

    it('includes serialized action functions', () => {
      const { parser } = makeArithSetup();
      const data = parser.serialize();
      const fnEntries = data.actions.filter(a => a !== undefined);
      expect(fnEntries.length).toBeGreaterThan(0);
    });

    it('symbols contain name and isNT flag', () => {
      const { parser } = makeArithSetup();
      const data = parser.serialize();
      for (const sym of data.symbols) {
        expect(typeof sym.name).toBe('string');
        expect(typeof sym.isNT).toBe('boolean');
      }
    });
  });

  describe('toJSON()', () => {
    it('returns a valid JSON string', () => {
      const { parser } = makeArithSetup();
      const json = parser.toJSON();
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('round-trips through JSON.parse', () => {
      const { parser } = makeArithSetup();
      const data = JSON.parse(parser.toJSON()) as SerializedParser;
      expect(typeof data.action).toBe('object');
      expect(Array.isArray(data.symbols)).toBe(true);
    });
  });

  describe('Parser.deserialize()', () => {
    it('reconstructs a working parser', () => {
      const { parser } = makeArithSetup();
      const restored = Parser.deserialize<string | number>(parser.serialize());

      // Use same lexer from a fresh setup for both
      const { lexer, parser: origParser } = makeArithSetup();
      const parseR = (src: string) => restored.parse(lexer.reset(src));
      const parseOrig2 = (src: string) => origParser.parse(lexer.reset(src));

      expect(parseR('2 + 3')).toBe(parseOrig2('2 + 3'));
      expect(parseR('10 - 4')).toBe(parseOrig2('10 - 4'));
      expect(parseR('3 * 4')).toBe(parseOrig2('3 * 4'));
    });

    it('preserves action handlers', () => {
      const { parser } = makeArithSetup();
      const restored = Parser.deserialize<string | number>(parser.serialize());
      const { lexer } = makeArithSetup();

      expect(restored.parse(lexer.reset('6 + 7'))).toBe(13);
      expect(restored.parse(lexer.reset('10 - 3'))).toBe(7);
    });
  });

  describe('Parser.fromJSON()', () => {
    it('round-trips through JSON', () => {
      const { parser } = makeArithSetup();
      const restored = Parser.fromJSON<string | number>(parser.toJSON());
      const { lexer } = makeArithSetup();

      expect(restored.parse(lexer.reset('2 + 3'))).toBe(5);
      expect(restored.parse(lexer.reset('4 * 5'))).toBe(20);
      expect(restored.parse(lexer.reset('10 - 7'))).toBe(3);
    });

    it('handles operator precedence correctly after round-trip', () => {
      const { parser } = makeArithSetup();
      const restored = Parser.fromJSON<string | number>(parser.toJSON());
      const { lexer } = makeArithSetup();

      // 2 + 3 * 4 = 2 + 12 = 14 (star has higher precedence)
      expect(restored.parse(lexer.reset('2 + 3 * 4'))).toBe(14);
    });

    it('produces identical results to original parser', () => {
      const { parser } = makeArithSetup();
      const restored = Parser.fromJSON<string | number>(parser.toJSON());
      const { lexer, parser: origParser } = makeArithSetup();
      const parseR = (src: string) => restored.parse(lexer.reset(src));
      const parseOrig = (src: string) => origParser.parse(lexer.reset(src));

      const cases = ['1', '1 + 2', '10 - 3', '3 * 4', '2 + 3 * 4', '10 - 2 * 3'];
      for (const c of cases) {
        expect(parseR(c)).toBe(parseOrig(c));
      }
    });

    it('throws on invalid input after round-trip', () => {
      const { parser } = makeArithSetup();
      const restored = Parser.fromJSON<string | number>(parser.toJSON());
      const { lexer } = makeArithSetup();

      expect(() => restored.parse(lexer.reset('2 +'))).toThrow();
    });
  });
});
