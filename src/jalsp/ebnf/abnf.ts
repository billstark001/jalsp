import { Token } from '../lexer/types';
import { BnfElement, SimpleProduction } from './types';
import { ABNF_SET } from './syntax';
import { tokenize } from './utils';

function getPosString(token: Token<BnfElement>): string {
  const { pos, position } = token;
  if (pos) {
    return `${pos.line}:${pos.col}`;
  }
  return position != null ? `:${position}` : '<unknown>';
}

export function lexAbnf(grammar: string): Token<BnfElement>[] {
  return tokenize(grammar, ABNF_SET, ['T_COMMENT']);
}

export function parseAbnf(tokens: Token<BnfElement>[]): SimpleProduction[] {
  const ret: SimpleProduction[] = [];
  let i = 0;

  const skip = () => {
    while (i < tokens.length &&
      (tokens[i].name === 'SPACE' || tokens[i].name === 'NEWLINE')) i++;
  };

  const parseRule = (): SimpleProduction | null => {
    skip();
    if (i >= tokens.length) return null;

    if (tokens[i].name !== 'IDENTIFIER') {
      throw new Error(`Expected rule name at ${getPosString(tokens[i])}, got ${tokens[i].name}`);
    }

    const name = tokens[i++].value.value as string;
    skip();

    if (i >= tokens.length || tokens[i].name !== 'DEFINITION') {
      throw new Error(`Expected '=' at ${getPosString(tokens[i - 1])}`);
    }

    const isIncremental = tokens[i++].lexeme === '=/';
    skip();

    const alternatives: BnfElement[][] = [];
    let current: BnfElement[] = [];

    while (i < tokens.length) {
      const t = tokens[i];

      if (t.name === 'NEWLINE') {
        if (current.length) alternatives.push(current);
        i++;
        break;
      } else if (t.name === 'SPACE') {
        i++;
      } else if (t.name === 'OR') {
        if (current.length) { alternatives.push(current); current = []; }
        i++;
        skip();
      } else if (['IDENTIFIER', 'STRING', 'PROSE', 'NUMBER', 'REPEAT'].includes(t.name)) {
        current.push(t.value);
        i++;
      } else {
        i++;
      }
    }

    if (current.length) alternatives.push(current);
    if (!alternatives.length) throw new Error(`Empty production for '${name}'`);

    const action = isIncremental ? 1 : undefined;
    for (const expr of alternatives) {
      ret.push({ name, expr, action });
    }
    return null;
  };

  while (i < tokens.length) {
    parseRule();
  }

  return ret;
}