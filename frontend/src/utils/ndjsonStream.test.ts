import { parseNDJSON } from './ndjsonStream';

function mockResponse(chunks: Uint8Array[]): Response {
  return {
    body: {
      getReader: () => {
        let i = 0;
        return {
          async read() {
            if (i >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: chunks[i++] };
          },
          async cancel() {
            /* noop */
          },
        };
      },
    },
  } as unknown as Response;
}

describe('parseNDJSON', () => {
  it('parses complete lines across chunks', async () => {
    const enc = new TextEncoder();
    const resp = mockResponse([
      enc.encode('{"a":1}\n{"a":'),
      enc.encode('2}\n'),
    ]);
    const events: any[] = [];
    for await (const e of parseNDJSON<any>(resp)) events.push(e);
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('handles last line without trailing newline', async () => {
    const enc = new TextEncoder();
    const resp = mockResponse([enc.encode('{"a":1}')]);
    const events: any[] = [];
    for await (const e of parseNDJSON<any>(resp)) events.push(e);
    expect(events).toEqual([{ a: 1 }]);
  });

  it('respects AbortSignal', async () => {
    const enc = new TextEncoder();
    const resp = mockResponse([enc.encode('{"a":1}\n')]);
    const ctrl = new AbortController();
    ctrl.abort();
    const events: any[] = [];
    for await (const e of parseNDJSON<any>(resp, ctrl.signal)) events.push(e);
    expect(events).toEqual([]);
  });
});