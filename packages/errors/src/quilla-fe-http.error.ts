import {
  QuillaFeError,
  type QuillaFeErrorJSON,
  type QuillaFeErrorOptions,
} from './quilla-fe.error.js';

export type QuillaFeHttpErrorOptions = QuillaFeErrorOptions & {
  readonly httpStatus: number;
  readonly requestUrl?: string;
};

type QuillaFeHttpErrorJSON = QuillaFeErrorJSON & {
  readonly httpStatus: number;
  readonly requestUrl?: string;
};

export abstract class QuillaFeHttpError extends QuillaFeError {
  readonly httpStatus: number;
  readonly requestUrl?: string;

  constructor(options: QuillaFeHttpErrorOptions) {
    super(options);
    this.httpStatus = options.httpStatus;
    if (options.requestUrl !== undefined) {
      this.requestUrl = options.requestUrl;
    }
  }

  override toJSON(): QuillaFeHttpErrorJSON {
    return {
      ...super.toJSON(),
      httpStatus: this.httpStatus,
      ...(this.requestUrl !== undefined ? { requestUrl: this.requestUrl } : {}),
    };
  }
}
