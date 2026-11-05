/**
 * SSE Client for 1337 Nexus AI Copilot
 * 
 * Streams events from POST /api/v1/copilot/ask over fetch with line/frame
 * buffer management to prevent JSON truncation issues.
 */

export interface Citation {
  chunk_id: string;
  subject_slug: string;
  ordinal: number;
  distance: number;
  snippet?: string;
  document_id?: string;
  chunk_metadata?: Record<string, unknown>;
}

export interface MetaPayload {
  thread_id: string;
  message_id: string;
  citations: Citation[];
}

export interface DeltaPayload {
  content: string;
}

export interface DonePayload {
  message_id: string;
  status: 'completed' | 'failed';
  tokens: number;
}

export interface AskRequestBody {
  question: string;
  k?: number;
  thread_id?: string;
  user_id?: string;
  project_id?: string;
  subject_slug?: string;
}

export interface StreamCopilotCallbacks {
  onMeta?: (meta: MetaPayload) => void;
  onDelta?: (delta: DeltaPayload) => void;
  onDone?: (done: DonePayload) => void;
  onError?: (error: Error) => void;
  onAbort?: () => void;
}

export interface StreamCopilotOptions {
  url?: string;
  body: AskRequestBody;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  callbacks?: StreamCopilotCallbacks;
}

/**
 * Parses a single raw SSE frame block and dispatches to appropriate callbacks.
 */
function parseAndDispatchFrame(rawFrame: string, callbacks?: StreamCopilotCallbacks): void {
  const lines = rawFrame.split(/\r?\n/);
  let eventType = '';
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataStr = line.slice(5).trim();
    }
  }

  if (!eventType || !dataStr || !callbacks) {
    return;
  }

  try {
    const parsed = JSON.parse(dataStr);
    switch (eventType) {
      case 'meta':
        callbacks.onMeta?.(parsed as MetaPayload);
        break;
      case 'delta':
        callbacks.onDelta?.(parsed as DeltaPayload);
        break;
      case 'done':
        callbacks.onDone?.(parsed as DonePayload);
        break;
      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error('Failed to parse SSE payload JSON:', err, 'Raw data:', dataStr);
  }
}

/**
 * Initiates an SSE streaming connection to the Copilot backend.
 * Uses a double-newline buffer so partial chunks across network frames are reassembled cleanly.
 */
export async function streamCopilotAnswer(options: StreamCopilotOptions): Promise<void> {
  const {
    url = '/api/v1/copilot/ask',
    body,
    signal,
    headers = {},
    callbacks = {},
  } = options;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    if (signal?.aborted) {
      callbacks.onAbort?.();
      return;
    }
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError?.(error);
    throw error;
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    const error = new Error(`Request failed (${response.status}): ${errorDetail || response.statusText}`);
    callbacks.onError?.(error);
    throw error;
  }

  if (!response.body) {
    const error = new Error('ReadableStream not supported on response body.');
    callbacks.onError?.(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE frames end with \r\n\r\n or \n\n
      let boundaryIndex: number;
      while ((boundaryIndex = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const rawFrame = buffer.slice(0, boundaryIndex);
        const match = buffer.match(/\r?\n\r?\n/);
        const delimLength = match ? match[0].length : 2;
        buffer = buffer.slice(boundaryIndex + delimLength);

        if (rawFrame.trim()) {
          parseAndDispatchFrame(rawFrame, callbacks);
        }
      }
    }

    // Flush any leftover frame in the buffer
    if (buffer.trim()) {
      parseAndDispatchFrame(buffer, callbacks);
    }
  } catch (err: unknown) {
    if (signal?.aborted) {
      callbacks.onAbort?.();
      return;
    }
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError?.(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
