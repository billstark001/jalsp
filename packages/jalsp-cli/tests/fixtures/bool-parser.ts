/**
 * Boolean expression parser fixture.
 * Grammar: E → E||T | T, T → T&&F | F, F → !F | (E) | true | false
 * Uses layered grammar to naturally encode AND > OR > NOT precedence.
 */
import { LRGrammarBuilder } from 'jalsp';
import type { JalspEntryOptions } from '../../src/index.js';

const builder = new LRGrammarBuilder()
  // E → E || T | T
  .bnf('E = E OR T',  (a: boolean, _: unknown, b: boolean) => a || b)
  .bnf('E = T',       (t: boolean) => t)
  // T → T && F | F
  .bnf('T = T AND F', (a: boolean, _: unknown, b: boolean) => a && b)
  .bnf('T = F',       (f: boolean) => f)
  // F → ! F | ( E ) | true | false
  .bnf('F = NOT F',   (_: unknown, e: boolean) => !e)
  .bnf('F = LPAREN E RPAREN', (_1: unknown, e: boolean, _2: unknown) => e)
  .bnf('F = TRUE',    () => true)
  .bnf('F = FALSE',   () => false)
  .opr('left', 'OR')
  .opr('left', 'AND')
  .opr('right', 'NOT');

export default builder;

export const defaultOptions: JalspEntryOptions = {
  eof: '<<EOF>>',
  start: 'E',
};
