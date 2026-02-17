import { Production } from "../parser/instrument";

export type ProductionHandler = (...args: any[]) => (any | undefined);


/**
 * modify the input data, and hand in to the next function or do nothing
 */
export interface ProductionHandlerModifier {
  [0]: 'id' | 'epsilon' | 'merge' | 'collect' | 'append' | 'apply',
  [1]: undefined | number | ProductionHandlerModifier, // the next move 
  [2]: number[] // opr params
}

// bnf expressions

export type ComplexExpression = (BnfElement | EbnfElement)[];
export type SimpleExpression = BnfElement[];

export type BnfElement = ({
  type: 'literal' | 'identifier';
  value: string;
} | {
  type: 'number',
  value: number;
}) & {
  isEbnf?: false;
};


export type EbnfElement = ({
  type:
  'optional' |
  'repeat' |
  'group' | 
  'mult'; // string literal with a mult sign
  mult?: number;
}) & {
  isEbnf: true;
  productionList: ComplexExpression[];
};

export interface ComplexProduction {
  name: string;
  expr: ComplexExpression;
  action?: number | ProductionHandlerModifier;
}

export interface SimpleProduction {
  name: string;
  expr: SimpleExpression;
  action?: number | ProductionHandlerModifier;
}


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


