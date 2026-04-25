import type { HttpClient } from '@quilla-fe-kit/api-client';
import { createContext, type ReactNode, useContext } from 'react';

const HttpClientContext = createContext<HttpClient | null>(null);

export type HttpClientProviderProps = {
  readonly client: HttpClient;
  readonly children: ReactNode;
};

export const HttpClientProvider = ({ client, children }: HttpClientProviderProps) => {
  return <HttpClientContext.Provider value={client}>{children}</HttpClientContext.Provider>;
};

export const useHttpClient = (): HttpClient => {
  const client = useContext(HttpClientContext);
  if (!client) {
    throw new Error(
      'useHttpClient: no HttpClient in context. ' +
        'Wrap your tree in <HttpClientProvider client={createHttpClient(...)}>.',
    );
  }
  return client;
};
