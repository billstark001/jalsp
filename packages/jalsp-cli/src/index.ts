#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { pathToFileURL } from 'url';
import { rollup as rollupBuild, type Plugin } from 'rollup';
import { nodeResolve as rollupResolve } from '@rollup/plugin-node-resolve';
import { generateLexerModule, generateParserModule } from 'jalsp';
import type { LexerBuilder, LRGrammarBuilder } from 'jalsp';

// These plugins use CJS-only type definitions; cast via unknown to bypass NodeNext type resolution
const rollupCommonjs = ((await import('@rollup/plugin-commonjs')) as unknown as { default: () => Plugin }).default;
const rollupTerser = ((await import('@rollup/plugin-terser')) as unknown as { default: () => Plugin }).default;

const program = new Command();
program.name('jalsp-cli').description('Compile and bundle jalsp lexers and parsers').version('0.1.0');

async function loadEntry(file: string, exportName: string): Promise<unknown> {
  const absPath = resolve(file);
  const fileUrl = pathToFileURL(absPath).href;
  const mod = await import(fileUrl);
  const exported = exportName === 'default' ? (mod.default ?? mod) : (mod[exportName] ?? mod.default);
  if (exported === undefined) {
    throw new Error(`Export '${exportName}' not found in ${file}`);
  }
  return exported;
}

// serialize command
program
  .command('serialize <type> <file>')
  .description('Serialize a LexerBuilder or LRGrammarBuilder to JSON')
  .option('-e, --export <name>', 'Export name to use from the file', 'default')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--eof <token>', 'EOF token name (for parser)')
  .option('--start <symbol>', 'Start symbol (for parser)')
  .action(async (type: string, file: string, opts: { export: string; output?: string; eof?: string; start?: string }) => {
    try {
      const entry = await loadEntry(file, opts.export);
      let json: string;
      if (type === 'lexer') {
        const lb = entry as LexerBuilder;
        const lexer = lb.build();
        json = lexer.toJSON();
      } else if (type === 'parser') {
        const gb = entry as LRGrammarBuilder;
        const pg = gb.build({ eofToken: opts.eof, startSymbol: opts.start });
        const { Parser } = await import('jalsp');
        const parser = new Parser(pg);
        json = parser.toJSON();
      } else {
        throw new Error(`Unknown type: ${type}`);
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

// bundle command
program
  .command('bundle <type> <file>')
  .description('Bundle a LexerBuilder or LRGrammarBuilder to JS')
  .option('-e, --export <name>', 'Export name to use from the file', 'default')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .option('--out-name <name>', 'Base name for output files', 'compiled')
  .option('--eof <token>', 'EOF token name (for parser)')
  .option('--start <symbol>', 'Start symbol (for parser)')
  .action(async (type: string, file: string, opts: { export: string; output: string; outName: string; eof?: string; start?: string }) => {
    try {
      const entry = await loadEntry(file, opts.export);
      let moduleCode: string;
      if (type === 'lexer') {
        const lb = entry as LexerBuilder;
        const lexer = lb.build();
        moduleCode = generateLexerModule(lexer as never);
      } else if (type === 'parser') {
        const gb = entry as LRGrammarBuilder;
        const pg = gb.build({ eofToken: opts.eof, startSymbol: opts.start });
        const { Parser } = await import('jalsp');
        const parser = new Parser(pg);
        moduleCode = generateParserModule(parser as never);
      } else {
        throw new Error(`Unknown type: ${type}`);
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
