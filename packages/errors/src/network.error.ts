import { QuillaFeError } from './quilla-fe.error.js';

export class NetworkError extends QuillaFeError {
  readonly code = 'NETWORK';
}
