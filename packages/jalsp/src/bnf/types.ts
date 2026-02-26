/**
 * Modifier that transforms data through a series of operations.
 * Used to modify input data and pass it to the next function or do nothing.
 */
export interface ProductionHandlerModifier {
  /** Operation type: 
   * - 'id': identity operation
   * - 'epsilon': empty operation
   * - 'merge': merge multiple values
   * - 'collect': collect values into array
   * - 'append': append value to array
   * - 'apply': apply function
   */
  [0]: 'id' | 'epsilon' | 'merge' | 'collect' | 'append' | 'apply',
  /** The next operation in the chain */
  [1]: undefined | number | ProductionHandlerModifier,
  /** Operation parameters */
  [2]: number[]
}

/**
 * Simple expression containing only BNF elements.
 * Represents a sequence of basic grammar elements without EBNF extensions.
 */
export type SimpleExpression = BnfElement[];

/**
 * Basic BNF grammar element.
 * Represents a terminal or non-terminal symbol in BNF notation.
 */
export type BnfElement = ({
  /** Type of the BNF element */
  type: 'literal' | 'identifier';
  /** String value of the element */
  value: string;
} | {
  /** Numeric type element */
  type: 'number',
  /** Numeric value */
  value: number;
}) & {
  /** Flag indicating this is not an EBNF element */
  isEbnf?: false;
};

/**
 * Production rule with simple BNF expressions only.
 * Represents a basic BNF grammar production without EBNF extensions.
 */
export interface SimpleProduction {
  /** Name of the non-terminal being defined */
  name: string;
  /** The right-hand side expression (BNF elements only) */
  expr: SimpleExpression;
  /** Optional action handler or modifier to process matched values */
  action?: number | ProductionHandlerModifier;
}
