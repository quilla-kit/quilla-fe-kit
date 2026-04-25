import { UnauthorizedError } from '@quilla-fe-kit/errors';
import type { TokenPair, TokenStorage } from '@quilla-fe-kit/storage';

export type RefreshEndpoint = (refreshToken: string) => Promise<TokenPair>;

export type SingleFlightTokenRefresherDeps = {
  readonly storage: TokenStorage;
  readonly refreshEndpoint: RefreshEndpoint;
};

export interface TokenRefresher {
  refresh(): Promise<string>;
}

export class SingleFlightTokenRefresher implements TokenRefresher {
  private inFlight: Promise<string> | null = null;

  constructor(private readonly deps: SingleFlightTokenRefresherDeps) {}

  refresh(): Promise<string> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.runRefresh().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async runRefresh(): Promise<string> {
    const refreshToken = await this.deps.storage.getRefreshToken();
    if (!refreshToken) {
      await this.deps.storage.clear();
      throw new UnauthorizedError({
        message: 'No refresh token available',
        httpStatus: 401,
      });
    }

    try {
      const next = await this.deps.refreshEndpoint(refreshToken);
      await this.deps.storage.setTokens(next);
      return next.access;
    } catch (error) {
      await this.deps.storage.clear();
      throw error;
    }
  }
}
