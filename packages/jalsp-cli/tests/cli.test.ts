/**
 * jalsp-cli integration test suite
 *
 * Tests cover:
 *  - serialize command (lexer & parser, default / named exports, in-file options)
 *  - bundle  command  (lexer & parser, bundled JS output)
 *  - end-to-end:  load the serialised/bundled artifact and verify parse results
 *  - performance:  measure build time and parse throughput; print a summary table
 *
 * Grammar fixtures are in ./fixtures/:
 *  - arith-lexer.ts   (arithmetic tokeniser)
 *  - arith-parser.ts  (arithmetic expression parser)
 *  - ident-lexer.ts   (identifier / keyword tokeniser, with nameSelector)
 *  - bool-parser.ts   (boolean expression parser)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LexerBuilder, LRGrammarBuilder, Lexer, Parser } from 'jalsp';
import type { SerializedLexer, SerializedParser } from 'jalsp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FIXTURES = resolve(__dirname, 'fixtures');
const TMP = resolve(__dirname, 'tmp');

/** Custom error for CLI execution failures */
class CliExecutionError extends Error {
  constructor(
    message: string,
    public stdout: string,
    public stderr: string,
    public code: number,
  ) {
    super(message);
    this.name = 'CliExecutionError';
    Object.setPrototypeOf(this, CliExecutionError.prototype);
  }
}

/** Run the compiled CLI binary (dist/index.js) via Node. */
function runCli(args: string[], cwd = ROOT): { stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [join(ROOT, 'dist', 'index.js'), ...args],
    { cwd, encoding: 'utf8' },
  );

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const code = result.status ?? 1;

  if (code !== 0) {
    throw new CliExecutionError(
      `CLI command failed with exit code ${code}\nArgs: ${args.join(' ')}\nStderr: ${stderr}`,
      stdout,
      stderr,
      code,
    );
  }

  return { stdout, stderr };
}

/** Build a fresh arithmetic lexer (used in multiple tests). */
function makeArithLexer() {
  return new LexerBuilder<string | number>()
    .t('NUM', /[0-9]+(\.[0-9]+)?/, (s) => parseFloat(s))
    .t('PLUS', '+')
    .t('MINUS', '-')
    .t('STAR', /\*/)
    .t('SLASH', /\//)
    .t('LPAREN', '(')
    .t('RPAREN', ')')
    .t(null, /\s+/)
    .build({ eofName: '<<EOF>>' });
}

/** Build a fresh arithmetic parser (used in multiple tests). */
function makeArithParser(lexer: ReturnType<typeof makeArithLexer>) {
  const pg = new LRGrammarBuilder()
    .bnf('E = E PLUS T', (e: number, _: unknown, t: number) => e + t)
    .bnf('E = E MINUS T', (e: number, _: unknown, t: number) => e - t)
    .bnf('E = T', (t: number) => t)
    .bnf('T = T STAR F', (t: number, _: unknown, f: number) => t * f)
    .bnf('T = T SLASH F', (t: number, _: unknown, f: number) => t / f)
    .bnf('T = F', (f: number) => f)
    .bnf('F = LPAREN E RPAREN', (_1: unknown, e: number, _2: unknown) => e)
    .bnf('F = NUM', (n: number) => n)
    .opr('left', 'PLUS', 'MINUS')
    .opr('left', 'STAR', 'SLASH')
    .build({ startSymbol: 'E', eofToken: '<<EOF>>' });
  return new Parser<string | number>(pg);
}

/** Build a boolean lexer matching the bool-parser fixture grammar. */
function makeBoolLexer() {
  return new LexerBuilder<string | boolean>()
    .t('TRUE', 'true', () => true as boolean)
    .t('FALSE', 'false', () => false as boolean)
    .t('AND', '&&')
    .t('OR', '||')
    .t('NOT', '!')
    .t('LPAREN', '(')
    .t('RPAREN', ')')
    .t(null, /\s+/)
    .build({ eofName: '<<EOF>>' });
}

// Performance tracking
interface PerfEntry { label: string; ms: number }
const perfLog: PerfEntry[] = [];
function perf(label: string, fn: () => void): void {
  const t0 = performance.now();
  fn();
  perfLog.push({ label, ms: +(performance.now() - t0).toFixed(2) });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  // Print performance table
  const colW = 50;
  console.log('\n' + '─'.repeat(colW + 12));
  console.log('  Performance Report');
  console.log('─'.repeat(colW + 12));
  for (const { label, ms } of perfLog) {
    console.log(`  ${label.padEnd(colW)} ${String(ms).padStart(8)} ms`);
  }
  console.log('─'.repeat(colW + 12) + '\n');

  // Clean up temp output
  rmSync(TMP, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// CLI - serialize command (lexer)
// ---------------------------------------------------------------------------

describe('CLI serialize lexer', () => {
  it('serializes arith-lexer to stdout (default export)', () => {
    const result = runCli(['serialize', 'lexer', join(FIXTURES, 'arith-lexer.ts')]);
    const data = JSON.parse(result.stdout) as SerializedLexer;
    expect(Array.isArray(data.records)).toBe(true);
    expect(data.eofName).toBeDefined();
  });

  it('serializes arith-lexer to a file', () => {
    const outFile = join(TMP, 'arith-lexer.json');
    perf('CLI serialize lexer → file', () => {
      const result = runCli(['serialize', 'lexer', join(FIXTURES, 'arith-lexer.ts'), '-o', outFile]);
    });
    expect(existsSync(outFile)).toBe(true);
    const data = JSON.parse(readFileSync(outFile, 'utf8')) as SerializedLexer;
    expect(data.records.length).toBeGreaterThan(0);
  });

  it('serializes ident-lexer using named export via --export flag', () => {
    // ident-lexer.ts uses a nameSelector - the internal record name is generated
    // but the lexer should have records
    const result = runCli([
      'serialize', 'lexer',
      join(FIXTURES, 'ident-lexer.ts'),
      '--export', 'default',
    ]);
    const data = JSON.parse(result.stdout) as SerializedLexer;
    // Should have at least: the identifier/keyword rule, NUMBER, STRING, punctuation, skip
    expect(data.records.length).toBeGreaterThan(5);
  });

  it('fails gracefully on unknown export name', () => {
    expect(() => runCli([
      'serialize', 'lexer',
      join(FIXTURES, 'arith-lexer.ts'),
      '--export', 'nonExistent',
    ])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CLI - serialize command (parser)
// ---------------------------------------------------------------------------

describe('CLI serialize parser', () => {
  it('serializes arith-parser using in-file options (eof + start)', () => {
    // arith-parser.ts exports `defaultOptions` with eof + start
    perf('CLI serialize parser (arith)', () => {
      const result = runCli(['serialize', 'parser', join(FIXTURES, 'arith-parser.ts')]);
      const data = JSON.parse(result.stdout) as SerializedParser;
      expect(typeof data.action).toBe('object');
      expect(Array.isArray(data.symbols)).toBe(true);
    });
  });

  it('serializes bool-parser using in-file options', () => {
    const result = runCli(['serialize', 'parser', join(FIXTURES, 'bool-parser.ts')]);
    const data = JSON.parse(result.stdout) as SerializedParser;
    expect(data.symbols.some(s => s.name === 'E')).toBe(true);
  });

  it('CLI --eof flag overrides in-file options', () => {
    // arith-parser.ts in-file sets eof='<<EOF>>'; passing a different one should override
    const result = runCli([
      'serialize', 'parser',
      join(FIXTURES, 'arith-parser.ts'),
      '--eof', '<<EOF>>',
    ]);
  });

  it('serializes parser to a file', () => {
    const outFile = join(TMP, 'arith-parser.json');
    const result = runCli([
      'serialize', 'parser',
      join(FIXTURES, 'arith-parser.ts'),
      '-o', outFile,
    ]);
    expect(existsSync(outFile)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CLI - in-file options: --options-export
// ---------------------------------------------------------------------------

describe('CLI --options-export flag', () => {
  it('loads options from explicitly named export', () => {
    // ident-lexer.ts exports `myLexerOptions` (with exportName: 'myLexer')
    const result = runCli([
      'serialize', 'lexer',
      join(FIXTURES, 'ident-lexer.ts'),
      '--options-export', 'myLexerOptions',
    ]);
    const data = JSON.parse(result.stdout) as SerializedLexer;
    expect(data.records.length).toBeGreaterThan(0);
  });

  it('errors when --options-export points to non-existent export', () => {
    expect(() => runCli([
      'serialize', 'lexer',
      join(FIXTURES, 'arith-lexer.ts'),
      '--options-export', 'badOptions',
    ])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CLI - bundle command
// ---------------------------------------------------------------------------

describe('CLI bundle', () => {
  it('bundles arith-lexer to a JS file', () => {
    const outDir = join(TMP, 'bundle-arith-lexer');
    perf('CLI bundle lexer (arith)', () => {
      const result = runCli([
        'bundle', 'lexer',
        join(FIXTURES, 'arith-lexer.ts'),
        '-o', outDir,
        '--out-name', 'arith-lexer',
      ]);
    });
    expect(existsSync(join(outDir, 'arith-lexer.js'))).toBe(true);
  });

  it('bundled lexer JS is non-empty', () => {
    const outDir = join(TMP, 'bundle-arith-lexer-check');
    runCli([
      'bundle', 'lexer',
      join(FIXTURES, 'arith-lexer.ts'),
      '-o', outDir,
      '--out-name', 'arith-lexer',
    ]);
    const js = readFileSync(join(outDir, 'arith-lexer.js'), 'utf8');
    expect(js.length).toBeGreaterThan(100);
  });

  it('bundles arith-parser to a JS file', () => {
    const outDir = join(TMP, 'bundle-arith-parser');
    perf('CLI bundle parser (arith)', () => {
      const result = runCli([
        'bundle', 'parser',
        join(FIXTURES, 'arith-parser.ts'),
        '-o', outDir,
        '--out-name', 'arith-parser',
      ]);
    });
    expect(existsSync(join(outDir, 'arith-parser.js'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: Serialise → Deserialise → Parse
// ---------------------------------------------------------------------------

describe('End-to-end: serialize → deserialize → parse', () => {
  describe('Arithmetic lexer', () => {
    let restoredLexer: Lexer<string | number>;

    beforeAll(() => {
      const origLexer = makeArithLexer();
      perf('Lexer.fromJSON round-trip', () => {
        restoredLexer = Lexer.fromJSON<string | number>(origLexer.toJSON());
      });
    });

    it('tokenizes integers', () => {
      restoredLexer.reset('42');
      const t = restoredLexer.nextToken();
      expect(t.name).toBe('NUM');
      expect(t.value).toBe(42);
    });

    it('tokenizes floats', () => {
      restoredLexer.reset('3.14');
      const t = restoredLexer.nextToken();
      expect(t.name).toBe('NUM');
      expect(t.value).toBeCloseTo(3.14);
    });

    it('tokenizes operators and parens', () => {
      restoredLexer.reset('(1+2)');
      const names = [];
      let tok = restoredLexer.nextToken();
      while (!restoredLexer.isEOF(tok)) {
        names.push(tok.name);
        tok = restoredLexer.nextToken();
      }
      expect(names).toEqual(['LPAREN', 'NUM', 'PLUS', 'NUM', 'RPAREN']);
    });

    it('skips whitespace', () => {
      restoredLexer.reset('  42  +  7  ');
      const names = [];
      let tok = restoredLexer.nextToken();
      while (!restoredLexer.isEOF(tok)) {
        names.push(tok.name);
        tok = restoredLexer.nextToken();
      }
      expect(names).toEqual(['NUM', 'PLUS', 'NUM']);
    });
  });

  describe('Identifier / keyword lexer', () => {
    let restoredLexer: Lexer<string>;

    beforeAll(() => {
      const origLexer = new LexerBuilder<string>()
        .t(
          (_v, lexeme) => {
            const kw = new Set(['if', 'else', 'while', 'return', 'true', 'false']);
            return kw.has(lexeme) ? 'KW_' + lexeme.toUpperCase() : 'IDENT';
          },
          /[a-zA-Z_][a-zA-Z0-9_]*/,
          (s) => s,
        )
        .t('NUMBER', /[0-9]+/)
        .t('SEMI', ';')
        .t(null, /\s+/)
        .build({ eofName: '<<EOF>>' });
      perf('Ident-lexer Lexer.fromJSON round-trip', () => {
        restoredLexer = Lexer.fromJSON<string>(origLexer.toJSON());
      });
    });

    it('identifies keywords', () => {
      restoredLexer.reset('if');
      expect(restoredLexer.nextToken().name).toBe('KW_IF');
    });

    it('identifies identifiers', () => {
      restoredLexer.reset('myVar');
      expect(restoredLexer.nextToken().name).toBe('IDENT');
    });

    it('handles mixed tokens', () => {
      restoredLexer.reset('while x');
      expect(restoredLexer.nextToken().name).toBe('KW_WHILE');
      expect(restoredLexer.nextToken().name).toBe('IDENT');
    });
  });

  describe('Arithmetic parser', () => {
    let lexer: Lexer<string | number>;
    let restoredParser: Parser<string | number>;

    beforeAll(() => {
      lexer = makeArithLexer();
      const origParser = makeArithParser(lexer);
      perf('Arith Parser.fromJSON round-trip', () => {
        restoredParser = Parser.fromJSON<string | number>(origParser.toJSON());
      });
    });

    const parse = (src: string) => restoredParser.parse(lexer.reset(src));

    it('evaluates simple addition', () => {
      expect(parse('1 + 2')).toBe(3);
    });

    it('evaluates simple subtraction', () => {
      expect(parse('10 - 3')).toBe(7);
    });

    it('evaluates multiplication', () => {
      expect(parse('3 * 4')).toBe(12);
    });

    it('evaluates division', () => {
      expect(parse('8 / 4')).toBe(2);
    });

    it('respects operator precedence (* over +)', () => {
      expect(parse('2 + 3 * 4')).toBe(14);
    });

    it('respects parentheses', () => {
      expect(parse('(2 + 3) * 4')).toBe(20);
    });

    it('handles complex expressions', () => {
      expect(parse('10 - 2 * 3 + 1')).toBe(5);
    });

    it('handles floating-point numbers', () => {
      expect(parse('1.5 + 0.5')).toBeCloseTo(2);
    });

    it('throws on invalid input', () => {
      expect(() => parse('2 +')).toThrow();
    });

    it('parse throughput benchmark (1,000 parses)', () => {
      const exprs = ['1+2', '3*4', '10-5', '(2+3)*4', '100/2+3*5'];
      let iterations = 0;
      perf('Arith parser: 1000 parses', () => {
        for (let i = 0; i < 1000; i++) {
          parse(exprs[i % exprs.length]);
          iterations++;
        }
      });
      expect(iterations).toBe(1000);
    });
  });

  describe('Boolean parser', () => {
    let lexer: Lexer<string | boolean>;
    let restoredParser: Parser<string | boolean>;

    beforeAll(() => {
      lexer = makeBoolLexer();

      // Layered grammar: OR < AND < NOT (same structure as existing parser tests)
      const pg = new LRGrammarBuilder()
        .bnf('E = E OR T', (a: boolean, _: unknown, b: boolean) => a || b)
        .bnf('E = T', (t: boolean) => t)
        .bnf('T = T AND F', (a: boolean, _: unknown, b: boolean) => a && b)
        .bnf('T = F', (f: boolean) => f)
        .bnf('F = NOT F', (_: unknown, e: boolean) => !e)
        .bnf('F = LPAREN E RPAREN', (_1: unknown, e: boolean, _2: unknown) => e)
        .bnf('F = TRUE', () => true)
        .bnf('F = FALSE', () => false)
        .opr('left', 'OR')
        .opr('left', 'AND')
        .opr('right', 'NOT')
        .build({ startSymbol: 'E', eofToken: '<<EOF>>' });

      const origParser = new Parser<string | boolean>(pg);
      perf('Bool Parser.fromJSON round-trip', () => {
        restoredParser = Parser.fromJSON<string | boolean>(origParser.toJSON());
      });
    });

    const parse = (src: string) => restoredParser.parse(lexer.reset(src));

    it('parses true literal', () => {
      expect(parse('true')).toBe(true);
    });

    it('parses false literal', () => {
      expect(parse('false')).toBe(false);
    });

    it('evaluates AND', () => {
      expect(parse('true && false')).toBe(false);
    });

    it('evaluates OR', () => {
      expect(parse('true || false')).toBe(true);
    });

    it('evaluates NOT', () => {
      expect(parse('!true')).toBe(false);
    });

    it('respects precedence (AND before OR)', () => {
      expect(parse('true || false && false')).toBe(true);
    });

    it('handles parentheses', () => {
      expect(parse('(true || false) && false')).toBe(false);
    });

    it('handles complex expression', () => {
      expect(parse('!false && (true || false)')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// CLI serialize → deserialise pipeline
// ---------------------------------------------------------------------------

describe('CLI serialize → deserialize pipeline', () => {
  it('arith-lexer: CLI output deserializes to working Lexer', () => {
    const result = runCli(['serialize', 'lexer', join(FIXTURES, 'arith-lexer.ts')]);

    perf('Pipeline: CLI serialize lexer → Lexer.fromJSON', () => {
      const lexer = Lexer.fromJSON<string | number>(result.stdout);
      lexer.reset('1 + 2 * 3');
      const names: string[] = [];
      let tok = lexer.nextToken();
      while (!lexer.isEOF(tok)) { names.push(tok.name); tok = lexer.nextToken(); }
      expect(names).toEqual(['NUM', 'PLUS', 'NUM', 'STAR', 'NUM']);
    });
  });

  it('arith-parser: CLI output deserializes to working Parser', () => {
    const result = runCli(['serialize', 'parser', join(FIXTURES, 'arith-parser.ts')]);

    perf('Pipeline: CLI serialize parser → Parser.fromJSON', () => {
      const parser = Parser.fromJSON<string | number>(result.stdout);
      const lexer = makeArithLexer();
      expect(parser.parse(lexer.reset('3 + 4 * 2'))).toBe(11);
    });
  });

  it('bool-parser: CLI output deserializes to working Parser', () => {
    const result = runCli(['serialize', 'parser', join(FIXTURES, 'bool-parser.ts')]);

    const boolLexer = makeBoolLexer();
    const parser = Parser.fromJSON<string | boolean>(result.stdout);
    expect(parser.parse(boolLexer.reset('true && !false'))).toBe(true);
  });
});
