import { useAuth } from './use-auth.hook.js';

export type HasScopeMode = 'every' | 'some';

export const useHasScope = (scopes: readonly string[], mode: HasScopeMode = 'every'): boolean => {
  const { principal } = useAuth();
  if (!principal || scopes.length === 0) return false;
  const owned = principal.scopes;
  return mode === 'every'
    ? scopes.every((s) => owned.includes(s))
    : scopes.some((s) => owned.includes(s));
};
