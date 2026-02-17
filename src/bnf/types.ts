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
 * Complex expression that can contain both BNF and EBNF elements.
 * Represents a sequence of grammar elements in a production rule.
 */
export type ComplexExpression = (BnfElement | EbnfElement)[];

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
 * Extended BNF (EBNF) element with special constructs.
 * Supports grouping, optional elements, repetition, and multiplicity.
 */
export type EbnfElement = ({
  /** Type of EBNF construct:
   * - 'optional': [...] zero or one occurrence
   * - 'repeat': {...} zero or more occurrences  
   * - 'group': (...) grouping
   * - 'mult': multiplicity with specific count
   */
  type:
  'optional' |
  'repeat' |
  'group' |
  'mult';
  /** Multiplicity factor (for 'mult' type or to indicate repetition count) */
  mult?: number;
}) & {
  /** Flag indicating this is an EBNF element */
  isEbnf: true;
  /** List of alternative productions within this EBNF element */
  productionList: ComplexExpression[];
};

/**
 * Production rule with complex expressions (may include EBNF elements).
 * Represents a grammar production with a name, expression, and optional action.
 */
export interface ComplexProduction {
  /** Name of the non-terminal being defined */
  name: string;
  /** The right-hand side expression (may contain EBNF elements) */
  expr: ComplexExpression;
  /** Optional action handler or modifier to process matched values */
  action?: number | ProductionHandlerModifier;
}

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
