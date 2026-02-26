/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Position,
  Token, TokenHandler, TokenNameSelector, TokenStream,
  LexerPositionOptions,
  LexerOptions,
  ActionRecord,
  TokenRecord,
} from "./types";
import { getLCIndex, getLinePositions } from "./utils";
import { serializeFunction, deserializeFunction, SerializeOptions, DeserializeOptions, SerializedFunction } from '../utils/serializer';

export interface SerializedLexer {
  records: Array<{
    name: string;
    pattern: string;
    flags?: string;
    isRegExp?: boolean;
    handler: SerializedFunction;
    nameSelector?: SerializedFunction;
  }>;
  eofName: string;
  eofValue: unknown;
  dummyHandler: SerializedFunction;
}

interface LexerRecord<T> {
  name: string;
  pat: RegExp | string;
  f: TokenHandler<T>;
  n?: TokenNameSelector<T>;
}

export class LexerError extends Error {

  additional?: any;

  constructor(msg: string, additional?: any) {
    super(msg);
    this.additional = additional;
  }

}

export const DEFAULT_EOF_TOKEN = '<<EOF>>';

export class Lexer<T> implements TokenStream<T> {

  static readonly DEFAULT_EOF_TOKEN = DEFAULT_EOF_TOKEN;

  str?: string;
  rec?: number[];
  pos: number;
  eofName: string;
  eofValue: T;
  dummyHandler: TokenHandler<T>;

  readonly records: LexerRecord<T>[];

  constructor(options: LexerOptions<T>) {
    this.str = undefined;
    this.pos = 0;

    const { actions, records, eofName, eofValue, dummyHandler } = options;
    this.records = [];
    this.eofName = eofName || Lexer.DEFAULT_EOF_TOKEN;
    this.eofValue = eofValue;
    this.dummyHandler = dummyHandler;

    for (const rec of records) {
      const { name, pattern, isRegExp, flags, handlerIndex } = rec;

      // assume the flags are clean
      // compile the regexp if necessary
      const pat: RegExp | string = isRegExp
        ? new RegExp(pattern, flags || 'y')
        : pattern;


      this.records.push({
        name,
        pat,
        f: actions[handlerIndex].handler ?? this.dummyHandler,
        n: actions[handlerIndex].nameSelector
      });
    }
  }

  reset(str?: string) {
    this.str = str ?? this.str;
    if (this.str != undefined)
      this.rec = getLinePositions(this.str);
    this.pos = 0;
    return this;
  }

  seek(pos: number, from?: LexerPositionOptions) {
    from = from ?? 'begin';
    if (from === 'current')
      pos += this.pos;
    else if (from === 'end')
      pos += this.str?.length ?? 0;
    this.pos = pos;
    return this;
  }

  nextToken(advance = true): Token<T> {
    if (this.str == undefined)
      throw new LexerError("No input string assigned.");

    this.rec = this.rec ?? getLinePositions(this.str);
    const origPos = this.pos;

    if (origPos < 0 || origPos > this.str.length)
      throw new LexerError(`Invalid pointer position: ${origPos}.`);
    else if (origPos >= this.str.length) {
      // EOF reached
      return {
        name: this.eofName,
        value: this.eofValue,
        lexeme: this.eofName,
        position: origPos,
        pos: this.currentFilePosition()
      }
    }

    else {

      // match each record
      for (const { name, pat, f, n } of this.records) {
        let lexeme: string | undefined = undefined;
        let arr: RegExpExecArray | undefined = undefined;
        let lexemeIndex: number = -1;
        let advanced = false;

        // check if lexeme matches
        if (pat instanceof RegExp) {
          pat.lastIndex = origPos;
          const res = pat.exec(this.str);
          if (res != null) {
            lexeme = res[0];
            lexemeIndex = res.index;
            arr = res;
            if (advance) {
              this.pos = pat.lastIndex;
              advanced = true;
            }
          }
        } else {
          if (this.str.startsWith(pat, origPos)) {
            lexeme = pat;
            lexemeIndex = origPos;
            if (advance) {
              this.pos = origPos + pat.length;
              advanced = true;
            }
          }
        }

        // if the token is 0-length
        if (advanced && this.pos == origPos) {
          const p = this.currentFilePosition();
          throw new LexerError(`Zero-length token at position ${this.pos}/(${p.line}:${p.col})`);
        }

        if (lexeme != null) {
          const value = f(lexeme, lexemeIndex, arr);
          // determine name
          let realName = name;
          if (n != null) {
            const _realName = n(value, lexeme);
            if (_realName === undefined) // discard the token
              return this.nextToken();
            else
              realName = _realName;
          }
          // form token
          const ret: Token<T> = {
            name: realName,
            lexeme,
            value: value as T,
            position: lexemeIndex,
            pos: getLCIndex(this.rec, lexemeIndex, true)
          }
          return ret;
        }
      }

      // no match
      // origPos should equate this.pos
      const p = this.currentFilePosition();
      throw new LexerError(`Unknown token ${JSON.stringify(
        origPos + 10 < this.str.length ?
          this.str.substring(origPos, origPos + 10) + '...' :
          this.str.substring(origPos)
      )} at position ${origPos}/(${p.line}:${p.col})`);
    }
  }

  nextTokens(step: number): Token<T>[] {
    if (step < 1) throw new Error(`Invalid step: ${step}`);
    const ret: Token<T>[] = [];
    for (let i = 0; i < step; i++) {
      const t = this.nextToken(true);
      ret.push(t);
    }
    return ret;
  }

  isEOF(t: Token<T>): boolean {
    return t.name == this.eofName;
  }
  currentPosition(): number {
    return this.pos;
  }
  currentFilePosition(): Position {
    if (this.str == undefined)
      return { line: 0, col: -1 };
    if (this.rec == undefined)
      this.rec = getLinePositions(this.str);
    return getLCIndex(this.rec, this.pos, true);
  }

  serialize(options?: SerializeOptions): SerializedLexer {
    return {
      records: this.records.map(rec => ({
        name: rec.name,
        pattern: rec.pat instanceof RegExp ? rec.pat.source : rec.pat,
        flags: rec.pat instanceof RegExp ? rec.pat.flags : undefined,
        isRegExp: rec.pat instanceof RegExp ? true : undefined,
        handler: serializeFunction(rec.f, options),
        nameSelector: rec.n ? serializeFunction(rec.n, options) : undefined,
      })),
      eofName: this.eofName,
      eofValue: this.eofValue,
      dummyHandler: serializeFunction(this.dummyHandler, options),
    };
  }

  toJSON(options?: SerializeOptions): string {
    return JSON.stringify(this.serialize(options));
  }

  static deserialize<T = string>(
    serialized: SerializedLexer,
    options?: DeserializeOptions
  ): Lexer<T> {
    const dummyHandler = deserializeFunction(serialized.dummyHandler, options) as TokenHandler<T>;
    const actions: ActionRecord<T>[] = serialized.records.map(rec => ({
      handler: deserializeFunction(rec.handler, options) as TokenHandler<T>,
      nameSelector: rec.nameSelector
        ? deserializeFunction(rec.nameSelector, options) as TokenNameSelector<T>
        : undefined,
    }));
    const records: TokenRecord[] = serialized.records.map((rec, i) => ({
      name: rec.name,
      pattern: rec.pattern,
      flags: rec.flags,
      isRegExp: rec.isRegExp,
      handlerIndex: i,
    }));
    return new Lexer<T>({
      actions,
      records,
      eofName: serialized.eofName,
      eofValue: serialized.eofValue as T,
      dummyHandler,
    });
  }

  static fromJSON<T = string>(
    json: string,
    options?: DeserializeOptions
  ): Lexer<T> {
    return Lexer.deserialize<T>(JSON.parse(json) as SerializedLexer, options);
  }

}