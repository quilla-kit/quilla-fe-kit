const QUILLA_FE_ERROR = Symbol.for('quilla-fe-kit.error');

export type QuillaFeErrorOptions = {
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: unknown;
};

export type QuillaFeErrorJSON = {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: unknown;
};

export abstract class QuillaFeError extends Error {
  readonly [QUILLA_FE_ERROR] = true as const;
  abstract readonly code: string;
  readonly context?: Record<string, unknown>;

  constructor(options: QuillaFeErrorOptions) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    if (options.context !== undefined) {
      this.context = options.context;
    }
  }

  toJSON(): QuillaFeErrorJSON {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.context !== undefined ? { context: this.context } : {}),
      ...(this.cause !== undefined ? { cause: this.cause } : {}),
    };
  }

  static is(e: unknown): e is QuillaFeError {
    return (
      typeof e === 'object' &&
      e !== null &&
      (e as Record<PropertyKey, unknown>)[QUILLA_FE_ERROR] === true
    );
  }
}
