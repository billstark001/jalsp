import { ActionRecord, TokenDefinition, TokenHandler, TokenNameSelector, TokenRecord } from "../models/token";
import Lexer from "./lexer";
export default class RegExpLexerBuilder {
    protected actions: ActionRecord[];
    protected records: TokenRecord[];
    protected usedTokens: Set<string>;
    protected optionalToken: string;
    constructor(lexicon?: TokenDefinition | RegExpLexerBuilder);
    protected registerAction(h?: TokenHandler, n?: TokenNameSelector): number;
    /**
     *
     * @param name The token name.
     * @param pattern The matching pattern.
     * - String inputs are treated as an exact match of that string.
     * - RegExp inputs are treated as the expression
     * with global flag moved and sticky flag appended.
     * @param f The handler.
     */
    t(name: string | TokenNameSelector, pattern: string | RegExp, f?: TokenHandler): this;
    define(eof?: string): TokenDefinition;
    build(eof?: string): Lexer;
}
