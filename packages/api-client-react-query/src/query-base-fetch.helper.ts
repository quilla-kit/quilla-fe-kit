import { type HttpClient, type HttpHeaders, parseETagHeaderValue } from '@quilla-fe-kit/api-client';
import type { QueryBaseResult } from './query-base-result.type.js';
import type { QueryTransformer } from './transformer.type.js';

export type QueryBaseFetchInput<TRaw, TModel> = {
  readonly client: HttpClient;
  readonly url: string;
  readonly params: Record<string, unknown>;
  readonly headers?: HttpHeaders;
  readonly signal?: AbortSignal;
  readonly transformer?: QueryTransformer;
  readonly mapper?: (raw: TRaw) => TModel;
};

export const fetchQueryBase = async <TRaw, TModel>({
  client,
  url,
  params,
  headers,
  signal,
  transformer,
  mapper,
}: QueryBaseFetchInput<TRaw, TModel>): Promise<QueryBaseResult<TModel>> => {
  const response = await client.request<unknown>({
    url,
    ...(Object.keys(params).length > 0 ? { params } : {}),
    ...(headers ? { headers } : {}),
    ...(signal ? { signal } : {}),
  });

  const version = parseETagHeaderValue(response.headers.etag);

  const rawData = transformer ? transformer(response.data).data : response.data;
  const raw = rawData as TRaw;
  const mapped = mapper ? mapper(raw) : (raw as unknown as TModel);

  return { data: mapped, version };
};
