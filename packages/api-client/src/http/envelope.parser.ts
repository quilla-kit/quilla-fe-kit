import {
  BadRequestError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  type QuillaFeHttpError,
  type QuillaFeHttpErrorOptions,
  UnauthorizedError,
  ValidationError,
} from '@quilla-fe-kit/errors';
import type { ErrorEnvelope } from '../wire/error-envelope.type.js';
import type { HttpErrorParser } from './http-error-parser.interface.js';

type HttpErrorClass = new (options: QuillaFeHttpErrorOptions) => QuillaFeHttpError;

const NAME_DISPATCH: Readonly<Record<string, HttpErrorClass>> = {
  [BadRequestError.name]: BadRequestError,
  [UnauthorizedError.name]: UnauthorizedError,
  [ForbiddenError.name]: ForbiddenError,
  [NotFoundError.name]: NotFoundError,
  [ConflictError.name]: ConflictError,
  [ValidationError.name]: ValidationError,
  [BusinessRuleError.name]: BusinessRuleError,
  [InternalServerError.name]: InternalServerError,
};

const STATUS_DISPATCH: Readonly<Record<number, HttpErrorClass>> = {
  400: BadRequestError,
  401: UnauthorizedError,
  403: ForbiddenError,
  404: NotFoundError,
  409: ConflictError,
  412: ConflictError,
  422: ValidationError,
  500: InternalServerError,
};

export class EnvelopeHttpErrorParser implements HttpErrorParser {
  fromResponse(status: number, statusText: string, body: unknown, url: string): Error {
    const envelope = (body as ErrorEnvelope | undefined)?.error;
    const message = envelope?.message ?? statusText ?? 'HTTP request failed';
    const baseOptions: QuillaFeHttpErrorOptions = {
      message,
      httpStatus: status,
      requestUrl: url,
      ...(envelope?.details !== undefined ? { context: envelope.details } : {}),
    };

    const ByName = envelope?.name !== undefined ? NAME_DISPATCH[envelope.name] : undefined;
    if (ByName) return new ByName(baseOptions);

    const ByStatus = STATUS_DISPATCH[status];
    if (ByStatus) return new ByStatus(baseOptions);

    return new InternalServerError(baseOptions);
  }

  fromTransportError(error: unknown): Error {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new NetworkError({ message: error.message || 'Request aborted', cause: error });
    }
    if (error instanceof TypeError) {
      return new NetworkError({ message: error.message || 'Network error', cause: error });
    }
    if (error instanceof Error) {
      return new NetworkError({ message: error.message, cause: error });
    }
    return new NetworkError({ message: 'Unknown transport error', cause: error });
  }
}
