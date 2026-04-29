import { memoryTokenStorage } from '@quilla-fe-kit/auth';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/auth.provider.js';
import { useAuth } from '../src/use-auth.hook.js';
import { makeJwt } from './helpers/make-jwt.js';

const wrap = (storage = memoryTokenStorage()) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider storage={storage}>{children}</AuthProvider>
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

  it('hydrates principal from a valid stored token', async () => {
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

  it('clears storage when stored token fails to parse', async () => {
    const storage = memoryTokenStorage();
    await storage.setTokens({ access: 'garbage', refresh: 'r' });

    const { wrapper } = wrap(storage);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(await storage.getAccessToken()).toBeNull();
  });

  it('signIn parses + persists tokens, signOut clears state and storage', async () => {
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

  it('signIn throws when access token cannot be parsed', async () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn({ access: 'garbage', refresh: 'r' });
      }),
    ).rejects.toThrow(/Principal/);
  });

  it('honors a custom parseClaims override', async () => {
    const storage = memoryTokenStorage();
    const token = makeJwt({ sub: 'alt-user', org: 'alt-scope', perms: ['x'] });
    await storage.setTokens({ access: token, refresh: 'r' });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider
        storage={storage}
        parseClaims={(t) => {
          const p = JSON.parse(Buffer.from(t.split('.')[1] ?? '', 'base64').toString('utf8')) as {
            sub: string;
            org: string;
            perms: string[];
          };
          return { userId: p.sub, scopeId: p.org, scopes: p.perms };
        }}
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
});
