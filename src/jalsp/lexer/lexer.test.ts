import * as J from '../../index';

var weirdLex = J.newLexer()
  .t(() => undefined, / +/)
  .t((v, l) => 'T' + l, /[\+\-\*\/]/)
  .build('EOF');

describe('Lexing regular languages', () => {
  it ('Discards tokens where an undefined is returned in the first function', () => {
    expect(weirdLex.reset('      ').nextToken().name).toBe('EOF');
  });

  it ('Determines tokens\' name according to the passed function', () => {
    expect(weirdLex.reset('+').nextToken().name).toBe('T+');
  })
});