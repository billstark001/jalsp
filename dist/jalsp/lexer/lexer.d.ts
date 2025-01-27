import { Token, TokenDefinition, TokenHandler, TokenNameSelector, TokenStream } from "../models/token";
import { Position } from "../utils/str";
interface LexerRecord {
    name: string;
    pat: RegExp | string;
    f: TokenHandler;
    n?: TokenNameSelector;
}
export declare enum PositionOptions {
    Begin = 0,
    End = 1,
    Current = 2
}
export default class Lexer implements TokenStream {
    str?: string;
    rec?: number[];
    pos: number;
    eof: string;
    readonly records: LexerRecord[];
    constructor({ actions, records, eofToken }: TokenDefinition);
    reset(str?: string): this;
    seek(pos: number, from?: PositionOptions): this;
    nextToken(advance?: boolean): Token;
    isEOF(t: Token): boolean;
    currentPosition(): number;
    currentFilePosition(): Position;
}
export {};
