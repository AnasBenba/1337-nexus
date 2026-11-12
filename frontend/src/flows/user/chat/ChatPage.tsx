import { FormEvent, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { TeamChatPanel } from './TeamChatPanel';

type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  offlineMessage: boolean;
  delivered?: boolean;
  read?: boolean;
};

type SendAck = {
  status: 'ok' | 'error';
  message?: string;
  message_id?: string;
  delivered?: boolean;
};

type ReadAck = {
  status: 'ok' | 'error';
  message?: string;
};

type ReadReceipt = {
  message_id: string;
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

function parseMessage(value: unknown): ChatMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const message = value as Record<string, unknown>;
  const senderId = message.from ?? message.sender_id;
  const receiverId = message.to ?? message.receiver_id;

  if (
    typeof senderId !== 'string' ||
    typeof receiverId !== 'string' ||
    typeof message.content !== 'string'
  ) {
    return null;
  }

  return {
    id: typeof message.id === 'string' ? message.id : '',
    senderId,
    receiverId,
    content: message.content,
    createdAt:
      typeof message.created_at === 'string'
        ? message.created_at
        : new Date().toISOString(),
    offlineMessage: message.offline_message === true,
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map<string, ChatMessage>();

  for (const message of [...current, ...incoming]) {
    const key =
      message.id ||
      `${message.senderId}:${message.receiverId}:${message.createdAt}:${message.content}`;
    messages.set(key, message);
  }

  return [...messages.values()].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export const ChatPage = () => {
  const socketRef = useRef<Socket | null>(null);
  const readMessageIds = useRef(new Set<string>());
  const [currentUserId, setCurrentUserId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(
    () => () => {
      socketRef.current?.disconnect();
    },
    [],
  );

  const loadHistory = async (userId: string, peerId: string) => {
    try {
      const response = await fetch(`/messages/${userId}/${peerId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Could not load history (${response.status})`);
      }

      const body: unknown = await response.json();
      if (!Array.isArray(body)) {
        throw new Error('The history endpoint returned an unexpected response');
      }

      const history = body
        .map(parseMessage)
        .filter((message): message is ChatMessage => message !== null);
      setMessages((current) => mergeMessages(current, history));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load history');
    }
  };

  const connect = () => {
    const userId = currentUserId.trim();
    const peerId = receiverId.trim();
    if (!userId || !peerId) {
      setError('Enter your user UUID and the recipient’s user UUID first.');
      return;
    }

    setError('');
    setStatus('connecting');

    const socket = io('/chat', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      void loadHistory(userId, peerId);
    });
    socket.on('connect_error', (connectError) => {
      setStatus('disconnected');
      setError(
        `${connectError.message}. Check that you are logged in at localhost:8000 and that the backend is running.`,
      );
    });
    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      if (reason !== 'io client disconnect') {
        setError(`Chat disconnected: ${reason}`);
      }
    });
    socket.on('receive_dm', (payload: unknown) => {
      const message = parseMessage(payload);
      if (message) {
        setMessages((current) => mergeMessages(current, [message]));
      }
    });
    socket.on('dm_read_receipt', (payload: unknown) => {
      if (
        typeof payload !== 'object' ||
        payload === null ||
        typeof (payload as ReadReceipt).message_id !== 'string'
      ) {
        return;
      }

      const { message_id: messageId } = payload as ReadReceipt;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, read: true } : message,
        ),
      );
    });

    socket.connect();
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus('disconnected');
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const socket = socketRef.current;
    const peerId = receiverId.trim();
    const content = draft.trim();

    if (!socket?.connected) {
      setError('Connect to chat before sending a message.');
      return;
    }
    if (!peerId || !content) {
      setError('Choose a valid recipient and enter a message.');
      return;
    }

    setError('');
    setSending(true);
    socket.timeout(10000).emit(
      'send_dm',
      { receiver_id: peerId, content },
      (timeoutError: Error | null, ack: SendAck) => {
        setSending(false);
        if (timeoutError) {
          setError('The server did not acknowledge the message. Check the connection and try again.');
          return;
        }
        if (ack.status !== 'ok' || !ack.message_id) {
          setError(ack.message ?? 'The server rejected this message.');
          return;
        }

        setMessages((current) =>
          mergeMessages(current, [
            {
              id: ack.message_id!,
              senderId: currentUserId.trim(),
              receiverId: peerId,
              content,
              createdAt: new Date().toISOString(),
              offlineMessage: false,
              delivered: ack.delivered,
              read: false,
            },
          ]),
        );
        setDraft('');
      },
    );
  };

  const active = status === 'connected';
  const displayMessages = messages.filter((message) => {
    const userId = currentUserId.trim();
    const peerId = receiverId.trim();
    return (
      (message.senderId === userId && message.receiverId === peerId) ||
      (message.senderId === peerId && message.receiverId === userId)
    );
  });

  useEffect(() => {
    const socket = socketRef.current;
    const userId = currentUserId.trim();

    if (!active || !socket?.connected || document.visibilityState !== 'visible') {
      return;
    }

    for (const message of displayMessages) {
      if (
        !message.id ||
        message.senderId === userId ||
        readMessageIds.current.has(message.id)
      ) {
        continue;
      }

      readMessageIds.current.add(message.id);
      socket.timeout(10000).emit(
        'dm_read',
        { message_id: message.id },
        (timeoutError: Error | null, ack: ReadAck) => {
          if (timeoutError) {
            readMessageIds.current.delete(message.id);
            setError('Could not confirm that the message was read.');
            return;
          }
          if (ack.status !== 'ok') {
            readMessageIds.current.delete(message.id);
            setError(ack.message ?? 'The server rejected the read receipt.');
          }
        },
      );
    }
  }, [active, currentUserId, displayMessages]);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Realtime test
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Direct messages</h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            Test the Socket.IO <code>/chat</code> namespace with your existing DM events.
          </p>
        </div>
        <a
          className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-fixed"
          href="http://localhost:8000/auth/login"
          target="_blank"
          rel="noreferrer"
        >
          Sign in to the backend
        </a>
      </header>

      <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-semibold text-on-surface">
          Your user UUID
          <input
            className="rounded-xl border-outline-variant bg-surface px-3 py-2 font-normal"
            onChange={(event) => setCurrentUserId(event.target.value)}
            placeholder="Paste your account UUID"
            type="text"
            value={currentUserId}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-on-surface">
          Recipient user UUID
          <input
            className="rounded-xl border-outline-variant bg-surface px-3 py-2 font-normal"
            onChange={(event) => setReceiverId(event.target.value)}
            placeholder="Paste recipient UUID"
            type="text"
            value={receiverId}
          />
        </label>
        {active ? (
          <button
            className="rounded-xl bg-surface-container-high px-5 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container"
            onClick={disconnect}
            type="button"
          >
            Disconnect
          </button>
        ) : (
          <button
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-60"
            disabled={status === 'connecting'}
            onClick={connect}
            type="button"
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect'}
          </button>
        )}
        <p className="text-xs text-on-surface-variant md:col-span-3">
          Your ID is for displaying history. The sender identity is taken from the signed-in
          account’s access-token cookie. Use a second browser or session for the recipient.
        </p>
      </section>

      <section className="flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <div>
            <h2 className="font-bold text-on-surface">
              {receiverId ? `Conversation with user ${receiverId}` : 'Conversation'}
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              History loads when the Socket.IO connection is established.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              active
                ? 'bg-green-100 text-green-800'
                : status === 'connecting'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {status}
          </span>
        </div>

        <div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-5">
          {displayMessages.length === 0 ? (
            <div className="grid h-full min-h-48 place-items-center text-center">
              <div>
                <p className="font-semibold text-on-surface">No messages loaded</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Connect, then send a message from this user or another chat client.
                </p>
              </div>
            </div>
          ) : (
            displayMessages.map((message, index) => {
              const isMine = message.senderId === currentUserId.trim();
              return (
                <article
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  key={message.id || `${message.createdAt}-${index}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 md:max-w-[70%] ${
                      isMine
                        ? 'rounded-br-sm bg-primary text-on-primary'
                        : 'rounded-bl-sm bg-surface-container text-on-surface'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] opacity-75">
                      <time dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </time>
                      {message.offlineMessage && <span>Delivered after reconnect</span>}
                      {isMine && message.delivered === false && <span>Saved for later</span>}
                      {isMine && message.read && <span>Read</span>}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <form className="flex gap-3 border-t border-outline-variant p-4" onSubmit={sendMessage}>
          <input
            className="min-w-0 flex-1 rounded-xl border-outline-variant bg-surface px-4 py-3 text-sm"
            disabled={!active}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={active ? 'Write a message…' : 'Connect to start chatting'}
            value={draft}
          />
          <button
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!active || sending || !draft.trim()}
            type="submit"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </section>

      {error && (
        <p
          className="rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="alert"
        >
          {error}
        </p>
      )}

      <TeamChatPanel />
    </section>
  );
};
