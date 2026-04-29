import type { ReactNode } from 'react';
import { useAuth } from './use-auth.hook.js';

export type RequireAuthProps = {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
  readonly scopes?: readonly string[];
  readonly forbiddenFallback?: ReactNode;
  readonly loadingFallback?: ReactNode;
};

export const RequireAuth = ({
  children,
  fallback,
  scopes,
  forbiddenFallback = null,
  loadingFallback = null,
}: RequireAuthProps): ReactNode => {
  const { isLoading, principal } = useAuth();

  if (isLoading) return loadingFallback;
  if (!principal) return fallback;

  if (scopes && scopes.length > 0) {
    const ok = scopes.some((s) => principal.scopes.includes(s));
    if (!ok) return forbiddenFallback;
  }

  return children;
};
