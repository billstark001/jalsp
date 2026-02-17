
// EBNF elements

import { EbnfElement, SimpleProduction, ComplexProduction, BnfElement, ComplexExpression } from "../bnf/types";
import { getIncrementName } from "../lexer/utils";
import '../utils/array-extension';


// conversion

// special cases of types
function convertSingle(prod: ComplexProduction, getName: (init: string) => string) {

  const cache: ComplexProduction[] = [prod];

  const ret: SimpleProduction[] = [];
  while (cache.length > 0) {
    const current = cache.pop()!;
    let handled = false;
    for (let i = 0; i < current.expr.length; ++i) {
      if (current.expr[i].isEbnf) {
        handled = true;
        const curElem = current.expr[i] as EbnfElement;
        const preExpr = current.expr.slice(0, i);
        const postExpr = current.expr.slice(i + 1);

        const newExprs: ComplexProduction[] = cache;

        if (curElem.type === 'optional') {
          newExprs.push({
            name: current.name,
            expr: preExpr.concat(postExpr),
            action:
              curElem.mult === undefined ?
                ['epsilon', current.action, [i]] :
                ['merge', current.action, [i, 0]]
          });

          const mult = curElem.mult ?? 1;
          if (mult < 1)
            continue;
          else
            for (let t = 1; t <= mult; ++t)
              curElem.productionList.forEach(
                pl => newExprs.push({
                  name: current.name,
                  expr: preExpr.concat(pl.repeat(t)).concat(postExpr),
                  action:
                    curElem.mult === undefined ?
                      current.action :
                      ['merge', current.action, [i, t]] // pos i, t times
                })
              );

        } else if (curElem.type === 'repeat') {
          // doesn't care mult
          const dashed = getName(current.name + '_RPT_PRE_0');
          newExprs.push({
            name: dashed,
            expr: preExpr,
            action: ['collect', undefined, [-1]],
          });
          curElem.productionList.forEach(
            pl => newExprs.push({
              name: dashed,
              expr: [{ type: 'identifier', value: dashed } as BnfElement | EbnfElement].concat(pl),
              action: ['append', undefined, [1, 1]]
            })
          );
          newExprs.push({
            name: current.name,
            expr: [{ type: 'identifier', value: dashed } as BnfElement | EbnfElement].concat(postExpr),
            action: ['apply', current.action, [0]]
          });
        } else if (curElem.type === 'mult') {
          let mult = curElem.mult ?? 0;
          if (mult < 0)
            mult = 0;
          curElem.productionList.forEach(
            pl => newExprs.push({
              name: current.name,
              expr: preExpr.concat(Array(mult).fill(pl).flat()).concat(postExpr),
              action: ['merge', current.action, [i, mult]]
            })
          );
        } else if (curElem.type === 'group') {
          const mult = curElem.mult ?? 1;
          // const withMult = curElem.mult != undefined;
          if (mult < 1)
            newExprs.push({
              name: current.name,
              expr: preExpr.concat(postExpr),
              action: ['collect', current.action, [i, 0]]
            });
          else {
            let arr = [preExpr];
            for (let i = 0; i < mult; ++i) {
              const _arr = arr
                .map(x => curElem.productionList.map(y => x.concat(y)));
              const __arr: ComplexExpression[] = [];
              _arr.forEach(x => x.forEach(xx => __arr.push(xx)));
              arr = __arr;
            }
            for (const prod2 of arr)
              newExprs.push({
                name: current.name,
                expr: prod2.concat(postExpr),
                action: ['merge', current.action, [i, mult]]
              });
          }
        } else {
          throw Error(`Unhandled EBNF operation: ${JSON.stringify(curElem.type)}`);
        }
        break;
      }
    }

    if (handled) {
      // do nothing...
    } else {
      ret.push(current as SimpleProduction);
    }
  }
  return ret;
}

// general
export function convertToBnf(unparsed: ComplexProduction[], actionOverride?: number) {
  const nonTerminals: Set<string> = new Set();
  const terminals: Set<string> = new Set();

  // first add all names
  // in order to solve name conflict
  const nameStack: EbnfElement[] = [];
  for (const prod of unparsed) {
    nonTerminals.add(prod.name);
  }
  for (const prod of unparsed) {
    for (const token of prod.expr) {
      if (token.isEbnf)
        nameStack.push(token as EbnfElement);
      else if (!nonTerminals.has(String(token)))
        terminals.add(String(token));
    }
  }
  while (nameStack.length > 0) {
    const curElem = nameStack.pop()!;
    for (const expr of curElem.productionList) {
      for (const token of expr) {
        if (token.isEbnf)
          nameStack.push(token as EbnfElement);
        else if (!nonTerminals.has(String(token)))
          terminals.add(String(token));
      }
    }
  }
  // convert in order
  const converted: SimpleProduction[] = [];
  const convertedCache: Set<string> = new Set();

  const getName = (name: string) => {
    while (nonTerminals.has(name) || terminals.has(name))
      name = getIncrementName(name);
    nonTerminals.add(name);
    return name;
  };

  for (let i = 0; i < unparsed.length; ++i) {
    const current: ComplexProduction = {
      name: unparsed[i].name,
      expr: unparsed[i].expr,
      action: actionOverride ?? unparsed[i]?.action ?? i
    }
    const parsed = convertSingle(current, getName);
    for (const bnf of parsed) {
      const sign = JSON.stringify([bnf.name, bnf.expr]);
      if (!convertedCache.has(sign)) {
        convertedCache.add(sign);
        converted.push(bnf);
      }
    }
  }

  return converted;
}
