export type ErrorEnvelope = {
  readonly error: {
    readonly name: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
};
