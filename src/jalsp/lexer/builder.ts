import { ActionRecord, TokenDefinition, TokenHandler, TokenNameSelector, TokenRecord } from "./types";
import { getIncrementName } from "./utils";
import { Lexer } from "./lexer";


export class RegExpLexerBuilder {

  protected actions: ActionRecord[];
  protected records: TokenRecord[];
  protected usedTokens: Set<string>;

  protected optionalToken = '';

  constructor(lexicon?: TokenDefinition | RegExpLexerBuilder) {

    var builder: RegExpLexerBuilder | undefined = undefined;
    var def: TokenDefinition | undefined = undefined;
    if (lexicon !== undefined) {
      if (lexicon instanceof RegExpLexerBuilder) {
        builder = lexicon;
      } else {
        def = lexicon;
      }
    }

    // shallow copy of arrays
    this.actions = Array.from(builder?.actions ?? def?.actions ?? [])
      .map(x => ({ ...x }));
    this.records = Array.from(builder?.records ?? def?.records ?? [])
      .map(x => ({ ...x }));
    this.usedTokens = new Set(this.records.map(x => x.name));
    this.optionalToken = builder?.optionalToken ?? 'OPTIONAL_TOKEN_0';
  }

  protected registerAction(h?: TokenHandler, n?: TokenNameSelector) {
    return this.actions.push({ handler: h, nameSelector: n }) - 1;
  }

  /**
   * @param name The token name. 
   * @param pattern The matching pattern. 
   * - String inputs are treated as an exact match of that string.
   * - RegExp inputs are treated as the expression 
   * with global flag moved and sticky flag appended.
   * @param f The handler.
   */
  t(name: string | TokenNameSelector, pattern: string | RegExp, f?: TokenHandler) {

    // parse name
    var realName: string;
    var sel: TokenNameSelector | undefined = undefined;
    if (typeof (name) == 'string')
      realName = name;
    else {
      while (this.usedTokens.has(this.optionalToken)) {
        this.optionalToken = getIncrementName(this.optionalToken);
      }
      realName = this.optionalToken;
      sel = name;
    }
    this.usedTokens.add(realName);

    // register handler
    const handlerIndex = this.registerAction(f, sel);
    const result: TokenRecord = {
      name: realName,
      handlerIndex,
      pattern: '',
    };

    // parse pattern
    if (pattern instanceof RegExp) {
      result.pattern = pattern.source;
      let flags = pattern.flags;
      flags = flags.replace('g', '');
      if (flags.indexOf('y') < 0) {
        flags += 'y';
      }
      result.isRegExp = true;
      result.flags = flags;
    } else {
      result.pattern = pattern;
      delete result.isRegExp;
      delete result.flags;
    }

    // push back the record
    this.records.push(result);

    // chained calling
    return this;
  }

  define(eof?: string): TokenDefinition {
    return {
      actions: this.actions,
      records: this.records,
      eofToken: eof
    }
  }

  build(eof?: string): Lexer {
    return new Lexer(this.define(eof));
  }

}