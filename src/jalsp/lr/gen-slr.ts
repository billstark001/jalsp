import LR0Generator from "./gen-lr0";
import { GrammarDefinition, AutomatonActionRecord } from "./types";
import { Production, GItem, isNonTerminal } from "./utils-obj";
import { EOF_INDEX, findState } from "./utils";

export default class SLRGenerator extends LR0Generator {
  constructor(grammar: GrammarDefinition) {
    super(grammar);
    this.computeSLR();
  }

  private computeSLR(): void {
    this.determineS1();
    const states: GItem[][] = [];

    this.action = {};
    this.goto = {};
    this.startProduction = new Production(this.S1, [this.start]);
    this.startItem = this.closure([this.startProduction.getItems()[0]]);

    states.push(this.startItem);
    let i = 0;
    
    while (i < states.length) {
      const Ii = states[i];
      const act = (this.action[i] = this.action[i] ?? {});
      
      for (const gItem of Ii) {
        if (gItem.isAtEnd()) {
          const p = gItem.production;
          const pIndex = this.productions.indexOf(p);
          
          if (!p.head.equals(this.S1)) {
            const follow = this.follow[p.head.toString()];
            for (const a of follow) {
              const newAction: AutomatonActionRecord = [
                'reduce',
                [this.symbolsTable[gItem.production.head.name], gItem.production.body.length, pIndex]
              ];
              this.tryAddAction(act, gItem, a, newAction);
            }
          } else {
            act[EOF_INDEX] = ['accept', []];
            this.actionTrack.set(act[EOF_INDEX], gItem);
          }
        } else {
          const a = gItem.symbolAhead();
          const Ij = this.gotoLR0(Ii, a);
          
          let j = findState(states, Ij);
          if (j < 0) {
            j = states.push(Ij) - 1;
          }
          
          const an = this.symbolsTable[a.name];
          if (isNonTerminal(a)) {
            (this.goto[i] = this.goto[i] ?? {})[an] = j;
          } else {
            const newAction: AutomatonActionRecord = ['shift', [j]];
            this.tryAddAction(act, gItem, a, newAction);
          }
        }
      }
      i++;
    }
    
    this.statesTable = states;
    this.startState = 0;
  }
}