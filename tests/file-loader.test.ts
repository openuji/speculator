import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { nodeFileLoader } from '../src/utils/file-loader/node.js';
import { browserFileLoader } from '../src/utils/file-loader/browser.js';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(async () => { throw new Error('boom'); }),
}));

describe('nodeFileLoader', () => {
  it('wraps fs read errors', async () => {
    await expect(nodeFileLoader('file:///missing.txt')).rejects.toThrow(
      'Failed to load file: file:///missing.txt. boom',
    );
  });
});

describe('browserFileLoader', () => {
  afterEach(() => {
    delete (global as any).fetch;
  });

  it('throws on HTTP errors', async () => {
    const fetchMock = jest.fn<(path: RequestInfo | URL) => Promise<Response>>(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response));
    (global as any).fetch = fetchMock as any;
    await expect(browserFileLoader('/missing')).rejects.toThrow('HTTP 404: Not Found');
    expect(fetchMock).toHaveBeenCalledWith('/missing');
  });

  it('throws on network errors', async () => {
    const fetchMock = jest.fn<(path: RequestInfo | URL) => Promise<Response>>(async () => {
      throw new Error('network fail');
    });
    (global as any).fetch = fetchMock as any;
    await expect(browserFileLoader('/fail')).rejects.toThrow('network fail');
  });
});
