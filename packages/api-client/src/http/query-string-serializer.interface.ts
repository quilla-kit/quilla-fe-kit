import type { HttpQueryParams } from './http-types.type.js';

export interface QueryStringSerializer {
  serialize(params: HttpQueryParams): string;
}
