import { Token } from '../lexer/types';
import { BnfElement } from './types';
import { getLCIndex, getLinePositions } from '../lexer/utils';

interface RegexDict {
  [key: string]: RegExp;
}

export function handleSingleQuoteString(str: string): string {
  if (str.length < 2) throw new Error('Invalid single-quoted string');
  const inner = str.slice(1, -1);
  let result = '';
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === '\\' && i + 1 < inner.length) {
      const next = inner[i + 1];
      if (next === "'") {
        result += "'"; // unescape \' → '
      } else {
        result += '\\' + next; // keep all other escape sequences intact
      }
      i += 2;
    } else if (ch === '"') {
      result += '\\"'; // escape bare double-quote
      i++;
    } else {
      result += ch;
      i++;
    }
  }
  return '"' + result + '"';
}

export function createToken(
  key: string,
  pos: number,
  lexeme: string,
  rec: number[]
): Token<BnfElement> {
  const name = key.substring(2);
  const token: Token<BnfElement> = {
    name,
    position: pos,
    pos: getLCIndex(rec, pos, true),
    lexeme,
    value: { type: 'literal', value: '' },
  };

  if (key === 'T_STRING1') {
    token.value.value = JSON.parse(handleSingleQuoteString(lexeme));
  } else if (key === 'T_STRING' || key === 'T_STRING2') {
    token.value.value = JSON.parse(lexeme);
  } else if (key === 'T_NON_NEG_INTEGER' || key === 'T_NUMBER') {
    token.value.type = 'number';
    token.value.value = key === 'T_NUMBER' ? parseInt(lexeme, 16) : Number(lexeme);
  } else if (key === 'T_IDENTIFIER_AB') {
    token.value.type = 'identifier';
    token.value.value = lexeme.slice(1, -1).replace(/>>/g, '>');
  } else {
    token.value.type = 'identifier';
    token.value.value = lexeme;
  }

  return token;
}

export function tokenize(
  grammar: string,
  dict: RegexDict,
  skipKeys: string[] = []
): Token<BnfElement>[] {
  let pos = 0;
  const ret: Token<BnfElement>[] = [];
  const rec = getLinePositions(grammar);

  while (pos < grammar.length) {
    let parsed = false;

    for (const key in dict) {
      dict[key].lastIndex = pos;
      const res = dict[key].exec(grammar);

      if (res !== null) {
        parsed = true;

        if (skipKeys.includes(key)) {
          pos = dict[key].lastIndex;
          break;
        }

        ret.push(createToken(key, pos, res[0], rec));
        pos = dict[key].lastIndex;
        break;
      }
    }

    if (!parsed) {
      const snippet = grammar.substring(pos, Math.min(pos + 6, grammar.length)) +
        (pos + 6 < grammar.length ? '...' : '');
      throw new Error(`Unknown token ${JSON.stringify(snippet)} at position ${pos}`);
    }
  }

  return ret;
}

export function mergeBnfElements(arr: BnfElement[]): BnfElement {
  if (arr.length === 0) throw new Error('Cannot merge empty array');
  if (arr.length === 1) return arr[0];

  const ret = { ...arr[0] };
  const values = arr.map(e => {
    if (e.type !== ret.type) throw new Error(`Cannot merge types: ${e.type} and ${ret.type}`);
    return e.value;
  });

  ret.value = ret.type === 'number' ? Number(values.join('')) :
    ret.type === 'literal' ? values.join('') :
      values.join(' ');

  return ret;
}
