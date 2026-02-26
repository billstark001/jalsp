#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { pathToFileURL } from 'url';
import { rollup as rollupBuild, type Plugin } from 'rollup';
import { nodeResolve as rollupResolve } from '@rollup/plugin-node-resolve';
import { generateLexerModule, generateParserModule } from 'jalsp';
import type { LexerBuilder, LRGrammarBuilder, GrammarBuildingOptions } from 'jalsp';

// These plugins use CJS-only type definitions; cast via unknown to bypass NodeNext type resolution
const rollupCommonjs = ((await import('@rollup/plugin-commonjs')) as unknown as { default: () => Plugin }).default;
const rollupTerser = ((await import('@rollup/plugin-terser')) as unknown as { default: () => Plugin }).default;

/**
 * Options that can be exported from an entry file to control build behaviour.
 *
 * Export this object under any name and pass `--options-export <name>` to the
 * CLI, or use the conventional name `<exportName>Options` (e.g. `myLexerOptions`
 * when `--export myLexer` is used).
 *
 * @example
 * ```ts
 * // my-parser.ts
 * export const myParserOptions: JalspEntryOptions = {
 *   eof: 'EOF',
 *   start: 'Program',
 * };
 * export default builder;
 * ```
 */
export interface JalspEntryOptions {
  /** EOF token name (parser only) */
  eof?: string;
  /** Start symbol (parser only) */
  start?: string;
  /** Export name used by `generateLexerModule` / `generateParserModule` */
  exportName?: string;
  /** Package to import Lexer/Parser from in generated module code */
  importFrom?: string;
}

const program = new Command();
program.name('jalsp-cli').description('Compile and bundle jalsp lexers and parsers').version('0.1.0');

/**
 * Load an export from an ESM JS/TS file.
 * - When exportName is 'default', falls back to the module namespace if default is absent.
 * - When exportName is anything else, the named export must exist (no fallback).
 */
async function loadExport(file: string, exportName: string): Promise<unknown> {
  const absPath = resolve(file);
  const fileUrl = pathToFileURL(absPath).href;
  const mod = await import(fileUrl);
  let value: unknown;
  if (exportName === 'default') {
    value = mod.default ?? mod;
  } else {
    value = mod[exportName];
    if (value === undefined) {
      throw new Error(`Export '${exportName}' not found in ${file}`);
    }
  }
  return value;
}

/**
 * Resolve in-file options for a given entry file.
 *
 * Priority (highest first):
 * 1. `--options-export <name>` → load that named export from the file
 * 2. `<exportName>Options`     → conventional name based on the builder export
 * 3. No in-file options        → return `{}`
 */
async function loadEntryOptions(
  file: string,
  exportName: string,
  optionsExportName?: string,
): Promise<JalspEntryOptions> {
  const absPath = resolve(file);
  const fileUrl = pathToFileURL(absPath).href;
  const mod = await import(fileUrl);

  // 1. Explicit --options-export flag
  if (optionsExportName) {
    const opts = mod[optionsExportName];
    if (opts === undefined) {
      throw new Error(`Options export '${optionsExportName}' not found in ${file}`);
    }
    return opts as JalspEntryOptions;
  }

  // 2. Conventional name: <exportName>Options
  const conventional = exportName === 'default' ? 'defaultOptions' : `${exportName}Options`;
  if (mod[conventional] !== undefined) {
    return mod[conventional] as JalspEntryOptions;
  }

  return {};
}

// ---------------------------------------------------------------------------
// serialize command
// ---------------------------------------------------------------------------
program
  .command('serialize <type> <file>')
  .description('Serialize a LexerBuilder or LRGrammarBuilder to JSON')
  .option('-e, --export <name>', 'Named export of the builder in the entry file', 'default')
  .option('--options-export <name>', 'Named export of the JalspEntryOptions object in the entry file')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--eof <token>', 'EOF token name for the parser (overrides in-file options)')
  .option('--start <symbol>', 'Start symbol for the parser (overrides in-file options)')
  .action(async (
    type: string,
    file: string,
    opts: { export: string; optionsExport?: string; output?: string; eof?: string; start?: string },
  ) => {
    try {
      const [entry, fileOpts] = await Promise.all([
        loadExport(file, opts.export),
        loadEntryOptions(file, opts.export, opts.optionsExport),
      ]);

      // CLI flags override in-file options
      const eof = opts.eof ?? fileOpts.eof;
      const start = opts.start ?? fileOpts.start;

      let json: string;
      if (type === 'lexer') {
        const lb = entry as LexerBuilder;
        const lexer = lb.build();
        json = lexer.toJSON();
      } else if (type === 'parser') {
        const gb = entry as LRGrammarBuilder;
        const buildOpts: GrammarBuildingOptions = { eofToken: eof, startSymbol: start };
        const pg = gb.build(buildOpts);
        const { Parser } = await import('jalsp');
        const parser = new Parser(pg);
        json = parser.toJSON();
      } else {
        throw new Error(`Unknown type: ${type}. Must be 'lexer' or 'parser'.`);
      }

      if (opts.output) {
        mkdirSync(dirname(opts.output), { recursive: true });
        writeFileSync(opts.output, json, 'utf8');
        console.log(`Serialized to ${opts.output}`);
      } else {
        process.stdout.write(json + '\n');
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// bundle command
// ---------------------------------------------------------------------------
program
  .command('bundle <type> <file>')
  .description('Bundle a LexerBuilder or LRGrammarBuilder to a minified ESM module')
  .option('-e, --export <name>', 'Named export of the builder in the entry file', 'default')
  .option('--options-export <name>', 'Named export of the JalspEntryOptions object in the entry file')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .option('--out-name <name>', 'Base name for output files', 'compiled')
  .option('--eof <token>', 'EOF token name for the parser (overrides in-file options)')
  .option('--start <symbol>', 'Start symbol for the parser (overrides in-file options)')
  .action(async (
    type: string,
    file: string,
    opts: { export: string; optionsExport?: string; output: string; outName: string; eof?: string; start?: string },
  ) => {
    try {
      const [entry, fileOpts] = await Promise.all([
        loadExport(file, opts.export),
        loadEntryOptions(file, opts.export, opts.optionsExport),
      ]);

      // CLI flags override in-file options
      const eof = opts.eof ?? fileOpts.eof;
      const start = opts.start ?? fileOpts.start;
      const exportName = fileOpts.exportName;
      const importFrom = fileOpts.importFrom;

      let moduleCode: string;
      if (type === 'lexer') {
        const lb = entry as LexerBuilder;
        const lexer = lb.build();
        moduleCode = generateLexerModule(lexer as never, { exportName, importFrom });
      } else if (type === 'parser') {
        const gb = entry as LRGrammarBuilder;
        const buildOpts: GrammarBuildingOptions = { eofToken: eof, startSymbol: start };
        const pg = gb.build(buildOpts);
        const { Parser } = await import('jalsp');
        const parser = new Parser(pg);
        moduleCode = generateParserModule(parser as never, { exportName, importFrom });
      } else {
        throw new Error(`Unknown type: ${type}. Must be 'lexer' or 'parser'.`);
      }

      mkdirSync(opts.output, { recursive: true });
      const tmpFile = join(opts.output, '__entry__.mjs');
      writeFileSync(tmpFile, moduleCode, 'utf8');

      const outJs = join(opts.output, `${opts.outName}.js`);
      const bundle = await rollupBuild({
        input: tmpFile,
        plugins: [
          rollupResolve(),
          rollupCommonjs(),
          rollupTerser(),
        ],
      });
      await bundle.write({ file: outJs, format: 'esm', sourcemap: false });
      await bundle.close();

      const { unlinkSync } = await import('fs');
      try { unlinkSync(tmpFile); } catch { /* ignore */ }

      console.log(`Bundled to ${outJs}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program.parse();
