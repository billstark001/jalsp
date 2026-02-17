

import { lexBnf, parseBnf } from "../bnf/bnf";
import { convertEbnfToBnf, lexEbnf } from "./ebnf";
import { parseEbnf } from './ebnf-parser';
import { BnfElement } from "../bnf/types";
import { ComplexExpression } from "./types";

const testGrammar = `

stmt = expr '=' expr [';'] | expr LPAREN expr_list RPAREN expr;

expr ::= expr OPR2 expr | OPR1 expr | expr '?' expr ':' expr;
expr : IDENT | LITERAL;

`;

const testBnf = `
expr = expr OPR2 expr | OPR1 expr | expr '?' expr ':' expr | '(' expr ')'
`;

// Helper function to check if an expression contains a specific identifier
function hasIdentifier(expr: ComplexExpression, identifier: string): boolean {
  return expr.some(elem =>
    !elem.isEbnf &&
    (elem.type === 'identifier' || elem.type === 'literal') &&
    elem.value === identifier
  );
}

describe('Lexing EBNF grammars', () => {

  describe('EBNF mode', () => {
    it('should tokenize EBNF with repetition', () => {
      const tokens = lexEbnf('<list> ::= <item> { "," <item> }');

      const braces = tokens.filter(t => t.name === 'CB_L' || t.name === 'CB_R');
      expect(braces).toHaveLength(2);
    });

    it('should handle optional elements', () => {
      const tokens = lexEbnf('<item> ::= <val> [ "optional" ]');

      const brackets = tokens.filter(t => t.name === 'SB_L' || t.name === 'SB_R');
      expect(brackets).toHaveLength(2);
    });

    it('should handle grouping', () => {
      const tokens = lexEbnf('<expr> ::= ( <a> | <b> ) <c>');

      const parens = tokens.filter(t => t.name === 'RB_L' || t.name === 'RB_R');
      expect(parens).toHaveLength(2);
    });

    it('should handle numbers', () => {
      const tokens = lexEbnf('<repeat> ::= 3 * <item>');

      const numberToken = tokens.find(t => t.name === 'NON_NEG_INTEGER');
      expect(numberToken).toBeDefined();
      expect(numberToken!.value.type).toBe('number');
      expect((numberToken!.value as BnfElement).value).toBe(3);
    });

    it('should handle question mark', () => {
      const tokens = lexEbnf('<optional> ::= <item>?');

      expect(tokens.some(t => t.name === 'QUES')).toBe(true);
    });
  });
});

describe('Parsing BNF and EBNF syntax', () => {

  it('parses BNF grammar', () => {
    expect(lexEbnf(testBnf).length).toBeGreaterThan(0);
  });

  it('throws an error if an incorrect BNF grammar is fed', () => {
    expect(() => lexBnf(testGrammar)).toThrow();
  });

  it('parses the given BNF grammar to 4 productions', () => {
    const res2 = lexBnf(testBnf);
    const res3 = parseBnf(res2, false);
    expect(res3.length).toBe(4);
    expect(res3[0].expr.length).toBe(3);
    expect(res3[1].expr.length).toBe(2);
    expect(res3[2].expr.length).toBe(5);
    expect(res3[3].expr.length).toBe(3);
  });

  it('parses EBNF grammar', () => {
    expect(lexEbnf(testGrammar).length).toBeGreaterThan(0);
  });

  it('throws an error if an incorrect EBNF grammar is fed', () => {
    const lexRes = lexEbnf(testGrammar + '= = = = = = = =');
    expect(() => parseEbnf(lexRes)).toThrow();
  });

  it('parses correct EBNF grammar with grouping, optional, and repetition', () => {
    const ebnf = parseEbnf(lexEbnf('E = E (E) * 2 [E] {E} * 3 | F'));
    const bnf = convertEbnfToBnf(ebnf);
    expect(bnf.filter(x => hasIdentifier(x.expr, 'F')).length).toBeGreaterThan(0);
  });

  describe('EBNF Optional Elements', () => {
    it('converts optional element [X] to two productions', () => {
      const ebnf = parseEbnf(lexEbnf('S = A [B] C'));
      const bnf = convertEbnfToBnf(ebnf);
      // Should generate: S = A C | S = A B C
      expect(bnf.length).toBeGreaterThan(1);
      const withB = bnf.filter(p => hasIdentifier(p.expr, 'B'));
      const withoutB = bnf.filter(p => !hasIdentifier(p.expr, 'B'));
      expect(withB.length).toBeGreaterThan(0);
      expect(withoutB.length).toBeGreaterThan(0);
    });

    it('handles nested optional elements', () => {
      const ebnf = parseEbnf(lexEbnf('S = A [B [C]]'));
      const bnf = convertEbnfToBnf(ebnf);
      // Should generate multiple productions for different combinations
      expect(bnf.length).toBeGreaterThan(1);
    });
  });

  describe('EBNF Repetition', () => {
    it('converts repetition {X} to recursive production', () => {
      const ebnf = parseEbnf(lexEbnf('S = A {B}'));
      const bnf = convertEbnfToBnf(ebnf);
      // Should generate auxiliary production for repetition
      expect(bnf.length).toBeGreaterThan(1);
      // Should have at least one production with the original name
      expect(bnf.some(p => p.name === 'S')).toBe(true);
    });

    it('handles repetition with multiple elements', () => {
      const ebnf = parseEbnf(lexEbnf('S = {A B}'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBeGreaterThan(0);
    });
  });

  describe('EBNF Grouping', () => {
    it('converts grouped alternatives (A | B) to multiple productions', () => {
      const ebnf = parseEbnf(lexEbnf('S = X (A | B) Y'));
      const bnf = convertEbnfToBnf(ebnf);
      // Should expand to: S = X A Y | S = X B Y
      expect(bnf.length).toBe(2);
      expect(bnf.some(p => hasIdentifier(p.expr, 'A'))).toBe(true);
      expect(bnf.some(p => hasIdentifier(p.expr, 'B'))).toBe(true);
    });

    it('handles grouped sequences', () => {
      const ebnf = parseEbnf(lexEbnf('S = (A B) C'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBeGreaterThan(0);
      expect(bnf[0].expr.length).toBeGreaterThan(2);
    });
  });

  describe('EBNF Multiplication', () => {
    it('converts element * 2 to repeated sequence', () => {
      const ebnf = parseEbnf(lexEbnf('S = A * 2'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBeGreaterThan(0);
      // Should have A appearing twice in the expression
      const aCount = bnf[0].expr.filter(e => !e.isEbnf && e.value === 'A').length;
      expect(aCount).toBe(2);
    });

    it('converts element * 3 to triple sequence', () => {
      const ebnf = parseEbnf(lexEbnf('S = B * 3'));
      const bnf = convertEbnfToBnf(ebnf);
      const bCount = bnf[0].expr.filter(e => !e.isEbnf && e.value === 'B').length;
      expect(bCount).toBe(3);
    });

    it('handles group multiplication', () => {
      const ebnf = parseEbnf(lexEbnf('S = (A B) * 2'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBeGreaterThan(0);
    });
  });

  describe('EBNF Complex Combinations', () => {
    it('handles optional with multiplication', () => {
      const ebnf = parseEbnf(lexEbnf('S = A [B] * 2'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBeGreaterThan(0);
    });

    it('handles nested grouping with alternatives', () => {
      const ebnf = parseEbnf(lexEbnf('S = A (B | C | D) E'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBe(3);
      expect(bnf.some(p => hasIdentifier(p.expr, 'B'))).toBe(true);
      expect(bnf.some(p => hasIdentifier(p.expr, 'C'))).toBe(true);
      expect(bnf.some(p => hasIdentifier(p.expr, 'D'))).toBe(true);
    });

    it('handles multiple EBNF constructs in one rule', () => {
      const ebnf = parseEbnf(lexEbnf('S = A [B] (C | D) {E}'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBeGreaterThan(0);
    });

    it('handles the complex test grammar', () => {
      const ebnf = parseEbnf(lexEbnf(testGrammar));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBeGreaterThan(0);
      // Check that stmt and expr productions exist
      expect(bnf.some(p => p.name === 'stmt')).toBe(true);
      expect(bnf.some(p => p.name === 'expr')).toBe(true);
    });
  });

  describe('EBNF Edge Cases', () => {
    it('handles empty production', () => {
      const ebnf = parseEbnf(lexEbnf('S = '));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBe(1);
      expect(bnf[0].expr.length).toBe(0);
    });

    it('handles single terminal', () => {
      const ebnf = parseEbnf(lexEbnf('S = A'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBe(1);
      expect(bnf[0].expr.length).toBe(1);
    });

    it('handles multiple alternatives without EBNF constructs', () => {
      const ebnf = parseEbnf(lexEbnf('S = A | B | C'));
      const bnf = convertEbnfToBnf(ebnf);
      expect(bnf.length).toBe(3);
    });
  });

});


