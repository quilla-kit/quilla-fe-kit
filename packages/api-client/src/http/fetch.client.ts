import type { HttpClient } from './http-client.interface.js';
import type { HttpErrorParser } from './http-error-parser.interface.js';
import type {
  HttpHeaders,
  HttpRequest,
  HttpRequestBody,
  HttpResponse,
} from './http-types.type.js';
import type { QueryStringSerializer } from './query-string-serializer.interface.js';

export type FetchHttpClientDeps = {
  readonly baseUrl: string;
  readonly querySerializer: QueryStringSerializer;
  readonly errorParser: HttpErrorParser;
  readonly fetchImpl?: typeof fetch;
};

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly querySerializer: QueryStringSerializer;
  private readonly errorParser: HttpErrorParser;
  private readonly fetchImpl: typeof fetch;

  constructor(deps: FetchHttpClientDeps) {
    this.baseUrl = deps.baseUrl;
    this.querySerializer = deps.querySerializer;
    this.errorParser = deps.errorParser;
    this.fetchImpl = deps.fetchImpl ?? this.resolveGlobalFetch();
  }

  async request<T = unknown>(config: HttpRequest): Promise<HttpResponse<T>> {
    const method = (config.method ?? 'GET').toUpperCase();
    const url = this.buildUrl(config.url, config.params);
    const { body, headers } = this.prepareBody(config.body, config.headers);
    const signal = this.composeSignal(config.signal, config.timeoutMs);

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = body;
    if (signal !== undefined) init.signal = signal;

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      throw this.errorParser.fromTransportError(error);
    }

    const responseHeaders = this.readHeaders(response.headers);
    const parsedBody = await this.parseBody(response);

    if (!response.ok) {
      throw this.errorParser.fromResponse(response.status, response.statusText, parsedBody, url);
    }

    return {
      status: response.status,
      headers: responseHeaders,
      data: parsedBody as T,
    };
  }

  private resolveGlobalFetch(): typeof fetch {
    const candidate = (globalThis as { fetch?: typeof fetch }).fetch;
    if (!candidate) {
      throw new Error(
        'FetchHttpClient requires globalThis.fetch. ' +
          'Use Node 20+, a modern browser, or pass an explicit fetchImpl.',
      );
    }
    return candidate.bind(globalThis);
  }

  private buildUrl(path: string, params: HttpRequest['params']): string {
    const isAbsolute = /^https?:\/\//i.test(path);
    const base = isAbsolute ? path : `${this.baseUrl}${path}`;
    const query = this.querySerializer.serialize(params);
    if (!query) return base;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}${query}`;
  }

  private prepareBody(
    body: HttpRequestBody,
    headers: HttpHeaders | undefined,
  ): { body: BodyInit | undefined; headers: HttpHeaders } {
    const finalHeaders: HttpHeaders = { ...(headers ?? {}) };

    if (body === undefined || body === null) {
      return { body: undefined, headers: finalHeaders };
    }

    if (
      body instanceof ArrayBuffer ||
      body instanceof Blob ||
      body instanceof FormData ||
      body instanceof Uint8Array ||
      typeof body === 'string'
    ) {
      return { body: body as BodyInit, headers: finalHeaders };
    }

    if (!this.hasHeader(finalHeaders, 'content-type')) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    return { body: JSON.stringify(body), headers: finalHeaders };
  }

  private composeSignal(
    userSignal: AbortSignal | undefined,
    timeoutMs: number | undefined,
  ): AbortSignal | undefined {
    const signals: AbortSignal[] = [];
    if (userSignal) signals.push(userSignal);
    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      signals.push(AbortSignal.timeout(timeoutMs));
    }
    if (signals.length === 0) return undefined;
    if (signals.length === 1) return signals[0];
    return AbortSignal.any(signals);
  }

  private readHeaders(source: Headers): HttpHeaders {
    const result: HttpHeaders = {};
    source.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }

  private async parseBody(response: Response): Promise<unknown> {
    if (response.status === 204 || response.status === 205) return undefined;

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const text = await response.text();
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    const text = await response.text();
    return text.length > 0 ? text : undefined;
  }

  private hasHeader(headers: HttpHeaders, name: string): boolean {
    const lower = name.toLowerCase();
    return Object.keys(headers).some((key) => key.toLowerCase() === lower);
  }
}
