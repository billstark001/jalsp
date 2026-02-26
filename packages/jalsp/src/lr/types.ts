import type { Production } from "./utils-obj";
import type { SimpleProduction } from "../bnf/types";

/**
 * Production handler function that processes matched production rules.
 * Takes any number of arguments (matched symbols) and returns a value or undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProductionHandler<TToken = any, TResult = any | undefined> = (...args: (TToken | TResult)[]) => TResult;

export interface OperatorDefinition {
  name: string;
  assoc: 'nonassoc' | 'left' | 'right';
  prior: number;
}

export interface ConflictPolicy {
  shiftReduce?: 'reduce' | 'shift' | 'error';
  reduceReduce?: 'existing' | 'new' | 'error';
  shiftShift?: 'existing' | 'new' | 'error';
  filterer?: (prod: Production, oprSet: Map<string, OperatorDefinition>) => OperatorDefinition | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GrammarDefinition<TToken = any, TResult = any | undefined> {
  moduleName: string;
  actionMode?: 'function' | 'constructor';
  mode?: 'lalr' | 'slr' | 'lr1';

  tokens: string[];
  productions: SimpleProduction[];
  actions: (ProductionHandler<TToken, TResult> | undefined)[];
  operators: OperatorDefinition[];

  startSymbol?: string;
  eofToken?: string; // name of the EOF token, default is '<<EOF>>'

  // conflict policy
  conflictPolicy?: ConflictPolicy;
}

export type AutomatonActionRecord = 
  | ['reduce', [number, number, number]]  // [headSymbol, bodyLength, productionIndex]
  | ['accept', []]
  | ['shift', [number]]  // [nextState]
  | ['error', [string]];  // [errorMessage]


