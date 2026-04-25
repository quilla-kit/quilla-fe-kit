export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type HttpHeaders = Record<string, string>;

export type HttpQueryParams = Record<string, unknown> | undefined;

export type HttpRequestBody =
  | undefined
  | null
  | string
  | Record<string, unknown>
  | unknown[]
  | ArrayBuffer
  | Uint8Array
  | Blob
  | FormData;

export type HttpRequest = {
  readonly url: string;
  readonly method?: HttpMethod;
  readonly params?: HttpQueryParams;
  readonly body?: HttpRequestBody;
  readonly headers?: HttpHeaders;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly disabledAuth?: boolean;
};

export type HttpResponse<T = unknown> = {
  readonly status: number;
  readonly headers: HttpHeaders;
  readonly data: T;
};
