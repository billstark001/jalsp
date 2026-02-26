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
const lexer = new LexerBuilder()
  .t('id', /[a-zA-Z_$][0-9a-zA-Z_$]*/)
  .t('int', /-?[0-9]+/, (res) => Number(res))
  .t('+', '+')
  .t('*', '*')
  .t('(', '(')
  .t(')', ')')
  .t(null, /\s+/)  // ignore whitespace
  .build('eof');
```

### Pattern Types: String vs RegExp

The lexer distinguishes between **string patterns** and **regex patterns**, with different matching behaviors:

- **String patterns** (exact match): `'.t('+', '+')`
  - Matches the exact literal string using `String.prototype.startsWith()`
  - Handler receives only: `(lexeme: string, index: number)`
  - Efficient for fixed tokens like operators and punctuation

- **RegExp patterns** (regex match): `.t('id', /[a-zA-Z_$]\w*/)`
  - Matches using regex with sticky flag appended
  - Handler receives: `(lexeme: string, index: number, regexMatch: RegExpExecArray)`
  - Useful for variable-length patterns like identifiers and numbers

Use string patterns for literal tokens (operators, keywords) and regex patterns for variable-length tokens (identifiers, numbers, whitespace).

Token handlers can optionally return `undefined` to discard a token (e.g., `null` as the name with `/\s+/` pattern for whitespace).

------

## Parser

```javascript
const parsedGrammar = new LRGrammarBuilder()
  .bnf('E = E "+" E', (e, _, t) => '(' + e + '+' + t + ')')
  .bnf('E = E "*" E', (e, _, t) => '(' + e + '*' + t + ')')
  .bnf('E = int', i => String(i))
  .bnf('E = id', i => i)
  .bnf('E = "(" E ")"', (_, e, __) => '{' + e + '}')
  .opr(16, 'left', '*')
  .opr('left', '+')
  .build({ mode: 'slr', eofToken: 'eof' });

// Use the parser
const parser = new Parser(parsedGrammar);
const result = parser.parse(lexer);
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
| ---- | ----------- | ------- |
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
| ---- | ----------- | ------- |
| `-e, --export <name>` | Named export of the builder | `default` |
| `--options-export <name>` | Named export of a `JalspEntryOptions` object | auto (`<exportName>Options`) |
| `-o, --output <dir>` | Output directory | `./dist` |
| `--out-name <name>` | Base name for output files | `compiled` |
| `--eof <token>` | EOF token name (parser only, overrides in-file) | `<<EOF>>` |
| `--start <symbol>` | Start symbol (parser only, overrides in-file) | first production head |

The `bundle` command generates:

- `<outName>.js` — minified ES module exporting the compiled lexer/parser instance

------

## Grammar Formats (BNF / EBNF / ABNF)

JALSP supports BNF-like, EBNF-like, and ABNF-like notations, but they are simplified dialects designed to feed the LR parser builder. If you are expecting full standard compliance, read the constraints below first.

### Shared rules

- Non-terminals can be either bare identifiers (`Expr`) or angle-bracketed identifiers (`<expr>`).
- Terminals are quoted strings (`"+"` or `'+'`) and must match lexer token names.
- Alternatives are separated by `|` (BNF/EBNF) or `/` (ABNF tokenization, but see ABNF limitations).

### BNF (simplified)

Typical usage in the builder:

```typescript
builder.bnf('E = E "+" T | T', (e, _, t) => e + t);
```

Constraints and differences:

- Multiple productions in a single string are not reliably supported; call `bnf()` once per rule or parse them separately.
- Empty productions are not meaningful in BNF mode.
- Semicolons are tokenized but are not a reliable multi-rule separator in a single parse call.

### EBNF (JALSP dialect)

Supported constructs:

- Grouping: `( ... )`
- Optional: `[ ... ]` (zero or one)
- Repetition: `{ ... }` (zero or more)
- Multiplicity: `elem * N` where `N` is a non-negative integer

Example:

```ebnf
stmt = id eq num [semi] | id lp list rp;
list = lbracket rbracket | lbracket num {comma num} rbracket;
```

Constraints and differences:

- Multiplicity is postfix only: `A * 2` is supported, `2 * A` is not.
- `?` is tokenized but is not parsed as an operator; use `[ ... ]` instead.
- Empty productions are allowed in EBNF (`S =`), and become epsilon productions when converted to BNF.
- EBNF is expanded to BNF internally; complex constructs may produce auxiliary rules.

### ABNF (partial)

JALSP can tokenize many ABNF tokens (e.g., `%x`, `%d`, `%b`, ranges, prose, and repetition counts), but parsing is intentionally minimal:

- The parser only treats `IDENTIFIER`, `STRING`, `PROSE`, `NUMBER`, and `REPEAT` as literal elements.
- Grouping `( ... )` and optionals `[ ... ]` are tokenized but ignored by the ABNF parser.
- Numeric value ranges and concatenation (e.g., `%x30-39`, `%x0D.0A`) are tokenized but not interpreted.
- `=/` is recognized and tagged as incremental alternatives; you can call `abnf()` multiple times to add rules.

If you need full ABNF semantics, consider pre-processing the grammar into JALSP BNF/EBNF before passing it into the builder.
