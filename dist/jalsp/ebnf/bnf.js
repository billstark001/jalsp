"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSingleQuoteString = handleSingleQuoteString;
exports.lexBnf = lexBnf;
exports.parseBnf = parseBnf;
require("ts-replace-all");
const str_1 = require("../utils/str");
;
const BNF_SET = {
    // bnf
    T_SPACE: /[ \xa0\u3000\r\n\t]+/y,
    T_DEFINITION: /(?:\:\:=|=|\:)/y,
    T_IDENTIFIER: /[a-zA-Z_$][0-9a-zA-Z_$]*/y,
    T_STRING1: /'(?:\\.|[^'\\])*'/y,
    T_STRING2: /"(?:\\.|[^"\\])*"/y,
    T_OR: /\|/y,
    T_SEP: /;/y,
    T_COMMA: /,/y,
};
const EBNF_SET = Object.assign({
    // ebnf
    T_NON_NEG_INTEGER: /[0-9]+/y,
    // export const T_NON_NEG_INTEGER = /(?:0|[1-9][0-9]*)/
    T_MINUS: /\-/y,
    T_MULT: /\*/y,
    T_QUES: /\?/y,
    T_RB_L: /\(/y,
    T_RB_R: /\)/y,
    T_SB_L: /\[/y,
    T_SB_R: /\]/y,
    T_CB_L: /\{/y,
    T_CB_R: /\}/y,
}, BNF_SET);
Object.freeze(BNF_SET);
Object.freeze(EBNF_SET);
const T_RET = /\r?\n/;
function handleSingleQuoteString(strIn) {
    strIn = strIn
        .substring(1, strIn.length - 1)
        .replaceAll('\\\'', '\'')
        .replaceAll('"', '\\"');
    return '"' + strIn + '"';
}
function lexBnf(grammar, ebnf) {
    var dict = ebnf ? EBNF_SET : BNF_SET;
    var pos = 0;
    var ret = [];
    var rec = (0, str_1.getLinePositions)(grammar);
    while (pos < grammar.length) {
        let parsed = false;
        for (const key in dict) {
            dict[key].lastIndex = pos;
            const res = dict[key].exec(grammar);
            if (res !== null) {
                parsed = true;
                var token = {
                    name: key.substring(2),
                    position: pos,
                    pos: (0, str_1.getLCIndex)(rec, pos, true),
                    lexeme: res[0]
                };
                if (key == 'T_STRING1')
                    token.value = JSON.parse(handleSingleQuoteString(token.lexeme));
                else if (key == 'T_STRING2' || key == 'T_NON_NEG_INTEGER')
                    token.value = JSON.parse(token.lexeme);
                else
                    token.value = token.lexeme;
                pos = dict[key].lastIndex;
                ret.push(token);
            }
        }
        if (!parsed) {
            throw new Error(`Unknown token ${JSON.stringify(pos + 6 < grammar.length ?
                grammar.substring(pos, pos + 6) + '...' :
                grammar.substring(pos, grammar.length))} at position ${pos}`);
        }
    }
    return ret;
}
const P_NON_COMMA = /(i)( *= *)((?: *(?:i *)*\|?)*)/y;
const P_COMMA = /(i)( *= *)((?: *(?:i *,? *)*\|?)*)/y;
const P_SPACE = / +/y;
function parseBnf(tokens, commaSeparate, action) {
    var _a, _b;
    // change it to a string so we can use regex
    // discarded the DFA class because of its speed
    const _formatted = [];
    for (var i = 0; i < tokens.length; ++i) {
        const t = tokens[i];
        var c;
        if (t.name == 'SPACE' || t.name == 'SEP')
            c = ' ';
        else if (t.name == 'DEFINITION')
            c = '=';
        else if (t.name == 'IDENTIFIER' || t.name == 'STRING1' || t.name == 'STRING2')
            c = 'i';
        else if (t.name == 'OR')
            c = '|';
        else if (t.name == 'COMMA')
            c = commaSeparate ? ',' : ' ';
        else
            throw new Error(`Non-BNF token ${JSON.stringify(t.name)}(${JSON.stringify(t.lexeme)}) found at position ${t.position}`);
        _formatted.push(c);
    }
    const formatted = _formatted.join('');
    const P_PROD = commaSeparate ? P_COMMA : P_NON_COMMA;
    var pos = 0;
    var ret = [];
    while (pos < formatted.length) {
        P_SPACE.lastIndex = P_PROD.lastIndex = pos;
        var res;
        if ((res = P_SPACE.exec(formatted))) {
            pos = P_SPACE.lastIndex;
        }
        else if ((res = P_PROD.exec(formatted))) {
            const shift = pos + res[1].length + res[2].length;
            const name = (_b = (_a = tokens[pos].value) !== null && _a !== void 0 ? _a : tokens[pos].lexeme) !== null && _b !== void 0 ? _b : '[E]';
            const words = (commaSeparate ?
                parseProductionComma(res[3]) :
                parseProductionNonComma(res[3]))
                .map(x => x.map(y => y.map(z => { var _a, _b; return (_b = (_a = tokens[shift + z].value) !== null && _a !== void 0 ? _a : tokens[shift + z].lexeme) !== null && _b !== void 0 ? _b : '[E]'; }).join(' ')));
            words.forEach(p => ret.push({ name: name, expr: p, action: action }));
            pos = P_PROD.lastIndex;
        }
        else {
            throw new Error(`Non-BNF grammar found at position ${tokens[pos].position} (Token: ${tokens[pos].name}(${JSON.stringify(tokens[pos].lexeme)}))`);
        }
    }
    return ret;
}
function parseProductionNonComma(p) {
    const ret = [];
    var cur = [];
    for (var i = 0; i < p.length; ++i) {
        if (p[i] == 'i')
            cur.push([i]);
        else if (p[i] == '|') {
            ret.push(cur);
            cur = [];
        }
    }
    if (cur) {
        ret.push(cur);
        cur = [];
    }
    return ret;
}
function parseProductionComma(p) {
    const ret = [];
    var cur = [];
    var wrd = [];
    for (var i = 0; i < p.length; ++i) {
        if (p[i] == 'i')
            wrd.push(i);
        else if (p[i] == '|') {
            if (wrd) {
                cur.push(wrd);
                wrd = [];
            }
            ret.push(cur);
            cur = [];
        }
        else if (p[i] == ',') {
            cur.push(wrd);
            wrd = [];
        }
    }
    if (cur) {
        ret.push(cur);
        cur = [];
    }
    return ret;
}
