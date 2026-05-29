---
'@quilla-fe-kit/auth-react': minor
---

Add optional `decodeToken?: TokenDecoder<TClaims> | undefined` prop to
`AuthProvider`. The built-in default checks token expiry (exp + nbf) and
decodes claims in a single parse, so expired tokens are rejected at both
hydration and `signIn` without any extra wiring. `decode` is stabilized
with `useMemo`, preventing effect and callback churn when consumers pass
a stable `decodeToken` reference. Consumers who need custom decode
behavior (different format, clock-skew tolerance, added validation) pass
`decodeToken` as a prop. `TokenDecoder<TClaims>` type is exported. The
internal `jwt.parser.ts` re-export shim is removed — import JWT utilities
from `@quilla-fe-kit/auth` directly.
