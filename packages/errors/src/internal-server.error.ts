import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class InternalServerError extends QuillaFeHttpError {
  readonly code = 'INTERNAL_SERVER';
}
