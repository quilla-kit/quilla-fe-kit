import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class NotFoundError extends QuillaFeHttpError {
  readonly code: string = 'NOT_FOUND';
}
