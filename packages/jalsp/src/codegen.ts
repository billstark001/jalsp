import { Lexer, SerializedLexer } from './lexer/lexer';
import { Parser, SerializedParser } from './lr/parser';
import { ParsedGrammar } from './lr/generator';

export interface ModuleGenOptions {
  /** Import path for jalsp (default: 'jalsp') */
  importFrom?: string;
  /** Variable name for the exported instance (default: 'lexer' or 'parser') */
  exportName?: string;
  /** Whether to also export the raw serialized data (default: false) */
  exportData?: boolean;
}

function isSerializedParser(obj: unknown): obj is SerializedParser {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return Array.isArray(p.symbols) && p.symbols.length > 0 && typeof (p.symbols[0] as Record<string, unknown>).isNT === 'boolean';
}

/**
 * Generate a JS module string that exports a pre-compiled Lexer.
 */
export function generateLexerModule(
  lexer: Lexer<unknown> | SerializedLexer,
  options: ModuleGenOptions = {}
): string {
  const { importFrom = 'jalsp', exportName = 'lexer', exportData = false } = options;
  const data: SerializedLexer =
    lexer instanceof Lexer
      ? lexer.serialize()
      : lexer;
  const dataStr = JSON.stringify(data);
  const lines: string[] = [
    `import { Lexer } from '${importFrom}';`,
    ``,
    `const _lexerData = ${dataStr};`,
    ``,
    ...(exportData ? [`export const lexerData = _lexerData;`, ``] : []),
    `export const ${exportName} = Lexer.deserialize(_lexerData);`,
  ];
  return lines.join('\n');
}

/**
 * Generate a JS module string that exports a pre-compiled Parser.
 */
export function generateParserModule(
  parser: Parser<unknown> | ParsedGrammar | SerializedParser,
  options: ModuleGenOptions = {}
): string {
  const { importFrom = 'jalsp', exportName = 'parser', exportData = false } = options;
  let data: SerializedParser;
  if (parser instanceof Parser) {
    data = parser.serialize();
  } else if (isSerializedParser(parser)) {
    data = parser as SerializedParser;
  } else {
    // It's a ParsedGrammar - wrap in Parser to serialize
    data = new Parser(parser as ParsedGrammar).serialize();
  }
  const dataStr = JSON.stringify(data);
  const lines: string[] = [
    `import { Parser } from '${importFrom}';`,
    ``,
    `const _parserData = ${dataStr};`,
    ``,
    ...(exportData ? [`export const parserData = _parserData;`, ``] : []),
    `export const ${exportName} = Parser.deserialize(_parserData);`,
  ];
  return lines.join('\n');
}
