/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

/**
 * Options for function serialization
 */
export interface SerializeOptions {
  /** Whether to allow non-pure functions (functions with external dependencies) */
  allowNonPure?: boolean;
  /** Whether to allow async functions */
  allowAsync?: boolean;
  /** Whether to throw error on violations, or just warn */
  strictMode?: boolean;
}

/**
 * Options for function deserialization
 */
export interface DeserializeOptions {
  /** Custom context to provide to deserialized functions */
  context?: Record<string, any>;
  /** Whether to validate the function before returning */
  validate?: boolean;
}

/**
 * Serialized function metadata
 */
export interface SerializedFunction {
  /** The function source code */
  source: string;
  /** Function type: 'function', 'arrow', or 'builtin' */
  type: 'function' | 'arrow' | 'builtin';
  /** Whether the function is async */
  isAsync: boolean;
  /** Function name (if available) */
  name?: string;
  /** Built-in function identifier (for native functions) */
  builtinId?: string;
}

/**
 * Map of supported built-in functions
 */
const BUILTIN_FUNCTIONS: ReadonlyMap<Function, string> = new Map<Function, string>([
  [Number, 'Number'],
  [String, 'String'],
  [Boolean, 'Boolean'],
  [Array, 'Array'],
  [Object, 'Object'],
  [Date, 'Date'],
  [RegExp, 'RegExp'],
  [Math.abs, 'Math.abs'],
  [Math.ceil, 'Math.ceil'],
  [Math.floor, 'Math.floor'],
  [Math.round, 'Math.round'],
  [Math.max, 'Math.max'],
  [Math.min, 'Math.min'],
  [Math.sqrt, 'Math.sqrt'],
  [Math.pow, 'Math.pow'],
  [JSON.parse, 'JSON.parse'],
  [JSON.stringify, 'JSON.stringify'],
  [parseInt, 'parseInt'],
  [parseFloat, 'parseFloat'],
  [isNaN, 'isNaN'],
  [isFinite, 'isFinite'],
]);

/**
 * Reverse map for deserialization
 */
const BUILTIN_LOOKUP: ReadonlyMap<string, Function> = new Map<string, Function>(
  Array.from(BUILTIN_FUNCTIONS.entries()).map(([fn, id]) => [id, fn])
);

/**
 * Check if a function is a built-in function
 */
function isBuiltinFunction(fn: Function): boolean {
  return BUILTIN_FUNCTIONS.has(fn);
}

const impurePatterns: ReadonlyArray<Readonly<{ pattern: RegExp; message: string }>> = [
  { pattern: /console\./g, message: 'Uses console (side effect)' },
  { pattern: /\bdocument\b/g, message: 'Accesses document (external dependency)' },
  { pattern: /\bwindow\b/g, message: 'Accesses window (external dependency)' },
  { pattern: /\blocalstorage\b/gi, message: 'Uses localStorage (side effect)' },
  { pattern: /\bsessionstorage\b/gi, message: 'Uses sessionStorage (side effect)' },
  { pattern: /\bfetch\b/g, message: 'Uses fetch (side effect)' },
  { pattern: /\bXMLHttpRequest\b/g, message: 'Uses XMLHttpRequest (side effect)' },
  { pattern: /\bprocess\b/g, message: 'Accesses process (external dependency)' },
  { pattern: /\brequire\b/g, message: 'Uses require (external dependency)' },
  { pattern: /\bimport\b/g, message: 'Uses import (external dependency)' },
  { pattern: /\bDate\.now\b/g, message: 'Uses Date.now() (non-deterministic)' },
  { pattern: /\bMath\.random\b/g, message: 'Uses Math.random() (non-deterministic)' },
] as const;

/**
 * Check if a function appears to be pure (simple heuristic)
 * Note: This is not foolproof, but catches common impure patterns
 */
function isPureFunction(source: string): { isPure: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check for common impure patterns


  for (const { pattern, message } of impurePatterns) {
    if (pattern.test(source)) {
      violations.push(message);
    }
  }

  // Check for free variables (variables not defined in function)
  // This is a simplified check
  const functionBody = source.match(/\{([\s\S]*)\}/)?.[1] || source;
  const paramNames = extractParameterNames(source);
  const usedVars = extractVariableNames(functionBody);
  const freeVars = usedVars.filter(
    v => !paramNames.includes(v) && !isBuiltinName(v)
  );

  if (freeVars.length > 0) {
    violations.push(`Uses free variables: ${freeVars.join(', ')}`);
  }

  return {
    isPure: violations.length === 0,
    violations,
  };
}

/**
 * Extract parameter names from function source
 */
function extractParameterNames(source: string): string[] {
  // Match function parameters
  const match = source.match(/\(([^)]*)\)/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map(p => p.trim().split('=')[0].trim())
    .filter(p => p && p !== '...');
}

/**
 * Extract variable names used in code (simplified)
 */
function extractVariableNames(code: string): string[] {
  // Remove strings and comments
  const cleaned = code
    .replace(/"[^"]*"/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Match identifiers
  const identifiers = cleaned.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];

  // Extract declared variables (const, let, var, function declarations)
  const declarations = new Set<string>();
  const declPatterns = [
    /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
    /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
  ];

  for (const pattern of declPatterns) {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) {
      declarations.add(match[1]);
    }
  }

  // Filter out declared variables and return unique identifiers
  return [...new Set(identifiers.filter(id => !declarations.has(id)))];
}

const builtins: ReadonlySet<string> = new Set([
  'undefined', 'null', 'true', 'false', 'Infinity', 'NaN',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Date',
  'RegExp', 'Math', 'JSON', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'console', 'let', 'const', 'var', 'function',
  'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'try', 'catch', 'finally',
  'throw', 'new', 'this', 'typeof', 'instanceof',
]);

/**
 * Check if a name is a built-in JavaScript identifier
 */
function isBuiltinName(name: string): boolean {
  return builtins.has(name);
}

/**
 * Serialize a function to a JSON-compatible object
 */
export function serializeFunction(
  fn: Function,
  options: SerializeOptions = {}
): SerializedFunction {
  const { allowNonPure = true, allowAsync = true, strictMode = false } = options;

  // Handle built-in functions
  if (isBuiltinFunction(fn)) {
    return {
      source: '',
      type: 'builtin',
      isAsync: false,
      builtinId: BUILTIN_FUNCTIONS.get(fn),
    };
  }

  // Get function source
  const source = fn.toString();

  // Detect async functions using multiple approaches since TypeScript may transform them
  // 1. Check constructor name (works for native async functions)
  // 2. Check source code for async keyword or __awaiter helper (works for transpiled functions)
  const isAsync =
    fn.constructor.name === 'AsyncFunction' ||
    /^\s*async[\s(]/.test(source) ||
    source.includes('__awaiter');

  if (isAsync && !allowAsync) {
    const message = 'Async functions are not allowed';
    if (strictMode) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }

  // Detect function type
  let type: 'function' | 'arrow';
  if (source.includes('=>')) {
    type = 'arrow';
  } else {
    type = 'function';
  }

  // Check purity
  if (!allowNonPure) {
    const { isPure, violations } = isPureFunction(source);
    if (!isPure) {
      const message = `Function may not be pure:\n${violations.join('\n')}`;
      if (strictMode) {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }

  // Extract function name
  let name: string | undefined;
  const nameMatch = source.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
  if (nameMatch) {
    name = nameMatch[1];
  }

  return {
    source,
    type,
    isAsync,
    name,
  };
}

/**
 * Serialize a function to a JSON string
 */
export function serializeFunctionToString(
  fn: Function,
  options?: SerializeOptions
): string {
  const serialized = serializeFunction(fn, options);
  return JSON.stringify(serialized);
}

/**
 * Deserialize a function from a serialized object
 */
export function deserializeFunction(
  serialized: SerializedFunction,
  options: DeserializeOptions = {}
): Function {
  const { context = {}, validate = true } = options;

  // Handle built-in functions
  if (serialized.type === 'builtin') {
    if (!serialized.builtinId) {
      throw new Error('Built-in function ID is missing');
    }
    const fn = BUILTIN_LOOKUP.get(serialized.builtinId);
    if (!fn) {
      throw new Error(`Unknown built-in function: ${serialized.builtinId}`);
    }
    return fn;
  }

  // Reconstruct the function
  try {
    // TypeScript's __awaiter helper for async functions
    const __awaiter = function (thisArg: any, _arguments: any, P: any, generator: any) {
      function adopt(value: any) { return value instanceof P ? value : new P(function (resolve: any) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve: any, reject: any) {
        function fulfilled(value: any) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value: any) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result: any) {
          if (result.done) {
            resolve(result.value);
          } else {
            adopt(result.value).then(fulfilled, rejected);
          }
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };

    // Create a function constructor with context (including __awaiter for async functions)
    const fullContext = { ...context, __awaiter };
    const contextKeys = Object.keys(fullContext);
    const contextValues = Object.values(fullContext);

    // Wrap the function source in a return statement
    let wrappedSource: string;
    if (serialized.type === 'arrow') {
      wrappedSource = `return (${serialized.source})`;
    } else {
      wrappedSource = `return ${serialized.source}`;
    }

    // Create the function with context
    const fn = new Function(...contextKeys, wrappedSource)(...contextValues);

    // Validate if requested
    if (validate) {
      if (typeof fn !== 'function') {
        throw new Error('Deserialization did not produce a function');
      }
    }

    return fn;
  } catch (error) {
    throw new Error(
      `Failed to deserialize function: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deserialize a function from a JSON string
 */
export function deserializeFunctionFromString(
  serialized: string,
  options?: DeserializeOptions
): Function {
  try {
    const parsed = JSON.parse(serialized) as SerializedFunction;
    return deserializeFunction(parsed, options);
  } catch (error) {
    throw new Error(
      `Failed to parse serialized function: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Utility to test if a function can be serialized and deserialized
 */
export function testRoundTrip(fn: Function, ...args: any[]): boolean {
  try {
    const serialized = serializeFunction(fn);
    const deserialized = deserializeFunction(serialized);

    // Test with provided arguments
    const original = fn(...args);
    const restored = deserialized(...args);

    return JSON.stringify(original) === JSON.stringify(restored);
  } catch {
    return false;
  }
}