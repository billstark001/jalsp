import { Token, TokenStream } from "../lexer/types";
import { ProductionHandler } from "./types";
import { AutomatonActionRecord } from "./types";
import { GSymbol } from "./utils-obj";
import { ParsedGrammar } from "./generator";
import { ParserError } from "./error";
import { getTokenString } from "../lexer/utils";

export interface ParserStackItem<T> {
  s: number,
  i: Token<T>
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function identity(...x: any[]) {
  return x;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Parser<TToken, TContext = any, TResult = TToken> {

  // defs
  action: { [id: number]: AutomatonActionRecord[] } = {};
  goto: { [id: number]: number[] } = {};
  actionMode: string;
  actions: (ProductionHandler<TToken, TResult> | undefined)[];
  startState: number = 0;
  symbols: GSymbol[];
  symbolsTable: { [name: string]: number };

  // runtime

  stream?: TokenStream<TToken>;
  a?: Token<TToken>;
  an?: number;
  accepted: boolean = false;
  inError: boolean = false;
  context?: TContext = undefined;

  stack?: ParserStackItem<TToken | TResult>[];

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
  parse(stream: TokenStream<TToken>, context?: TContext): TResult {
    this.stack = [];
    this.context = context;

    this.stream = stream;
    this.a = this.stream.nextToken();
    this.stack.push({ s: this.startState, i: this.a });
    this.accepted = false;
    this.inError = false;

    let top: ParserStackItem<TToken | TResult>;

    while (!this.accepted && !this.inError) {
      top = this.stack[this.stack.length - 1];
      const s = top.s;
      //this.a = this.currentToken;
      if (stream.isEOF(this.a))
        this.an = 0;
      else
        this.an = this.symbolsTable[this.a.name];
      const action = this.action[s][this.an];

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
    return top!.i.value as TResult;
  }

  shift(state: number) {
    this.stack!.push({ s: state, i: this.a! });
    this.a = this.stream!.nextToken();
  }

  reduce(head: number, length: number, prodIndex: number) {
    if (this.stack === undefined) {
      this.error("Symbol stack is not yet initialized.");
      return;
    }

    const rhs = this.stack.splice(-length, length);
    const t = this.stack[this.stack.length - 1];
    const ns = this.goto[t.s][head];

    const action = this.actions[prodIndex] ?? (identity as ProductionHandler<TToken, TResult>);
    const values = rhs.map(si => si.i!.value);

    const value = action.apply(this.context, values);
    const nt: Token<TToken | TResult> = {
      name: this.symbols?.[head].name ?? '',
      value,
      lexeme: ''
    };
    this.stack.push({ s: ns, i: nt });

  }

  accept() {
    this.accepted = true;
  }

  error(token: Token<TToken> | string) {

    if (typeof token === 'string') {
      throw new ParserError(token);
    }
    else if (this.stream === undefined) {
      throw new ParserError("No token stream is assigned as the parser's input.");
    }
    else if (this.stream.isEOF(token)) {
      const { line, col } = this.stream.currentFilePosition();
      throw new ParserError(`Unexpected EOF at (${line}:${col})`);
    } else {
      const stop = this.stack == undefined ? undefined : this.stack[this.stack.length - 1].s;
      throw new ParserError(`Unexpected token ${getTokenString(token)} (Stack state: ${stop})`);
    }

  }
}