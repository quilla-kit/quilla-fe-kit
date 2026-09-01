import { NotFoundError } from './not-found.error.js';

export class CrossScopeAccessError extends NotFoundError {
  override readonly code = 'CROSS_SCOPE_ACCESS';
}
