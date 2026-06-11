import type { HttpClient } from './http-client.interface.js';
import type { HttpHeaders, HttpQueryParams } from './http-types.type.js';

export type DownloadFileOptions = {
  readonly url: string;
  readonly filename: string;
  readonly params?: HttpQueryParams;
  readonly headers?: HttpHeaders;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
};

export const downloadFile = async (
  client: HttpClient,
  options: DownloadFileOptions,
): Promise<void> => {
  const { filename, ...request } = options;
  const response = await client.request<Blob>({
    ...request,
    method: 'GET',
    responseType: 'blob',
  });
  saveBlobAsFile(response.data, filename);
};

export const saveBlobAsFile = (blob: Blob, filename: string): void => {
  const doc = (globalThis as { document?: Document }).document;
  const url = (globalThis as { URL?: typeof URL }).URL;
  if (!doc || !url || typeof url.createObjectURL !== 'function') {
    throw new Error(
      'saveBlobAsFile requires a browser environment (document + URL.createObjectURL).',
    );
  }

  const objectUrl = url.createObjectURL(blob);
  try {
    const anchor = doc.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    doc.body.appendChild(anchor);
    anchor.click();
    doc.body.removeChild(anchor);
  } finally {
    url.revokeObjectURL(objectUrl);
  }
};
