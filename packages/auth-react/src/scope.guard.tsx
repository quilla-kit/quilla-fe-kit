import type { ReactNode } from 'react';
import { type HasScopeMode, useHasScope } from './use-has-scope.hook.js';

export type ScopeGuardProps = {
  readonly scopes: readonly string[];
  readonly mode?: HasScopeMode;
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
};

export const ScopeGuard = ({
  scopes,
  mode = 'every',
  children,
  fallback = null,
}: ScopeGuardProps): ReactNode => {
  return useHasScope(scopes, mode) ? children : fallback;
};
