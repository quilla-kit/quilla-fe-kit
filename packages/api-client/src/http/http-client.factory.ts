import { memoryTokenStorage, type TokenStorage } from '@quilla-fe-kit/storage';
import { AuthenticatedHttpClient } from './authenticated.client.js';
import { EnvelopeHttpErrorParser } from './envelope.parser.js';
import { FetchHttpClient } from './fetch.client.js';
import type { HttpClient } from './http-client.interface.js';
import type { HttpErrorParser } from './http-error-parser.interface.js';
import type { QueryStringSerializer } from './query-string-serializer.interface.js';
import { type QueryConventions, RepeatParamsSerializer } from './repeat-params.serializer.js';
import {
  type RefreshEndpoint,
  SingleFlightTokenRefresher,
} from './single-flight-token.refresher.js';

export type CreateHttpClientConfig = {
  readonly baseUrl: string;
  readonly storage?: TokenStorage;
  readonly refreshEndpoint?: RefreshEndpoint;
  readonly errorParser?: HttpErrorParser;
  readonly querySerializer?: QueryStringSerializer | Partial<QueryConventions>;
  readonly fetchImpl?: typeof fetch;
};

export const createHttpClient = (config: CreateHttpClientConfig): HttpClient => {
  const querySerializer = resolveQuerySerializer(config.querySerializer);
  const errorParser = config.errorParser ?? new EnvelopeHttpErrorParser();
  const fetchImpl = config.fetchImpl;

  const transport = new FetchHttpClient({
    baseUrl: config.baseUrl,
    querySerializer,
    errorParser,
    ...(fetchImpl ? { fetchImpl } : {}),
  });

  if (!config.refreshEndpoint) {
    return transport;
  }

  const storage = config.storage ?? memoryTokenStorage();
  const tokenRefresher = new SingleFlightTokenRefresher({
    storage,
    refreshEndpoint: config.refreshEndpoint,
  });

  return new AuthenticatedHttpClient({ inner: transport, storage, tokenRefresher });
};

const resolveQuerySerializer = (
  input: CreateHttpClientConfig['querySerializer'],
): QueryStringSerializer => {
  if (!input) return new RepeatParamsSerializer();
  if (isQueryStringSerializer(input)) return input;
  return new RepeatParamsSerializer(input);
};

const isQueryStringSerializer = (
  value: QueryStringSerializer | Partial<QueryConventions>,
): value is QueryStringSerializer =>
  typeof (value as QueryStringSerializer).serialize === 'function';
