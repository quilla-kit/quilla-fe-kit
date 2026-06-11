import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadFile, saveBlobAsFile } from '../../src/http/file.downloader.js';
import type { HttpClient } from '../../src/http/http-client.interface.js';

const makeFakeDom = () => {
  const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
  const appendChild = vi.fn();
  const removeChild = vi.fn();
  const document = {
    createElement: vi.fn(() => anchor),
    body: { appendChild, removeChild },
  } as unknown as Document;
  return { anchor, document, appendChild, removeChild };
};

const stubObjectUrl = () => {
  const createObjectURL = vi.fn(() => 'blob:fake');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveBlobAsFile', () => {
  it('throws a clear error outside a browser environment', () => {
    expect(() => saveBlobAsFile(new Blob(['x']), 'x.zip')).toThrow(/browser environment/);
  });

  it('drives an anchor click and revokes the object URL', () => {
    const dom = makeFakeDom();
    vi.stubGlobal('document', dom.document);
    const { createObjectURL, revokeObjectURL } = stubObjectUrl();

    const blob = new Blob(['zip']);
    saveBlobAsFile(blob, 'export.zip');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(dom.anchor.href).toBe('blob:fake');
    expect(dom.anchor.download).toBe('export.zip');
    expect(dom.appendChild).toHaveBeenCalledWith(dom.anchor);
    expect(dom.anchor.click).toHaveBeenCalledTimes(1);
    expect(dom.removeChild).toHaveBeenCalledWith(dom.anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('revokes the object URL even when the click throws', () => {
    const dom = makeFakeDom();
    (dom.anchor.click as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('click failed');
    });
    vi.stubGlobal('document', dom.document);
    const { revokeObjectURL } = stubObjectUrl();

    expect(() => saveBlobAsFile(new Blob(['zip']), 'export.zip')).toThrow('click failed');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});

describe('downloadFile', () => {
  it('requests the blob through the client then saves it', async () => {
    const dom = makeFakeDom();
    vi.stubGlobal('document', dom.document);
    const { createObjectURL } = stubObjectUrl();

    const blob = new Blob(['zip']);
    const request = vi.fn(async () => ({ status: 200, headers: {}, data: blob }));
    const client = { request } as unknown as HttpClient;

    await downloadFile(client, {
      url: '/exports/x.zip',
      filename: 'export.zip',
      params: { scope: 'a' },
    });

    expect(request).toHaveBeenCalledWith({
      url: '/exports/x.zip',
      params: { scope: 'a' },
      method: 'GET',
      responseType: 'blob',
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(dom.anchor.download).toBe('export.zip');
  });
});
