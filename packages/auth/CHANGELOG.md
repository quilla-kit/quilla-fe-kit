# @quilla-fe-kit/auth

## 0.2.0

### Minor Changes

- aeb2a49: Add JWT decode utilities: `decodeJwtPayload`, `decodeJwtHeader`,
  `isTokenExpired` (checks both `exp` and `nbf` with optional clock-skew
  tolerance), `getTokenExpiry`, and the `JwtPayload`, `JwtHeader`,
  `IsTokenExpiredOptions` types. Zero new runtime dependencies. Base64url
  decode uses `Buffer.from` in Node and `atob + TextDecoder` in browsers —
  both paths produce correct UTF-8 strings for non-ASCII claim values.

## 0.1.1

### Patch Changes

- ba25ee0: test: smoke-test CI release via Trusted Publishers (OIDC) across all packages

## 0.1.0

### Minor Changes

- 4e00828: Initial release of `@quilla-fe-kit/errors`, `@quilla-fe-kit/auth`,
  `@quilla-fe-kit/api-client`, and `@quilla-fe-kit/api-client-react-query`.
