import { ConflictError } from './conflict.error.js';

export class OptimisticLockError extends ConflictError {
  override readonly code = 'OPTIMISTIC_LOCK';
}
