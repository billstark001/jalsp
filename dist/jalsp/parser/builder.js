"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bnf_1 = require("../ebnf/bnf");
const ebnf_1 = require("../ebnf/ebnf");
const error_1 = require("../models/error");
const generator_1 = __importDefault(require("./generator"));
const parser_1 = __importDefault(require("./parser"));
class LRGrammarBuilder {
    constructor(grammar) {
        var _a, _b, _c, _d;
        var builder = undefined;
        var def = undefined;
        if (grammar !== undefined) {
            if (grammar instanceof LRGrammarBuilder) {
                builder = grammar;
            }
            else {
                def = grammar;
            }
        }
        this.productions = Array.from((_b = (_a = builder === null || builder === void 0 ? void 0 : builder.productions) !== null && _a !== void 0 ? _a : def === null || def === void 0 ? void 0 : def.productions) !== null && _b !== void 0 ? _b : [])
            .map(x => ({ name: x.name, expr: x.expr, action: x.action }));
        this.operators = Array.from((_d = (_c = builder === null || builder === void 0 ? void 0 : builder.operators) !== null && _c !== void 0 ? _c : def === null || def === void 0 ? void 0 : def.operators) !== null && _d !== void 0 ? _d : [])
            .map(x => Object.assign({}, x));
        this.prodCache = new Map();
        this.productions.forEach((x, i) => this.prodCache.set(JSON.stringify([x.name, x.expr]), i));
        this.oprCache = new Map();
        this.operators.forEach((x, i) => this.oprCache.set(x.name, i));
        this.lowestHierarchy = 65536;
        this.actions = [];
        this.parseEbnf = undefined;
    }
    act(handler) {
        if (handler == undefined)
            return undefined;
        const index = this.actions.length;
        this.actions.push(handler);
        return index;
    }
    bnfInner(prods, handlerIndex) {
        for (var p of prods) {
            const sign = JSON.stringify([p.name, p.expr]);
            const handlerInUse = handlerIndex !== null && handlerIndex !== void 0 ? handlerIndex : p.action;
            if (this.prodCache.has(sign) && handlerInUse !== undefined) {
                this.productions[this.prodCache.get(sign)].action = handlerInUse;
            }
            else {
                this.prodCache.set(sign, this.productions.length);
                p.action = handlerInUse;
                this.productions.push(p);
            }
        }
    }
    bnf(prods, handler) {
        // normalize prod to array
        if (typeof (prods) == 'string' || prods instanceof String)
            prods = (0, bnf_1.parseBnf)((0, bnf_1.lexBnf)(prods, false));
        // .map(x => [x.name, x.expr, undefined]);
        else if (!(prods instanceof Array))
            prods = [prods];
        const handlerIndex = this.act(handler);
        this.bnfInner(prods, handlerIndex);
        return this;
    }
    registerEbnfParser(parser) {
        this.parseEbnf = parser;
    }
    ebnf(prods, handler) {
        // normalize prod to array
        if (typeof (prods) == 'string' || prods instanceof String) {
            if (this.parseEbnf == undefined)
                throw new error_1.ParserError('No EBNF parser is registered in this builder instance.');
            prods = this.parseEbnf((0, bnf_1.lexBnf)(prods, true));
        }
        // .map(x => [x.name, x.expr, undefined]);
        else if (!(prods instanceof Array))
            prods = [prods];
        const handlerIndex = this.act(handler);
        var simpleProds = (0, ebnf_1.convertToBnf)(prods, handlerIndex);
        this.bnfInner(simpleProds);
        return this;
    }
    opr(param0, ...params) {
        var hier = this.lowestHierarchy - 1;
        var assoc;
        var oprs;
        if (typeof (param0) == 'number' || param0 instanceof Number) {
            hier = Number(param0);
            assoc = params[0];
            oprs = params.slice(1);
        }
        else {
            assoc = String(param0);
            oprs = params;
        }
        assoc = String(assoc || "nonassoc").toLowerCase().trim();
        if (assoc != 'nonassoc' && assoc != 'left' && assoc != 'right')
            throw new error_1.ParserError(`Invalid operator associativity: ${JSON.stringify(assoc)}.`, [hier, assoc, oprs]);
        oprs.forEach((name) => {
            const elem = {
                name: name,
                prior: hier,
                assoc: assoc
            };
            if (hier < this.lowestHierarchy)
                this.lowestHierarchy = hier;
            if (this.oprCache.has(name))
                this.operators[this.oprCache.get(name)] = elem;
            else {
                this.oprCache.set(name, this.operators.length);
                this.operators.push(elem);
            }
        });
        return this;
    }
    define(options) {
        var _a;
        var tokens = options === null || options === void 0 ? void 0 : options.tokens;
        if (tokens === undefined) { // calculate all terminals
            tokens = [];
            var nts = new Set(this.productions.map(x => x.name));
            this.productions.forEach(x => x.expr.forEach(name => {
                if (!nts.has(name))
                    tokens.push(name);
            }));
        }
        var mode = (_a = options === null || options === void 0 ? void 0 : options.mode) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        return {
            moduleName: (options === null || options === void 0 ? void 0 : options.moduleName) || 'Parser',
            actionMode: options === null || options === void 0 ? void 0 : options.actionMode,
            mode: mode,
            tokens: tokens,
            productions: this.productions,
            actions: this.actions,
            operators: this.operators,
            startSymbol: options === null || options === void 0 ? void 0 : options.startSymbol,
            eofToken: options === null || options === void 0 ? void 0 : options.eofToken,
        };
    }
    generate(options) {
        var def = this.define(options);
        var gen = new generator_1.default(def);
        return gen.generateParsedGrammar();
    }
    build(params) {
        return new parser_1.default(this.generate(params));
    }
}
exports.default = LRGrammarBuilder;
