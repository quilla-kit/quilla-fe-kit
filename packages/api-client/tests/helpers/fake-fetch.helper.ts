import { vi } from 'vitest';

export type FakeFetchCall = {
  readonly url: string;
  readonly init: RequestInit;
};

export type FakeResponseInit = {
  readonly status?: number;
  readonly statusText?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
};

export const fakeResponse = (init: FakeResponseInit = {}): Response => {
  const status = init.status ?? 200;
  const statusText = init.statusText ?? 'OK';
  const headers = new Headers(init.headers ?? {});

  let bodyText: string | null = null;
  if (init.body !== undefined) {
    if (typeof init.body === 'string') {
      bodyText = init.body;
    } else {
      bodyText = JSON.stringify(init.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
  }

  return new Response(bodyText, { status, statusText, headers });
};

export const stubFetch = (
  responder: (url: string, init: RequestInit) => Response | Promise<Response> | never,
) => {
  const calls: FakeFetchCall[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return responder(url, init);
  });
  return { impl: impl as unknown as typeof fetch, calls };
};
