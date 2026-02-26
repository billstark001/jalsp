import { LexerBuilder } from './builder';
import { TokenHandler } from './types';

describe('RegExpLexerBuilder', () => {
  // Mode 1: Pure functions without context
  describe('Pure function mode', () => {
    it('should work with pure function handlers', () => {
      const builder = new LexerBuilder<number | undefined>();
      const handler: TokenHandler<number> = (raw) => parseInt(raw, 10);

      builder.t('NUMBER', /[0-9]+/, handler);
      builder.t('WHITESPACE', /\s+/, () => undefined);

      const lexer = builder.build({ eofName: 'EOF', eofValue: undefined });
      expect(lexer).toBeDefined();
    });

    it('should throw error when using string method name without context', () => {
      const builder = new LexerBuilder<number>();

      expect(() => {
        builder.t('NUMBER', /[0-9]+/, 'parseNumber');
      }).toThrow('Cannot use string method name without a context object');
    });
  });

  // Mode 2: Context object with methods
  describe('Context object mode', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface MyContext extends Record<string, TokenHandler<any>> {
      parseNumber: TokenHandler<number>;
      parseString: TokenHandler<string>;
    }

    it('should work with context object and method names', () => {
      const context: MyContext = {
        parseNumber: (raw) => parseInt(raw, 10),
        parseString: (raw) => raw.slice(1, -1), // Remove quotes
      };

      const builder = new LexerBuilder(context);
      builder.t('NUMBER', /[0-9]+/, 'parseNumber');
      builder.t('STRING', /"[^"]*"/, 'parseString');

      const lexer = builder.build({ eofName: 'EOF', eofValue: undefined });
      expect(lexer).toBeDefined();
    });

    it('should also work with pure functions when context is provided', () => {
      const context: MyContext = {
        parseNumber: (raw) => parseInt(raw, 10),
        parseString: (raw) => raw.slice(1, -1),
      };

      const builder = new LexerBuilder<number | string | undefined>(context);
      builder.t('NUMBER', /[0-9]+/, (raw) => Number(raw));
      builder.t('STRING', /"[^"]*"/, 'parseString');

      const lexer = builder.build({ eofName: 'EOF', eofValue: undefined });
      expect(lexer).toBeDefined();
    });

    it('should throw error for non-existent method', () => {
      const context: MyContext = {
        parseNumber: (raw) => parseInt(raw, 10),
        parseString: (raw) => raw.slice(1, -1),
      };

      const builder = new LexerBuilder(context);

      expect(() => {
        builder.t('NUMBER', /[0-9]+/, 'nonExistentMethod' as string);
      }).toThrow("Method 'nonExistentMethod' not found in context object");
    });
  });

  // Clone functionality
  describe('clone()', () => {
    it('should create an independent copy of the builder', () => {
      const builder1 = new LexerBuilder();
      builder1.t('NUMBER', /[0-9]+/);

      const builder2 = builder1.clone();
      builder2.t('STRING', /"[^"]*"/);

      const def1 = builder1.define();
      const def2 = builder2.define();

      expect(def1.records.length).toBe(1);
      expect(def2.records.length).toBe(2);
    });
  });

  // addFrom functionality
  describe('addFrom()', () => {
    it('should add tokens from another builder', () => {
      const builder1 = new LexerBuilder();
      builder1.t('NUMBER', /[0-9]+/);

      const builder2 = new LexerBuilder();
      builder2.t('STRING', /"[^"]*"/);
      builder2.addFrom(builder1);

      const def = builder2.define();
      expect(def.records.length).toBe(2);
      expect(def.records[0].name).toBe('STRING');
      expect(def.records[1].name).toBe('NUMBER');
    });

    it('should add tokens from a TokenDefinition', () => {
      const builder1 = new LexerBuilder();
      builder1.t('NUMBER', /[0-9]+/);
      const def1 = builder1.define();

      const builder2 = new LexerBuilder();
      builder2.t('STRING', /"[^"]*"/);
      builder2.addFrom(def1);

      const def2 = builder2.define();
      expect(def2.records.length).toBe(2);
    });
  });

  // Serialization
  describe('serialize() and deserialize()', () => {
    it('should serialize and deserialize builder with pure functions', () => {
      const builder = new LexerBuilder<number | string | undefined>();
      builder.t('NUMBER', /[0-9]+/, (raw) => parseInt(raw, 10));
      builder.t('STRING', /"[^"]*"/, (raw) => raw.slice(1, -1));

      const serialized = builder.serialize();
      expect(serialized).toHaveProperty('actions');
      expect(serialized).toHaveProperty('records');
      expect(serialized).toHaveProperty('optionalToken');

      const deserialized = LexerBuilder.deserialize(serialized);
      const def1 = builder.define();
      const def2 = deserialized.define();

      expect(def1.records.length).toBe(def2.records.length);
      expect(def1.records[0].name).toBe(def2.records[0].name);
    });

    it('should serialize and deserialize builder with context', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      interface MyContext extends Record<string, TokenHandler<any>> {
        parseNumber: TokenHandler<number>;
      }

      const context: MyContext = {
        parseNumber: (raw) => parseInt(raw, 10),
      };

      const builder = new LexerBuilder<number | string | undefined>(context);
      builder.t('NUMBER', /[0-9]+/, 'parseNumber');

      const serialized = builder.serialize();
      expect(serialized).toHaveProperty('contextMethods');
      expect(serialized.contextMethods).toHaveProperty('parseNumber');

      const deserialized = LexerBuilder.deserialize(serialized);
      const def1 = builder.define();
      const def2 = deserialized.define();

      expect(def1.records.length).toBe(def2.records.length);
      expect(def1.records[0].name).toBe(def2.records[0].name);
    });

    it('should work with serialize options', () => {
      const builder = new LexerBuilder<number | string | undefined>();
      builder.t('NUMBER', /[0-9]+/, (raw) => parseInt(raw, 10));

      // Test with allowNonPure option
      const serialized = builder.serialize({ allowNonPure: true, allowAsync: false });
      expect(serialized).toBeDefined();

      const deserialized = LexerBuilder.deserialize(serialized);
      expect(deserialized).toBeDefined();
    });
  });
});
