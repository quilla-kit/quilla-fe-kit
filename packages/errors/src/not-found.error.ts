import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class NotFoundError extends QuillaFeHttpError {
  readonly code = 'NOT_FOUND';
}
