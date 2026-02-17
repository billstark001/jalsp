/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * if undefined is returned, the token is ignored
 */
export type TokenNameSelector = (value: any | undefined, lexeme: string) => string | undefined;
export type TokenHandler = (
  raw: string,
  index: number,
  arr?: RegExpExecArray,
) => (any | undefined);


export interface Position {
  line: number,
  col: number,
}

export interface Token<T = string> {
  name: string,

  lexeme: string,
  value: T,

  position?: number,
  pos?: Position,
}

export interface TokenStream<T = string> {
  nextToken(): Token<T>,
  isEOF(t: Token<T>): boolean,
  currentPosition(): number,
  currentFilePosition(): Position;
}

// export interface TokenRecord {
//   [0]: string; // name
//   [1]: string; // pattern
//   [2]: string; // flags
//   [3]: number; // handler
// }

export interface TokenRecord {
  name: string;
  pattern: string;
  isRegExp?: boolean;
  flags?: string;
  handlerIndex: number;
}

export interface ActionRecord {
  handler?: TokenHandler;
  nameSelector?: TokenNameSelector;
}


export interface TokenDefinition {
  actions: ActionRecord[];
  records: TokenRecord[];
  eofToken?: string
}

export type LexerPositionOptions = 'begin' | 'end' | 'current';
