import {
  serializeFunction,
  serializeFunctionToString,
  deserializeFunction,
  deserializeFunctionFromString,
  testRoundTrip,
} from './serializer';

describe('Function Serialization', () => {
  describe('Basic function serialization', () => {
    test('should serialize and deserialize a simple function', () => {
      function add(a: number, b: number): number {
        return a + b;
      }

      const serialized = serializeFunction(add);
      expect(serialized.type).toBe('function');
      expect(serialized.isAsync).toBe(false);
      expect(serialized.name).toBe('add');

      const deserialized = deserializeFunction(serialized);
      expect(deserialized(2, 3)).toBe(5);
    });

    test('should serialize and deserialize an arrow function', () => {
      const multiply = (a: number, b: number) => a * b;

      const serialized = serializeFunction(multiply);
      expect(serialized.type).toBe('arrow');
      expect(serialized.isAsync).toBe(false);

      const deserialized = deserializeFunction(serialized);
      expect(deserialized(4, 5)).toBe(20);
    });

    test('should serialize and deserialize an anonymous function', () => {
      const fn = function (x: number) {
        return x * x;
      };

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);
      expect(deserialized(7)).toBe(49);
    });

    test('should handle complex expressions', () => {
      const fn = (x: number) => {
        const y = x * 2;
        const z = y + 10;
        return z / 2;
      };

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);
      expect(deserialized(5)).toBe(10);
    });
  });

  describe('Async function serialization', () => {
    test('should serialize and deserialize async functions', async () => {
      const asyncFn = async (x: number) => {
        return x * 2;
      };

      const serialized = serializeFunction(asyncFn, { allowAsync: true });
      expect(serialized.isAsync).toBe(true);

      const deserialized = deserializeFunction(serialized);
      const result = await deserialized(5);
      expect(result).toBe(10);
    });

    test('should throw error for async functions when not allowed in strict mode', () => {
      const asyncFn = async (x: number) => x * 2;

      expect(() => {
        serializeFunction(asyncFn, { allowAsync: false, strictMode: true });
      }).toThrow('Async functions are not allowed');
    });

    test('should warn for async functions when not allowed in non-strict mode', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const asyncFn = async (x: number) => x * 2;

      serializeFunction(asyncFn, { allowAsync: false, strictMode: false });
      expect(consoleSpy).toHaveBeenCalledWith('Async functions are not allowed');

      consoleSpy.mockRestore();
    });
  });

  describe('Built-in function serialization', () => {
    test('should serialize and deserialize Number constructor', () => {
      const serialized = serializeFunction(Number);
      expect(serialized.type).toBe('builtin');
      expect(serialized.builtinId).toBe('Number');

      const deserialized = deserializeFunction(serialized);
      expect(deserialized('123')).toBe(123);
    });

    test('should serialize and deserialize String constructor', () => {
      const serialized = serializeFunction(String);
      const deserialized = deserializeFunction(serialized);
      expect(deserialized(123)).toBe('123');
    });

    test('should serialize and deserialize Math methods', () => {
      const serialized = serializeFunction(Math.abs);
      const deserialized = deserializeFunction(serialized);
      expect(deserialized(-5)).toBe(5);
    });

    test('should serialize and deserialize parseInt', () => {
      const serialized = serializeFunction(parseInt);
      const deserialized = deserializeFunction(serialized);
      expect(deserialized('42')).toBe(42);
    });

    test('should serialize and deserialize JSON.parse', () => {
      const serialized = serializeFunction(JSON.parse);
      const deserialized = deserializeFunction(serialized);
      expect(deserialized('{"a":1}')).toEqual({ a: 1 });
    });
  });

  describe('Purity checks', () => {
    test('should detect console usage', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const impureFn = (x: number) => {
        console.log(x);
        return x;
      };

      serializeFunction(impureFn, { allowNonPure: false, strictMode: false });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should throw error for impure functions in strict mode', () => {
      const impureFn = (x: number) => {
        console.log(x);
        return x;
      };

      expect(() => {
        serializeFunction(impureFn, { allowNonPure: false, strictMode: true });
      }).toThrow('Function may not be pure');
    });

    test('should allow pure functions', () => {
      const pureFn = (x: number, y: number) => {
        const sum = x + y;
        return sum * 2;
      };

      expect(() => {
        serializeFunction(pureFn, { allowNonPure: false, strictMode: true });
      }).not.toThrow();
    });

    test('should detect Math.random usage', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const nonDeterministic = () => Math.random();

      serializeFunction(nonDeterministic, { allowNonPure: false, strictMode: false });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('String serialization', () => {
    test('should serialize to string and deserialize from string', () => {
      const fn = (x: number) => x * 3;

      const str = serializeFunctionToString(fn);
      expect(typeof str).toBe('string');

      const deserialized = deserializeFunctionFromString(str);
      expect(deserialized(4)).toBe(12);
    });

    test('should handle JSON serialization of built-ins', () => {
      const str = serializeFunctionToString(Math.floor);
      const deserialized = deserializeFunctionFromString(str);
      expect(deserialized(4.7)).toBe(4);
    });
  });

  describe('Context injection', () => {
    test('should inject context into deserialized functions', () => {
      // Create a function that uses external constants
      const fnSource = '(x) => x + OFFSET';
      const serialized = {
        source: fnSource,
        type: 'arrow' as const,
        isAsync: false,
      };

      const deserialized = deserializeFunction(serialized, {
        context: { OFFSET: 10 },
      });

      expect(deserialized(5)).toBe(15);
    });

    test('should inject multiple context values', () => {
      const fnSource = '(x) => x * MULTIPLIER + OFFSET';
      const serialized = {
        source: fnSource,
        type: 'arrow' as const,
        isAsync: false,
      };

      const deserialized = deserializeFunction(serialized, {
        context: { MULTIPLIER: 2, OFFSET: 5 },
      });

      expect(deserialized(10)).toBe(25);
    });
  });

  describe('Edge cases', () => {
    test('should handle functions with default parameters', () => {
      const fn = (x: number, y: number = 10) => x + y;

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);

      expect(deserialized(5)).toBe(15);
      expect(deserialized(5, 20)).toBe(25);
    });

    test('should handle functions with rest parameters', () => {
      const fn = (...nums: number[]) => nums.reduce((a, b) => a + b, 0);

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);

      expect(deserialized(1, 2, 3, 4)).toBe(10);
    });

    test('should handle functions with destructured parameters', () => {
      const fn = ({ x, y }: { x: number; y: number }) => x + y;

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);

      expect(deserialized({ x: 3, y: 7 })).toBe(10);
    });

    test('should handle multiline functions', () => {
      const fn = (x: number) => {
        if (x < 0) {
          return -x;
        }
        return x;
      };

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);

      expect(deserialized(-5)).toBe(5);
      expect(deserialized(5)).toBe(5);
    });

    test('should handle functions with nested functions', () => {
      const fn = (x: number) => {
        const helper = (y: number) => y * 2;
        return helper(x) + 1;
      };

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);

      expect(deserialized(5)).toBe(11);
    });

    test('should handle functions returning objects', () => {
      const fn = (x: number) => ({ value: x, doubled: x * 2 });

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);

      expect(deserialized(5)).toEqual({ value: 5, doubled: 10 });
    });

    test('should handle functions with array operations', () => {
      const fn = (arr: number[]) => arr.map(x => x * 2).filter(x => x > 5);

      const serialized = serializeFunction(fn);
      const deserialized = deserializeFunction(serialized);

      expect(deserialized([1, 2, 3, 4, 5])).toEqual([6, 8, 10]);
    });
  });

  describe('Error handling', () => {
    test('should throw error for invalid serialized data', () => {
      expect(() => {
        deserializeFunctionFromString('invalid json');
      }).toThrow();
    });

    test('should throw error for unknown built-in function', () => {
      const serialized = {
        source: '',
        type: 'builtin' as const,
        isAsync: false,
        builtinId: 'UnknownFunction',
      };

      expect(() => {
        deserializeFunction(serialized);
      }).toThrow('Unknown built-in function');
    });

    test('should throw error for missing built-in ID', () => {
      const serialized = {
        source: '',
        type: 'builtin' as const,
        isAsync: false,
      };

      expect(() => {
        deserializeFunction(serialized);
      }).toThrow('Built-in function ID is missing');
    });

    test('should validate deserialized output', () => {
      const invalidSerialized = {
        source: '() => { return "not a function constructor" }',
        type: 'arrow' as const,
        isAsync: false,
      };

      // This should still work as it returns a function
      expect(() => {
        deserializeFunction(invalidSerialized, { validate: true });
      }).not.toThrow();
    });
  });

  describe('Round trip testing', () => {
    test('should pass round trip test for simple functions', () => {
      const fn = (x: number) => x * 2;
      expect(testRoundTrip(fn, 5)).toBe(true);
    });

    test('should pass round trip test for complex functions', () => {
      const fn = (arr: number[]) => arr.map(x => x * 2).reduce((a, b) => a + b, 0);
      expect(testRoundTrip(fn, [1, 2, 3, 4])).toBe(true);
    });

    test('should pass round trip test for built-in functions', () => {
      expect(testRoundTrip(Math.abs, -5)).toBe(true);
      expect(testRoundTrip(String, 123)).toBe(true);
    });
  });
});