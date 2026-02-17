/* eslint-disable @typescript-eslint/no-explicit-any */
import { GSymbol, isNonTerminal, isTerminal, eps, Production, GItem, LR1Item } from "./utils-obj";
import { OperatorDefinition, AutomatonActionRecord } from "./types";
import { IEquatable } from "../utils/typing";
import { ProductionHandler, ProductionHandlerModifier } from "../bnf/types";

export const EOF_INDEX = 0;

export const computeFirst = (
  list: GSymbol[],
  first: { [name: string]: Set<GSymbol> }
): Set<GSymbol> => {
  const ret: Set<GSymbol> = new Set();

  for (let i = 0; i < list.length; i++) {
    let epsFound = false;
    const f = first[list[i].toString()];

    for (const e of f) {
      if (e === eps) {
        epsFound = true;
      } else {
        ret.add(e);
      }
    }

    if (!epsFound) break;
  }

  if (list.length > 0 && ret.size === 0) {
    ret.add(eps);
  }

  return ret;
};

export const closure = (
  items: GItem[],
  getProductionsByHead: (head: GSymbol) => Production[]
): GItem[] => {
  const stack = Array.from(items);
  let p = 0;

  while (p < stack.length) {
    const item = stack[p];
    const B = item.symbolAhead();

    if (isNonTerminal(B)) {
      const prods = getProductionsByHead(B);
      for (const prod of prods) {
        const ni = prod.getItems()[0];

        let found = false;
        for (const stackItem of stack) {
          if (ni.equals(stackItem)) {
            found = true;
            break;
          }
        }

        if (!found) {
          stack.push(ni);
        }
      }
    }
    p++;
  }

  return stack;
};

export const closureLR1 = (
  items: LR1Item[],
  getProductionsByHead: (head: GSymbol) => Production[],
  computeFirstFn: (list: GSymbol[]) => Set<GSymbol>
): LR1Item[] => {
  const stack = Array.from(items);
  let p = 0;

  while (p < stack.length) {
    const item = stack[p].item;
    const lookahead = stack[p].lookahead;
    const B = item.symbolAhead();

    if (isNonTerminal(B)) {
      const prods = getProductionsByHead(B);
      for (const prod of prods) {
        const suffix = item.tail();
        suffix.push(lookahead);
        const first: Set<GSymbol> = computeFirstFn(suffix);

        for (const symbol of first) {
          if (isTerminal(symbol)) {
            const ni = new LR1Item(prod.getItems()[0], symbol);

            let found = false;
            for (const stackItem of stack) {
              if (ni.equals(stackItem)) {
                found = true;
                break;
              }
            }

            if (!found) {
              stack.push(ni);
            }
          }
        }
      }
    }
    p++;
  }

  return stack;
};

export const findState = (
  list: IEquatable[][],
  state: IEquatable[],
  lr1ItemSimilar?: boolean
): number => {
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.length !== state.length) continue;

    let equals = true;
    for (const item1 of s) {
      let found = false;

      for (const item2 of state) {
        const isEqual = lr1ItemSimilar
          ? (item2 as LR1Item).item.equals((item1 as LR1Item).item)
          : item2.equals(item1);

        if (isEqual) {
          found = true;
          break;
        }
      }

      if (!found) {
        equals = false;
        break;
      }
    }

    if (equals) return i;
  }

  return -1;
};

export const identityFunc: ProductionHandler = (...args) => args;

export function compileActionRecord(rec: ProductionHandlerModifier, f: (i: number) => ProductionHandler | undefined): ProductionHandler | undefined {

  let nextFunc: ProductionHandler | undefined;
  if (typeof (rec[1]) == 'number')
    nextFunc = f(rec[1]);
  else if (rec[1] instanceof Number)
    nextFunc = f(Number(rec[1]));
  else if (rec[1] === undefined)
    nextFunc = identityFunc;
  else
    nextFunc = compileActionRecord(rec[1], f);

  // nextFunc = (...args) => { console.log(rec[0]); return nextFunc!(...args); }

  const nextFunc2 = nextFunc ?? identityFunc;

  if (rec[0] == 'epsilon') {
    const i = rec[2][0] ?? 0;
    return (...args) => nextFunc2(...(args.slice(0, i).concat([undefined]).concat(args.slice(i))));
  } else if (rec[0] == 'merge') {
    const i = rec[2][0] ?? 0;
    const t = rec[2][1] ?? 0;
    return (...args) => nextFunc2(...(args.slice(0, i).concat([args.slice(i, i + t)]).concat(args.slice(i + t))));
  } else if (rec[0] == 'collect') {
    // const i = rec[2][0] ?? -1;
    return nextFunc === undefined ?
      (...args) => [args, []] :
      (...args) => nextFunc!(args, []);
  } else if (rec[0] == 'append') {
    // const i = rec[2][0] ?? 1;
    // const j = rec[2][1] ?? 1;
    return nextFunc === undefined ?
      (...args) => [args[0][0], args[0][1].concat([args.slice(1)])] :
      (...args) => nextFunc!(args[0][0], args[0][1].concat([args.slice(1)]));
  } else if (rec[0] == 'apply') {
    // const i = rec[2][0] ?? 0;
    return (pre: any[], post: any[]) => nextFunc2(...(pre[0].concat([pre[1]]).concat(post)));
  } else {
    return nextFunc;
  }
}

export const defaultOperatorHandler = (
  prod: Production,
  oprMap: Map<string, OperatorDefinition>
): OperatorDefinition | undefined => {
  for (const t of prod.body) {
    if (oprMap.has(t.name)) {
      return oprMap.get(t.name);
    }
  }
  return undefined;
};

export const getConflictText = (
  type: string,
  sym: GSymbol,
  gItem: GItem,
  conflict?: GItem
): string => {
  const cflStr = conflict
    ? `between ${gItem} and ${conflict}`
    : `in ${gItem}`;
  return `${type} conflict ${cflStr} on ${sym}`;
};

export const printActionTable = (
  action: { [id: number]: AutomatonActionRecord[] }
): string => {
  for (const si in action) {
    const i = Number(si);
    const str: string[] = [si, ': '];

    for (const p in action[i]) {
      const act = action[i][p];
      str.push(p, '->', act[0], act[1][0]?.toString() ?? '', '\t');
    }

    return str.join('');
  }
  return '';
};