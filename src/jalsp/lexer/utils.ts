import type { Position } from "./types";


const incRegex = /_([0-9]+)$/;
const returnRegex = /\r?\n/g;


export function getIncrementName(current: string): string {
  const matchRes = incRegex.exec(current);
  if (matchRes) {
    var ind = matchRes.index || current.length - matchRes[0].length;
    var num = matchRes[1];
    return current.substring(0, ind) + '_' + String(Number(num) + 1);
  } else {
    return current + '_0';
  }
}

export function getLinePositions(str: string): number[] {
  returnRegex.lastIndex = 0;
  const ret: number[] = [0];
  var match: RegExpExecArray | null;
  while ((match = returnRegex.exec(str)) != null) {
    ret.push(match.index + match[0].length);
  }
  return ret;
}

export function getLCIndex(str: string, pos: number, lineOneBased?: boolean, columnOneBased?: boolean): Position;
export function getLCIndex(record: number[], pos: number, lineOneBased?: boolean, columnOneBased?: boolean): Position;
export function getLCIndex(record: string | number[], pos: number, lineOneBased?: boolean, columnOneBased?: boolean): Position {
  const ob = lineOneBased ? 1 : 0;
  const obc = columnOneBased ? 1 : 0;
  if (!(record instanceof Array))
    record = getLinePositions(record);
  if (record.length == 0 || pos < record[0])
    return { line: -1 + ob, col: pos - (record[0] === undefined ? pos : record[0]) + obc };
  if (pos >= record[record.length - 1])
    return { line: record.length - 1 + ob, col: pos - record[record.length - 1] + obc };

  // cond: record[i] > pos
  var lb = 0; // the largest index that doesn't satisfy
  var rb = record.length; // the smallest index that satisfies
  var mb: number;
  while (rb - lb > 1) {
    mb = Math.floor((rb + lb) / 2);
    if (record[mb] > pos)
      rb = mb;
    else
      lb = mb;
  }

  return {
    line: lb + ob,
    col: pos - record[lb] + obc
  };
}

