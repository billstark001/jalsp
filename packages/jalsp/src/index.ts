import { lexBnf, parseBnf } from './bnf/bnf';
import { lexAbnf, parseAbnf } from './bnf/abnf';
import { lexEbnf } from './ebnf/ebnf';
import { parseEbnf } from './ebnf/ebnf-parser';

import { LexerBuilder } from './lexer/builder';
import { LRGrammarBuilder } from './lr/builder';
import { Lexer } from './lexer/lexer';
import { Parser } from './lr/parser';
import { LRGenerator } from './lr/generator';

import { convertEbnfToBnf } from './ebnf/ebnf';
import { compileActionRecord } from './lr/utils';

export {
  LexerBuilder,
  LRGrammarBuilder,
  Lexer,
  Parser,
  LRGenerator,

  lexBnf,
  parseBnf,
  lexAbnf,
  parseAbnf,
  lexEbnf,
  parseEbnf,
  convertEbnfToBnf,
  compileActionRecord,
};

export type * from './lexer/types';
export type * from './lr/types';

export { generateLexerModule, generateParserModule } from './codegen';
export type { ModuleGenOptions } from './codegen';
export type { SerializedLexer } from './lexer/lexer';
export type { SerializedParser } from './lr/parser';
