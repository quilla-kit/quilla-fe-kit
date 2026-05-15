import type { HttpRequest, HttpResponse } from './http-types.type.js';

export interface HttpClient {
  request<T = unknown>(config: HttpRequest): Promise<HttpResponse<T>>;
}
