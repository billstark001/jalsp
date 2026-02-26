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

## Serialization & Deserialization

Both `Lexer` and `Parser` support serialization to JSON and reconstruction from JSON.

### Lexer Serialization

```typescript
import { LexerBuilder, Lexer } from 'jalsp';

const lexer = new LexerBuilder()
  .t('NUM', /[0-9]+/, (s) => parseInt(s))
  .t('PLUS', '+')
  .t(null, /\s+/)
  .build();

// Serialize to JSON string
const json = lexer.toJSON();

// Reconstruct from JSON
const restored = Lexer.fromJSON(json);
restored.reset('1 + 2');
```

### Parser Serialization

```typescript
import { LRGrammarBuilder, Parser } from 'jalsp';

const parsedGrammar = new LRGrammarBuilder()
  .bnf('E = E "+" T', (e, _, t) => e + t)
  .bnf('E = T')
  .bnf('T = NUM', Number)
  .opr('left', '+')
  .build({ eofToken: 'EOF' });

const parser = new Parser(parsedGrammar);

// Serialize to JSON string
const json = parser.toJSON();

// Reconstruct from JSON
const restored = Parser.fromJSON(json);
```

### `serialize` / `deserialize` methods

The lower-level `serialize()` / `Lexer.deserialize()` / `Parser.deserialize()` methods work with plain objects (`SerializedLexer` / `SerializedParser`) for use-cases where you manage JSON encoding yourself.

------

## Module Code Generation

Generate a self-contained ES module that can be used as a rollup/bundler entry point:

```typescript
import { LexerBuilder, LRGrammarBuilder, Parser, generateLexerModule, generateParserModule } from 'jalsp';

// Generate lexer module
const lexer = new LexerBuilder()
  .t('NUM', /[0-9]+/)
  .t('PLUS', '+')
  .build();

const lexerModuleCode = generateLexerModule(lexer);
// -> "import { Lexer } from 'jalsp';\nconst _lexerData = ...;\nexport const lexer = Lexer.deserialize(...);"

// Generate parser module
const parsedGrammar = new LRGrammarBuilder()
  .bnf('E = E "+" T | T')
  .bnf('T = NUM')
  .build();
const parser = new Parser(parsedGrammar);

const parserModuleCode = generateParserModule(parser);

// Options
const code = generateLexerModule(lexer, {
  importFrom: 'jalsp',    // which package to import from (default: 'jalsp')
  exportName: 'myLexer',  // export variable name (default: 'lexer')
  exportData: false,      // also export raw serialized data (default: false)
});
```

------

## `jalsp-cli`

The `jalsp-cli` package provides a command-line tool to compile and bundle lexers/parsers.

### Installation

```bash
pnpm add -D jalsp-cli
# or globally:
pnpm add -g jalsp-cli
```

### Entry File Format

Create an ESM JavaScript or TypeScript file that exports a `LexerBuilder` or `LRGrammarBuilder`:

```typescript
// my-lexer.ts
import { LexerBuilder } from 'jalsp';

const builder = new LexerBuilder()
  .t('NUM', /[0-9]+/, (s) => parseInt(s))
  .t('PLUS', '+')
  .t(null, /\s+/);

export default builder;
```

```typescript
// my-parser.ts
import { LRGrammarBuilder } from 'jalsp';

const builder = new LRGrammarBuilder()
  .bnf('E = E "+" T | T', (e, _, t) => e + t)
  .bnf('T = NUM', Number)
  .opr('left', '+');

export default builder;
```

### In-file Options

You can export a `JalspEntryOptions` object from the entry file to set build options without passing them on the command line.  The CLI resolves options in this priority order (highest first):

1. **CLI flags** (`--eof`, `--start`, etc.) — always override everything
2. **`--options-export <name>`** — load a named export from the file
3. **Conventional name** — `<exportName>Options` (e.g. `defaultOptions` for `--export default`, or `myBuilderOptions` for `--export myBuilder`)

```typescript
// my-parser.ts
import { LRGrammarBuilder } from 'jalsp';
import type { JalspEntryOptions } from 'jalsp-cli';

const builder = new LRGrammarBuilder()
  .bnf('Program = stmtList')
  // ...
  .opr('left', 'PLUS', 'MINUS');

export default builder;

// Conventional name (picked up automatically when --export default)
export const defaultOptions: JalspEntryOptions = {
  eof: 'EOF',
  start: 'Program',
  exportName: 'myParser',   // name used in generated module code
  importFrom: 'jalsp',      // package to import from in generated code
};
```

You may also use a custom export name and reference it with `--options-export`:

```bash
jalsp-cli serialize parser my-parser.ts --options-export myParserOptions
```

### `serialize` command — Output JSON

Compile a builder to its serialized JSON representation:

```bash
# Serialize a lexer (reads default export)
jalsp-cli serialize lexer my-lexer.ts -o lexer.json

# Serialize a parser (named export, custom EOF token via CLI flag)
jalsp-cli serialize parser my-parser.ts --export myParser --eof EOF -o parser.json

# Use in-file options (defaultOptions.eof / defaultOptions.start are picked up automatically)
jalsp-cli serialize parser my-parser.ts

# Print to stdout
jalsp-cli serialize lexer my-lexer.ts
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --export <name>` | Named export of the builder | `default` |
| `--options-export <name>` | Named export of a `JalspEntryOptions` object | auto (`<exportName>Options`) |
| `-o, --output <file>` | Output file path | stdout |
| `--eof <token>` | EOF token name (parser only, overrides in-file) | `<<EOF>>` |
| `--start <symbol>` | Start symbol (parser only, overrides in-file) | first production head |

### `bundle` command — Output bundled JS

Compile a builder and bundle everything (including jalsp runtime + handlers) into a single minified JS file:

```bash
# Bundle a lexer
jalsp-cli bundle lexer my-lexer.ts -o dist/ --out-name my-lexer

# Bundle a parser using in-file options
jalsp-cli bundle parser my-parser.ts -o dist/ --out-name my-parser

# Override EOF token via CLI flag
jalsp-cli bundle parser my-parser.ts -o dist/ --eof EOF
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --export <name>` | Named export of the builder | `default` |
| `--options-export <name>` | Named export of a `JalspEntryOptions` object | auto (`<exportName>Options`) |
| `-o, --output <dir>` | Output directory | `./dist` |
| `--out-name <name>` | Base name for output files | `compiled` |
| `--eof <token>` | EOF token name (parser only, overrides in-file) | `<<EOF>>` |
| `--start <symbol>` | Start symbol (parser only, overrides in-file) | first production head |

The `bundle` command generates:
- `<outName>.js` — minified ES module exporting the compiled lexer/parser instance

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
