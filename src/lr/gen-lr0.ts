import {
  AutomatonActionRecord,
  ConflictPolicy,
  GrammarDefinition,
  OperatorDefinition,
  ProductionHandler
} from "./types";
import { SimpleProduction } from "../bnf/types";
import { GItem, Production, eps, GSymbol, isNonTerminal, NT, T, LR1Item } from "./utils-obj";
import '../utils/array-extension';
import { getIncrementName } from "../lexer/utils";
import { ParserError } from "./error";
import { compileActionRecord } from "./utils";
import { DEFAULT_EOF_TOKEN } from "../lexer/lexer";
import {
  EOF_INDEX,
  computeFirst,
  closure,
  defaultOperatorHandler,
  getConflictText
} from "./utils";

export interface ParsedGrammar {
  action: { [id: number]: AutomatonActionRecord[] };
  goto: { [id: number]: number[] };
  actionMode: string;
  actions: (ProductionHandler | undefined)[];
  startState: number;
  symbols: GSymbol[];
  symbolsTable: { [name: string]: number };
}

export class LR0Generator {
  tokens: Set<string>;
  productions: Production[];
  actions: (ProductionHandler | undefined)[];
  operators: Map<string, OperatorDefinition>;

  start: GSymbol;

  moduleName: string;
  actionMode: 'function' | 'constructor';

  nonTerminals: NT[];
  terminals: T[];

  symbols: GSymbol[];
  symbolsTable: { [name: string]: number };

  first: { [name: string]: Set<GSymbol> } = {};
  follow: { [name: string]: Set<GSymbol> } = {};

  EOF: GSymbol;
  S1: GSymbol = eps;
  startItem: GItem[] | LR1Item[] = [];
  startProduction?: Production = undefined;
  action: { [id: number]: AutomatonActionRecord[] } = {};
  actionTrack: Map<AutomatonActionRecord, GItem> = new Map();
  goto: { [id: number]: number[] } = {};
  statesTable: GItem[][] | LR1Item[][] = [];
  startState: number = 0;

  conflictPolicy: ConflictPolicy;

  constructor(grammar: GrammarDefinition) {
    this.tokens = new Set(grammar.tokens);
    this.nonTerminals = [];
    this.terminals = [];
    this.moduleName = grammar.moduleName;
    this.actionMode = grammar.actionMode || 'function';
    this.conflictPolicy = Object.assign({}, grammar.conflictPolicy);
    this.conflictPolicy.filterer = this.conflictPolicy.filterer ?? defaultOperatorHandler;
    this.symbols = [];
    this.symbolsTable = {};

    // determine eof
    this.EOF = new T(grammar.eofToken || DEFAULT_EOF_TOKEN);
    this.symbols.push(this.EOF);
    this.symbolsTable[this.EOF.toString()] = EOF_INDEX;
    this.terminals.push(this.EOF);
    this.tokens.add(this.EOF.name);

    this.operators = new Map();

    this.productions = [];
    this.actions = [];
    this.processProductions(grammar.productions, (i) => grammar.actions[i]);

    if (grammar.operators !== undefined) {
      for (const opList of grammar.operators) {
        this.operators.set(opList.name, Object.assign({}, opList));
      }
    }

    // determine start symbol
    this.start = grammar.startSymbol
      ? this.symbols[this.symbolsTable[grammar.startSymbol]]
      : this.productions[0].head;

    this.computeFirstAndFollow();
  }

  protected processProductions(
    unparsed: SimpleProduction[],
    actionTable: (i: number) => ProductionHandler | undefined
  ): void {
    for (const production of unparsed) {
      const head = production.name ?? '[E]';
      const body = production.expr ?? [];

      let action: ProductionHandler | undefined = undefined;
      if (typeof production.action === 'number') {
        action = actionTable(Number(production.action));
      } else if (typeof production.action !== 'undefined') {
        action = compileActionRecord(production.action, actionTable);
      }

      const p = new Production(
        this.addGrammarElement(head),
        body.map((element) => {
          const elementName = typeof element === 'string' 
            ? element 
            : element.type === 'number' 
              ? String(element.value) 
              : element.value;
          return this.addGrammarElement(elementName);
        })
      );
      this.productions.push(p);
      this.actions.push(action);
    }
  }

  protected addGrammarElement(element: string): GSymbol {
    if (this.symbolsTable[element] === undefined) {
      let el: GSymbol;
      if (this.tokens.has(element)) {
        el = new T(element);
        this.terminals.push(el);
      } else {
        el = new NT(element);
        this.nonTerminals.push(el);
      }
      const index = this.symbols.push(el) - 1;
      this.symbolsTable[element] = index;
    }
    return this.symbols[this.symbolsTable[element]];
  }

  protected computeFirstAndFollow(): void {
    const first: { [name: string]: Set<GSymbol> } = {};
    const nullable: { [name: string]: boolean } = {};
    const follow: { [name: string]: Set<GSymbol> } = {};
    
    for (const t of this.terminals) {
      first[t.toString()] = new Set<GSymbol>([t]);
    }

    let done = false;

    // compute FIRST
    do {
      done = false;
      for (const p of this.productions) {
        const lhs = p.head;
        const rhs = p.body;
        const lhss = lhs.toString();

        first[lhss] = first[lhss] ?? new Set();
        
        if (rhs.length === 0) {
          done = first[lhss].add2(eps) || done;
          nullable[lhss] = true;
        } else {
          let i;
          for (i = 0; i < rhs.length; i++) {
            const e = rhs[i];
            const es = e.toString();
            first[es] = first[es] ?? new Set();
            const fwe = new Set(first[es]);
            fwe.delete(eps);
            done = first[lhss].addSet2(fwe) || done;
            if (!first[es].has(eps)) break;
          }
          
          if (i === rhs.length && first[rhs[i - 1].toString()].has(eps)) {
            done = first[lhss].add2(eps) || done;
          }
        }
      }
    } while (done);

    this.first = first;

    // compute FOLLOW
    const startStr = this.start.toString();
    follow[startStr] = follow[startStr] ?? new Set();
    follow[startStr].add(this.EOF);
    
    do {
      done = false;
      for (const p of this.productions) {
        const rhs = p.body;
        const lhs = p.head;
        const lhss = lhs.toString();
        
        for (let i = 0; i < rhs.length; i++) {
          const rhsis = rhs[i].toString();
          
          if (isNonTerminal(rhs[i])) {
            follow[rhsis] = follow[rhsis] ?? new Set();
            
            if (i < rhs.length - 1) {
              const tail = rhs.slice(i + 1);
              const f = this.computeFirst(tail);
              const epsfound = f.delete(eps);
              done = follow[rhsis].addSet2(f) || done;
              
              if (epsfound) {
                follow[lhss] = follow[lhss] ?? new Set();
                done = follow[rhsis].addSet2(follow[lhss]) || done;
              }
            } else {
              follow[lhss] = follow[lhss] ?? new Set();
              done = follow[rhsis].addSet2(follow[lhss]) || done;
            }
          }
        }
      }
    } while (done);

    this.follow = follow;
  }

  protected getProductionsByHead(head: GSymbol): Production[] {
    const result: Production[] = [];
    for (const p of this.productions) {
      if (p.head.equals(head)) {
        result.push(p);
      }
    }
    return result;
  }

  protected computeFirst(list: GSymbol[]): Set<GSymbol> {
    return computeFirst(list, this.first);
  }

  protected closure(items: GItem[]): GItem[] {
    return closure(items, (head) => this.getProductionsByHead(head));
  }

  protected gotoLR0(i: GItem[], x: GSymbol): GItem[] {
    const j: GItem[] = [];
    
    for (const item of i) {
      if (!item.isAtEnd() && item.symbolAhead().equals(x)) {
        j.push(item.nextItem());
      }
    }
    
    return this.closure(j);
  }

  protected determineS1(): void {
    let s1Name = '__GLOBAL';
    while (
      this.nonTerminals.some(x => x.name === s1Name) ||
      this.tokens.has(s1Name)
    ) {
      s1Name = getIncrementName(s1Name);
    }
    this.S1 = new NT(s1Name);
  }

  protected tryAddAction(
    act: AutomatonActionRecord[],
    gItem: GItem,
    lookahead: GSymbol,
    newAction: AutomatonActionRecord
  ): void {
    const an = this.symbolsTable[lookahead.toString()] ?? 0;

    if (act[an] === undefined) {
      act[an] = newAction;
    } else {
      act[an] = this.resolveConflict(
        act[an],
        newAction,
        lookahead,
        gItem,
        this.actionTrack.get(act[an])
      );
    }
    this.actionTrack.set(act[an], gItem);
  }

  protected resolveConflict(
    currentAction: AutomatonActionRecord,
    newAction: AutomatonActionRecord,
    a: GSymbol,
    gItem: GItem,
    conflict?: GItem
  ): AutomatonActionRecord {
    let shiftAction: AutomatonActionRecord;
    let reduceAction: AutomatonActionRecord;
    const curType = currentAction[0];
    
    if (curType === 'reduce') {
      reduceAction = currentAction;

      if (newAction[0] === 'reduce') {
        // Check if both reduce actions are identical
        const current = currentAction[1];
        const newAct = newAction[1];
        if (
          current[0] !== newAct[0] ||
          current[1] !== newAct[1] ||
          current[2] !== newAct[2]
        ) {
          throw new ParserError(
            getConflictText('Reduce/Reduce', a, gItem, conflict),
            [gItem, conflict]
          );
        }
        return currentAction;
      } else {
        shiftAction = newAction;
      }
    } else {
      shiftAction = currentAction;
      
      if (newAction[0] === 'shift') {
        if (newAction[1][0] !== currentAction[1][0]) {
          throw new ParserError(
            getConflictText('Shift/Shift', a, gItem, conflict),
            [gItem, conflict]
          );
        }
        return currentAction;
      } else {
        reduceAction = newAction;
      }
    }

    const prodIndex = reduceAction[1][2] as number;
    if (prodIndex < 0 || prodIndex >= this.productions.length) {
      throw new ParserError(
        `Invalid production index ${prodIndex} in reduce action`,
        [gItem, conflict]
      );
    }
    
    const prod = this.productions[prodIndex];
    const operators = this.operators;
    
    if (operators && operators.has(a.name)) {
      const aPrior = operators.get(a.name)!.prior;
      const op = this.conflictPolicy.filterer!(prod, operators);

      if (op) {
        const { assoc: redAssoc, prior: redPrior } = op as OperatorDefinition;
        
        if (aPrior === redPrior) {
          if (redAssoc === 'left') return reduceAction;
          if (redAssoc === 'right') return shiftAction;
          
          if (this.conflictPolicy.shiftReduce === 'reduce') return reduceAction;
          if (this.conflictPolicy.shiftReduce === 'shift') return shiftAction;
          
          return ['error', [`Shift/Reduce conflict: Operator ${JSON.stringify(op)} is non-associative.`]];
        } else if (aPrior > redPrior) {
          return shiftAction;
        } else {
          return reduceAction;
        }
      }
    } else {
      if (this.conflictPolicy.shiftReduce === 'reduce') return reduceAction;
      if (this.conflictPolicy.shiftReduce === 'shift') return shiftAction;
    }
    
    throw new ParserError(getConflictText('Shift/Reduce', a, gItem, conflict), [gItem, conflict]);
  }

  getSymbols(): GSymbol[] {
    return this.nonTerminals.concat(this.terminals);
  }

  generateParsedGrammar(): ParsedGrammar {
    return {
      action: this.action,
      goto: this.goto,
      actions: this.actions,
      startState: this.startState,
      symbolsTable: this.symbolsTable,
      actionMode: this.actionMode,
      symbols: this.symbols,
    };
  }
}