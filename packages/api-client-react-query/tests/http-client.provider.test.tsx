import type { HttpClient } from '@quilla-fe-kit/api-client';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HttpClientProvider, useHttpClient } from '../src/http-client.provider.js';

const fakeClient: HttpClient = {
  request: (async () => ({ status: 200, headers: {}, data: undefined })) as HttpClient['request'],
};

describe('HttpClientProvider + useHttpClient', () => {
  it('provides the configured HttpClient to descendants', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <HttpClientProvider client={fakeClient}>{children}</HttpClientProvider>
    );
    const { result } = renderHook(() => useHttpClient(), { wrapper });
    expect(result.current).toBe(fakeClient);
  });

  it('throws a clear error when no provider is in the tree', () => {
    expect(() => renderHook(() => useHttpClient())).toThrow(/HttpClientProvider/);
  });
});
