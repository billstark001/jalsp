export function arrayEquals<T>(arr1?: T[], arr2?: T[]) {
  if (arr1 == arr2)
    return true;
  if (arr1 == undefined || arr2 == undefined)
    return false;
  if (arr1.length != arr2.length)
    return false;
  let flag = true;
  arr1.forEach((v, i) => flag = flag && (v == arr2[i]));
  return flag;
}

export function arrayEqualsStrict<T>(arr1?: T[], arr2?: T[]) {
  if (arr1 === arr2)
    return true;
  if (arr1 === undefined || arr2 === undefined)
    return false;
  if (arr1.length !== arr2.length)
    return false;
  let flag = true;
  arr1.forEach((v, i) => flag = flag && (v === arr2[i]));
  return flag;
}