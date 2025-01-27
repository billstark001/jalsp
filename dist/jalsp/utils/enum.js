"use strict";
function arrayEquals(arr1, arr2) {
    if (arr1 == arr2)
        return true;
    if (arr1 == undefined || arr2 == undefined)
        return false;
    if (arr1.length != arr2.length)
        return false;
    var flag = true;
    arr1.forEach((v, i) => flag = flag && (v == arr2[i]));
    return flag;
}
function arrayEqualsStrict(arr1, arr2) {
    if (arr1 === arr2)
        return true;
    if (arr1 === undefined || arr2 === undefined)
        return false;
    if (arr1.length !== arr2.length)
        return false;
    var flag = true;
    arr1.forEach((v, i) => flag = flag && (v === arr2[i]));
    return flag;
}
