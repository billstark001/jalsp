import LRGrammarBuilder from './builder';
import { GrammarDefinition } from './types';
import { Token } from '../lexer/types';
import { BnfElement, ComplexProduction } from '../bnf/types';

describe('LRGrammarBuilder', () => {
  describe('clone()', () => {
    it('should create an independent copy of the builder', () => {
      const builder1 = new LRGrammarBuilder();
      builder1.bnf('S = A B');
      builder1.opr('left', '+', '-');

      const builder2 = builder1.clone();
      builder2.bnf('S = C D');

      // builder1 should not be affected by changes to builder2
      const def1 = builder1.define();
      const def2 = builder2.define();

      expect(def1.productions.length).toBe(1);
      expect(def2.productions.length).toBe(2);
    });

    it('should copy actions and handlers', () => {
      const handler = (x: number) => x * 2;
      const builder1 = new LRGrammarBuilder();
      builder1.bnf('S = A', handler);

      const builder2 = builder1.clone();
      const def = builder2.define();

      expect(def.actions.length).toBeGreaterThan(0);
      expect(def.actions[0]).toBe(handler);
    });
  });

  describe('addFrom()', () => {
    it('should add productions from another builder', () => {
      const builder1 = new LRGrammarBuilder();
      builder1.bnf('S = A B');
      builder1.opr('left', '+');

      const builder2 = new LRGrammarBuilder();
      builder2.bnf('T = C D');
      builder2.opr('right', '*');

      builder1.addFrom(builder2);
      const def = builder1.define();

      expect(def.productions.length).toBe(2);
      expect(def.operators.length).toBe(2);
      expect(def.productions[0].name).toBe('S');
      expect(def.productions[1].name).toBe('T');
    });

    it('should add productions from a GrammarDefinition', () => {
      const def: GrammarDefinition = {
        moduleName: 'Test',
        tokens: ['A', 'B'],
        productions: [
          { name: 'S', expr: [{ type: 'identifier', value: 'A' }] }
        ],
        actions: [],
        operators: [],
      };

      const builder = new LRGrammarBuilder();
      builder.addFrom(def);

      const result = builder.define();
      expect(result.productions.length).toBe(1);
      expect(result.productions[0].name).toBe('S');
    });

    it('should handle action indices correctly when adding from another builder', () => {
      const handler1 = (x: number) => x + 1;
      const handler2 = (x: number) => x * 2;

      const builder1 = new LRGrammarBuilder();
      builder1.bnf('S = A', handler1);

      const builder2 = new LRGrammarBuilder();
      builder2.bnf('T = B', handler2);

      builder1.addFrom(builder2);
      const def = builder1.define();

      expect(def.actions.length).toBe(2);
      expect(def.actions[0]).toBe(handler1);
      expect(def.actions[1]).toBe(handler2);
      expect(def.productions[0].action).toBe(0);
      expect(def.productions[1].action).toBe(1);
    });
  });

  describe('abnf()', () => {
    it('should parse ABNF grammar strings', () => {
      const builder = new LRGrammarBuilder();
      builder.abnf('rule = value');

      const def = builder.define();
      expect(def.productions.length).toBe(1);
      expect(def.productions[0].name).toBe('rule');
    });

    it('should parse ABNF with alternatives', () => {
      const builder = new LRGrammarBuilder();
      builder.abnf('rule = value1 / value2');

      const def = builder.define();
      expect(def.productions.length).toBe(2);
      expect(def.productions[0].name).toBe('rule');
      expect(def.productions[1].name).toBe('rule');
    });

    it('should accept SimpleProduction objects', () => {
      const builder = new LRGrammarBuilder();
      builder.abnf({
        name: 'S',
        expr: [
          { type: 'identifier', value: 'A' },
          { type: 'identifier', value: 'B' }
        ]
      });

      const def = builder.define();
      expect(def.productions.length).toBe(1);
      expect(def.productions[0].name).toBe('S');
      expect(def.productions[0].expr.length).toBe(2);
    });

    it('should handle actions in ABNF', () => {
      const handler = (a: string, b: string) => a + b;
      const builder = new LRGrammarBuilder();
      builder.abnf('S = A B', handler);

      const def = builder.define();
      expect(def.actions.length).toBe(1);
      expect(def.actions[0]).toBe(handler);
      expect(def.productions[0].action).toBe(0);
    });
  });

  describe('serialize() and deserialize()', () => {
    it('should serialize and deserialize a simple builder', () => {
      const builder1 = new LRGrammarBuilder();
      builder1.bnf('S = A B');
      builder1.opr('left', '+', '-');

      const serialized = builder1.serialize();
      const builder2 = LRGrammarBuilder.deserialize(serialized);

      const def1 = builder1.define();
      const def2 = builder2.define();

      expect(def2.productions.length).toBe(def1.productions.length);
      expect(def2.operators.length).toBe(def1.operators.length);
      expect(def2.productions[0].name).toBe(def1.productions[0].name);
    });

    it('should serialize and deserialize handlers', () => {
      const builder1 = new LRGrammarBuilder();
      const handler = (a: number, b: number) => a + b;
      builder1.bnf('S = A B', handler);

      const serialized = builder1.serialize();
      const builder2 = LRGrammarBuilder.deserialize(serialized);

      const def2 = builder2.define();
      expect(def2.actions.length).toBe(1);
      expect(def2.actions[0]).toBeDefined();

      // Test that the deserialized function works
      const result = (def2.actions[0] as (a: number, b: number) => number)(5, 3);
      expect(result).toBe(8);
    });

    it('should preserve lowestPrecedence value', () => {
      const builder1 = new LRGrammarBuilder();
      builder1.opr(10, 'left', '+');
      builder1.opr(5, 'right', '*');

      const serialized = builder1.serialize();
      const builder2 = LRGrammarBuilder.deserialize(serialized);

      // Add a new operator without precedence - it should use lowestPrecedence
      builder2.opr('left', '/');

      const def = builder2.define();
      const divOpr = def.operators.find(o => o.name === '/');
      expect(divOpr?.prior).toBe(4); // Should be lowestPrecedence - 1
    });
  });

  describe('constructor fixes', () => {
    it('should copy actions from another builder', () => {
      const handler = (x: number) => x * 2;
      const builder1 = new LRGrammarBuilder();
      builder1.bnf('S = A', handler);

      const builder2 = new LRGrammarBuilder(builder1);
      const def = builder2.define();

      expect(def.actions.length).toBe(1);
      expect(def.actions[0]).toBe(handler);
    });

    it('should copy lowestPrecedence from another builder', () => {
      const builder1 = new LRGrammarBuilder();
      builder1.opr(10, 'left', '+');

      const builder2 = new LRGrammarBuilder(builder1);
      builder2.opr('right', '*');

      const def = builder2.define();
      const multOpr = def.operators.find(o => o.name === '*');
      expect(multOpr?.prior).toBe(9); // Should use copied lowestPrecedence
    });

    it('should copy parseEbnf from another builder', () => {
      const builder1 = new LRGrammarBuilder();
      const mockParser = (_tokens: Token<BnfElement>[]) =>
        [{ name: 'test', expr: [], action: undefined }] as ComplexProduction[];
      builder1.registerEbnfParser(mockParser);

      const builder2 = new LRGrammarBuilder(builder1);

      // parseEbnf should be copied
      expect(() => builder2.ebnf('S = (A | B)')).not.toThrow();
    });
  });

  describe('define() fixes', () => {
    it('should correctly extract terminal names from BnfElements', () => {
      const builder = new LRGrammarBuilder();
      builder.bnf('S = A B');
      builder.bnf('A = "literal"');

      const def = builder.define();

      // Should extract terminal names correctly
      expect(def.tokens).toContain('B');
      expect(def.tokens).toContain('literal');
      expect(def.tokens).not.toContain('S');
      expect(def.tokens).not.toContain('A');
    });
  });
});
