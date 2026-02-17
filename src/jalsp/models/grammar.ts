import type { Production } from "../parser/instrument";
import type { SimpleProduction, ProductionHandler } from "../ebnf/types";


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
  mode?: 'LALR1' | 'SLR' | 'LR1';

  tokens: string[];
  productions: SimpleProduction[];
  actions: (ProductionHandler | undefined)[];
  operators: OperatorDefinition[];

  startSymbol?: string;
  eofToken?: string;

  // conflict policy
  conflictPolicy?: ConflictPolicy;
}

export interface AutomatonActionRecord {
  [0]: 'reduce' | 'accept' | 'shift' | 'error',
  [1]: (number | string)[],
}


