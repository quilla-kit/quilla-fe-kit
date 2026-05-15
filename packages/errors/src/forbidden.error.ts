import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class ForbiddenError extends QuillaFeHttpError {
  readonly code = 'FORBIDDEN';
}
