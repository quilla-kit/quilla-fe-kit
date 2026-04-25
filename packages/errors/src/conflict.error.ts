import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class ConflictError extends QuillaFeHttpError {
  readonly code = 'CONFLICT';
}
