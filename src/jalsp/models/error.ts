export class LexerError extends Error {

  additional?: any;

  constructor(msg: string, additional?: any) {
    super(msg);
    this.additional = additional;
  }

}
export class ParserError extends Error {

  additional?: any;

  constructor(msg: string, additional?: any) {
    super(msg);
    this.additional = additional;
  }

}