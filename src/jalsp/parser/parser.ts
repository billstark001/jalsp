import { stringifyToken, Token, TokenStream } from "../models/token";
import { AutomatonActionRecord, BnfElement, ProductionHandler } from "../models/grammar";
import { GSymbol } from "./symbol";
import { ParsedGrammar } from "./generator";
import { ParserError } from "../models/error";

export interface ParserStackItem {
  s: number,
  i?: Token<BnfElement>
}


function identity(...x: any[]) {
  return x;
}

export default class Parser<T> {

  // defs
  action: { [id: number]: AutomatonActionRecord[] } = {};
  goto: { [id: number]: number[] } = {};
  actionMode: string;
  actions: (ProductionHandler | undefined)[];
  startState: number = 0;
  symbols: GSymbol[];
  symbolsTable: { [name: string]: number };

  // runtime

  stream?: TokenStream<BnfElement>;
  a?: Token<BnfElement>;
  an?: number;
  accepted: boolean = false;
  inError: boolean = false;
  context?: T = undefined;

  stack?: ParserStackItem[];

  constructor(specs: ParsedGrammar) {
    this.action = specs.action;
    this.goto = specs.goto;
    this.actions = specs.actions;
    this.startState = specs.startState;
    //This is needed to translate from lexer names to parser numbers
    this.symbolsTable = specs.symbolsTable;
    this.actionMode = specs.actionMode;
    this.symbols = specs.symbols;
  }

  executeAction(rec?: AutomatonActionRecord): boolean {
    if (rec === undefined)
      return false;
    if (rec[0] == 'error')
      this.error(rec[1].join(', '));
    else if (rec[0] == 'shift')
      this.shift(rec[1][0] as number);
    else if (rec[0] == 'accept')
      this.accept();
    else if (rec[0] == 'reduce')
      this.reduce(
        rec[1][0] as number,
        rec[1][1] as number,
        rec[1][2] as number
      );
    else
      return false;

    return true;
  }

  /*
  create(ctor, args) {
    var args = [this.context].concat(args);
    var factory = ctor.bind.apply(ctor, args);
    return new factory();
  }
  */

  /**
   * Note: this only actually needs:
   * symbolsTable
   * action
   * actions
   * startState
   * @param stream 
   * @param context 
   * @returns 
   */
  parse(stream: TokenStream<BnfElement>, context?: T) {
    this.stack = [];
    this.context = context;

    this.stream = stream;
    this.a = this.stream.nextToken();
    this.stack.push({ s: this.startState });
    this.accepted = false;
    this.inError = false;

    var top: ParserStackItem | undefined = undefined;

    while (!this.accepted && !this.inError) {
      top = this.stack[this.stack.length - 1];
      var s = top.s;
      //this.a = this.currentToken;
      if (stream.isEOF(this.a))
        this.an = 0;
      else
        this.an = this.symbolsTable[this.a.name];
      var action = this.action[s][this.an];

      if (this.executeAction(action)) {
        // do nothing
      } else {
        this.inError = true;
        if (action !== undefined)
          this.error(`Unexpected action ${action[0]}(${action[1].map(x => JSON.stringify(x)).join(', ')}).`);
        else // `Undefined action found. (stack top: ${JSON.stringify(top)} a: ${JSON.stringify(this.a)} an: ${this.an})`
          this.error(this.a);
      }
    }
    return top?.i?.value;
  }

  shift(state: number) {
    this.stack!.push({ s: state, i: this.a });
    this.a = this.stream!.nextToken();
  }

  reduce(head: number, length: number, prodIndex: number) {
    if (this.stack === undefined) {
      this.error("Symbol stack is not yet initialized.");
      return;
    }

    var rhs = this.stack.splice(-length, length);
    var t = this.stack[this.stack.length - 1];
    var ns = this.goto[t.s][head];
    var value;
    if (this.actions) {
      var action = this.actions[prodIndex] ?? identity;
      var values = rhs.map(function (si) {
        return si.i?.value;
      });

      value = action.apply(this.context, values);

    }
    //If we are debugging

    if (this.symbols) {
      var nt = { name: this.symbols[head].name, value: value };
      this.stack.push({ s: ns, i: nt });
    }
    else {
      this.stack.push({ s: ns, i: { name: '', value: value } });
    }

  }

  accept() {
    this.accepted = true;
  }

  error(token: Token<BnfElement> | string) {

    if (typeof token === 'string') {
      throw new ParserError(token);
    }
    else if (this.stream === undefined) {
      throw new ParserError("No token stream is assigned as the parser's input.");
    }
    else if (this.stream.isEOF(token)) {
      var { line, col } = this.stream.currentFilePosition();
      throw new ParserError(`Unexpected EOF at (${line}:${col})`);
    } else {
      var stop = this.stack == undefined ? undefined : this.stack[this.stack.length - 1].s;
      throw new ParserError(`Unexpected token ${stringifyToken(token)} (Stack state: ${stop})`);
    }

  }
}