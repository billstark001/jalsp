import { Token } from '../lexer/types';
import { BnfElement, SimpleProduction } from './types';
import { BNF_SET, P_NON_COMMA, P_COMMA, P_SPACE } from './syntax';
import { tokenize, mergeBnfElements } from './utils';

export function lexBnf(grammar: string): Token<BnfElement>[] {
  return tokenize(grammar, BNF_SET);
}

function formatTokens(tokens: Token<BnfElement>[], commaSeparate: boolean): string {
  return tokens.map(t => {
    if (t.name === 'SPACE' || t.name === 'SEP') return ' ';
    if (t.name === 'DEFINITION') return '=';
    if (t.name.startsWith('IDENTIFIER')) return 'i';
    if (t.name.startsWith('STRING')) return 's';
    if (t.name === 'OR') return '|';
    if (t.name === 'COMMA') return commaSeparate ? ',' : ' ';
    throw new Error(`Non-BNF token ${t.name}(${JSON.stringify(t.lexeme)}) at ${t.position}`);
  }).join('');
}

function parseProduction(p: string, commaSeparate: boolean): number[][][] {
  const ret: number[][][] = [];
  let cur: number[][] = [];
  let wrd: number[] = [];

  for (let i = 0; i < p.length; i++) {
    if (p[i] === 'i' || p[i] === 's') {
      if (commaSeparate) {
        wrd.push(i);
      } else {
        cur.push([i]);
      }
    } else if (p[i] === '|') {
      if (commaSeparate && wrd.length) { cur.push(wrd); wrd = []; }
      if (cur.length) { ret.push(cur); cur = []; }
    } else if (p[i] === ',' && commaSeparate && wrd.length) {
      cur.push(wrd);
      wrd = [];
    }
  }

  if (commaSeparate && wrd.length) cur.push(wrd);
  if (cur.length) ret.push(cur);

  return ret;
}

export function parseBnf(
  tokens: Token<BnfElement>[],
  commaSeparate = false,
  action?: number
): SimpleProduction[] {
  const formatted = formatTokens(tokens, commaSeparate);
  const P_PROD = commaSeparate ? P_COMMA : P_NON_COMMA;
  let pos = 0;
  const ret: SimpleProduction[] = [];

  while (pos < formatted.length) {
    P_SPACE.lastIndex = P_PROD.lastIndex = pos;
    let res: RegExpExecArray | null;

    if ((res = P_SPACE.exec(formatted))) {
      pos = P_SPACE.lastIndex;
    } else if ((res = P_PROD.exec(formatted))) {
      const shift = pos + res[1].length + res[2].length;
      const { type, value } = tokens[pos].value;
      const name = type === 'identifier' ? value as string : `[${type}:${value}]`;

      const alternatives = parseProduction(res[3], commaSeparate).map(alt =>
        alt.map(term => mergeBnfElements(term.map(idx => tokens[shift + idx].value)))
      );

      for (const expr of alternatives) {
        ret.push({ name, expr, action });
      }
      pos = P_PROD.lastIndex;
    } else {
      throw new Error(
        `Non-BNF grammar at ${tokens[pos].position} (${tokens[pos].name})`
      );
    }
  }

  return ret;
}