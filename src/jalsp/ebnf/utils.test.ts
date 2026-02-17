import { handleSingleQuoteString } from './utils';


describe('handleSingleQuoteString', () => {
  it('should convert single quotes to double quotes', () => {
    expect(handleSingleQuoteString("'hello'")).toBe('"hello"');
  });

  it('should handle escaped single quotes', () => {
    expect(handleSingleQuoteString("'hello\\'world'")).toBe('"hello\'world"');
  });

  it('should escape double quotes', () => {
    expect(handleSingleQuoteString("'hello\"world'")).toBe('"hello\\"world"');
  });

  it('should throw on invalid input', () => {
    expect(() => handleSingleQuoteString("'")).toThrow();
    expect(() => handleSingleQuoteString("")).toThrow();
  });
});
