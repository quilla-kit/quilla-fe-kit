import { QuillaFeHttpError } from './quilla-fe-http.error.js';

export class BusinessRuleError extends QuillaFeHttpError {
  readonly code = 'BUSINESS_RULE';
}
