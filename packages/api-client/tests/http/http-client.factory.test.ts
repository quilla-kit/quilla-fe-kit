import { describe, expect, it } from 'vitest';
import { AuthenticatedHttpClient } from '../../src/http/authenticated.client.js';
import { FetchHttpClient } from '../../src/http/fetch.client.js';
import { createHttpClient } from '../../src/http/http-client.factory.js';
import { RepeatParamsSerializer } from '../../src/http/repeat-params.serializer.js';
import { fakeResponse, stubFetch } from '../helpers/fake-fetch.helper.js';

describe('createHttpClient', () => {
  it('returns a FetchHttpClient when no refreshEndpoint is provided', () => {
    const fetchStub = stubFetch(() => fakeResponse({ body: {} }));
    const client = createHttpClient({ baseUrl: 'https://api', fetchImpl: fetchStub.impl });
    expect(client).toBeInstanceOf(FetchHttpClient);
  });

  it('returns an AuthenticatedHttpClient when refreshEndpoint is provided', () => {
    const fetchStub = stubFetch(() => fakeResponse({ body: {} }));
    const client = createHttpClient({
      baseUrl: 'https://api',
      fetchImpl: fetchStub.impl,
      refreshEndpoint: async () => ({ access: 'A', refresh: 'R' }),
    });
    expect(client).toBeInstanceOf(AuthenticatedHttpClient);
  });

  it('serializes query string with default conventions', async () => {
    const fetchStub = stubFetch(() => fakeResponse({ body: {} }));
    const client = createHttpClient({ baseUrl: 'https://api', fetchImpl: fetchStub.impl });
    await client.request({
      url: '/users',
      params: { search: { name: 'foo' }, page: 1, limit: 20 },
    });
    expect(fetchStub.calls[0]?.url).toBe(
      'https://api/users?name__contains=foo&page=1&pageSize=20',
    );
  });

  it('accepts a partial QueryConventions config and applies it', async () => {
    const fetchStub = stubFetch(() => fakeResponse({ body: {} }));
    const client = createHttpClient({
      baseUrl: 'https://api',
      fetchImpl: fetchStub.impl,
      querySerializer: { searchSuffix: '_like' },
    });
    await client.request({ url: '/u', params: { search: { name: 'foo' } } });
    expect(fetchStub.calls[0]?.url).toBe('https://api/u?name_like=foo');
  });

  it('accepts a full QueryStringSerializer instance', async () => {
    const fetchStub = stubFetch(() => fakeResponse({ body: {} }));
    const custom = new RepeatParamsSerializer({
      paginationKeys: { page: 'p', limit: 'sz', sort: 'o' },
    });
    const client = createHttpClient({
      baseUrl: 'https://api',
      fetchImpl: fetchStub.impl,
      querySerializer: custom,
    });
    await client.request({ url: '/u', params: { page: 5, limit: 10 } });
    expect(fetchStub.calls[0]?.url).toBe('https://api/u?p=5&sz=10');
  });
});
