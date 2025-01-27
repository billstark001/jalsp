import { IEquatable } from "../utils/equatable";
export declare abstract class GSymbol implements /*IMatchable<GSymbol>, */ IEquatable {
    name: string;
    constructor(name: string);
    toString(): string;
    abstract match(other: GSymbol): boolean;
    abstract matchTerminal(other: T): boolean;
    abstract matchNonTerminal(other: NT): boolean;
    abstract clone(): GSymbol;
    equals(x: GSymbol): boolean;
}
export declare class NT extends GSymbol {
    match(other: GSymbol): boolean;
    matchTerminal(other: T): boolean;
    matchNonTerminal(other: NT): boolean;
    clone(): NT;
    toString(): string;
}
export declare class T extends GSymbol {
    match(other: GSymbol): boolean;
    matchTerminal(other: T): boolean;
    matchNonTerminal(other: NT): boolean;
    clone(): GSymbol;
}
export declare class EpsilonSymbol extends T {
    constructor();
    match(other: GSymbol): boolean;
    matchTerminal(other: T): boolean;
    matchNonTerminal(other: NT): boolean;
    clone(): GSymbol;
}
export declare function isTerminal(e: any): e is T;
export declare function isNonTerminal(e: any): e is NT;
export declare const eps: EpsilonSymbol;
export declare const eof: T;
export declare const EOFNUM = 0;
