import { IEquatable } from "../utils/equatable";
import { GSymbol } from "./symbol";

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
    for (var i = 0; i < this.body.length; ++i)
      if (!this.body[i].equals(obj.body[i]))
        return false;
    return true;
  }

  toString(dot?: number) {
    var str = [];

    str.push(this.head.toString());
    str.push(' ::= ');
    for (var i = 0; i < this.body.length; i++) {
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
/*
export class LRRuleBook extends NDRuleBook<GSymbol> {

  constructor(rules: Rule<GSymbol>[]) {
    super(rules);
  }

  getSymbols(): GSymbol[] {
    var symbols: GSymbol[] = [];
    this.rules
      .filter(function (rule) {
        return ((rule.input !== eps)  && !(rule.input.negate));
      })
      .map(function (rule) {
        return rule.input as unknown as GSymbol;
      })
      .forEach(function (i) {
        if (!symbols.filter(s => s.match(i))) {
          symbols.push(i);
        }
      });

    return symbols;
  }

}
*/