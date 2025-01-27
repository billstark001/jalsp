"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printActionTable = printActionTable;
const instrument_1 = require("./instrument");
const symbol_1 = require("./symbol");
require("../utils/enum_extensions");
const str_1 = require("../utils/str");
const error_1 = require("../models/error");
const ebnf_1 = require("../ebnf/ebnf");
const EOF_INDEX = 0;
const defaultOperatorHandler = (prod, oprMap) => {
    var op = prod.body.filter(t => oprMap.has(t.name))[0];
    if (op)
        return oprMap.get(op.name);
    return undefined;
};
function printActionTable(action) {
    var _a;
    var str;
    var i;
    for (var si in action) {
        i = Number(si);
        str = [];
        str.push(si);
        str.push(': ');
        for (var p in action[i]) {
            str.push(p);
            str.push('->');
            str.push(action[i][p][0]);
            str.push((_a = action[i][p][1][0]) === null || _a === void 0 ? void 0 : _a.toString());
            str.push('\t');
        }
        console.log(str.join(''));
    }
}
class LRGenerator {
    constructor(grammar) {
        var _a, _b, _c;
        this.first = {};
        this.follow = {};
        this.S1 = symbol_1.eps;
        this.startItem = [];
        this.startProduction = undefined;
        this.action = {};
        this.actionTrack = new Map();
        this.goto = {};
        this.statesTable = [];
        this.startState = 0;
        const self = this;
        this.tokens = new Set(grammar.tokens);
        this.nonTerminals = [];
        this.terminals = [];
        this.moduleName = grammar.moduleName;
        this.actionMode = grammar.actionMode || 'function';
        this.conflictPolicy = Object.assign({}, grammar.conflictPolicy);
        this.conflictPolicy.filterer = (_a = this.conflictPolicy.filterer) !== null && _a !== void 0 ? _a : defaultOperatorHandler;
        this.symbols = [];
        this.symbolsTable = {};
        // determine eof
        this.EOF = new symbol_1.T((_b = grammar.eofToken) !== null && _b !== void 0 ? _b : '<<EOF>>');
        this.symbols.push(this.EOF);
        this.symbolsTable[this.EOF.toString()] = EOF_INDEX;
        this.terminals.push(this.EOF);
        this.tokens.add(this.EOF.name);
        this.operators = new Map();
        this.productions = [];
        this.actions = [];
        this.processProductions(grammar.productions, (i) => grammar.actions[i]);
        if (grammar.operators !== undefined) {
            grammar.operators.forEach(opList => self.operators.set(opList.name, Object.assign({}, opList)));
        }
        // determine start symbol
        this.start = grammar.startSymbol ?
            this.symbols[this.symbolsTable[grammar.startSymbol]] :
            this.productions[0].head;
        this.computeFirstAndFollow();
        var mode = (_c = grammar.mode) === null || _c === void 0 ? void 0 : _c.toUpperCase();
        if (mode === 'LALR1') {
            this.computeLR1(true);
        }
        else if (mode === 'SLR') {
            this.computeSLR();
        }
        else if (mode === 'LR1') {
            this.computeLR1(false);
        }
        else {
            this.computeAuto();
        }
    }
    computeAuto() {
        try {
            this.computeSLR();
        }
        catch (e) {
            try {
                this.computeLR1(true); // LALR1
            }
            catch (e) {
                this.computeLR1(false); // LR1
            }
        }
    }
    determineS1() {
        var s1Name = '__GLOBAL';
        while (this.nonTerminals.filter(x => x.name == s1Name).length > 0 || this.tokens.has(s1Name))
            s1Name = (0, str_1.getIncrementName)(s1Name);
        this.S1 = new symbol_1.NT(s1Name);
    }
    /**
     * here we split productions and actions, create internal productions and validate them
     * @param unparsed a list consists of simple BNF productions
     */
    processProductions(unparsed, actionTable) {
        const self = this;
        const selfProductions = this.productions;
        const selfActions = this.actions;
        unparsed.forEach(function (production) {
            var _a, _b;
            const head = (_a = production.name) !== null && _a !== void 0 ? _a : '[E]';
            const body = (_b = production.expr) !== null && _b !== void 0 ? _b : [];
            var action = undefined;
            if (typeof (production.action) == 'number' || production.action instanceof Number)
                action = actionTable(Number(production.action));
            else if (typeof (production.action) == 'undefined')
                action = undefined;
            else
                action = (0, ebnf_1.compileActionRecord)(production.action, actionTable);
            var p = new instrument_1.Production(self.addGrammarElement(head), body.map((element) => self.addGrammarElement(element)));
            selfProductions.push(p);
            selfActions.push(action);
        });
    }
    addGrammarElement(element) {
        if (this.symbolsTable[element] == undefined) {
            var el = undefined;
            if (this.tokens.has(element)) {
                // it's a terminal
                el = new symbol_1.T(element);
                this.terminals.push(el);
            }
            else {
                el = new symbol_1.NT(element);
                this.nonTerminals.push(el);
            }
            var index = this.symbols.push(el) - 1;
            this.symbolsTable[element] = index;
        }
        return this.symbols[this.symbolsTable[element]];
    }
    // Computes FIRST and FOLLOW sets
    computeFirstAndFollow() {
        var _a;
        const self = this;
        var first = {};
        var nullable = {};
        var follow = {};
        self.terminals.forEach(function (t) {
            first[t.toString()] = new Set([t]);
        });
        var done = false;
        // compute FIRST
        do {
            done = false;
            self.productions.forEach(function (p) {
                var _a, _b;
                const lhs = p.head;
                const rhs = p.body;
                const lhss = lhs.toString();
                first[lhss] = (_a = first[lhss]) !== null && _a !== void 0 ? _a : new Set();
                if (rhs.length == 0) {
                    done = first[lhss].add2(symbol_1.eps) || done;
                    nullable[lhss] = true;
                }
                else {
                    var i;
                    for (i = 0; i < rhs.length; i++) {
                        var e = rhs[i];
                        var es = e.toString();
                        first[es] = (_b = first[es]) !== null && _b !== void 0 ? _b : new Set();
                        var fwe = new Set(first[es]);
                        fwe.delete(symbol_1.eps);
                        // add elements
                        done = first[lhss].addSet2(fwe) || done;
                        if (!first[es].has(symbol_1.eps))
                            break;
                    }
                    // let's check if all rhs elements were nullable
                    if ((i === rhs.length) && (first[rhs[i - 1].toString()].has(symbol_1.eps))) {
                        done = first[lhss].add2(symbol_1.eps) || done;
                    }
                }
            });
        } while (done);
        // this is needed for computeFirst
        self.first = first;
        // compute FOLLOW
        const startStr = self.start.toString();
        follow[startStr] = (_a = follow[startStr]) !== null && _a !== void 0 ? _a : new Set();
        follow[startStr].add(self.EOF);
        do {
            done = false;
            self.productions.forEach(function (p) {
                var _a, _b, _c;
                const rhs = p.body;
                const lhs = p.head;
                const lhss = lhs.toString();
                for (var i = 0; i < rhs.length; i++) {
                    const rhsis = rhs[i].toString();
                    if ((0, symbol_1.isNonTerminal)(rhs[i])) {
                        follow[rhsis] = (_a = follow[rhsis]) !== null && _a !== void 0 ? _a : new Set();
                        if (i < rhs.length - 1) {
                            // BUG: here we need to compute first(rhs[i+1]...rhs[n])
                            var tail = rhs.slice(i + 1);
                            // var f = first[rhs[i + 1]].clone();
                            var f = self.computeFirst(tail);
                            var epsfound = f.delete(symbol_1.eps);
                            done = follow[rhsis].addSet2(f) || done;
                            if (epsfound) {
                                follow[lhss] = (_b = follow[lhss]) !== null && _b !== void 0 ? _b : new Set();
                                done = follow[rhsis].addSet2(follow[lhss]) || done;
                            }
                        }
                        else {
                            follow[lhss] = (_c = follow[lhss]) !== null && _c !== void 0 ? _c : new Set();
                            done = follow[rhsis].addSet2(follow[lhss]) || done;
                        }
                    }
                }
            });
        } while (done);
        self.follow = follow;
    }
    getProdutionsByHead(head) {
        return this.productions.filter(function (p) {
            return p.head.equals(head);
        });
    }
    computeFirst(list) {
        var ret = new Set();
        const self = this;
        for (var i = 0; i < list.length; i++) {
            var epsFound = false;
            var f = self.first[list[i].toString()];
            if (!f === undefined) {
                throw new error_1.ParserError(`Unexpected element: ${JSON.stringify(list[i].toString())} at position ${i}`, list[i]);
            }
            f.forEach(function (e) {
                if (e === symbol_1.eps) {
                    epsFound = true;
                }
                else {
                    ret.add(e);
                }
            });
            if (!epsFound)
                break;
        }
        if (i == list.length) {
            ret.add(symbol_1.eps);
        }
        return ret;
    }
    closure(items) {
        const self = this;
        var stack = Array.from(items); // .toArray();
        var p = 0;
        while (p < stack.length) {
            var item = stack[p];
            var B = item.symbolAhead();
            if ((0, symbol_1.isNonTerminal)(B)) {
                self.getProdutionsByHead(B).forEach(function (prod) {
                    var ni = prod.getItems()[0];
                    if (stack.filter((i) => ni.equals(i)).length == 0) {
                        stack.push(ni);
                    }
                });
            }
            p = p + 1;
        }
        return stack;
    }
    closureLR1(items) {
        const self = this;
        var stack = Array.from(items); // .toArray();
        var p = 0;
        while (p < stack.length) {
            var item = stack[p].item;
            var lookahead = stack[p].lookahead;
            var B = item.symbolAhead();
            if ((0, symbol_1.isNonTerminal)(B)) {
                self.getProdutionsByHead(B).forEach(function (prod) {
                    var suffix = item.tail();
                    suffix.push(lookahead);
                    var first = self.computeFirst(suffix);
                    Array.from(first).filter(function (symbol) {
                        return (0, symbol_1.isTerminal)(symbol);
                    })
                        .forEach(function (b) {
                        var ni = new instrument_1.LR1Item(prod.getItems()[0], b);
                        if (stack.filter(function (item) {
                            return ni.equals(item);
                        }).length == 0) {
                            stack.push(ni);
                        }
                    });
                });
            }
            p = p + 1;
        }
        return stack;
    }
    gotoLR0(i, x) {
        var j = [];
        i.forEach(function (item) {
            if (!item.isAtEnd()) {
                if (item.symbolAhead().equals(x)) {
                    j.push(item.nextItem());
                }
            }
        });
        // Nota: potrebbero esserci ripetizioni.
        return this.closure(j);
    }
    gotoLR1(i, x) {
        var j = [];
        i.forEach(function (lr1Item) {
            var gItem = lr1Item.item;
            if (!gItem.isAtEnd()) {
                var a = lr1Item.lookahead;
                if (gItem.symbolAhead().equals(x)) {
                    j.push(new instrument_1.LR1Item(gItem.nextItem(), a));
                }
            }
        });
        // Nota: potrebbero esserci ripetizioni.
        return this.closureLR1(j);
    }
    computeSLR() {
        var _a;
        const self = this;
        self.determineS1();
        const states = [];
        var newAction;
        self.action = {};
        self.goto = {};
        self.startProduction = new instrument_1.Production(self.S1, [self.start]);
        // start at I0 (state 0): closureLR1({[S'::=S,§]}) on stack to process
        self.startItem = self.closure([self.startProduction.getItems()[0]]);
        states.push(self.startItem);
        var i = 0;
        while (i < states.length) {
            // take the Ii state to process at the top of the stack
            var Ii = states[i];
            var act = (self.action[i] = (_a = self.action[i]) !== null && _a !== void 0 ? _a : {});
            Ii.forEach(function (gItem) {
                var _a;
                // for each item
                if (gItem.isAtEnd()) {
                    // if A is not S',  add ACTION(i, a) = reduce (A -> X)
                    var p = gItem.production;
                    var pIndex = self.productions.indexOf(p);
                    if (!p.head.equals(self.S1)) {
                        var follow = self.follow[p.head.toString()];
                        follow.forEach(function (a) {
                            newAction = ['reduce', [self.symbolsTable[gItem.production.head.name], gItem.production.body.length, pIndex]];
                            self.tryAddAction(act, gItem, a, newAction);
                        });
                    }
                    else { // A == S'
                        act[EOF_INDEX] = ['accept', []];
                        self.actionTrack.set(act[EOF_INDEX], gItem);
                    }
                }
                else // not at end
                 {
                    var a = gItem.symbolAhead();
                    // compute Ij = goto(Ii, X)
                    var Ij = self.gotoLR0(Ii, a);
                    // check if IJ is on the stack
                    var j = self.findState(states, Ij);
                    if (j < 0) {
                        // push if Ij is not on the stack
                        j = states.push(Ij) - 1;
                    }
                    else {
                        // console.log("state already found");
                    }
                    // otherwise j = (position of Ij on the stack)
                    var an = self.symbolsTable[a.name];
                    if ((0, symbol_1.isNonTerminal)(a)) {
                        // add to table GOTO(i, X) = j
                        (self.goto[i] = (_a = self.goto[i]) !== null && _a !== void 0 ? _a : {})[an] = j;
                    }
                    else {
                        // add to ACTION(i, X) = shift j
                        newAction = ['shift', [j]];
                        self.tryAddAction(act, gItem, a, newAction);
                    }
                }
            });
            i = i + 1;
        }
        self.statesTable = states;
        self.startState = 0;
    }
    computeLR1(lalr1) {
        var _a;
        const self = this;
        self.determineS1();
        const states = [];
        var newAction;
        self.action = {};
        self.goto = {};
        self.startProduction = new instrument_1.Production(self.S1, [self.start]);
        // start at I0 (state 0): closureLR1({[S'::=S,§]}) on stack to process
        self.startItem = self.closureLR1([new instrument_1.LR1Item(self.startProduction.getItems()[0], self.EOF)]);
        states.push(self.startItem);
        var i = 0;
        while (i < states.length) {
            // take the Ii state to process at the top of the stack
            var Ii = states[i];
            var act = (self.action[i] = (_a = self.action[i]) !== null && _a !== void 0 ? _a : {});
            Ii.forEach(function (lr1Item) {
                var _a;
                // for each LR1item
                var gItem = lr1Item.item;
                var lookahead = lr1Item.lookahead;
                if (gItem.isAtEnd()) {
                    // if A is not S',  add ACTION(i, a) = reduce (A -> X)
                    var p = gItem.production;
                    var pIndex = self.productions.indexOf(p);
                    if (!p.head.equals(self.S1)) {
                        newAction = ['reduce', [self.symbolsTable[gItem.production.head.name], gItem.production.body.length, pIndex]];
                        self.tryAddAction(act, gItem, lookahead, newAction);
                    }
                    else { // A == S'
                        act[EOF_INDEX] = ['accept', []];
                        self.actionTrack.set(act[EOF_INDEX], gItem);
                    }
                }
                else // not at end
                 {
                    var a = gItem.symbolAhead();
                    // compute Ij = goto(Ii, X)
                    var Ij = self.gotoLR1(Ii, a);
                    // check if IJ is on the stack
                    var j = self.findState(states, Ij, lalr1);
                    if (j < 0) {
                        // push if Ij is not on the stack
                        j = states.push(Ij) - 1;
                    }
                    else {
                        if (lalr1) // LR1: do nothing
                            self.mergeStates(j, states[j], Ij);
                    }
                    // otherwise j = (position of Ij on the stack)
                    var an = self.symbolsTable[a.name];
                    if ((0, symbol_1.isNonTerminal)(a)) {
                        // add to table GOTO(i, X) = j
                        (self.goto[i] = (_a = self.goto[i]) !== null && _a !== void 0 ? _a : {})[an] = j;
                    }
                    else {
                        // add to ACTION(i, X) = shift j
                        newAction = ['shift', [j]];
                        self.tryAddAction(act, gItem, a, newAction);
                    }
                }
            });
            i = i + 1;
        }
        self.statesTable = states;
        self.startState = 0;
    }
    findState(list, state, lr1ItemSimilar) {
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (s.length != state.length)
                continue;
            // check if every item in s is also in state
            var equals = true;
            for (var i1 = 0; i1 < s.length; i1++) {
                var item1 = s[i1];
                var found = state.filter(lr1ItemSimilar ?
                    (item2) => item2.item.equals(item1.item) :
                    (item2) => item2.equals(item1)).length > 0;
                if (!found) {
                    equals = false;
                    break;
                }
            }
            if (equals)
                return i;
        }
        // we exited the loop, the state was not found
        return -1;
    }
    mergeStates(j, state, other) {
        const self = this;
        state.forEach(function (lr1Item) {
            var _a;
            if (lr1Item.item.isAtEnd()) {
                const otherLR1item = other.filter((oLR1item) => {
                    return oLR1item.item.equals(lr1Item.item);
                })[0];
                if (otherLR1item == undefined)
                    return;
                // merge the lookahead of otherLR1item into the ones of lr1Item
                const gItem = otherLR1item.item;
                const p = gItem.production;
                const lookahead = otherLR1item.lookahead;
                const pIndex = self.productions.findIndex(x => x.equals(p));
                var act = (self.action[j] = (_a = self.action[j]) !== null && _a !== void 0 ? _a : {});
                if (p.head.equals(self.S1)) { // A == S'
                    act[EOF_INDEX] = ['accept', []];
                    self.actionTrack.set(act[EOF_INDEX], gItem);
                }
                else {
                    var newAction = [
                        'reduce', [
                            self.symbolsTable[gItem.production.head.name],
                            gItem.production.body.length,
                            pIndex
                        ]
                    ];
                    self.tryAddAction(act, gItem, lookahead, newAction);
                }
            }
        });
    }
    tryAddAction(act, gItem, lookahead, newAction) {
        var _a;
        const self = this;
        var an = (_a = self.symbolsTable[lookahead.toString()]) !== null && _a !== void 0 ? _a : 0;
        // console.log(`tryAddAction ${lookahead} ${JSON.stringify(act)} ${an}`);
        if (act[an] === undefined) {
            act[an] = newAction;
        }
        else {
            // check if prod contains an operator and compare it to a
            act[an] = self.resolveConflict(act[an], newAction, lookahead, gItem, self.actionTrack.get(act[an]));
        }
        self.actionTrack.set(act[an], gItem);
    }
    getSymbols() {
        return this.nonTerminals.concat(this.terminals);
    }
    getConflictText(type, sym, gItem, conflict) {
        var cflStr = '';
        if (conflict)
            cflStr = `between ${gItem} and ${conflict}`;
        else
            cflStr = `in ${gItem}`;
        return `${type} conflict ${cflStr} on ${sym}`;
    }
    resolveConflict(currentAction, newAction, a, gItem, conflict) {
        // if current action is reduce we have a prod, otherwise?
        var shiftAction, reduceAction;
        var curType = currentAction[0];
        if (curType == 'reduce') {
            reduceAction = currentAction;
            if (newAction[0] == 'reduce') {
                if (newAction[1][0] != currentAction[1][0] || newAction[1][1] != currentAction[1][1]
                    || newAction[1][2] != currentAction[1][2]) {
                    throw new error_1.ParserError(this.getConflictText('Reduce/Reduce', a, gItem, conflict), [gItem, conflict]);
                }
                else {
                    return currentAction;
                }
            }
            else {
                shiftAction = newAction;
            }
        }
        else { // current is shift
            shiftAction = currentAction;
            if (newAction[0] == 'shift') {
                if (newAction[1][0] != currentAction[1][0]) {
                    throw new error_1.ParserError(this.getConflictText('Shift/Shift', a, gItem, conflict), [gItem, conflict]);
                }
                else {
                    return currentAction;
                }
            }
            else {
                // new Action is Reduce
                reduceAction = newAction;
            }
        }
        const prod = this.productions[reduceAction[1][2]];
        // check if a is an operator
        const operators = this.operators;
        if (operators && operators.has(a.name)) {
            const aPrior = operators.get(a.name).prior;
            // check if prod contains an operator
            const op = this.conflictPolicy.filterer(prod, operators);
            if (op) {
                const { assoc: redAssoc, prior: redPrior } = op;
                // first check if it is the same priority
                if (aPrior == redPrior) {
                    if (redAssoc == 'left')
                        return reduceAction; // prefer reduce
                    else if (redAssoc == 'right')
                        return shiftAction; // prefer shift
                    else { // nonassoc
                        if (this.conflictPolicy.shiftReduce == 'reduce')
                            return reduceAction;
                        else if (this.conflictPolicy.shiftReduce == 'shift')
                            return shiftAction;
                        else // not assigned
                            return ['error', [`Shift/Reduce conflict: Operator ${JSON.stringify(op)} is non-associative.`]];
                    }
                }
                else if (aPrior > redPrior) {
                    return shiftAction;
                }
                else { // aPrior < redPrior
                    return reduceAction;
                }
            }
        }
        else {
            if (this.conflictPolicy.shiftReduce == 'reduce')
                return reduceAction;
            else if (this.conflictPolicy.shiftReduce == 'shift')
                return shiftAction;
        }
        // a is not an operator
        throw new error_1.ParserError(this.getConflictText('Shift/Reduce', a, gItem, conflict), [gItem, conflict]);
    }
    generateParsedGrammar() {
        const specs = this;
        return {
            action: specs.action,
            goto: specs.goto,
            actions: specs.actions,
            startState: specs.startState,
            symbolsTable: specs.symbolsTable,
            actionMode: specs.actionMode,
            symbols: specs.symbols,
        };
    }
}
exports.default = LRGenerator;
