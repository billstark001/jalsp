/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * if undefined is returned, the token is ignored
 */
export type TokenNameSelector = (value: any | undefined, lexeme: string) => string | undefined;
export type TokenHandler<T> = (
  raw: string,
  index: number,
  arr?: RegExpExecArray,
) => T;


export interface Position {
  line: number,
  col: number,
}

export interface Token<T> {
  name: string,

  lexeme: string,
  value: T,

  position?: number,
  pos?: Position,
}

export interface TokenStream<T> {
  nextToken(): Token<T>,
  isEOF(t: Token<T>): boolean,
  currentPosition(): number,
  currentFilePosition(): Position;
}

export interface TokenRecord {
  name: string;
  pattern: string;
  isRegExp?: boolean;
  flags?: string;
  handlerIndex: number;
}

export interface ActionRecord<T> {
  handler?: TokenHandler<T>;
  nameSelector?: TokenNameSelector;
}

export interface LexerOptionsFull<T> {
  actions: ActionRecord<T>[];
  records: TokenRecord[];
  eofName?: string;
  eofValue: T;
  dummyHandler: TokenHandler<T>;
}

type _Keys = 'eofValue' | 'dummyHandler';
export type LexerOptions<T> = Omit<LexerOptionsFull<T>, _Keys> & Partial<Pick<LexerOptionsFull<T>, _Keys>>;

export type LexerPositionOptions = 'begin' | 'end' | 'current';
