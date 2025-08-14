import { describe, it, expect, jest } from '@jest/globals';
import { RespecXrefResolver } from '../src/utils/respec-xref-resolver';
import type { XrefQuery } from '../src/types';

describe('RespecXrefResolver', () => {
  it('batches queries with same specs and maps results', async () => {
    const fetchMock = jest.fn(async () => ({
      json: async () => ({
        'task queue': [{ uri: 'https://example.com/task', spec: 'dom', title: 'Task Queue' }],
        'event loop': [{ uri: 'https://example.com/loop', spec: 'html', title: 'Event Loop' }],
      }),
    })) as unknown as jest.MockedFunction<typeof fetch>;

    const resolver = new RespecXrefResolver(fetchMock);
    const queries: XrefQuery[] = [
      { id: 'a', term: 'task queue', specs: ['dom', 'html'] },
      { id: 'b', term: 'event loop', specs: ['dom', 'html'] },
    ];
    const results = await resolver.resolveBatch(queries);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://respec.org/xref?terms=task+queue&terms=event+loop&cite=dom%2Chtml',
    );
    expect(results.get('a')).toEqual([
      { href: 'https://example.com/task', text: 'Task Queue', cite: 'dom' },
    ]);
    expect(results.get('b')).toEqual([
      { href: 'https://example.com/loop', text: 'Event Loop', cite: 'html' },
    ]);
  });

  it('handles fetch errors gracefully', async () => {
    const fetchMock = jest.fn(async () => {
      throw new Error('network');
    }) as unknown as jest.MockedFunction<typeof fetch>;
    const resolver = new RespecXrefResolver(fetchMock);
    const queries: XrefQuery[] = [{ id: 'x', term: 'missing' }];
    const results = await resolver.resolveBatch(queries);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.get('x')).toEqual([]);
  });
});
