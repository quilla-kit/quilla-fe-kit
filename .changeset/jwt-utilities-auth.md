---
'@quilla-fe-kit/auth': minor
---

Add JWT decode utilities: `decodeJwtPayload`, `decodeJwtHeader`,
`isTokenExpired` (checks both `exp` and `nbf` with optional clock-skew
tolerance), `getTokenExpiry`, and the `JwtPayload`, `JwtHeader`,
`IsTokenExpiredOptions` types. Zero new runtime dependencies. Base64url
decode uses `Buffer.from` in Node and `atob + TextDecoder` in browsers —
both paths produce correct UTF-8 strings for non-ASCII claim values.
