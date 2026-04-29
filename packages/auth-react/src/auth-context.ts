import type { TokenPair } from '@quilla-fe-kit/auth';
import { createContext } from 'react';
import type { Principal } from './principal.type.js';

export type AuthContextValue = {
  readonly principal: Principal | undefined;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly signIn: (tokens: TokenPair) => Promise<void>;
  readonly signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
