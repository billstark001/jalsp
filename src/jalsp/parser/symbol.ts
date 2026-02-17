/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DEFAULT_EOF_TOKEN } from "../models/constants";
import { IEquatable } from "../utils/equatable";


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
export const EOFNUM = 0;