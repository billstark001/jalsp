/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { IEquatable } from "../utils/typing";
import { DEFAULT_EOF_TOKEN } from "../lexer/lexer";

export class Production implements IEquatable {

  head: GSymbol;
  body: GSymbol[];
  dot: number;
  items?: GItem[];

  constructor(head: GSymbol, body: GSymbol[]) {
    this.head = head;
    this.body = body;
    this.dot = -1;
  }
  equals(obj: unknown): boolean {
    if (!(obj instanceof Production))
      return false;
    if (this === obj)
      return true;
    if (!this.head.equals(obj.head) || this.body.length != obj.body.length)
      return false;
    for (let i = 0; i < this.body.length; ++i)
      if (!this.body[i].equals(obj.body[i]))
        return false;
    return true;
  }

  toString(dot?: number) {
    const str = [];

    str.push(this.head.toString());
    str.push(' ::= ');
    for (let i = 0; i < this.body.length; i++) {
      if (i === dot) str.push('. ');
      str.push(this.body[i].toString());
      str.push(' ');
    }
    return str.join('').trim();
  }

  getItems() {

    if (this.items === undefined) {
      this.items = Array.from(Array(this.body.length + 1).keys()).map((i) => {
        return new GItem(this, i);
      });
    }
    return this.items!;
  }

}


export class GItem implements IEquatable {

  production: Production;
  dot: number;

  constructor(prod: Production, dot: number) {
    this.production = prod;
    this.dot = dot;
  }



  toString() {
    return this.production.toString(this.dot);
  };

  isAtStart() {
    return this.dot === 0;
  };

  isAtEnd() {
    return this.dot >= this.production.body.length;
  };

  symbolAhead() {
    return this.production.body[this.dot];
  };

  tail() {
    return this.production.body.slice(this.dot + 1, this.production.body.length);
  };

  nextItem() {
    return this.production.getItems()[this.dot + 1];
  };

  equals(other: GItem) {

    return other.production.equals(this.production) && other.dot === this.dot;
  };

}

export class LR1Item implements IEquatable {
  item: GItem;
  lookahead: GSymbol;

  constructor(item: GItem, lookahead: GSymbol) {
    this.item = item;
    this.lookahead = lookahead;
  }

  toString() {
    return '[' + this.item.toString() + ', ' + this.lookahead.toString() + ']';
  }

  equals(other: unknown) {
    if (!(other instanceof LR1Item)) return false;
    return this.item.equals(other.item) && this.lookahead.equals(other.lookahead);
  }

}



export abstract class GSymbol implements /*IMatchable<GSymbol>, */IEquatable {

  name: string;

  constructor(name: string) {
    this.name = name;
  }

  toString() {
    return this.name;
  }

  abstract match(other: GSymbol): boolean;
  abstract matchTerminal(other: T): boolean;
  abstract matchNonTerminal(other: NT): boolean;

  abstract clone(): GSymbol;

  equals(x: GSymbol) {
    if (this instanceof EpsilonSymbol && x instanceof EpsilonSymbol) {
      return true;
    }
    if (this instanceof T && x instanceof T) {
      return this.name === x.name;
    }
    if (this instanceof NT && x instanceof NT) {
      return this.name === x.name;
    }
    return false;
  }

}


export class NT extends GSymbol {

  match(other: GSymbol): boolean {
    return other.matchNonTerminal(this);
  }

  matchTerminal(other: T): boolean {
    return false;
  }

  matchNonTerminal(other: NT): boolean {
    return other.name === this.name;
  }

  clone(): NT {
    return new NT(this.name);
  }

  toString() {
    return '<<' + this.name + '>>';
  }

}

export class T extends GSymbol {

  match(other: GSymbol): boolean {
    return other.matchTerminal(this);
  }

  matchTerminal(other: T): boolean {
    return other.name === this.name;
  }

  matchNonTerminal(other: NT): boolean {
    return false;
  }

  clone(): GSymbol {
    return new T(this.name);
  }

}


export class EpsilonSymbol extends T {

  constructor() {
    super("ε");
  }

  match(other: GSymbol): boolean {
    return this.matchTerminal(other);
  }
  matchTerminal(other: T): boolean {
    return other instanceof EpsilonSymbol;
  }
  matchNonTerminal(other: NT): boolean {
    return false;
  }
  clone(): GSymbol {
    return this;
  }

}

export function isTerminal(e: any) {
  return e instanceof T;
}

export function isNonTerminal(e: any) {
  return e instanceof NT;
}

export const eps = new EpsilonSymbol();
export const eof = new T(DEFAULT_EOF_TOKEN);
export const EOF_NUM = 0;