import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class BadRequestError extends QuillaFeHttpError {
  readonly code = 'BAD_REQUEST';
}
