import { ActionRecord, TokenDefinition, TokenHandler, TokenNameSelector, TokenRecord } from "./types";
import { getIncrementName } from "./utils";
import { Lexer } from "./lexer";
import { serializeFunction, deserializeFunction, SerializeOptions, DeserializeOptions, SerializedFunction } from "../utils/serializer";

/**
 * Serialized representation of a RegExpLexerBuilder
 */
export interface SerializedLexerBuilder {
  actions: Array<{
    handler?: SerializedFunction;
    nameSelector?: SerializedFunction;
  }>;
  records: TokenRecord[];
  optionalToken: string;
  contextMethods?: Record<string, SerializedFunction>;
}

export class LexerBuilder<T extends Record<string, TokenHandler> = Record<string, TokenHandler>> {

  protected actions: ActionRecord[];
  protected records: TokenRecord[];
  protected usedTokens: Set<string>;

  protected optionalToken = '';
  protected context?: T;

  constructor(context?: T) {
    this.actions = [];
    this.records = [];
    this.usedTokens = new Set();
    this.optionalToken = 'OPTIONAL_TOKEN_0';
    this.context = context;
  }

  /**
   * Clone this builder, creating a new instance with copied state
   */
  clone(): LexerBuilder<T> {
    const cloned = new LexerBuilder<T>(this.context);
    cloned.actions = Array.from(this.actions).map(x => ({ ...x }));
    cloned.records = Array.from(this.records).map(x => ({ ...x }));
    cloned.usedTokens = new Set(this.usedTokens);
    cloned.optionalToken = this.optionalToken;
    return cloned;
  }

  /**
   * Add tokens from another builder or token definition
   */
  addFrom(lexicon: TokenDefinition | LexerBuilder<Record<string, TokenHandler>>): this {
    let actions: ActionRecord[];
    let records: TokenRecord[];
    
    if (lexicon instanceof LexerBuilder) {
      actions = lexicon.actions;
      records = lexicon.records;
    } else {
      actions = lexicon.actions ?? [];
      records = lexicon.records ?? [];
    }

    // Add actions and update handler indices in records
    const indexOffset = this.actions.length;
    this.actions.push(...actions.map(x => ({ ...x })));
    
    // Add records with adjusted handler indices
    for (const record of records) {
      const newRecord = { ...record };
      if (newRecord.handlerIndex !== undefined) {
        newRecord.handlerIndex += indexOffset;
      }
      this.records.push(newRecord);
      this.usedTokens.add(newRecord.name);
    }

    return this;
  }

  protected registerAction(h?: TokenHandler | string, n?: TokenNameSelector) {
    let handler: TokenHandler | undefined;
    
    if (typeof h === 'string') {
      // String method name
      if (!this.context) {
        throw new Error('Cannot use string method name without a context object');
      }
      const method = this.context[h];
      if (!method) {
        throw new Error(`Method '${h}' not found in context object`);
      }
      if (typeof method !== 'function') {
        throw new Error(`'${h}' is not a function in context object`);
      }
      handler = method;
    } else {
      handler = h;
    }
    
    return this.actions.push({ handler, nameSelector: n }) - 1;
  }

  /**
   * @param name The token name. 
   * @param pattern The matching pattern. 
   * - String inputs are treated as an exact match of that string.
   * - RegExp inputs are treated as the expression 
   * with global flag moved and sticky flag appended.
   * @param f The handler - can be a pure function or a string method name (if context object provided).
   */
  t(name: string | TokenNameSelector, pattern: string | RegExp, f?: TokenHandler | string) {

    // parse name
    let realName: string;
    let sel: TokenNameSelector | undefined = undefined;
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

  /**
   * Serialize the builder to a JSON-compatible object
   */
  serialize(options?: SerializeOptions): SerializedLexerBuilder {
    const serializedActions = this.actions.map(action => ({
      handler: action.handler ? serializeFunction(action.handler, options) : undefined,
      nameSelector: action.nameSelector ? serializeFunction(action.nameSelector, options) : undefined,
    }));

    const serialized: SerializedLexerBuilder = {
      actions: serializedActions,
      records: this.records.map(r => ({ ...r })),
      optionalToken: this.optionalToken,
    };

    // Serialize context methods if present
    if (this.context) {
      const contextMethods: Record<string, SerializedFunction> = {};
      for (const [key, value] of Object.entries(this.context)) {
        if (typeof value === 'function') {
          contextMethods[key] = serializeFunction(value, options);
        }
      }
      if (Object.keys(contextMethods).length > 0) {
        serialized.contextMethods = contextMethods;
      }
    }

    return serialized;
  }

  /**
   * Deserialize a builder from a serialized object
   */
  static deserialize<T extends Record<string, TokenHandler> = Record<string, TokenHandler>>(
    serialized: SerializedLexerBuilder,
    options?: DeserializeOptions
  ): LexerBuilder<T> {
    // Deserialize context if present
    let context: T | undefined;
    if (serialized.contextMethods) {
      context = {} as T;
      for (const [key, serializedFn] of Object.entries(serialized.contextMethods)) {
        (context as Record<string, TokenHandler>)[key] = deserializeFunction(serializedFn, options) as TokenHandler;
      }
    }

    const builder = new LexerBuilder<T>(context);
    builder.optionalToken = serialized.optionalToken;
    builder.records = serialized.records.map(r => ({ ...r }));
    builder.usedTokens = new Set(builder.records.map(x => x.name));

    // Deserialize actions
    builder.actions = serialized.actions.map(action => ({
      handler: action.handler ? deserializeFunction(action.handler, options) as TokenHandler : undefined,
      nameSelector: action.nameSelector ? deserializeFunction(action.nameSelector, options) as TokenNameSelector : undefined,
    }));

    return builder;
  }

}