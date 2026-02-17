/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IEquatable {
  equals(obj: any): boolean;
}

export type MethodKeyOf<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];
