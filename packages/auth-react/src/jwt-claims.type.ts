export type JwtClaims = {
  readonly u: string;
  readonly si: string;
  readonly s?: readonly string[];
};
