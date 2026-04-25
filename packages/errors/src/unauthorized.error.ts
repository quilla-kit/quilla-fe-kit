import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class UnauthorizedError extends QuillaFeHttpError {
  readonly code = 'UNAUTHORIZED';
}
