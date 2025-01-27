"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
const str_1 = require("./jalsp/utils/str");
const J = __importStar(require("./index"));
const testGrammar = `
expr = 
  expr (
      ADD | ADD_EQ | MINUS | MINUS_EQ | POW | POW_EQ
    | MULT | MULT_EQ | TDIV | TDIV_EQ | DIV | DIV_EQ | MOD | MOD_EQ
    | EQ | NEQ | LT | LT_EQ | GT | GT_EQ 
    | ANDL | ANDB | ORL | ORB | XORL | XORB
    | ASSGN | DEFAULT
    | FUNC_CALL | FUNC_CALL_REV | PROP_ACCESS
  ) expr
`;
var rec = (0, str_1.getLinePositions)(testGrammar);
var tokens = (0, _1.lexBnf)(testGrammar, true);
var res = (0, _1.parseEbnf)(tokens);
// console.log(tokens);
console.log(res);
var res2 = (0, _1.convertToBnf)(res, 1);
res2.forEach(x => console.log(x));
console.log(res2.length);
var singleCharLexer = J.newLexer()
    .t((v, l) => l, /./)
    .build('EOF');
var testParser = J.newParser()
    .ebnf('G = { A ";" }', (a) => a.map((x) => x[0]))
    .ebnf('A = B H { C | D | E } [ F ]', (b, h, cde, f) => {
    console.log(b, h, cde, f);
    return b + h + (cde === null || cde === void 0 ? void 0 : cde.join('')) + (f !== null && f !== void 0 ? f : '');
})
    .build({ mode: 'SLR', eofToken: 'EOF', startSymbol: 'G' });
// console.log(JSON.stringify(res));
console.log(testParser.parse(singleCharLexer.reset('BHCCCCCCCCCCCF;BHDDDD;')));
var ebnf = (0, _1.parseEbnf)((0, _1.lexBnf)('E = A (B) * 2 [C] {D} * 3 | F', true));
var bnf = (0, _1.convertToBnf)(ebnf);
console.log(bnf);
var p = J.newParser()
    .ebnf('conv = talker | conv texts')
    .ebnf('texts = TEXT | texts TEXT', (t, ts) => ([t].concat(ts)).join(''));
p.define({ mode: 'SLR' }).productions.forEach(x => console.log(x));
p.build({ mode: 'SLR' });
