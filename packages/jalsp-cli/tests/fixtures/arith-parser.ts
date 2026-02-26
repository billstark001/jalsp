/**
 * Arithmetic parser fixture.
 * Grammar: E → E+T | E-T | T, T → T*F | T/F | F, F → NUM | (E)
 * Returns numeric values.
 */
import { LRGrammarBuilder } from 'jalsp';
import type { JalspEntryOptions } from '../../src/index.js';

const builder = new LRGrammarBuilder()
  .bnf('E = E PLUS T',  (e: number, _: unknown, t: number) => e + t)
  .bnf('E = E MINUS T', (e: number, _: unknown, t: number) => e - t)
  .bnf('E = T',         (t: number) => t)
  .bnf('T = T STAR F',  (t: number, _: unknown, f: number) => t * f)
  .bnf('T = T SLASH F', (t: number, _: unknown, f: number) => t / f)
  .bnf('T = F',         (f: number) => f)
  .bnf('F = LPAREN E RPAREN', (_1: unknown, e: number, _2: unknown) => e)
  .bnf('F = NUM',       (n: number) => n)
  .opr('left', 'PLUS', 'MINUS')
  .opr('left', 'STAR', 'SLASH');

export default builder;

export const defaultOptions: JalspEntryOptions = {
  eof: '<<EOF>>',
  start: 'E',
};
