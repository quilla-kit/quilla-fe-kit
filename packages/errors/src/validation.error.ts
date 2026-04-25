import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class ValidationError extends QuillaFeHttpError {
  readonly code = 'VALIDATION';
}
