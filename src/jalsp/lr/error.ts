/* eslint-disable @typescript-eslint/no-explicit-any */
export class ParserError extends Error {

  additional?: any;

  constructor(msg: string, additional?: any) {
    super(msg);
    this.additional = additional;
  }

}