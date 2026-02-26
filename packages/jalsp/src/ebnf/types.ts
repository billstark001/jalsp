import { BnfElement, ProductionHandlerModifier } from "../bnf/types";

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
 * Complex expression that can contain both BNF and EBNF elements.
 * Represents a sequence of grammar elements in a production rule.
 */
export type ComplexExpression = (BnfElement | EbnfElement)[];


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
