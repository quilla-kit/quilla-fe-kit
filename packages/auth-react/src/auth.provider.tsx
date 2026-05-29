import { type TokenPair, type TokenStorage, decodeJwtPayload } from '@quilla-fe-kit/auth';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context.js';
import type { Principal } from './principal.type.js';

export type ClaimsMapper<TClaims> = (claims: TClaims) => Principal | null;

export type TokenDecoder<TClaims> = (token: string) => TClaims | null;

export type AuthProviderProps<TClaims> = {
  readonly storage: TokenStorage;
  readonly fromClaims: ClaimsMapper<TClaims>;
  readonly decodeToken?: TokenDecoder<TClaims> | undefined;
  readonly children: ReactNode;
};

function defaultDecodeToken<TClaims>(token: string): TClaims | null {
  const claims = decodeJwtPayload<{ exp?: number; nbf?: number }>(token);
  if (!claims || typeof claims.exp !== 'number') return null;
  const now = Math.floor(Date.now() / 1000);
  if (now > claims.exp || (typeof claims.nbf === 'number' && now < claims.nbf)) return null;
  return claims as unknown as TClaims;
}

const tokenToPrincipal = <TClaims,>(
  token: string,
  decode: TokenDecoder<TClaims>,
  fromClaims: ClaimsMapper<TClaims>,
): Principal | null => {
  const claims = decode(token);
  return claims ? fromClaims(claims) : null;
};

export const AuthProvider = <TClaims,>({
  storage,
  fromClaims,
  decodeToken,
  children,
}: AuthProviderProps<TClaims>) => {
  const [principal, setPrincipal] = useState<Principal | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const decode = useMemo(
    (): TokenDecoder<TClaims> => decodeToken ?? defaultDecodeToken,
    [decodeToken],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await storage.getAccessToken();
      if (cancelled) return;
      if (!token) {
        setIsLoading(false);
        return;
      }
      const next = tokenToPrincipal(token, decode, fromClaims);
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
  }, [storage, fromClaims, decode]);

  const signIn = useCallback(
    async (tokens: TokenPair) => {
      const next = tokenToPrincipal(tokens.access, decode, fromClaims);
      if (!next) {
        throw new Error('AuthProvider.signIn: access token failed to map into a Principal.');
      }
      await storage.setTokens(tokens);
      setPrincipal(next);
    },
    [storage, fromClaims, decode],
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
