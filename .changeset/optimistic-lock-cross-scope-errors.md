---
"@quilla-fe-kit/errors": minor
"@quilla-fe-kit/api-client": minor
---

Add `OptimisticLockError` and `CrossScopeAccessError`, mirroring the domain-specific error subtypes `@quilla-be-kit/persistence` throws on the backend (`OptimisticLockError extends ConflictError`, `CrossScopeAccessError extends NotFoundError`).

Previously `EnvelopeHttpErrorParser.fromResponse` only dispatched on the generic HTTP-semantic error names (`ConflictError`, `NotFoundError`, etc.). When a backend error's wire `name` was a more specific subtype the parser didn't know about, the lookup missed and fell through to the generic status-based class — losing the distinction entirely, with no trace of the original wire name left on the resulting error. Registering both classes in `NAME_DISPATCH` lets consumers write precise checks like `err instanceof OptimisticLockError` instead of matching on message text or guessing from the error's `context` shape.
