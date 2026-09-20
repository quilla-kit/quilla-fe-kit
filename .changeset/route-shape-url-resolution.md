---
'@quilla-fe-kit/api-client-react-query': minor
---

Consumer-owned request URLs for the mutation hooks.

PUT/PATCH/DELETE hardcoded `${basePath}/${id}`, so a route whose identifier is
not the last segment — `PUT /claims/:claimId/settle`, the shape you get when a
route always ends with the operation's own name — could not be expressed without
leaving the hook and losing OCC, invalidation, transformers and headers.

All four mutation hooks now resolve the URL through one documented ladder:

1. `options.resolveUrl(vars)`, if supplied — used verbatim.
2. Placeholders in `basePath` — every `/:name/` segment is substituted from the
   mutation variables, with `params` (new, optional, on `IdAndBody`) taking
   precedence. Names are free-form.
3. Neither — the id is appended, as before.

DELETE resolves placeholders against whatever shape its caller chose for
`TVars`, so `/orgs/:orgId/seats/:seatId` works with `mutate({ orgId, seatId })`
and no `id` at all. POST gains `resolveUrl` for routes derived from the body.

Placeholder matching is segment-anchored, which fixes PATCH's existing
substitution: `:id` no longer matches the prefix of `:idNumber`, `/orgs/:identity`
is no longer treated as containing `:id`, and the port in an absolute base URL
is never mistaken for a placeholder. An unresolved placeholder, an empty value or
a missing id now rejects the mutation with a `[url]` error instead of silently
producing `/users/undefined` or `/users/[object%20Object]`.

Behaviour changes:

- **Path values are percent-encoded.** `mutate({ id: 'a/b' })` now sends
  `/users/a%2Fb`. No-op for numeric and UUID ids. If you were pre-encoding ids
  yourself, stop, or they will be double-encoded. `resolveUrl` is the escape
  hatch for full control.
- **`useQueryBase`'s `query.extra` no longer overrides the typed fields.** It was
  merged last, so `extra: { page: 99 }` silently beat `page: 1`. Typed fields now
  win; `extra` still supplies any key they leave unset. To rename paging
  parameters on the wire, use `paginationKeys` / `searchSuffix` on the client's
  `querySerializer`. `query.extra` is now documented.
