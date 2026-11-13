---
'@quilla-fe-kit/api-client-react-query': minor
---

**Breaking:** `usePostMutationBase` variables are now `{ body?, params? }` (`PostMutationVars<TBody>`), matching how PUT/PATCH keep path values apart from the request body. Only `body` is sent. `:placeholders` in the path are filled from `params`, and POST never appends an id: a path with no placeholders is used as-is. Action endpoints like `/users/:id/suspend` now take the id with each call, so the URL no longer has to be fixed when the hook is created.

Migration:

- `mutate(body)` → `mutate({ body })`
- `resolveUrl: ({ orgId }) => …` + `mutate({ orgId, email })` → path `'/orgs/:orgId/members'` + `mutate({ params: { orgId }, body: { email } })`
- `invalidate` / `onSuccess` / `onMutate` callbacks now receive the `{ body, params }` object: read `vars.body?.x` / `vars.params?.x`
- The second generic changes meaning: `usePostMutationBase<TData, TVars>` → `usePostMutationBase<TData, TBody>`

Most old calls fail to compile. Two cases the compiler can't flag: a body that itself has a `body` or `params` field, and calls whose body type is `unknown` or that come from plain JavaScript. At runtime, any variables that aren't `{ body?, params? }` (a bare body, `FormData`, extra keys) reject the mutation with a `[post]` error before a request is sent.

New `resolvePathParams(basePath, vars)` helper: fills placeholders and never appends an id (what POST uses). `resolveMutationUrl` is unchanged.
