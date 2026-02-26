import { arrayEquals, arrayEqualsStrict } from "./object";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

type NestedArray<T> = Array<T | NestedArray<T>>;

declare global {
  interface Array<T> {
    flat<T>(this: NestedArray<T>, depth?: number): T[];
    flat<T>(depth?: number): any[];
    flatMap<T, V>(callbackfn: (value: T, index: number, array: T[]) => V[], thisArg?: any): Array<V>
    aggregate<T, V>(this: Array<T>, agg: (acc: V, x: T) => V, initial: V): V;
    repeat<T>(this: Array<T>, times: number): Array<T>;
    equals<T>(this: Array<T>, other?: Array<T>, strict?: boolean): boolean;
  }

  interface Set<T> {
    flatMap<T, V>(callbackfn: (value: T, index: number, array: T[]) => V[], thisArg?: any): Set<V>
    addSet<T>(s: Set<T>): Set<T>;
    deleteSet<T>(other: Set<T>): Set<T>;
    add2<T>(s: T): boolean;
    addSet2<T>(s: Set<T>): boolean;
  }
}

if (!Array.prototype.flat) {
  Array.prototype.flat = function <T>(this: Array<T>, depth: number = 1): any[] {
    if (depth < 1) {
      return this.slice();
    }

    return this.reduce((acc: any[], val: any) => {
      return acc.concat(Array.isArray(val) ? val.flat(depth - 1) : val);
    }, []);
  }
}

if (!Array.prototype.flatMap) {
  Array.prototype.flatMap = function <T, V>(
    callbackfn: (value: T, index: number, array: T[]) => V[],
    thisArg?: any): Array<V> {
    return this.map(callbackfn).reduce<V[]>((x, y) => x.concat(y), []);
  }
}

Array.prototype.equals = function <T>(this: Array<T>, other?: Array<T>, strict?: boolean) {
  return strict ? arrayEqualsStrict(this, other) : arrayEquals(this, other);
}

Array.prototype.aggregate = function <T, V>(this: Array<T>, agg: (acc: V, x: T) => V, initial: V) {
  let acc = initial;
  for (let i = 0; i < this.length; ++i) {
    acc = agg(acc, this[i]);
  }
  return acc;
}

Array.prototype.repeat = function <T>(this: Array<T>, times: number) {
  if (times < 1)
    return [];
  return [].concat(...Array(times).fill(this));
}


Set.prototype.deleteSet = function <T>(this: Set<T>, other: Set<T>) {
  for (const x of other) {
    if (this.has(x))
      this.delete(x);
  }
  return this;
}

Set.prototype.flatMap = function <T, V>(
  this: Set<T>,
  callbackfn: (value: T, index: number, array: T[]) => V[],
  thisArg?: any): Set<V> {
  const arrayRet = Array.from(this).map(callbackfn).reduce<V[]>((x, y) => x.concat(y), []);
  return new Set(arrayRet);
}

Set.prototype.addSet = function <T>(this: Set<T>, s: Set<T>) {
  for (const x of s) {
    this.add(x);
  }
  return this;
}

Set.prototype.add2 = function <T>(this: Set<T>, s: T) {
  const num = this.size;
  this.add(s);
  return this.size != num;
}

Set.prototype.addSet2 = function <T>(this: Set<T>, s: Set<T>) {
  const num = this.size;
  this.addSet(s);
  return this.size != num;
}