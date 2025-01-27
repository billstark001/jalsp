interface Array<T> {
    flatMap<T, V>(callbackfn: (value: T, index: number, array: T[]) => V[], thisArg?: any): Array<V>;
    aggregate<T, V>(this: Array<T>, agg: (acc: V, x: T) => V, initial: V): V;
    repeat<T>(this: Array<T>, times: number): Array<T>;
    equals<T>(this: Array<T>, other?: Array<T>, strict?: boolean): boolean;
}
interface Set<T> {
    flatMap<T, V>(callbackfn: (value: T, index: number, array: T[]) => V[], thisArg?: any): Set<V>;
    addSet<T>(s: Set<T>): Set<T>;
    deleteSet<T>(other: Set<T>): Set<T>;
    add2<T>(s: T): boolean;
    addSet2<T>(s: Set<T>): boolean;
}
