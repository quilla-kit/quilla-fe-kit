---
'@quilla-fe-kit/api-client-react-query': minor
---

`createQueryClient` accepts `queryDefaults` — an app-wide cache/refetch policy (`staleTime`, `gcTime`, `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount`, `networkMode`) merged with the kit's retry policy. Omitting it keeps TanStack's defaults. The README documents the precedence order (global → `setQueryDefaults` per key family → per hook), `Infinity` vs `'static'` staleness, and how to change defaults at runtime with `setDefaultOptions` without dropping the retry policy.
