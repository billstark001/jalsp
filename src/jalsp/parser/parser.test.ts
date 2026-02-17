import LRGrammarBuilder from './builder';
import RegExpLexerBuilder from '../lexer/builder';
import { eof } from './symbol';
import { newParser } from '../..';


var lexerAmb = new RegExpLexerBuilder()
  .t('id', /[a-zA-Z_$][0-9a-zA-Z_$]*/)
  .t('int', /[0-9]+/, (res) => Number(res[0]))
  .t((v, l) => l, /[\+\-\*\/\%\(\)\[\]\,\.]/)
  .t(() => undefined, /[ \xa0\u3000]+/)
  .build('eof');


var builderAmb = newParser()
  .ebnf('E = E ( ("+" | "-") | ("*" | "/" | "%") ) E', (e, o, t) => {
    return '(' + e + o[0][0] + t + ')'
  })
  .ebnf('ARR_LITERAL = E { "," E } [","]', (e: string, arr: string[][], __) => {
    // console.log(arr);
    return arr === undefined ?
      [e] :
      [e].concat(arr.map(x => x[1]));
  })
  .bnf('E = "[" ARR_LITERAL "]"', (_, arr, __) => {
    return '[' + arr.join(',') + ']';
  })
  .bnf('E = int', i => String(i))
  .bnf('E = id', i => i)
  .bnf('E = "("E")"', (_, e, __) => '{' + e + '}')

  .opr(32, 'left', '.')
  .opr('left', '(', ')')
  .opr('left', '[', ']')
  .opr('left', '*', '/', '%')
  .opr('left', '+', '-')
  .opr('left', ',')
  ;

var parserAmb = builderAmb.build({ mode: 'SLR', eofToken: 'eof' });

describe('Parsing SLR, LALR(1) and LR(1) grammar', () => {
  it('parses Ambiguous grammar', function () {
    var ret = parserAmb.parse(lexerAmb.reset('2+3*4-5'));
    expect(ret).toBe('((2+(3*4))-5)');
  });

  it('parses Ambiguous EBNF grammar', function () {
    var ret = parserAmb.parse(lexerAmb.reset('[1, 2, 3, 4, ]'));
    expect(ret).toBe('[1,2,3,4]');
  });
});

