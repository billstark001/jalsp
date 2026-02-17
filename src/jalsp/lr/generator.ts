import { GrammarDefinition } from "./types";
import LR0Generator, { ParsedGrammar } from "./gen-lr0";
import SLRGenerator from "./gen-slr";
import LALRGenerator from "./gen-lalr";

export { ParsedGrammar, LR0Generator, SLRGenerator, LALRGenerator };
export { printActionTable } from "./utils";

export default class LRGenerator extends LR0Generator {
  constructor(grammar: GrammarDefinition) {
    super(grammar);

    const mode = grammar.mode?.toUpperCase();
    if (mode === 'lalr') {
      this.computeMode('lalr', grammar);
    } else if (mode === 'slr') {
      this.computeMode('slr', grammar);
    } else if (mode === 'lr1') {
      this.computeMode('lr1', grammar);
    } else {
      this.computeAuto(grammar);
    }
  }

  private computeMode(mode: 'slr' | 'lalr' | 'lr1', grammar: GrammarDefinition): void {
    const generator = mode === 'slr'
      ? new SLRGenerator(grammar)
      : new LALRGenerator(grammar, mode === 'lalr');

    this.action = generator.action;
    this.goto = generator.goto;
    this.statesTable = generator.statesTable;
    this.startState = generator.startState;
    this.actionTrack = generator.actionTrack;
  }

  private computeAuto(grammar: GrammarDefinition): void {
    const errors: Error[] = [];
    
    // Try SLR first (simplest)
    try {
      this.computeMode('slr', grammar);
      return;
    } catch (e) {
      errors.push(e as Error);
    }
    
    // Try LALR(1) (more powerful, reasonable table size)
    try {
      this.computeMode('lalr', grammar);
      return;
    } catch (e) {
      errors.push(e as Error);
    }
    
    // Try LR(1) (most powerful, largest table size)
    try {
      this.computeMode('lr1', grammar);
      return;
    } catch (e) {
      errors.push(e as Error);
      
      // If all methods fail, throw detailed error
      const errorMessages = errors.map((err, idx) => {
        const modes = ['SLR', 'LALR(1)', 'LR(1)'];
        return `${modes[idx]}: ${err.message}`;
      }).join('\\n');
      
      throw new Error(
        `Failed to generate parser with any mode:\\n${errorMessages}`
      );
    }
  }
}