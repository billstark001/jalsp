"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const str_1 = require("../utils/str");
const lexer_1 = __importDefault(require("./lexer"));
class RegExpLexerBuilder {
    constructor(lexicon) {
        var _a, _b, _c, _d, _e;
        this.optionalToken = '';
        var builder = undefined;
        var def = undefined;
        if (lexicon !== undefined) {
            if (lexicon instanceof RegExpLexerBuilder) {
                builder = lexicon;
            }
            else {
                def = lexicon;
            }
        }
        // shallow copy of arrays
        this.actions = Array.from((_b = (_a = builder === null || builder === void 0 ? void 0 : builder.actions) !== null && _a !== void 0 ? _a : def === null || def === void 0 ? void 0 : def.actions) !== null && _b !== void 0 ? _b : [])
            .map(x => (Object.assign({}, x)));
        this.records = Array.from((_d = (_c = builder === null || builder === void 0 ? void 0 : builder.records) !== null && _c !== void 0 ? _c : def === null || def === void 0 ? void 0 : def.records) !== null && _d !== void 0 ? _d : [])
            .map(x => (Object.assign({}, x)));
        this.usedTokens = new Set(this.records.map(x => x.name));
        this.optionalToken = (_e = builder === null || builder === void 0 ? void 0 : builder.optionalToken) !== null && _e !== void 0 ? _e : 'OPTIONAL_TOKEN_0';
    }
    registerAction(h, n) {
        return this.actions.push({ handler: h, nameSelector: n }) - 1;
    }
    /**
     *
     * @param name The token name.
     * @param pattern The matching pattern.
     * - String inputs are treated as an exact match of that string.
     * - RegExp inputs are treated as the expression
     * with global flag moved and sticky flag appended.
     * @param f The handler.
     */
    t(name, pattern, f) {
        // parse name
        var realName;
        var sel = undefined;
        if (typeof (name) == 'string')
            realName = name;
        else {
            while (this.usedTokens.has(this.optionalToken)) {
                this.optionalToken = (0, str_1.getIncrementName)(this.optionalToken);
            }
            realName = this.optionalToken;
            sel = name;
        }
        this.usedTokens.add(realName);
        // register handler
        const handlerIndex = this.registerAction(f, sel);
        const result = {
            name: realName,
            handlerIndex,
            pattern: '',
        };
        // parse pattern
        if (pattern instanceof RegExp) {
            result.pattern = pattern.source;
            let flags = pattern.flags;
            flags = flags.replace('g', '');
            if (flags.indexOf('y') < 0) {
                flags += 'y';
            }
            result.isRegExp = true;
            result.flags = flags;
        }
        else {
            result.pattern = pattern;
            delete result.isRegExp;
            delete result.flags;
        }
        // push back the record
        this.records.push(result);
        // chained calling
        return this;
    }
    define(eof) {
        return {
            actions: this.actions,
            records: this.records,
            eofToken: eof
        };
    }
    build(eof) {
        return new lexer_1.default(this.define(eof));
    }
}
exports.default = RegExpLexerBuilder;
