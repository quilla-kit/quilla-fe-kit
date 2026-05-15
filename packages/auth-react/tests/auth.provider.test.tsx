import { memoryTokenStorage } from '@quilla-fe-kit/auth';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/auth.provider.js';
import { useAuth } from '../src/use-auth.hook.js';
import { makeJwt } from './helpers/make-jwt.js';
import { type QuillaTokenClaims, quillaFromClaims } from './helpers/quilla-from-claims.js';

const wrap = (storage = memoryTokenStorage()) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider storage={storage} fromClaims={quillaFromClaims}>
      {children}
    </AuthProvider>
  );
  return { wrapper, storage };
};

describe('AuthProvider', () => {
  it('useAuth throws when no provider is in the tree', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });

  it('starts unauthenticated when storage is empty', async () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.principal).toBeUndefined();
  });

  it('hydrates principal from a valid stored token via fromClaims', async () => {
    const storage = memoryTokenStorage();
    const token = makeJwt({ u: 'user-1', si: 'scope-1', s: ['admin'] });
    await storage.setTokens({ access: token, refresh: 'r' });

    const { wrapper } = wrap(storage);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.principal).toEqual({
      userId: 'user-1',
      scopeId: 'scope-1',
      scopes: ['admin'],
    });
  });

  it('clears storage when stored token fails to decode', async () => {
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'garbage', refresh: 'r' });

    const { wrapper } = wrap(storage);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(await storage.getAccessToken()).toBeNull();
  });

  it('clears storage when fromClaims returns null', async () => {
    const storage = memoryTokenStorage();
    const token = makeJwt({ si: 'scope-only' });
    await storage.setTokens({ access: token, refresh: 'r' });

    const { wrapper } = wrap(storage);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(await storage.getAccessToken()).toBeNull();
  });

  it('signIn maps + persists tokens, signOut clears state and storage', async () => {
    const { wrapper, storage } = wrap();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const token = makeJwt({ u: 'user-2', si: 'scope-2', s: ['viewer'] });
    await act(async () => {
      await result.current.signIn({ access: token, refresh: 'r' });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.principal?.userId).toBe('user-2');
    expect(await storage.getAccessToken()).toBe(token);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.principal).toBeUndefined();
    expect(await storage.getAccessToken()).toBeNull();
  });

  it('signIn throws when token cannot be mapped', async () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn({ access: 'garbage', refresh: 'r' });
      }),
    ).rejects.toThrow(/Principal/);
  });

  it('honors a custom fromClaims for a non-quilla claim shape', async () => {
    type AltClaims = { sub: string; org: string; perms: string[] };
    const storage = memoryTokenStorage();
    const token = makeJwt({ sub: 'alt-user', org: 'alt-scope', perms: ['x'] });
    await storage.setTokens({ access: token, refresh: 'r' });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider
        storage={storage}
        fromClaims={(c: AltClaims) => ({
          userId: c.sub,
          scopeId: c.org,
          scopes: c.perms,
        })}
      >
        {children}
      </AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.principal).toEqual({
      userId: 'alt-user',
      scopeId: 'alt-scope',
      scopes: ['x'],
    });
  });

  it('quillaFromClaims defaults scopes to [] when claim `s` is missing', () => {
    const claims: QuillaTokenClaims = { u: 'u', si: 'si' };
    expect(quillaFromClaims(claims)).toEqual({
      userId: 'u',
      scopeId: 'si',
      scopes: [],
    });
  });

  it('quillaFromClaims returns null when required fields are missing', () => {
    expect(quillaFromClaims({ si: 'si' } as unknown as QuillaTokenClaims)).toBeNull();
    expect(quillaFromClaims({ u: 'u' } as unknown as QuillaTokenClaims)).toBeNull();
  });
});
