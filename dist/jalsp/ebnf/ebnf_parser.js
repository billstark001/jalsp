"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = parseEbnf;
const token_1 = require("../models/token");
const builder_1 = __importDefault(require("../parser/builder"));
const generator_1 = __importDefault(require("../parser/generator"));
const parser_1 = __importDefault(require("../parser/parser"));
var ebnf = new builder_1.default()
    // .bnf('combine = ', (x) => x?.length)
    .bnf('ident = IDENTIFIER | STRING1 | STRING2', (x) => x !== null && x !== void 0 ? x : '[E]')
    .bnf('number = NON_NEG_INTEGER', (x) => x !== null && x !== void 0 ? x : 0)
    .bnf('elem = ident', (x) => x)
    .bnf('group = elem', (x) => [x])
    .bnf('group = elem group', (x, y) => [x].concat(y))
    .bnf('elem = RB_L groups RB_R | SB_L groups SB_R | CB_L groups CB_R', (l, m, r) => {
    var ret = {
        isEbnf: true,
        type: l == '(' ? 'group' : (l == '[' ? 'optional' : 'repeat'),
        productionList: m
    };
    return ret;
})
    .bnf('elem = elem MULT number', (g, s, n) => {
    var _a;
    if (typeof (g) == 'string')
        return {
            isEbnf: true,
            type: 'mult',
            productionList: [[g]],
            mult: n
        };
    else if (g instanceof Array)
        return {
            isEbnf: true,
            type: 'mult',
            productionList: [g],
            mult: n
        };
    else {
        g.mult = (_a = g.mult) !== null && _a !== void 0 ? _a : 1;
        g.mult *= n;
        return g;
    }
})
    .bnf('groups = group | groups OR group', (a, o, b) => {
    if (o)
        return a.concat([b]);
    else
        return [a];
})
    .bnf('prod = ident DEFINITION groups', (i, _, g) => {
    return g.map(h => ({
        name: i,
        expr: h,
    }));
})
    .bnf('prod = ident DEFINITION', (i, _) => [{ name: i, expr: [] }])
    .bnf('prods = ', () => [])
    .bnf('prods = prod', (p) => [p])
    .bnf('prods = prods SEP prod', (ps, _, p) => ps.concat([p]))
    .bnf('prods = prods SEP', (ps, _) => ps)
    .opr('left', 'COMMA')
    .opr('left', 'MULT')
    .opr('left', 'OR')
    // .opr('left', 'DEFINITION')
    .define({
    mode: 'SLR',
    eofToken: 'EOF',
    startSymbol: 'prods'
});
// console.log(ebnf);
// console.log(ebnf.productions);
// console.log(ebnf.operators);
var gen = new generator_1.default(ebnf);
var specs = gen.generateParsedGrammar();
// console.log(specs);
// printActionTable(specs.action);
// console.log(specs.goto);
var parser = new parser_1.default(specs);
function parseEbnf(tokens) {
    var res = parser.parse(new token_1.WrappedTokenArray(tokens
        .filter(x => x.name != 'SPACE'), 'EOF'), {}).flat();
    return res;
}
