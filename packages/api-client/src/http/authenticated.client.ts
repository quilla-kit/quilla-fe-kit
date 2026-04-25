import { UnauthorizedError } from '@quilla-fe-kit/errors';
import type { TokenStorage } from '@quilla-fe-kit/storage';
import type { HttpClient } from './http-client.interface.js';
import type { HttpHeaders, HttpRequest, HttpResponse } from './http-types.type.js';
import type { TokenRefresher } from './single-flight-token.refresher.js';

export type AuthenticatedHttpClientDeps = {
  readonly inner: HttpClient;
  readonly storage: TokenStorage;
  readonly tokenRefresher: TokenRefresher;
};

export class AuthenticatedHttpClient implements HttpClient {
  constructor(private readonly deps: AuthenticatedHttpClientDeps) {}

  async request<T = unknown>(config: HttpRequest): Promise<HttpResponse<T>> {
    if (config.disabledAuth) {
      return this.deps.inner.request<T>(config);
    }

    const accessToken = await this.deps.storage.getAccessToken();
    const withAuth = applyBearerToken(config, accessToken);

    try {
      return await this.deps.inner.request<T>(withAuth);
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;

      const newAccessToken = await this.deps.tokenRefresher.refresh();
      return this.deps.inner.request<T>(applyBearerToken(config, newAccessToken));
    }
  }
}

const applyBearerToken = (config: HttpRequest, token: string | null): HttpRequest => {
  if (!token) return config;
  const headers: HttpHeaders = { ...(config.headers ?? {}), Authorization: `Bearer ${token}` };
  return { ...config, headers };
};
