import LRGenerator, { LR0Generator, SLRGenerator, LALRGenerator } from './generator';
import { GrammarDefinition } from './types';

describe('Parser Generators', () => {
  // Helper function to create BnfElement
  const lit = (value: string) => ({ type: 'literal' as const, value });
  const id = (value: string) => ({ type: 'identifier' as const, value });

  // Simple grammar: S -> a | (S)
  const simpleGrammar: GrammarDefinition = {
    moduleName: 'SimpleGrammar',
    tokens: ['a', '(', ')', 'eof'],
    productions: [
      { name: 'S', expr: [lit('a')] },
      { name: 'S', expr: [lit('('), id('S'), lit(')')] },
    ],
    actions: [
      (a: string) => a,
      (_1: string, s: string, _2: string) => `(${s})`,
    ],
    operators: [],
    startSymbol: 'S',
    eofToken: 'eof',
  };

  // Arithmetic expression grammar for more complex tests
  const arithmeticGrammar: GrammarDefinition = {
    moduleName: 'ArithmeticGrammar',
    tokens: ['num', '+', '*', '(', ')', 'eof'],
    productions: [
      { name: 'E', expr: [id('E'), lit('+'), id('T')] },
      { name: 'E', expr: [id('T')] },
      { name: 'T', expr: [id('T'), lit('*'), id('F')] },
      { name: 'T', expr: [id('F')] },
      { name: 'F', expr: [lit('('), id('E'), lit(')')] },
      { name: 'F', expr: [lit('num')] },
    ],
    actions: [
      (e: number, _: string, t: number) => e + t,
      (t: number) => t,
      (t: number, _: string, f: number) => t * f,
      (f: number) => f,
      (_1: string, e: number, _2: string) => e,
      (n: number) => n,
    ],
    operators: [
      { name: '+', assoc: 'left', prior: 10 },
      { name: '*', assoc: 'left', prior: 20 },
    ],
    startSymbol: 'E',
    eofToken: 'eof',
  };

  describe('LR0Generator', () => {
    it('should create LR(0) generator with basic properties', () => {
      const generator = new LR0Generator(simpleGrammar);

      expect(generator.moduleName).toBe('SimpleGrammar');
      expect(generator.tokens.size).toBeGreaterThan(0);
      expect(generator.productions.length).toBeGreaterThan(0);
      expect(generator.symbols.length).toBeGreaterThan(0);
    });

    it('should compute FIRST sets', () => {
      const generator = new LR0Generator(simpleGrammar);

      expect(generator.first).toBeDefined();
      expect(Object.keys(generator.first).length).toBeGreaterThan(0);
    });

    it('should compute FOLLOW sets', () => {
      const generator = new LR0Generator(simpleGrammar);

      expect(generator.follow).toBeDefined();
      expect(Object.keys(generator.follow).length).toBeGreaterThan(0);
    });

    it('should have EOF symbol', () => {
      const generator = new LR0Generator(simpleGrammar);

      expect(generator.EOF).toBeDefined();
      expect(generator.EOF.name).toBe('eof');
    });

    it('should create symbol table', () => {
      const generator = new LR0Generator(simpleGrammar);

      expect(generator.symbolsTable).toBeDefined();
      expect(Object.keys(generator.symbolsTable).length).toBeGreaterThan(0);
    });
  });

  describe('SLRGenerator', () => {
    it('should create SLR parser tables', () => {
      const generator = new SLRGenerator(simpleGrammar);

      expect(generator.action).toBeDefined();
      expect(generator.goto).toBeDefined();
      expect(generator.statesTable.length).toBeGreaterThan(0);
    });

    it('should handle accept action', () => {
      const generator = new SLRGenerator(simpleGrammar);

      // Check if there's an accept action in the action table
      let hasAccept = false;
      for (const stateId in generator.action) {
        const actions = generator.action[stateId];
        for (const actionId in actions) {
          const action = actions[actionId];
          if (action[0] === 'accept') {
            hasAccept = true;
            break;
          }
        }
        if (hasAccept) break;
      }

      expect(hasAccept).toBe(true);
    });

    it('should generate action table with shift/reduce actions', () => {
      const generator = new SLRGenerator(arithmeticGrammar);

      let hasShift = false;
      let hasReduce = false;

      for (const stateId in generator.action) {
        const actions = generator.action[stateId];
        for (const actionId in actions) {
          const action = actions[actionId];
          if (action[0] === 'shift') hasShift = true;
          if (action[0] === 'reduce') hasReduce = true;
        }
      }

      expect(hasShift).toBe(true);
      expect(hasReduce).toBe(true);
    });
  });

  describe('LALRGenerator', () => {
    it('should create LALR(1) parser tables', () => {
      const generator = new LALRGenerator(simpleGrammar, true);

      expect(generator.action).toBeDefined();
      expect(generator.goto).toBeDefined();
      expect(generator.statesTable.length).toBeGreaterThan(0);
    });

    it('should create LR(1) parser tables when lalr flag is false', () => {
      const generator = new LALRGenerator(simpleGrammar, false);

      expect(generator.action).toBeDefined();
      expect(generator.goto).toBeDefined();
      expect(generator.statesTable.length).toBeGreaterThan(0);
    });

    it('should handle arithmetic grammar', () => {
      const generator = new LALRGenerator(arithmeticGrammar, true);

      expect(generator.statesTable.length).toBeGreaterThan(0);
      expect(Object.keys(generator.action).length).toBeGreaterThan(0);
    });
  });

  describe('LRGenerator (Auto mode)', () => {
    it('should automatically select a working mode for simple grammar', () => {
      const generator = new LRGenerator(simpleGrammar);

      expect(generator.action).toBeDefined();
      expect(generator.goto).toBeDefined();
      expect(generator.statesTable.length).toBeGreaterThan(0);
    });

    it('should respect explicit SLR mode', () => {
      const slrGrammar = { ...simpleGrammar, mode: 'slr' as const };
      const generator = new LRGenerator(slrGrammar);

      expect(generator.action).toBeDefined();
      expect(generator.statesTable.length).toBeGreaterThan(0);
    });

    it('should respect explicit LALR mode', () => {
      const lalrGrammar = { ...simpleGrammar, mode: 'lalr' as const };
      const generator = new LRGenerator(lalrGrammar);

      expect(generator.action).toBeDefined();
      expect(generator.statesTable.length).toBeGreaterThan(0);
    });

    it('should respect explicit LR(1) mode', () => {
      const lr1Grammar = { ...simpleGrammar, mode: 'lr1' as const };
      const generator = new LRGenerator(lr1Grammar);

      expect(generator.action).toBeDefined();
      expect(generator.statesTable.length).toBeGreaterThan(0);
    });

    it('should try multiple modes in auto mode', () => {
      // This grammar should work with any mode
      const autoGrammar = { ...arithmeticGrammar };
      delete autoGrammar.mode;

      const generator = new LRGenerator(autoGrammar);

      expect(generator.action).toBeDefined();
      expect(generator.goto).toBeDefined();
    });
  });

  describe('Grammar properties', () => {
    it('should handle custom action mode', () => {
      const constructorGrammar: GrammarDefinition = {
        ...simpleGrammar,
        actionMode: 'constructor',
      };

      const generator = new SLRGenerator(constructorGrammar);
      expect(generator.actionMode).toBe('constructor');
    });

    it('should handle operators', () => {
      const generator = new SLRGenerator(arithmeticGrammar);

      expect(generator.operators.size).toBe(2);
      expect(generator.operators.has('+')).toBe(true);
      expect(generator.operators.has('*')).toBe(true);
    });

    it('should create correct start symbol', () => {
      const generator = new SLRGenerator(simpleGrammar);

      expect(generator.start).toBeDefined();
      expect(generator.start.name).toBe('S');
    });
  });

  describe('Edge cases', () => {
    it('should handle grammar with single production', () => {
      const singleProdGrammar: GrammarDefinition = {
        moduleName: 'SingleProd',
        tokens: ['a', 'eof'],
        productions: [{ name: 'S', expr: [lit('a')] }],
        actions: [(a: string) => a],
        operators: [],
        startSymbol: 'S',
        eofToken: 'eof',
      };

      const generator = new LRGenerator(singleProdGrammar);
      expect(generator.productions.length).toBeGreaterThan(0);
    });

    it('should handle empty operators array', () => {
      const noOprGrammar: GrammarDefinition = {
        ...simpleGrammar,
        operators: [],
      };

      const generator = new SLRGenerator(noOprGrammar);
      expect(generator.operators.size).toBe(0);
    });

    it('should handle undefined actions', () => {
      const noActionsGrammar: GrammarDefinition = {
        ...simpleGrammar,
        actions: [undefined, undefined],
      };

      const generator = new SLRGenerator(noActionsGrammar);
      expect(generator.actions).toHaveLength(2);
    });
  });

  describe('State machine structure', () => {
    it('should have valid state transitions in goto table', () => {
      const generator = new SLRGenerator(arithmeticGrammar);

      // Check that goto entries reference valid states
      for (const stateId in generator.goto) {
        const transitions = generator.goto[stateId];
        for (const symbolId in transitions) {
          const targetState = transitions[symbolId];
          expect(targetState).toBeGreaterThanOrEqual(0);
          expect(targetState).toBeLessThan(generator.statesTable.length);
        }
      }
    });

    it('should have start state defined', () => {
      const generator = new SLRGenerator(simpleGrammar);

      expect(generator.startState).toBeDefined();
      expect(generator.startState).toBeGreaterThanOrEqual(0);
      expect(generator.startState).toBeLessThan(generator.statesTable.length);
    });

    it('should track action sources', () => {
      const generator = new SLRGenerator(simpleGrammar);

      expect(generator.actionTrack).toBeDefined();
      expect(generator.actionTrack.size).toBeGreaterThan(0);
    });
  });
});
