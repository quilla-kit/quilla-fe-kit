import { memoryTokenStorage } from '@quilla-fe-kit/auth';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/auth.provider.js';
import { RequireAuth } from '../src/require-auth.guard.js';
import { makeJwt } from './helpers/make-jwt.js';
import { quillaFromClaims } from './helpers/quilla-from-claims.js';

const renderWithToken = async (token: string | null, ui: React.ReactNode) => {
  const storage = memoryTokenStorage();
  if (token) await storage.setTokens({ access: token, refresh: 'r' });
  return render(
    <AuthProvider storage={storage} fromClaims={quillaFromClaims}>
      {ui}
    </AuthProvider>,
  );
};

describe('<RequireAuth>', () => {
  afterEach(cleanup);

  it('renders fallback when unauthenticated', async () => {
    await renderWithToken(
      null,
      <RequireAuth fallback={<span>login</span>}>
        <span>secret</span>
      </RequireAuth>,
    );
    await waitFor(() => expect(screen.getByText('login')).toBeDefined());
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('renders children when authenticated and no scopes required', async () => {
    const token = makeJwt({ u: 'u', si: 'si', s: ['anything'] });
    await renderWithToken(
      token,
      <RequireAuth fallback={<span>login</span>}>
        <span>secret</span>
      </RequireAuth>,
    );
    await waitFor(() => expect(screen.getByText('secret')).toBeDefined());
  });

  it('renders forbiddenFallback when authenticated but missing required scope', async () => {
    const token = makeJwt({ u: 'u', si: 'si', s: ['viewer'] });
    await renderWithToken(
      token,
      <RequireAuth
        fallback={<span>login</span>}
        forbiddenFallback={<span>forbidden</span>}
        scopes={['admin']}
      >
        <span>secret</span>
      </RequireAuth>,
    );
    await waitFor(() => expect(screen.getByText('forbidden')).toBeDefined());
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('uses any-of (some) semantics on the scopes prop', async () => {
    const token = makeJwt({ u: 'u', si: 'si', s: ['auditor'] });
    await renderWithToken(
      token,
      <RequireAuth fallback={<span>login</span>} scopes={['admin', 'auditor']}>
        <span>secret</span>
      </RequireAuth>,
    );
    await waitFor(() => expect(screen.getByText('secret')).toBeDefined());
  });

  it('renders loadingFallback while hydrating', async () => {
    const storage = memoryTokenStorage();
    const token = makeJwt({ u: 'u', si: 'si', s: [] });
    await storage.setTokens({ access: token, refresh: 'r' });
    render(
      <AuthProvider storage={storage} fromClaims={quillaFromClaims}>
        <RequireAuth fallback={<span>login</span>} loadingFallback={<span>loading</span>}>
          <span>secret</span>
        </RequireAuth>
      </AuthProvider>,
    );
    expect(screen.getByText('loading')).toBeDefined();
    await waitFor(() => expect(screen.getByText('secret')).toBeDefined());
  });
});
