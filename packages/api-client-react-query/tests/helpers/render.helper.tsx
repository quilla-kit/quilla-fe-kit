import type { HttpClient, HttpRequest, HttpResponse } from '@quilla-fe-kit/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, type RenderHookOptions, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HttpClientProvider } from '../../src/http-client.provider.js';

type AnyHttpResponse = HttpResponse<unknown>;
type Responder = (config: HttpRequest) => AnyHttpResponse | Promise<AnyHttpResponse>;

export const createFakeHttpClient = (responder: Responder) => {
  const calls: HttpRequest[] = [];
  const client: HttpClient = {
    request: (async (config: HttpRequest) => {
      calls.push(config);
      return responder(config);
    }) as HttpClient['request'],
  };
  return { client, calls };
};

export const newQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

export type WrapperParams = {
  readonly httpClient: HttpClient;
  readonly queryClient?: QueryClient;
};

export const buildWrapper = ({ httpClient, queryClient }: WrapperParams) => {
  const qc = queryClient ?? newQueryClient();
  return {
    queryClient: qc,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <HttpClientProvider client={httpClient}>{children}</HttpClientProvider>
      </QueryClientProvider>
    ),
  };
};

export const renderHookWithProviders = <Result, Props>(
  hook: (props: Props) => Result,
  params: WrapperParams,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'>,
): RenderHookResult<Result, Props> & { queryClient: QueryClient } => {
  const { queryClient, Wrapper } = buildWrapper(params);
  return Object.assign(renderHook(hook, { wrapper: Wrapper, ...(options ?? {}) }), {
    queryClient,
  });
};
