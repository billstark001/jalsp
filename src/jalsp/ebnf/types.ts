// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProductionHandler = (...args: any[]) => (any | undefined);

/**
 * modify the input data, and hand in to the next function or do nothing
 */
export interface ProductionHandlerModifier {
  [0]: 'id' | 'epsilon' | 'merge' | 'collect' | 'append' | 'apply',
  [1]: undefined | number | ProductionHandlerModifier, // the next move 
  [2]: number[] // opr params
}

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
