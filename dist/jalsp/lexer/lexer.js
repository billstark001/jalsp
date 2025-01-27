"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionOptions = void 0;
const error_1 = require("../models/error");
const str_1 = require("../utils/str");
const ID = (arr) => {
};
var PositionOptions;
(function (PositionOptions) {
    PositionOptions[PositionOptions["Begin"] = 0] = "Begin";
    PositionOptions[PositionOptions["End"] = 1] = "End";
    PositionOptions[PositionOptions["Current"] = 2] = "Current";
})(PositionOptions || (exports.PositionOptions = PositionOptions = {}));
class Lexer {
    constructor({ actions, records, eofToken }) {
        var _a;
        this.records = [];
        this.str = undefined;
        this.pos = 0;
        this.eof = eofToken !== null && eofToken !== void 0 ? eofToken : '<<EOF>>';
        for (const rec of records) {
            const { name, pattern, isRegExp, flags, handlerIndex } = rec;
            // assume the flags are clean
            // compile the regexp if necessary
            const pat = isRegExp
                ? new RegExp(pattern, flags || 'y')
                : pattern;
            this.records.push({
                name,
                pat,
                f: (_a = actions[handlerIndex].handler) !== null && _a !== void 0 ? _a : ID,
                n: actions[handlerIndex].nameSelector
            });
        }
    }
    reset(str) {
        this.str = str !== null && str !== void 0 ? str : this.str;
        if (this.str != undefined)
            this.rec = (0, str_1.getLinePositions)(this.str);
        this.pos = 0;
        return this;
    }
    seek(pos, from) {
        var _a, _b;
        from = from !== null && from !== void 0 ? from : PositionOptions.Begin;
        if (from == PositionOptions.Current)
            pos += this.pos;
        else if (from == PositionOptions.End)
            pos += (_b = (_a = this.str) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        this.pos = pos;
        return this;
    }
    nextToken(advance = true) {
        var _a, _b;
        if (this.str == undefined)
            throw new error_1.LexerError("No input string assigned.");
        this.rec = (_a = this.rec) !== null && _a !== void 0 ? _a : (0, str_1.getLinePositions)(this.str);
        const origPos = this.pos;
        if (origPos < 0 || origPos > this.str.length)
            throw new error_1.LexerError(`Invalid pointer position: ${origPos}.`);
        else if (origPos >= this.str.length) {
            // EOF reached
            return {
                name: this.eof,
                value: this.eof,
                lexeme: this.eof,
                position: origPos,
                pos: this.currentFilePosition()
            };
        }
        else {
            // match each record
            for (const { name, pat, f, n } of this.records) {
                let lexeme = undefined;
                let arr = undefined;
                let lexemeIndex = -1;
                let advanced = false;
                // check if lexeme matches
                if (pat instanceof RegExp) {
                    pat.lastIndex = origPos;
                    const res = pat.exec(this.str);
                    if (res != null) {
                        lexeme = res[0];
                        lexemeIndex = res.index;
                        arr = res;
                        if (advance) {
                            this.pos = pat.lastIndex;
                            advanced = true;
                        }
                    }
                }
                else {
                    if (this.str.startsWith(pat, origPos)) {
                        lexeme = pat;
                        lexemeIndex = origPos;
                        if (advance) {
                            this.pos = origPos + pat.length;
                            advanced = true;
                        }
                    }
                }
                // if the token is 0-length
                if (advanced && this.pos == origPos) {
                    var p = this.currentFilePosition();
                    throw new error_1.LexerError(`Zero-length token at position ${this.pos}/(${p.line}:${p.col})`);
                }
                if (lexeme != null) {
                    const value = (_b = f(lexeme, lexemeIndex, arr)) !== null && _b !== void 0 ? _b : lexeme;
                    // determine name
                    var realName = name;
                    if (n !== undefined) {
                        var _realName = n(value, lexeme);
                        if (_realName === undefined) // discard the token
                            return this.nextToken();
                        else
                            realName = _realName;
                    }
                    // form token
                    var ret = {
                        name: realName,
                        lexeme,
                        value,
                        position: lexemeIndex,
                        pos: (0, str_1.getLCIndex)(this.rec, lexemeIndex, true)
                    };
                    return ret;
                }
            }
            // no match
            // origPos should equate this.pos
            var p = this.currentFilePosition();
            throw new error_1.LexerError(`Unknown token ${JSON.stringify(origPos + 10 < this.str.length ?
                this.str.substring(origPos, origPos + 10) + '...' :
                this.str.substring(origPos))} at position ${origPos}/(${p.line}:${p.col})`);
        }
    }
    isEOF(t) {
        return t.name == this.eof;
    }
    currentPosition() {
        return this.pos;
    }
    currentFilePosition() {
        if (this.str == undefined)
            return { line: 0, col: -1 };
        if (this.rec == undefined)
            this.rec = (0, str_1.getLinePositions)(this.str);
        return (0, str_1.getLCIndex)(this.rec, this.pos, true);
    }
}
exports.default = Lexer;
