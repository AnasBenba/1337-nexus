import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

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

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

function parseMessage(value: unknown): ChatMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const message = value as Record<string, unknown>;
  const senderId = (message.from ?? message.sender_id) as string;
  const receiverId = (message.to ?? message.receiver_id) as string;

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

export const ChatPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  // Auto populate user ID if logged in
  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
    }
  }, [user]);

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
        throw new Error('History endpoint returned an unexpected response');
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
      setError('Please provide both your User UUID and the Recipient User UUID.');
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

    socket.on('connect_error', (connectError: Error) => {
      setStatus('disconnected');
      setError(`${connectError.message}. Make sure you are authenticated.`);
    });

    socket.on('disconnect', (reason: string) => {
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

    socket.connect();
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus('disconnected');
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    const peerId = receiverId.trim();
    const socket = socketRef.current;

    if (!socket || !socket.connected || !text || !peerId) return;

    setSending(true);
    setError('');

    socket.emit(
      'send_dm',
      { receiver_id: peerId, content: text },
      (ack: { status: string; message?: string; message_id?: string; delivered?: boolean }) => {
        setSending(false);
        if (ack?.status === 'ok') {
          const sentMessage: ChatMessage = {
            id: ack.message_id || '',
            senderId: currentUserId.trim(),
            receiverId: peerId,
            content: text,
            createdAt: new Date().toISOString(),
            offlineMessage: false,
            delivered: ack.delivered,
          };
          setMessages((current) => mergeMessages(current, [sentMessage]));
          setDraft('');
        } else {
          setError(ack?.message || 'Could not send message');
        }
      },
    );
  };

  const active = status === 'connected';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">chat</span>
            Direct Peer Messaging
          </h1>
          <p className="text-xs text-on-surface-variant">
            Encrypted real-time communication powered by WebSockets (Socket.IO)
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={openAuthModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-fixed text-on-primary-fixed text-xs font-bold hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">login</span>
            <span>Sign In for Automatic Session</span>
          </button>
        )}
      </div>

      {/* Connection Panel */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Your User UUID
          </label>
          <input
            type="text"
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            placeholder="UUID (e.g. 549ea884-...)"
            className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Recipient User UUID
          </label>
          <input
            type="text"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            placeholder="Recipient UUID..."
            className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface font-mono"
          />
        </div>

        <div className="flex items-end gap-2">
          {active ? (
            <button
              type="button"
              onClick={disconnect}
              className="flex-1 py-2 px-4 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              disabled={status === 'connecting'}
              onClick={connect}
              className="flex-1 py-2 px-4 rounded-xl bg-primary text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {status === 'connecting' ? 'Connecting...' : 'Connect Socket'}
            </button>
          )}

          <div className={`px-3 py-2 rounded-xl text-xs font-bold ${
            active ? 'bg-green-100 text-green-800' : 'bg-surface-container text-on-surface-variant'
          }`}>
            {status}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Messages Thread */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm flex flex-col h-[500px]">
        <div className="p-4 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-on-surface">
              {receiverId ? `Conversation with ${receiverId.slice(0, 8)}...` : 'Select a recipient'}
            </span>
          </div>
          <span className="text-[11px] text-on-surface-variant">Socket.IO /chat</span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[36px] text-outline mb-2">forum</span>
              <p className="text-xs font-semibold">No messages yet</p>
              <p className="text-[11px]">Connect and type a message to start communicating in real-time.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const isMine = m.senderId === currentUserId.trim();
              return (
                <div key={m.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl p-3 text-xs ${
                    isMine ? 'bg-primary text-on-primary rounded-br-none' : 'bg-surface-container text-on-surface rounded-bl-none'
                  }`}>
                    <p className="break-words">{m.content}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] opacity-75">
                      <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      {m.delivered && <span>• Delivered</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-3 border-t border-outline-variant flex gap-2">
          <input
            type="text"
            disabled={!active}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={active ? 'Type a peer message...' : 'Connect to start chatting...'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!active || sending || !draft.trim()}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};
