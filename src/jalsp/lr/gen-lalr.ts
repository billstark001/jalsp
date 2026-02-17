import { LR0Generator } from "./gen-lr0";
import { GrammarDefinition, AutomatonActionRecord } from "./types";
import { Production, LR1Item, isNonTerminal, GSymbol } from "./utils-obj";
import { EOF_INDEX, closureLR1, findState } from "./utils";

export class LALRGenerator extends LR0Generator {
  // Override with specific types for LR1
  override startItem!: LR1Item[];
  override statesTable!: LR1Item[][];

  constructor(grammar: GrammarDefinition, lalr1: boolean = true) {
    super(grammar);
    this.computeLR1(lalr1);
  }

  private computeLR1(lalr1: boolean): void {
    this.determineS1();
    const states: LR1Item[][] = [];

    this.action = {};
    this.goto = {};
    this.startProduction = new Production(this.S1, [this.start]);
    this.startItem = this.closureLR1([
      new LR1Item(this.startProduction.getItems()[0], this.EOF)
    ]);

    states.push(this.startItem);
    let i = 0;

    while (i < states.length) {
      const Ii = states[i];
      const act = (this.action[i] = this.action[i] ?? {});

      for (const lr1Item of Ii) {
        const gItem = lr1Item.item;
        const lookahead = lr1Item.lookahead;

        if (gItem.isAtEnd()) {
          const p = gItem.production;
          const pIndex = this.productions.indexOf(p);

          if (!p.head.equals(this.S1)) {
            const newAction: AutomatonActionRecord = [
              'reduce',
              [this.symbolsTable[gItem.production.head.name], gItem.production.body.length, pIndex]
            ];
            this.tryAddAction(act, gItem, lookahead, newAction);
          } else {
            act[EOF_INDEX] = ['accept', []];
            this.actionTrack.set(act[EOF_INDEX], gItem);
          }
        } else {
          const a = gItem.symbolAhead();
          const Ij = this.gotoLR1(Ii, a);

          let j = findState(states, Ij, lalr1);
          if (j < 0) {
            j = states.push(Ij) - 1;
          } else if (lalr1) {
            this.mergeStates(j, states[j], Ij);
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

  private closureLR1(items: LR1Item[]): LR1Item[] {
    return closureLR1(
      items,
      (head) => this.getProductionsByHead(head),
      (list) => this.computeFirst(list)
    );
  }

  private gotoLR1(i: LR1Item[], x: GSymbol): LR1Item[] {
    const j: LR1Item[] = [];

    for (const lr1Item of i) {
      const gItem = lr1Item.item;
      if (!gItem.isAtEnd()) {
        const a = lr1Item.lookahead;
        if (gItem.symbolAhead().equals(x)) {
          j.push(new LR1Item(gItem.nextItem(), a));
        }
      }
    }

    return this.closureLR1(j);
  }

  private mergeStates(j: number, state: LR1Item[], other: LR1Item[]): void {
    for (const lr1Item of state) {
      if (!lr1Item.item.isAtEnd()) continue;

      let otherLR1item: LR1Item | undefined;
      for (const oLR1item of other) {
        if (oLR1item.item.equals(lr1Item.item)) {
          otherLR1item = oLR1item;
          break;
        }
      }

      if (!otherLR1item) continue;

      const gItem = otherLR1item.item;
      const p = gItem.production;
      const lookahead = otherLR1item.lookahead;
      const pIndex = this.productions.findIndex(x => x.equals(p));

      // Check if production was found
      if (pIndex < 0) {
        console.warn(`Production not found when merging states: ${p}`);
        continue;
      }

      const act = (this.action[j] = this.action[j] ?? {});

      if (p.head.equals(this.S1)) {
        act[EOF_INDEX] = ['accept', []];
        this.actionTrack.set(act[EOF_INDEX], gItem);
      } else {
        const newAction: AutomatonActionRecord = [
          'reduce',
          [this.symbolsTable[gItem.production.head.name], gItem.production.body.length, pIndex]
        ];
        this.tryAddAction(act, gItem, lookahead, newAction);
      }
    }
  }
}