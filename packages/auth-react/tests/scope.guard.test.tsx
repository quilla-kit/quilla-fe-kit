import { memoryTokenStorage } from '@quilla-fe-kit/auth';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/auth.provider.js';
import { ScopeGuard } from '../src/scope.guard.js';
import { makeJwt } from './helpers/make-jwt.js';

const renderWithScopes = async (scopes: string[], ui: React.ReactNode) => {
  const storage = memoryTokenStorage();
  const token = makeJwt({ u: 'u', si: 'si', s: scopes });
  await storage.setTokens({ access: token, refresh: 'r' });
  return render(<AuthProvider storage={storage}>{ui}</AuthProvider>);
};

describe('<ScopeGuard>', () => {
  afterEach(cleanup);

  it('renders children when user holds all required scopes (every mode)', async () => {
    await renderWithScopes(
      ['a', 'b'],
      <ScopeGuard scopes={['a', 'b']}>
        <span>ok</span>
      </ScopeGuard>,
    );
    await waitFor(() => expect(screen.getByText('ok')).toBeDefined());
  });

  it('renders fallback when missing a required scope (every mode)', async () => {
    await renderWithScopes(
      ['a'],
      <ScopeGuard scopes={['a', 'b']} fallback={<span>nope</span>}>
        <span>ok</span>
      </ScopeGuard>,
    );
    await waitFor(() => expect(screen.getByText('nope')).toBeDefined());
    expect(screen.queryByText('ok')).toBeNull();
  });

  it('some-mode renders children when at least one scope is held', async () => {
    await renderWithScopes(
      ['a'],
      <ScopeGuard scopes={['a', 'b']} mode="some">
        <span>ok</span>
      </ScopeGuard>,
    );
    await waitFor(() => expect(screen.getByText('ok')).toBeDefined());
  });
});
