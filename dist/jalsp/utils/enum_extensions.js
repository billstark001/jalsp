"use strict";
Array.prototype.equals = function (other, strict) {
    return strict ? arrayEqualsStrict(this, other) : arrayEquals(this, other);
};
Array.prototype.flatMap = function (callbackfn, thisArg) {
    return this.map(callbackfn).reduce((x, y) => x.concat(y), []);
};
Array.prototype.aggregate = function (agg, initial) {
    var acc = initial;
    this.forEach(function (x) {
        acc = agg(acc, x);
    });
    return acc;
};
Array.prototype.repeat = function (times) {
    if (times < 1)
        return [];
    return [].concat(...Array(times).fill(this));
};
Set.prototype.deleteSet = function (other) {
    this.forEach(x => {
        if (other.has(x) && this.has(x))
            this.delete(x);
    });
    return this;
};
Set.prototype.flatMap = function (callbackfn, thisArg) {
    var arrayRet = Array.from(this).map(callbackfn).reduce((x, y) => x.concat(y), []);
    return new Set(arrayRet);
};
Set.prototype.addSet = function (s) {
    s.forEach(x => this.add(x));
    return this;
};
Set.prototype.add2 = function (s) {
    const num = this.size;
    this.add(s);
    return this.size != num;
};
Set.prototype.addSet2 = function (s) {
    const num = this.size;
    this.addSet(s);
    return this.size != num;
};
