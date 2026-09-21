---
'@quilla-fe-kit/api-client': minor
---

**BREAKING:** `RepeatParamsSerializer` now throws `QuerySerializationError` when
a plain object reaches a value position, instead of silently emitting
`[object Object]`. To restore the previous behaviour, override the new
`protected encodeValue(value, keyPath)` on a subclass.

This is the default serializer, so it affects any consumer that does not supply
its own `querySerializer`. It covers all three cases that previously stringified
silently: a top-level nested object, one nested inside `search` or `filter`
(reported as `filter.age`), and one inside an array (reported as `tags[1]`).
`Date` and other class instances are unaffected.

**BREAKING:** `QueryConventions.defaultLimit` is removed. It was stored and never
read, so runtime behaviour is unchanged, but passing it is now a compile error.

`RepeatParamsSerializer` is now extensible rather than all-or-nothing:
`encodeValue`, `conventions` and `isPlainObject` are `protected`, so a subclass can
change how one value is encoded while inheriting search, filter, pagination and
array-repeat handling. Previously the only escape hatch was reimplementing
`QueryStringSerializer` wholesale.

Also exports `DEFAULT_QUERY_CONVENTIONS`.
