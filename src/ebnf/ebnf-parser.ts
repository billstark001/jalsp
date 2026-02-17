import { EbnfElement, ComplexProduction, BnfElement, ComplexExpression } from "../bnf/types";
import { Position, Token, TokenStream } from "../lexer/types";
import { LRGrammarBuilder } from "../lr/builder";
import { LRGenerator } from "../lr/generator";
import { Parser } from "../lr/parser";
import { DEFAULT_EOF_TOKEN } from "../lexer/lexer";

const ebnf = new LRGrammarBuilder()

  // .bnf('combine = ', (x) => x?.length)

  .bnf('ident = IDENTIFIER | STRING1 | STRING2', (x) => x ?? '[E]')
  .bnf('number = NON_NEG_INTEGER', (x: BnfElement) => {
    if (x && typeof x === 'object' && 'value' in x) {
      return Number(x.value) ?? 0;
    }
    return x ?? 0;
  })
  .bnf('elem = ident', (x) => x)
  .bnf('group = elem', (x) => [x])
  .bnf('group = elem group', (x, y) => [x].concat(y))
  .bnf('elem = RB_L groups RB_R | SB_L groups SB_R | CB_L groups CB_R', (l, m) => {
    // Extract the actual bracket value from BnfElement
    const leftBracket = (l && typeof l === 'object' && 'value' in l) ? l.value : l;
    const ret: EbnfElement = {
      isEbnf: true,
      type: leftBracket == '(' ? 'group' : (leftBracket == '[' ? 'optional' : 'repeat'),
      productionList: m
    };
    return ret;
  })
  .bnf('elem = elem MULT number', (g: BnfElement | EbnfElement | ComplexExpression, s, n): EbnfElement => {
    if (g instanceof Array) {
      return {
        isEbnf: true,
        type: 'mult',
        productionList: [g],
        mult: n,
      }
    }
    if (g.isEbnf) {
      g.mult = g.mult ?? 1;
      g.mult *= n;
      return g;
    }
    // else: g is BNF
    return {
      isEbnf: true,
      type: 'mult',
      productionList: [[g]],
      mult: n,
    }
  })
  .bnf('groups = group | groups OR group', (a, o, b): ComplexExpression[] => {
    if (o)
      return a.concat([b]);
    else
      return [a];
  })
  .bnf('prod = ident DEFINITION groups', (i, _, g: ComplexExpression[]): ComplexProduction[] => {
    // Extract the actual string name from the BnfElement
    let name: string;
    if (i && typeof i === 'object' && 'value' in i) {
      name = i.value as string;
    } else {
      name = i || '[E]';
    }
    return g.map<ComplexProduction>(h => ({
      name: name,
      expr: h,
    }));
  })
  .bnf('prod = ident DEFINITION', (i, _): Array<ComplexProduction> => {
    // Extract the actual string name from the BnfElement
    let name: string;
    if (i && typeof i === 'object' && 'value' in i) {
      name = i.value as string;
    } else {
      name = i || '[E]';
    }
    return [{ name: name, expr: [] }];
  })

  .bnf('prods = ', () => [])
  .bnf('prods = prod', (p) => p)
  .bnf('prods = prods SEP prod', (ps, _, p) => ps.concat(p))
  .bnf('prods = prods SEP', (ps, _) => ps)


  .opr('left', 'COMMA')
  .opr('left', 'MULT')
  .opr('left', 'OR')
  // .opr('left', 'DEFINITION')

  .define({
    mode: 'slr',
    eofToken: 'EOF',
    startSymbol: 'prods'
  });

const gen = new LRGenerator(ebnf);
const specs = gen.generateParsedGrammar();

const parser = new Parser<BnfElement | EbnfElement, unknown, ComplexProduction[]>(specs);


const EOF: <T>(name: string, value: T) => Token<T> = (name, value) => ({
  name,
  lexeme: name,
  value,
  position: -1,
  pos: { line: -1, col: -1 }
});

export class WrappedTokenArray<T> implements TokenStream<T> {

  private tokens: Token<T>[];
  private pos: number;
  private eof: Token<T>;

  constructor(tokens: Token<T>[], eof?: string, eofValue?: T) {
    this.tokens = tokens;
    this.pos = 0;
    this.eof = EOF<T>(eof || DEFAULT_EOF_TOKEN, eofValue ?? (eof || DEFAULT_EOF_TOKEN) as unknown as T);
  }
  nextToken(): Token<T> {
    if (this.pos >= this.tokens.length)
      return this.eof;
    return this.tokens[this.pos++];
  }
  isEOF(t: Token<T>): boolean {
    return t.name == this.eof.name;
  }
  currentPosition(): number {
    return this.tokens[this.pos]?.position ?? -1;
  }
  currentFilePosition(): Position {
    return this.tokens[this.pos]?.pos ?? this.eof.pos!;
  }

  reset() {
    this.pos = 0;
  }

}

export function parseEbnf(tokens: Token<BnfElement | EbnfElement>[]): ComplexProduction[] {
  const wrapped = new WrappedTokenArray(
    tokens
      .filter(x => x.name != 'SPACE'), 'EOF'
  );
  const res = parser!.parse(wrapped, {});
  if (res === undefined) {
    throw new Error('Failed to parse EBNF grammar');
  } 
  // TODO
  return res;
}