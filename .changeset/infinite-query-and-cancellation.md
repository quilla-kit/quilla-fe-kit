---
'@quilla-fe-kit/api-client-react-query': minor
---

**BREAKING:** `useQueryBase` now forwards TanStack's `AbortSignal` to the HTTP
client, so cancellation reaches the network. Superseded queries, inactive
queries and `queryClient.cancelQueries` abort the in-flight request instead of
only discarding its result. Code relying on a GET completing after unmount or
after a key change will see it aborted.

Add `useInfiniteQueryBase` for chunked or paged reads that belong in the query
cache. It carries the same mapper, transformer, envelope, debounce and
cancellation handling as `useQueryBase`, and stays envelope-agnostic: the
consumer supplies `initialPageParam` and `getNextPageParam`.

The page param imposes no pagination vocabulary. Canonical `page`/`limit`/`sort`
are remapped by the client's `paginationKeys`; any other key — `cursor`,
`pagina`, `after` — reaches the wire verbatim with no `extra` wrapper.

`useInfiniteQueryBase` appends an `'infinite'` segment to the `baseKey` you give
it, so an infinite query and a `useQueryBase` list sharing a base key cannot
collide on one cache entry. Existing prefix invalidation is unaffected, since the
segment is appended rather than replacing anything. It is exported as
`INFINITE_KEY_SEGMENT` for consumers who want to target infinite queries
specifically.

`QuerySerializationError` is now treated as non-retryable by the default retry
policy, since re-sending an unserializable param cannot succeed.
