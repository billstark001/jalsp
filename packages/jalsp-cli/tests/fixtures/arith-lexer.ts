/**
 * Arithmetic lexer fixture.
 * Tokens: NUM, PLUS, MINUS, STAR, SLASH, LPAREN, RPAREN
 */
import { LexerBuilder } from 'jalsp';
import type { JalspEntryOptions } from '../../src/index.js';

const builder = new LexerBuilder<string | number>()
  .t('NUM', /[0-9]+(\.[0-9]+)?/, (s) => parseFloat(s))
  .t('PLUS', '+')
  .t('MINUS', '-')
  .t('STAR', /\*/)
  .t('SLASH', /\//)
  .t('LPAREN', '(')
  .t('RPAREN', ')')
  .t(null, /\s+/);

export default builder;

export const defaultOptions: JalspEntryOptions = {
  // no EOF override needed — using default <<EOF>>
};
