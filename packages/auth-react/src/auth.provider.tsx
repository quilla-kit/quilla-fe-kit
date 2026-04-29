import type { TokenPair, TokenStorage } from '@quilla-fe-kit/auth';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context.js';
import { type ClaimsParser, defaultClaimsParser } from './jwt.parser.js';
import type { Principal } from './principal.type.js';

export type AuthProviderProps = {
  readonly storage: TokenStorage;
  readonly children: ReactNode;
  readonly parseClaims?: ClaimsParser;
};

export const AuthProvider = ({
  storage,
  children,
  parseClaims = defaultClaimsParser,
}: AuthProviderProps) => {
  const [principal, setPrincipal] = useState<Principal | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await storage.getAccessToken();
      if (cancelled) return;
      if (!token) {
        setIsLoading(false);
        return;
      }
      const next = parseClaims(token);
      if (!next) {
        await storage.clear();
        if (cancelled) return;
        setIsLoading(false);
        return;
      }
      setPrincipal(next);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storage, parseClaims]);

  const signIn = useCallback(
    async (tokens: TokenPair) => {
      const next = parseClaims(tokens.access);
      if (!next) {
        throw new Error('AuthProvider.signIn: access token failed to parse into a Principal.');
      }
      await storage.setTokens(tokens);
      setPrincipal(next);
    },
    [storage, parseClaims],
  );

  const signOut = useCallback(async () => {
    await storage.clear();
    setPrincipal(undefined);
  }, [storage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      principal,
      isAuthenticated: principal !== undefined,
      isLoading,
      signIn,
      signOut,
    }),
    [principal, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
