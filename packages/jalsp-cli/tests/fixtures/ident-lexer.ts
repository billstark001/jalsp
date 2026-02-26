/**
 * Identifier / keyword lexer fixture.
 * Demonstrates nameSelector for keyword detection.
 * Uses an inline set (no external closure) so the function survives serialisation.
 */
import { LexerBuilder } from 'jalsp';
import type { JalspEntryOptions } from '../../src/index.js';

const builder = new LexerBuilder<string>()
  .t(
    (_v, lexeme) => {
      const kw = new Set(['if', 'else', 'while', 'return', 'true', 'false']);
      return kw.has(lexeme) ? 'KW_' + lexeme.toUpperCase() : 'IDENT';
    },
    /[a-zA-Z_][a-zA-Z0-9_]*/,
    (s) => s,
  )
  .t('NUMBER', /[0-9]+(\.[0-9]+)?/)
  .t('STRING', /"(?:[^"\\]|\\.)*"/, (s) => s.slice(1, -1))
  .t('LPAREN', '(')
  .t('RPAREN', ')')
  .t('LBRACE', '{')
  .t('RBRACE', '}')
  .t('SEMI', ';')
  .t('EQ', '==')
  .t('ASSIGN', '=')
  .t('COMMA', ',')
  .t(null, /\s+/);

export default builder;

export const defaultOptions: JalspEntryOptions = {};

export const myLexerOptions: JalspEntryOptions = {
  exportName: 'myLexer',
};
