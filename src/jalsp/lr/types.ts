import type { Production } from "./utils-obj";
import type { SimpleProduction, ProductionHandler } from "../bnf/types";


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

export interface GrammarDefinition {
  moduleName: string;
  actionMode?: 'function' | 'constructor';
  mode?: 'lalr' | 'slr' | 'lr1';

  tokens: string[];
  productions: SimpleProduction[];
  actions: (ProductionHandler | undefined)[];
  operators: OperatorDefinition[];

  startSymbol?: string;
  eofToken?: string;

  // conflict policy
  conflictPolicy?: ConflictPolicy;
}

export type AutomatonActionRecord = 
  | ['reduce', [number, number, number]]  // [headSymbol, bodyLength, productionIndex]
  | ['accept', []]
  | ['shift', [number]]  // [nextState]
  | ['error', [string]];  // [errorMessage]


