import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamCopilotAnswer, MetaPayload, DonePayload } from './sse-client';

describe('streamCopilotAnswer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly reassembles chunked SSE frames and fires callbacks in order', async () => {
    const metaObj: MetaPayload = {
      thread_id: 'test-thread-id',
      message_id: 'test-msg-id',
      citations: [
        {
          chunk_id: 'chunk-1',
          subject_slug: 'libft',
          ordinal: 1,
          distance: 0.12,
        },
      ],
    };

    const doneObj: DonePayload = {
      message_id: 'test-msg-id',
      status: 'completed',
      tokens: 42,
    };

    // Simulated network chunks arriving with partial frames
    const rawStreamParts = [
      `event: meta\ndata: ${JSON.stringify(metaObj)}\n\n`,
      'event: delta\ndata: {"content": "Hello',
      ' world"}\n\nevent: delta\ndata: {"content": "!"}\n\n',
      `event: done\ndata: ${JSON.stringify(doneObj)}\n\n`,
    ];

    const encoder = new TextEncoder();
    let chunkIndex = 0;

    const mockReadableStream = new ReadableStream({
      pull(controller) {
        if (chunkIndex < rawStreamParts.length) {
          controller.enqueue(encoder.encode(rawStreamParts[chunkIndex]));
          chunkIndex++;
        } else {
          controller.close();
        }
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockReadableStream,
    } as unknown as Response);

    const onMeta = vi.fn();
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamCopilotAnswer({
      body: { question: 'What is libft?' },
      callbacks: {
        onMeta,
        onDelta,
        onDone,
        onError,
      },
    });

    expect(onMeta).toHaveBeenCalledTimes(1);
    expect(onMeta).toHaveBeenCalledWith(metaObj);

    expect(onDelta).toHaveBeenCalledTimes(2);
    expect(onDelta).toHaveBeenNthCalledWith(1, { content: 'Hello world' });
    expect(onDelta).toHaveBeenNthCalledWith(2, { content: '!' });

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(doneObj);

    expect(onError).not.toHaveBeenCalled();
  });

  it('handles AbortSignal cleanly without throwing unhandled error', async () => {
    const controller = new AbortController();

    globalThis.fetch = vi.fn().mockImplementation(() => {
      controller.abort();
      const err = new Error('The user aborted a request.');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const onAbort = vi.fn();
    const onError = vi.fn();

    await streamCopilotAnswer({
      body: { question: 'Stop this' },
      signal: controller.signal,
      callbacks: {
        onAbort,
        onError,
      },
    });

    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('triggers onError callback when backend returns non-200 status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Database offline'),
    } as unknown as Response);

    const onError = vi.fn();

    await expect(
      streamCopilotAnswer({
        body: { question: 'Will fail' },
        callbacks: { onError },
      })
    ).rejects.toThrow('Request failed (500)');

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
