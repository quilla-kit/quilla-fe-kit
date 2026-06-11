import { describe, expect, it } from 'vitest';
import { ConflictError, NetworkError, ValidationError } from '@quilla-fe-kit/errors';
import { EnvelopeHttpErrorParser } from '../../src/http/envelope.parser.js';
import { FetchHttpClient } from '../../src/http/fetch.client.js';
import { RepeatParamsSerializer } from '../../src/http/repeat-params.serializer.js';
import { fakeResponse, stubFetch } from '../helpers/fake-fetch.helper.js';

const buildClient = (responder: Parameters<typeof stubFetch>[0]) => {
  const fetchStub = stubFetch(responder);
  const client = new FetchHttpClient({
    baseUrl: 'https://api.example.com',
    querySerializer: new RepeatParamsSerializer(),
    errorParser: new EnvelopeHttpErrorParser(),
    fetchImpl: fetchStub.impl,
  });
  return { client, fetchStub };
};

describe('FetchHttpClient — URL composition', () => {
  it('joins relative path with baseUrl', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/users' });
    expect(fetchStub.calls[0]?.url).toBe('https://api.example.com/users');
  });

  it('uses absolute path as-is, ignoring baseUrl', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: 'https://other.example/x' });
    expect(fetchStub.calls[0]?.url).toBe('https://other.example/x');
  });

  it('appends query string with ? when none exists', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/users', params: { page: 2 } });
    expect(fetchStub.calls[0]?.url).toBe('https://api.example.com/users?page=2');
  });

  it('appends query string with & when ? already exists', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/users?ref=abc', params: { page: 2 } });
    expect(fetchStub.calls[0]?.url).toBe('https://api.example.com/users?ref=abc&page=2');
  });
});

describe('FetchHttpClient — body + headers', () => {
  it('JSON-stringifies plain objects and sets Content-Type', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/x', method: 'POST', body: { a: 1 } });
    const init = fetchStub.calls[0]?.init;
    expect(init?.body).toBe('{"a":1}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('does not override an existing Content-Type', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({
      url: '/x',
      method: 'POST',
      body: { a: 1 },
      headers: { 'Content-Type': 'application/vnd.custom+json' },
    });
    const init = fetchStub.calls[0]?.init;
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/vnd.custom+json',
    );
  });

  it('passes FormData through without setting Content-Type', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    const fd = new FormData();
    fd.append('file', 'x');
    await client.request({ url: '/upload', method: 'POST', body: fd });
    const init = fetchStub.calls[0]?.init;
    expect(init?.body).toBe(fd);
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('passes string bodies through unchanged', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/x', method: 'POST', body: 'raw' });
    expect(fetchStub.calls[0]?.init.body).toBe('raw');
  });

  it('omits body for null/undefined', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/x', method: 'POST', body: null });
    expect(fetchStub.calls[0]?.init.body).toBeUndefined();
  });
});

describe('FetchHttpClient — response parsing', () => {
  it('parses JSON when content-type is application/json', async () => {
    const { client } = buildClient(() => fakeResponse({ body: { hello: 'world' } }));
    const res = await client.request<{ hello: string }>({ url: '/x' });
    expect(res.data).toEqual({ hello: 'world' });
  });

  it('returns text when content-type is not JSON', async () => {
    const { client } = buildClient(() =>
      fakeResponse({ body: 'plain text', headers: { 'content-type': 'text/plain' } }),
    );
    const res = await client.request<string>({ url: '/x' });
    expect(res.data).toBe('plain text');
  });

  it('returns undefined data on 204 No Content', async () => {
    const { client } = buildClient(() => fakeResponse({ status: 204, statusText: 'No Content' }));
    const res = await client.request({ url: '/x' });
    expect(res.data).toBeUndefined();
  });

  it('exposes response headers as a flat record', async () => {
    const { client } = buildClient(() =>
      fakeResponse({ headers: { etag: '"7"' }, body: {} }),
    );
    const res = await client.request({ url: '/x' });
    expect(res.headers.etag).toBe('"7"');
  });
});

describe('FetchHttpClient — responseType', () => {
  it('returns a Blob when responseType is blob', async () => {
    const { client } = buildClient(() =>
      fakeResponse({ body: 'PKzip', headers: { 'content-type': 'application/zip' } }),
    );
    const res = await client.request<Blob>({ url: '/export.zip', responseType: 'blob' });
    expect(res.data).toBeInstanceOf(Blob);
    expect(await res.data.text()).toBe('PKzip');
  });

  it('returns an ArrayBuffer when responseType is arrayBuffer', async () => {
    const { client } = buildClient(() =>
      fakeResponse({ body: 'bytes', headers: { 'content-type': 'application/octet-stream' } }),
    );
    const res = await client.request<ArrayBuffer>({ url: '/x', responseType: 'arrayBuffer' });
    expect(res.data).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(res.data)).toBe('bytes');
  });

  it('returns the raw ReadableStream when responseType is stream', async () => {
    const { client } = buildClient(() =>
      fakeResponse({ body: 'chunk', headers: { 'content-type': 'application/octet-stream' } }),
    );
    const res = await client.request<ReadableStream<Uint8Array>>({
      url: '/x',
      responseType: 'stream',
    });
    expect(typeof res.data.getReader).toBe('function');
  });

  it('returns text even for JSON content-type when responseType is text', async () => {
    const { client } = buildClient(() => fakeResponse({ body: { a: 1 } }));
    const res = await client.request<string>({ url: '/x', responseType: 'text' });
    expect(res.data).toBe('{"a":1}');
  });

  it('parses JSON regardless of content-type when responseType is json', async () => {
    const { client } = buildClient(() =>
      fakeResponse({ body: '{"x":1}', headers: { 'content-type': 'text/plain' } }),
    );
    const res = await client.request<{ x: number }>({ url: '/x', responseType: 'json' });
    expect(res.data).toEqual({ x: 1 });
  });

  it('still parses the error envelope (not the blob) on a failing binary request', async () => {
    const { client } = buildClient(() =>
      fakeResponse({
        status: 404,
        statusText: 'Not Found',
        body: { error: { name: 'NotFoundError', message: 'gone' } },
      }),
    );
    await expect(
      client.request<Blob>({ url: '/export.zip', responseType: 'blob' }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});

describe('FetchHttpClient — error handling', () => {
  it('rejects with the parser-mapped error for 4xx/5xx', async () => {
    const { client } = buildClient(() =>
      fakeResponse({
        status: 412,
        statusText: 'Precondition Failed',
        body: { error: { name: 'ConflictError', message: 'version mismatch' } },
      }),
    );
    await expect(client.request({ url: '/x', method: 'PUT' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('preserves envelope name dispatch (BusinessRuleError on a 422)', async () => {
    const { client } = buildClient(() =>
      fakeResponse({
        status: 422,
        body: { error: { name: 'BusinessRuleError', message: 'rule failed' } },
      }),
    );
    await expect(client.request({ url: '/x' })).rejects.toMatchObject({
      name: 'BusinessRuleError',
    });
  });

  it('rejects with ValidationError on a 422 without name', async () => {
    const { client } = buildClient(() =>
      fakeResponse({ status: 422, statusText: 'Unprocessable', body: {} }),
    );
    await expect(client.request({ url: '/x' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('routes transport failures through fromTransportError', async () => {
    const { client } = buildClient(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(client.request({ url: '/x' })).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('FetchHttpClient — signal + timeout', () => {
  it('passes the user-provided signal through', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    const ctrl = new AbortController();
    await client.request({ url: '/x', signal: ctrl.signal });
    expect(fetchStub.calls[0]?.init.signal).toBe(ctrl.signal);
  });

  it('attaches a timeout-derived signal when timeoutMs is set', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/x', timeoutMs: 50 });
    expect(fetchStub.calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits the signal when neither is provided', async () => {
    const { client, fetchStub } = buildClient(() => fakeResponse({ body: {} }));
    await client.request({ url: '/x' });
    expect(fetchStub.calls[0]?.init.signal).toBeUndefined();
  });
});
