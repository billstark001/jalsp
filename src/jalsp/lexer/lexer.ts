import { DEFAULT_EOF_TOKEN } from "../models/constants";
import { LexerError } from "../models/error";
import { Token, TokenDefinition, TokenHandler, TokenNameSelector, TokenStream } from "../models/token";
import { getLCIndex, getLinePositions, Position } from "../utils/str";

const dummyHandler: TokenHandler = () => { }

interface LexerRecord {
  name: string;
  pat: RegExp | string;
  f: TokenHandler;
  n?: TokenNameSelector;
}

export enum PositionOptions {
  Begin,
  End,
  Current,
}

export default class Lexer implements TokenStream {

  str?: string;
  rec?: number[];
  pos: number;
  eof: string;

  readonly records: LexerRecord[];

  constructor({ actions, records, eofToken }: TokenDefinition) {
    this.records = [];
    this.str = undefined;
    this.pos = 0;
    this.eof = eofToken || DEFAULT_EOF_TOKEN;

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
        f: actions[handlerIndex].handler ?? dummyHandler,
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

  seek(pos: number, from?: PositionOptions) {
    from = from ?? PositionOptions.Begin;
    if (from == PositionOptions.Current)
      pos += this.pos;
    else if (from == PositionOptions.End)
      pos += this.str?.length ?? 0;
    this.pos = pos;
    return this;
  }

  nextToken(advance = true): Token {
    if (this.str == undefined)
      throw new LexerError("No input string assigned.");

    this.rec = this.rec ?? getLinePositions(this.str);
    const origPos = this.pos;

    if (origPos < 0 || origPos > this.str.length)
      throw new LexerError(`Invalid pointer position: ${origPos}.`);
    else if (origPos >= this.str.length) {
      // EOF reached
      return {
        name: this.eof,
        value: this.eof,
        lexeme: this.eof,
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
          var p = this.currentFilePosition();
          throw new LexerError(`Zero-length token at position ${this.pos}/(${p.line}:${p.col})`);
        }

        if (lexeme != null) {
          const value = f(lexeme, lexemeIndex, arr) ?? lexeme;
          // determine name
          var realName = name;
          if (n !== undefined) {
            var _realName = n(value, lexeme);
            if (_realName === undefined) // discard the token
              return this.nextToken();
            else
              realName = _realName;
          }
          // form token
          var ret: Token = {
            name: realName,
            lexeme,
            value,
            position: lexemeIndex,
            pos: getLCIndex(this.rec, lexemeIndex, true)
          }
          return ret;
        }
      }

      // no match
      // origPos should equate this.pos
      var p = this.currentFilePosition();
      throw new LexerError(`Unknown token ${JSON.stringify(
        origPos + 10 < this.str.length ?
          this.str.substring(origPos, origPos + 10) + '...' :
          this.str.substring(origPos)
      )} at position ${origPos}/(${p.line}:${p.col})`);
    }
  }

  nextTokens(step: number): Token[] {
    if (step < 1) throw new Error(`Invalid step: ${step}`);
    const ret: Token[] = [];
    for (let i = 0; i < step; i++) {
      const t = this.nextToken(true);
      ret.push(t);
    }
    return ret;
  }

  isEOF(t: Token): boolean {
    return t.name == this.eof;
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

}