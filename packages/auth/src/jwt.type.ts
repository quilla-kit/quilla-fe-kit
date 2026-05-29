export type JwtHeader = {
  readonly alg?: string;
  readonly typ?: string;
  readonly kid?: string;
};

export type JwtPayload = {
  readonly iss?: string;
  readonly sub?: string;
  readonly aud?: string | readonly string[];
  readonly exp?: number;
  readonly nbf?: number;
  readonly iat?: number;
  readonly jti?: string;
};
