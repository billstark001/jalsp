# JALSP

Possible acronym for: **J**ust **A**nother **L**exical and **S**yntactic **P**arser (in JavaScript) or **Ja**vaScript **L**exical and **S**yntactic **P**arser.

JALSP is a (partial) refactoring of [JACOB](https://github.com/Canna71/Jacob), a Bison-like JS Compiler generator. It provides native Regex-based lexer and JACOB-identical parser implementations with usage inspired by [PLY](https://www.dabeaz.com/ply/). This can be used for example to create a DSL (domain specific language) to be used in a JavaScript runtime.

Generating a language parser involves two steps: 
 1. Aggregating the input characters into a series of *tokens*. This is done by the module *lexer*.
 2. Interpreting the series of tokens as a *language*, according to a set of *grammar* or *syntax*. This is done by the module *parser*.


Given appropriate instructions, Jalsp will generate both the lexer and the parser. We'll see how to specify the actual behaviors of your parser.

------

## Lexer

```javascript
var lexer = new RegExpLexerBuilder()
  .t('id', /[a-zA-Z_$][0-9a-zA-Z_$]*/)
  .t('int', /-?[0-9]+/, (res) => Number(res[0]))
  .t('+', /\+/)
  .t('*', /\*/)
  .t('(', /\(/)
  .t(')', /\)/)
  .build('eof');
```

TBD

------

## Parser

```javascript
var parser = new LRGrammarBuilder()
  .bnf('E = E "+" E', (e, _, t) => '(' + e + '+' + t + ')')
  .bnf('E = E "*" E', (e, _, t) => '(' + e + '*' + t + ')')
  .bnf('E = int', i => String(i))
  .bnf('E = id', i => i)
  .bnf('E = "("E")"', (_, e, __) => '{' + e + '}')

  .opr(16, 'left', '*')
  .opr('left', '+')

  .build({ mode: 'slr', eofToken: 'eof' });
```

TBD

------

## BNF and EBNF

Tha actual grammar is specified in Extended Backus–Naur Form, with every rule followed by an action consisting in a javascript function.

The EBNF in the example defines rules using Non-Terminal symbols (`Program`, `Statement`, `Expression`, ...) and terminal symbols (`(`, `)`, `integer`, `*`,...). Terminal symbols are contained in single quotes and should match the name of the tokens as yielded by the lexer.

Each production can have several alternatives (separated by the pipe symbol) and each alternative can have its own action function. The action function will receive a parameter for each element of the corresponding right-hand-side part of the production.

Each rule is then terminated with a semicolon (`;`).

EBNF is more handier than BNF because it also adds shortcuts to define repetitions, optionals and grouping:

`{ ... }` means 0 or more (...)

`[ ... ]` means 0 or 1 (...)

`( ... )` will group the content into one group. This is useful to inline some rules that don't need a special action for themselves, for example:
```
Assignment = Identifier ':=' ( 'integer' | Identifier | 'string' );
```