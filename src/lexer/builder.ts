import { ActionRecord, LexerOptions, TokenHandler, TokenNameSelector, TokenRecord } from "./types";
import { getIncrementName } from "./utils";
import { Lexer } from "./lexer";
import { serializeFunction, deserializeFunction, SerializeOptions, DeserializeOptions, SerializedFunction } from "../utils/serializer";
import { MethodKeyOf } from "../utils/typing";

/**
 * if eofValue is to be `undefined`, it must be assigned explicitly.
 * Otherwise, it will default to eofName.
 */
export type LexerBuilderDefineOptions<T> = T extends string | undefined
  ? { eofName?: string, eofValue?: T }
  : { eofName?: string; eofValue: T };

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

const ignoreName = () => undefined;
const lexemeAsValue = <TValue>(lexeme: string) => lexeme as unknown as TValue;

export class LexerBuilder<TValue = string, TAction extends Record<string, TokenHandler<TValue>> = Record<string, TokenHandler<TValue>>> {

  protected actions: ActionRecord<TValue>[];
  protected records: TokenRecord[];
  protected usedTokens: Set<string>;

  protected optionalToken = '';
  protected context?: TAction;

  constructor(context?: TAction) {
    this.actions = [];
    this.records = [];
    this.usedTokens = new Set();
    this.optionalToken = 'OPTIONAL_TOKEN_0';
    this.context = context;
  }

  /**
   * Clone this builder, creating a new instance with copied state
   */
  clone(): LexerBuilder<TValue, TAction> {
    const cloned = new LexerBuilder<TValue, TAction>(this.context);
    cloned.actions = Array.from(this.actions).map(x => ({ ...x }));
    cloned.records = Array.from(this.records).map(x => ({ ...x }));
    cloned.usedTokens = new Set(this.usedTokens);
    cloned.optionalToken = this.optionalToken;
    return cloned;
  }

  /**
   * Add tokens from another builder or token definition
   */
  addFrom(lexicon: LexerOptions<TValue> | LexerBuilder<TValue, TAction>): this {
    let actions: ActionRecord<TValue>[];
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

  protected registerAction(_handler?: TokenHandler<TValue> | MethodKeyOf<TAction>, nameSelector?: TokenNameSelector<TValue>) {
    let handler: TokenHandler<TValue> | undefined;

    if (typeof _handler === 'string') {
      // String method name
      if (!this.context) {
        throw new Error('Cannot use string method name without a context object');
      }
      const method = this.context[_handler];
      if (!method) {
        throw new Error(`Method '${_handler}' not found in context object`);
      }
      if (typeof method !== 'function') {
        throw new Error(`'${_handler}' is not a function in context object`);
      }
      handler = method;
    } else {
      handler = _handler as TokenHandler<TValue> | undefined;
    }

    return this.actions.push({ handler, nameSelector }) - 1;
  }

  /**
   * @param name The token name.
   * - If a function is passed, it will be used as a name selector to determine the token name based on the matched lexeme.
   * - If null or undefined is passed, or the passed function returns nullish, the token will be ignored.
   * @param pattern The matching pattern. 
   * - String inputs are treated as an exact match of that string.
   * - RegExp inputs are treated as the expression 
   * with global flag moved and sticky flag appended.
   * @param f The handler - can be a pure function or a string method name (if context object provided).
   */

  t(
    this: TValue extends string ? this : never,
    name: string | null | undefined | TokenNameSelector<TValue>,
    pattern: string | RegExp
  ): this;

  t(
    name: string | null | undefined | TokenNameSelector<TValue>,
    pattern: string | RegExp,
    f: TokenHandler<TValue> | MethodKeyOf<TAction>
  ): this;

  t(
    name: string | null | undefined | TokenNameSelector<TValue>,
    pattern: string | RegExp,
    f?: TokenHandler<TValue> | MethodKeyOf<TAction>
  ): this {

    // parse name
    let realName: string = '';
    let sel: TokenNameSelector<TValue> | undefined = undefined;
    if (typeof name === 'string')
      realName = name;
    else if (name == null) {
      name = ignoreName;
    }
    if (typeof name === 'function') {
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

  define(
    this: TValue extends string | undefined ? this : never,
    options?: LexerBuilderDefineOptions<TValue>,
  ): LexerOptions<TValue>;
  define(options: LexerBuilderDefineOptions<TValue>): LexerOptions<TValue>;
  define(options?: LexerBuilderDefineOptions<TValue>): LexerOptions<TValue> {
    options ??= {} as LexerBuilderDefineOptions<TValue>;
    const eofName = options.eofName;
    let eofValue: TValue;
    if ('eofValue' in options) {
      eofValue = options.eofValue as TValue;
    } else {
      eofValue = eofName as unknown as TValue;
    }
    return {
      actions: this.actions,
      records: this.records,
      eofName,
      eofValue,
      dummyHandler: lexemeAsValue,
    };
  }

  build(
    this: TValue extends string | undefined ? this : never,
    options?: LexerBuilderDefineOptions<TValue>,
  ): Lexer<TValue>;
  build(options: LexerBuilderDefineOptions<TValue>): Lexer<TValue>;
  build(options?: LexerBuilderDefineOptions<TValue>): Lexer<TValue> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options2: LexerOptions<TValue> = (this as any).define(options);
    return new Lexer(options2);
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
  static deserialize<TValue = string, TAction extends Record<string, TokenHandler<TValue>> = Record<string, TokenHandler<TValue>>>(
    serialized: SerializedLexerBuilder,
    options?: DeserializeOptions
  ): LexerBuilder<TValue, TAction> {
    // Deserialize context if present
    let context: TAction | undefined;
    if (serialized.contextMethods) {
      context = {} as TAction;
      for (const [key, serializedFn] of Object.entries(serialized.contextMethods)) {
        (context as Record<string, TokenHandler<TValue>>)[key] = deserializeFunction(serializedFn, options) as TokenHandler<TValue>;
      }
    }

    const builder = new LexerBuilder<TValue, TAction>(context);
    builder.optionalToken = serialized.optionalToken;
    builder.records = serialized.records.map(r => ({ ...r }));
    builder.usedTokens = new Set(builder.records.map(x => x.name));

    // Deserialize actions
    builder.actions = serialized.actions.map(action => ({
      handler: action.handler ? deserializeFunction(action.handler, options) as TokenHandler<TValue> : undefined,
      nameSelector: action.nameSelector ? deserializeFunction(action.nameSelector, options) as TokenNameSelector<TValue> : undefined,
    }));

    return builder;
  }

}