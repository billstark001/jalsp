import { LexerBuilder } from './lexer/builder';
import { LRGrammarBuilder } from './lr/builder';
import { Parser } from './lr/parser';
import { Lexer } from './lexer/lexer';
import { generateLexerModule, generateParserModule } from './codegen';

describe('generateLexerModule()', () => {
  function makeArithLexer() {
    return new LexerBuilder<string | number>()
      .t('NUM', /[0-9]+/, (s) => parseInt(s, 10))
      .t('PLUS', '+')
      .t('MINUS', '-')
      .t(null, /\s+/)
      .build({ eofName: 'EOF' });
  }

  it('returns a string', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>);
    expect(typeof code).toBe('string');
  });

  it('imports Lexer from the specified package', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>, { importFrom: 'jalsp' });
    expect(code).toContain("from 'jalsp'");
    expect(code).toContain('Lexer');
  });

  it('uses custom importFrom', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>, { importFrom: '@my/pkg' });
    expect(code).toContain("from '@my/pkg'");
  });

  it('uses default export name "lexer"', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>);
    expect(code).toContain('export const lexer =');
  });

  it('uses custom export name', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>, { exportName: 'myLexer' });
    expect(code).toContain('export const myLexer =');
  });

  it('does not export raw data by default', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>);
    expect(code).not.toContain('export const lexerData');
  });

  it('exports raw data when exportData: true', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>, { exportData: true });
    expect(code).toContain('export const lexerData');
  });

  it('embeds serialized JSON data inline', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>);
    expect(code).toContain('_lexerData');
    expect(code).toContain('"eofName"');
  });

  it('accepts a SerializedLexer object directly', () => {
    const lexer = makeArithLexer();
    const data = lexer.serialize();
    const code = generateLexerModule(data);
    expect(code).toContain('export const lexer =');
  });

  it('generates valid executable module code', () => {
    const lexer = makeArithLexer();
    const code = generateLexerModule(lexer as Lexer<unknown>, { importFrom: 'jalsp' });

    // Strip import and remove `export` keyword to make it evaluable with new Function
    const execCode = code
      .replace(/^import \{[^}]+\} from '[^']+';$/m, '')
      .replace(/\bexport const /g, 'const ');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('Lexer', execCode + '\nreturn lexer;');
    const restoredLexer = fn(Lexer) as Lexer<string | number>;

    restoredLexer.reset('42 + 7');
    expect(restoredLexer.nextToken().name).toBe('NUM');
    expect(restoredLexer.nextToken().name).toBe('PLUS');
    expect(restoredLexer.nextToken().name).toBe('NUM');
  });
});

describe('generateParserModule()', () => {
  const eofToken = 'EOF';

  function makeArithSetup() {
    const lexer = new LexerBuilder<string | number>()
      .t('num', /[0-9]+/, (s) => parseInt(s, 10))
      .t('plus', /\+/)
      .t('minus', /-/)
      .t(null, /\s+/)
      .build({ eofName: eofToken });

    const pg = new LRGrammarBuilder()
      .bnf('E = E plus T', (e: number, _: unknown, t: number) => e + t)
      .bnf('E = E minus T', (e: number, _: unknown, t: number) => e - t)
      .bnf('E = T', (t: number) => t)
      .bnf('T = num', (n: number) => n)
      .opr('left', 'plus', 'minus')
      .build({ startSymbol: 'E', eofToken });

    const parser = new Parser<string | number>(pg);
    return { lexer, parser, pg };
  }

  it('returns a string', () => {
    const { parser } = makeArithSetup();
    const code = generateParserModule(parser);
    expect(typeof code).toBe('string');
  });

  it('imports Parser from the specified package', () => {
    const { parser } = makeArithSetup();
    const code = generateParserModule(parser, { importFrom: 'jalsp' });
    expect(code).toContain("from 'jalsp'");
    expect(code).toContain('Parser');
  });

  it('uses custom importFrom', () => {
    const { parser } = makeArithSetup();
    const code = generateParserModule(parser, { importFrom: '@my/pkg' });
    expect(code).toContain("from '@my/pkg'");
  });

  it('uses default export name "parser"', () => {
    const { parser } = makeArithSetup();
    const code = generateParserModule(parser);
    expect(code).toContain('export const parser =');
  });

  it('uses custom export name', () => {
    const { parser } = makeArithSetup();
    const code = generateParserModule(parser, { exportName: 'myParser' });
    expect(code).toContain('export const myParser =');
  });

  it('does not export raw data by default', () => {
    const { parser } = makeArithSetup();
    const code = generateParserModule(parser);
    expect(code).not.toContain('export const parserData');
  });

  it('exports raw data when exportData: true', () => {
    const { parser } = makeArithSetup();
    const code = generateParserModule(parser, { exportData: true });
    expect(code).toContain('export const parserData');
  });

  it('accepts a ParsedGrammar object directly', () => {
    const { pg } = makeArithSetup();
    const code = generateParserModule(pg);
    expect(code).toContain('export const parser =');
  });

  it('accepts a SerializedParser object directly', () => {
    const { parser } = makeArithSetup();
    const data = parser.serialize();
    const code = generateParserModule(data);
    expect(code).toContain('export const parser =');
  });

  it('generates valid executable module code', () => {
    const { parser, lexer } = makeArithSetup();
    const code = generateParserModule(parser, { importFrom: 'jalsp' });

    const execCode = code
      .replace(/^import \{[^}]+\} from '[^']+';$/m, '')
      .replace(/\bexport const /g, 'const ');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('Parser', execCode + '\nreturn parser;');
    const restoredParser = fn(Parser) as Parser<string | number>;

    expect(restoredParser.parse(lexer.reset('2 + 3'))).toBe(5);
    expect(restoredParser.parse(lexer.reset('10 - 4'))).toBe(6);
  });
});
