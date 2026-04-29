import { memoryTokenStorage } from '@quilla-fe-kit/auth';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/auth.provider.js';
import { useHasScope } from '../src/use-has-scope.hook.js';
import { makeJwt } from './helpers/make-jwt.js';

const wrapWithScopes = async (scopes: string[]) => {
  const storage = memoryTokenStorage();
  const token = makeJwt({ u: 'u', si: 'si', s: scopes });
  await storage.setTokens({ access: token, refresh: 'r' });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider storage={storage}>{children}</AuthProvider>
  );
  return wrapper;
};

describe('useHasScope', () => {
  it('returns false when no principal is loaded yet', async () => {
    const storage = memoryTokenStorage();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider storage={storage}>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useHasScope(['admin']), { wrapper });
    expect(result.current).toBe(false);
  });

  it('returns false when scopes list is empty', async () => {
    const wrapper = await wrapWithScopes(['admin']);
    const { result } = renderHook(() => useHasScope([]), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('every-mode (default): true only when all scopes are held', async () => {
    const wrapper = await wrapWithScopes(['a', 'b']);
    const { result: r1 } = renderHook(() => useHasScope(['a', 'b']), { wrapper });
    await waitFor(() => expect(r1.current).toBe(true));

    const { result: r2 } = renderHook(() => useHasScope(['a', 'c']), { wrapper });
    await waitFor(() => expect(r2.current).toBe(false));
  });

  it('some-mode: true when at least one scope is held', async () => {
    const wrapper = await wrapWithScopes(['a']);
    const { result: r1 } = renderHook(() => useHasScope(['a', 'b'], 'some'), { wrapper });
    await waitFor(() => expect(r1.current).toBe(true));

    const { result: r2 } = renderHook(() => useHasScope(['x', 'y'], 'some'), { wrapper });
    await waitFor(() => expect(r2.current).toBe(false));
  });
});
