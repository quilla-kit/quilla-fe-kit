---
'@quilla-fe-kit/api-client': patch
'@quilla-fe-kit/api-client-react-query': patch
---

Documentation, from adopter feedback on 0.4.0 / 0.7.0.

`RepeatParamsSerializer`: state that an `encodeValue` override should encode a
transport-wide convention, not a rule keyed to a param name. The serializer is a
foundation layer every request passes through, so keying it to one feature's
vocabulary inverts the dependency — those params should be flattened at the call
site. The existing example was already convention-scoped; the boundary was just
never written down, and specializing it by `keyPath` is an easy wrong turn.

`useInfiniteQueryBase`: scope what it replaces. It accumulates pages of one query
key; it is not a general merge layer, and assembling one view from heterogeneous
request shapes still belongs in application state. The previous wording ("rather
than in a merged store you maintain yourself") read as a broader promise than the
hook makes.
