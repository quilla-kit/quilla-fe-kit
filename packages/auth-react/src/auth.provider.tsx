import type { TokenPair, TokenStorage } from '@quilla-fe-kit/auth';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context.js';
import { decodeJwtPayload } from './jwt.parser.js';
import type { Principal } from './principal.type.js';

export type ClaimsMapper<TClaims> = (claims: TClaims) => Principal | null;

export type AuthProviderProps<TClaims> = {
  readonly storage: TokenStorage;
  readonly fromClaims: ClaimsMapper<TClaims>;
  readonly children: ReactNode;
};

const tokenToPrincipal = <TClaims,>(
  token: string,
  fromClaims: ClaimsMapper<TClaims>,
): Principal | null => {
  const claims = decodeJwtPayload<TClaims>(token);
  return claims ? fromClaims(claims) : null;
};

export const AuthProvider = <TClaims,>({
  storage,
  fromClaims,
  children,
}: AuthProviderProps<TClaims>) => {
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
      const next = tokenToPrincipal(token, fromClaims);
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
  }, [storage, fromClaims]);

  const signIn = useCallback(
    async (tokens: TokenPair) => {
      const next = tokenToPrincipal(tokens.access, fromClaims);
      if (!next) {
        throw new Error('AuthProvider.signIn: access token failed to map into a Principal.');
      }
      await storage.setTokens(tokens);
      setPrincipal(next);
    },
    [storage, fromClaims],
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
