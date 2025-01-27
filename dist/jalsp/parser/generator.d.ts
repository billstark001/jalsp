import { IEquatable } from "../utils/equatable";
import { AutomatonActionRecord, ConflictPolicy, GrammarDefinition, OperatorDefinition, ProductionHandler, SimpleProduction } from "../models/grammar";
import { GItem, LR1Item, Production } from "./instrument";
import { GSymbol, NT, T } from "./symbol";
import '../utils/enum_extensions';
export interface ParsedGrammar {
    action: {
        [id: number]: AutomatonActionRecord[];
    };
    goto: {
        [id: number]: number[];
    };
    actionMode: string;
    actions: (ProductionHandler | undefined)[];
    startState: number;
    symbols: GSymbol[];
    symbolsTable: {
        [name: string]: number;
    };
}
export declare function printActionTable(action: {
    [id: number]: AutomatonActionRecord[];
}): void;
export default class LRGenerator {
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
    symbolsTable: {
        [name: string]: number;
    };
    first: {
        [name: string]: Set<GSymbol>;
    };
    follow: {
        [name: string]: Set<GSymbol>;
    };
    EOF: GSymbol;
    S1: GSymbol;
    startItem: GItem[] | LR1Item[];
    startProduction?: Production;
    action: {
        [id: number]: AutomatonActionRecord[];
    };
    actionTrack: Map<AutomatonActionRecord, GItem>;
    goto: {
        [id: number]: number[];
    };
    statesTable: GItem[][] | LR1Item[][];
    startState: number;
    conflictPolicy: ConflictPolicy;
    constructor(grammar: GrammarDefinition);
    computeAuto(): void;
    determineS1(): void;
    /**
     * here we split productions and actions, create internal productions and validate them
     * @param unparsed a list consists of simple BNF productions
     */
    processProductions(unparsed: SimpleProduction[], actionTable: (i: number) => ProductionHandler | undefined): void;
    addGrammarElement(element: string): GSymbol;
    computeFirstAndFollow(): void;
    getProdutionsByHead(head: GSymbol): Production[];
    computeFirst(list: GSymbol[]): Set<GSymbol>;
    closure(items: GItem[]): GItem[];
    closureLR1(items: LR1Item[]): LR1Item[];
    gotoLR0(i: GItem[], x: GSymbol): GItem[];
    gotoLR1(i: LR1Item[], x: GSymbol): LR1Item[];
    computeSLR(): void;
    computeLR1(lalr1?: boolean): void;
    findState(list: IEquatable[][], state: IEquatable[], lr1ItemSimilar?: boolean): number;
    mergeStates(j: number, state: LR1Item[], other: LR1Item[]): void;
    tryAddAction(act: AutomatonActionRecord[], gItem: GItem, lookahead: GSymbol, newAction: AutomatonActionRecord): void;
    getSymbols(): GSymbol[];
    getConflictText(type: string, sym: GSymbol, gItem: GItem, conflict?: GItem): string;
    resolveConflict(currentAction: AutomatonActionRecord, newAction: AutomatonActionRecord, a: GSymbol, gItem: GItem, conflict?: GItem): AutomatonActionRecord;
    generateParsedGrammar(): ParsedGrammar;
}
