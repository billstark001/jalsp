import { lexBnf, parseBnf } from "../bnf/bnf";
import { lexAbnf, parseAbnf } from "../bnf/abnf";
import { convertEbnfToBnf } from "../ebnf/ebnf";
import { ParserError } from "./error";
import { BnfElement, ComplexProduction, EbnfElement, SimpleProduction } from "../bnf/types";
import { GrammarDefinition, OperatorDefinition, ProductionHandler } from "./types";
import { Token } from "../lexer/types";
import { LRGenerator, ParsedGrammar } from "./generator";
import { serializeFunction, deserializeFunction, SerializeOptions, DeserializeOptions, SerializedFunction } from "../utils/serializer";

export interface GrammarBuildingOptions {
  moduleName?: string,
  actionMode?: 'function' | 'constructor',
  mode?: 'lalr' | 'slr' | 'lr1',
  tokens?: string[],

  startSymbol?: string,
  eofToken?: string,

}

/**
 * Serialized representation of an LRGrammarBuilder
 */
export interface SerializedGrammarBuilder {
  productions: SimpleProduction[];
  operators: OperatorDefinition[];
  lowestPrecedence: number;
  actions: Array<SerializedFunction | undefined>;
}

export class LRGrammarBuilder {

  protected productions: SimpleProduction[];
  protected operators: OperatorDefinition[];

  protected prodCache: Map<string, number>;
  protected oprCache: Map<string, number>;
  protected lowestPrecedence: number;

  protected actions: (ProductionHandler | undefined)[];

  protected parseEbnf?: (prods: Token<EbnfElement | BnfElement>[]) => ComplexProduction[];

  constructor(grammar?: LRGrammarBuilder | GrammarDefinition) {
    let builder: LRGrammarBuilder | undefined = undefined;
    let def: GrammarDefinition | undefined = undefined;
    if (grammar !== undefined) {
      if (grammar instanceof LRGrammarBuilder) {
        builder = grammar;
      } else {
        def = grammar;
      }
    }

    this.productions = Array.from(builder?.productions ?? def?.productions ?? [])
      .map(x => ({ name: x.name, expr: x.expr, action: x.action }));
    this.operators = Array.from(builder?.operators ?? def?.operators ?? [])
      .map(x => Object.assign({}, x));
    this.prodCache = new Map();
    this.productions.forEach((x, i) => this.prodCache.set(JSON.stringify([x.name, x.expr]), i));
    this.oprCache = new Map();
    this.operators.forEach((x, i) => this.oprCache.set(x.name, i));
    this.lowestPrecedence = builder?.lowestPrecedence ?? 65536;
    this.actions = Array.from(builder?.actions ?? def?.actions ?? []);

    this.parseEbnf = builder?.parseEbnf;
  }

  act(handler?: ProductionHandler) {
    if (handler == undefined)
      return undefined;
    const index = this.actions.length;
    this.actions.push(handler);
    return index;
  }

  /**
   * Clone this builder, creating a new instance with copied state
   */
  clone(): LRGrammarBuilder {
    return new LRGrammarBuilder(this);
  }

  /**
   * Add productions and operators from another builder or grammar definition
   */
  addFrom(grammar: LRGrammarBuilder | GrammarDefinition): this {
    let productions: SimpleProduction[];
    let operators: OperatorDefinition[];
    let actions: (ProductionHandler | undefined)[];

    if (grammar instanceof LRGrammarBuilder) {
      productions = grammar.productions;
      operators = grammar.operators;
      actions = grammar.actions;
    } else {
      productions = grammar.productions ?? [];
      operators = grammar.operators ?? [];
      actions = grammar.actions ?? [];
    }

    // Add actions and update action indices in productions
    const actionIndexOffset = this.actions.length;
    this.actions.push(...actions.map(x => x));

    // Add productions with adjusted action indices
    for (const prod of productions) {
      const newProd = { ...prod };
      if (newProd.action !== undefined && typeof newProd.action === 'number') {
        newProd.action += actionIndexOffset;
      }
      this.bnfInner([newProd]);
    }

    // Add operators
    for (const opr of operators) {
      this.opr(opr.prior, opr.assoc, opr.name);
    }

    return this;
  }

  protected bnfInner(prods: SimpleProduction[], handlerIndex?: number) {
    for (const prod of prods) {
      const sign = JSON.stringify([prod.name, prod.expr]);
      const handlerInUse = handlerIndex ?? prod.action;
      if (this.prodCache.has(sign) && handlerInUse !== undefined) {
        this.productions[this.prodCache.get(sign)!].action = handlerInUse;
      } else {
        this.prodCache.set(sign, this.productions.length);
        prod.action = handlerInUse;
        this.productions.push(prod);
      }
    }
  }

  bnf(
    prods: string | SimpleProduction | SimpleProduction[],
    handler?: ProductionHandler
  ) {
    // normalize prod to array
    if (typeof (prods) == 'string' || prods instanceof String)
      prods = parseBnf(lexBnf(prods as string, false));
    // .map(x => [x.name, x.expr, undefined]);
    else if (!(prods instanceof Array))
      prods = [prods as SimpleProduction];

    const handlerIndex = this.act(handler);

    this.bnfInner(prods, handlerIndex);
    return this;
  }

  abnf(
    prods: string | SimpleProduction | SimpleProduction[],
    handler?: ProductionHandler
  ) {
    // normalize prod to array
    if (typeof (prods) == 'string' || prods instanceof String)
      prods = parseAbnf(lexAbnf(prods as string));
    else if (!(prods instanceof Array))
      prods = [prods as SimpleProduction];

    const handlerIndex = this.act(handler);

    this.bnfInner(prods, handlerIndex);
    return this;
  }

  registerEbnfParser(parser: (prods: Token<BnfElement | EbnfElement>[]) => ComplexProduction[]) {
    this.parseEbnf = parser;
  }

  ebnf(
    prods: string | ComplexProduction | ComplexProduction[],
    handler?: ProductionHandler
  ) {

    // normalize prod to array
    if (typeof (prods) == 'string' || prods instanceof String) {
      if (this.parseEbnf == undefined)
        throw new ParserError('No EBNF parser is registered in this builder instance.');
      prods = this.parseEbnf(lexBnf(prods as string, true));
    }
    // .map(x => [x.name, x.expr, undefined]);
    else if (!(prods instanceof Array))
      prods = [prods as ComplexProduction];

    const handlerIndex = this.act(handler);
    const simpleProds = convertEbnfToBnf(prods, handlerIndex);
    this.bnfInner(simpleProds);

    return this;
  }

  opr(association: 'nonassoc' | 'left' | 'right', ...oprs: string[]): LRGrammarBuilder;
  opr(precedence: number, association: 'nonassoc' | 'left' | 'right', ...oprs: string[]): LRGrammarBuilder;
  opr(param0: number | string, ...params: string[]): LRGrammarBuilder {
    let precedence = this.lowestPrecedence - 1;
    let assoc: string;
    let oprs: string[];
    if (typeof (param0) == 'number') {
      precedence = Number(param0);
      assoc = params[0];
      oprs = params.slice(1);
    } else {
      assoc = String(param0);
      oprs = params;
    }
    assoc = String(assoc || "nonassoc").toLowerCase().trim();
    if (assoc != 'nonassoc' && assoc != 'left' && assoc != 'right')
      throw new ParserError(`Invalid operator associativity: ${JSON.stringify(assoc)}.`, [precedence, assoc, oprs]);
    for (const name of oprs) {
      const elem: OperatorDefinition = {
        name: name,
        prior: precedence,
        assoc: assoc as 'nonassoc' | 'left' | 'right'
      };
      if (precedence < this.lowestPrecedence)
        this.lowestPrecedence = precedence;
      if (this.oprCache.has(name))
        this.operators[this.oprCache.get(name) as number] = elem;
      else {
        this.oprCache.set(name, this.operators.length);
        this.operators.push(elem);
      }
    }
    return this;
  }

  define(options?: GrammarBuildingOptions): GrammarDefinition {
    let tokens = options?.tokens;
    if (tokens === undefined) { // calculate all terminals
      tokens = [];
      const nonTerminalProds = new Set(this.productions.map(x => x.name));
      this.productions.forEach(x => x.expr.forEach(elem => {
        const name = typeof elem === 'object' && 'value' in elem
          ? String(elem.value)
          : String(elem);
        if (!nonTerminalProds.has(name))
          tokens!.push(name);
      }));
    }
    const mode = options?.mode?.toLowerCase() as 'lalr' | 'slr' | 'lr1' | undefined;

    return {
      moduleName: options?.moduleName || 'Parser',
      actionMode: options?.actionMode,
      mode: mode,
      tokens: tokens,
      productions: this.productions,
      actions: this.actions,
      operators: this.operators,
      startSymbol: options?.startSymbol,
      eofToken: options?.eofToken,
    }
  }

  build(options?: GrammarBuildingOptions): ParsedGrammar {
    const def = this.define(options);
    const gen = new LRGenerator(def);
    return gen.generateParsedGrammar();
  }

  /**
   * Serialize the builder to a JSON-compatible object
   */
  serialize(options?: SerializeOptions): SerializedGrammarBuilder {
    const serializedActions = this.actions.map(action =>
      action ? serializeFunction(action, options) : undefined
    );

    const serialized: SerializedGrammarBuilder = {
      productions: this.productions.map(p => ({ ...p })),
      operators: this.operators.map(o => ({ ...o })),
      lowestPrecedence: this.lowestPrecedence,
      actions: serializedActions,
    };

    return serialized;
  }

  /**
   * Deserialize a builder from a serialized object
   */
  static deserialize(
    serialized: SerializedGrammarBuilder,
    options?: DeserializeOptions
  ): LRGrammarBuilder {
    const builder = new LRGrammarBuilder();

    builder.productions = serialized.productions.map(p => ({ ...p }));
    builder.operators = serialized.operators.map(o => ({ ...o }));
    builder.lowestPrecedence = serialized.lowestPrecedence;

    // Rebuild caches
    builder.prodCache.clear();
    builder.productions.forEach((x, i) =>
      builder.prodCache.set(JSON.stringify([x.name, x.expr]), i)
    );
    builder.oprCache.clear();
    builder.operators.forEach((x, i) =>
      builder.oprCache.set(x.name, i)
    );

    // Deserialize actions
    builder.actions = serialized.actions.map(action =>
      action ? deserializeFunction(action, options) as ProductionHandler : undefined
    );

    return builder;
  }

}
