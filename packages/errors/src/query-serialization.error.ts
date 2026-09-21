import { QuillaFeError } from './quilla-fe.error.js';

export class QuerySerializationError extends QuillaFeError {
  readonly code = 'QUERY_SERIALIZATION';
}
