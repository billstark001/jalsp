export function arrayEquals<T>(arr1?: T[], arr2?: T[]) {
  if (arr1 == arr2)
    return true;
  if (arr1 == undefined || arr2 == undefined)
    return false;
  if (arr1.length != arr2.length)
    return false;
  let flag = true;
  for (let i = 0; i < arr1.length; ++i) {
    flag = flag && (arr1[i] == arr2[i]);
  }
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
  for (let i = 0; i < arr1.length; ++i) {
    flag = flag && (arr1[i] === arr2[i]);
  }
  return flag;
}