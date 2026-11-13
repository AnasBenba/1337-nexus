import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { Avatar } from '@/components/Avatar';
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

export type PeerUser = {
  id: string;
  login: string;
  fullname: string;
  role: string;
  avatar_url?: string | null;
  is_self?: boolean;
  is_online?: boolean;
};

export type CurrentUser = {
  id: string;
  login: string;
  fullname: string;
  role: string;
  avatar_url?: string | null;
  intra_id?: number | null;
};

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
    delivered: typeof message.delivered === 'boolean' ? message.delivered : undefined,
    read: typeof message.is_read === 'boolean' ? message.is_read : undefined,
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
  const { user: authUser, isAuthenticated, isLoading, openAuthModal } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const readMessageIds = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  // Sync currentUser from AuthContext and fetch real peers list when authenticated
  useEffect(() => {
    if (!isAuthenticated || !authUser) {
      setCurrentUser(null);
      setPeers([]);
      setReceiverId('');
      setMessages([]);
      return;
    }

    setCurrentUser({
      id: authUser.id,
      login: authUser.login,
      fullname: authUser.fullname,
      role: authUser.role,
      avatar_url: authUser.avatar_url,
      intra_id: authUser.intra_id,
    });

    let cancelled = false;
    const fetchPeers = async () => {
      try {
        const peersRes = await fetch('/messages/peers', { credentials: 'include' });
        if (!peersRes.ok) {
          throw new Error(`Could not load peers (${peersRes.status})`);
        }
        const peersData = (await peersRes.json()) as PeerUser[];
        if (!cancelled && Array.isArray(peersData)) {
          setPeers(peersData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load peers list.');
        }
      }
    };

    void fetchPeers();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authUser]);

  // Connect Socket.IO /chat namespace when authenticated
  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
      return;
    }

    setError('');
    setStatus('connecting');

    const socket = io('/chat', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      setError('');
    });

    socket.on('connect_error', (connectError) => {
      setStatus('disconnected');
      setError(`${connectError.message}. Make sure the backend server is running.`);
    });

    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      if (reason !== 'io client disconnect') {
        setError(`Chat disconnected: ${reason}`);
      }
    });

    socket.on(
      'my_identity',
      (payload: {
        id: string;
        login: string;
        fullname: string;
        role: string;
        avatar_url?: string | null;
        online_user_ids?: string[];
      }) => {
        if (payload?.id) {
          setCurrentUser((prev) =>
            prev ?? {
              id: payload.id,
              login: payload.login,
              fullname: payload.fullname,
              role: payload.role,
              avatar_url: payload.avatar_url ?? null,
            },
          );
        }
        if (Array.isArray(payload.online_user_ids)) {
          const onlineSet = new Set(payload.online_user_ids);
          setPeers((prev) =>
            prev.map((peer) => ({
              ...peer,
              is_online: onlineSet.has(peer.id),
            })),
          );
        }
      },
    );

    socket.on(
      'presence_change',
      (payload: { user_id: string; status: 'online' | 'offline' }) => {
        if (payload?.user_id) {
          setPeers((prev) =>
            prev.map((peer) =>
              peer.id === payload.user_id
                ? { ...peer, is_online: payload.status === 'online' }
                : peer,
            ),
          );
        }
      },
    );

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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, authUser?.id]);

  const loadHistory = async (peerId: string) => {
    if (!currentUser?.id || !peerId) return;
    try {
      const response = await fetch(`/messages/${currentUser.id}/${peerId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Could not load history (${response.status})`);
      }

      const body: unknown = await response.json();
      if (!Array.isArray(body)) {
        throw new Error('Unexpected message history response');
      }

      const history = body
        .map(parseMessage)
        .filter((message): message is ChatMessage => message !== null);
      setMessages((current) => mergeMessages(current, history));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load history');
    }
  };

  const handleSelectPeer = (peer: PeerUser) => {
    setReceiverId(peer.id);
    setError('');
    void loadHistory(peer.id);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, receiverId]);

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const socket = socketRef.current;
    const peerId = receiverId.trim();
    const content = draft.trim();
    const myId = currentUser?.id?.trim();

    if (!socket?.connected) {
      setError('Chat is currently disconnected. Reconnecting…');
      return;
    }
    if (!peerId) {
      setError('Please select a peer from the list to message.');
      return;
    }
    if (!content) return;
    if (!myId) {
      setError('Your user session is still loading. Please wait a moment.');
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
          setError('The server did not acknowledge the message. Check connection and retry.');
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
              senderId: myId,
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

  const selectedPeer = useMemo(
    () => peers.find((p) => p.id === receiverId) ?? null,
    [peers, receiverId],
  );

  const filteredPeers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return peers
      .filter((p) => !p.is_self && p.id !== currentUser?.id)
      .filter(
        (p) =>
          !q ||
          p.login.toLowerCase().includes(q) ||
          p.fullname.toLowerCase().includes(q),
      );
  }, [peers, searchQuery, currentUser]);

  const onlinePeers = useMemo(
    () => filteredPeers.filter((p) => p.is_online),
    [filteredPeers],
  );
  const offlinePeers = useMemo(
    () => filteredPeers.filter((p) => !p.is_online),
    [filteredPeers],
  );

  const displayMessages = useMemo(() => {
    const myId = currentUser?.id?.trim();
    const peerId = receiverId.trim();
    if (!myId || !peerId) return [];
    return messages.filter(
      (m) =>
        (m.senderId === myId && m.receiverId === peerId) ||
        (m.senderId === peerId && m.receiverId === myId),
    );
  }, [messages, currentUser, receiverId]);

  // Send read receipts for incoming unread messages in active thread
  useEffect(() => {
    const socket = socketRef.current;
    if (!active || !socket || !currentUser?.id) return;

    const unread = displayMessages.filter(
      (m) => m.receiverId === currentUser.id && !m.read && !readMessageIds.current.has(m.id),
    );

    for (const msg of unread) {
      if (!msg.id) continue;
      readMessageIds.current.add(msg.id);
      socket.timeout(5000).emit(
        'dm_read',
        { message_id: msg.id },
        (timeoutError: Error | null, ack: ReadAck) => {
          if (timeoutError || ack.status !== 'ok') {
            readMessageIds.current.delete(msg.id);
          }
        },
      );
    }
  }, [active, currentUser, displayMessages]);

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-space-2xl text-center">
        <div className="rounded-2xl bg-surface-container-lowest p-8 shadow-sm border border-outline-variant/40">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[28px]">chat</span>
          </div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">
            Sign in to message peers
          </h1>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            Sign in with your 42 Intra account or student credentials to see online peers and start direct conversations.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm hover:opacity-95 transition-opacity"
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={openAuthModal}
              className="inline-flex items-center gap-2 rounded-full bg-surface-container px-5 py-2.5 font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
            >
              Quick sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl flex-col gap-6 pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface lg:text-4xl">
            Messages
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Connect and message directly with fellow students in real time.
          </p>
        </div>

        {/* Identity Badge */}
        {currentUser && (
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 py-2.5 shadow-sm hover:bg-surface-container transition-colors"
          >
            <Avatar
              name={currentUser.fullname || currentUser.login}
              src={currentUser.avatar_url}
              online={active}
              className="h-9 w-9 text-xs"
            />
            <div className="text-left text-xs">
              <p className="font-bold text-on-surface leading-tight">
                {currentUser.fullname || currentUser.login}
              </p>
              <p className="font-mono text-[11px] text-on-surface-variant">
                @{currentUser.login} &bull;{' '}
                <span className={active ? 'text-emerald-700 font-semibold' : 'text-outline'}>
                  {active ? 'Online' : 'Connecting…'}
                </span>
              </p>
            </div>
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Left Sidebar: Peers List */}
        <aside className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-primary">group</span>
              <span>Peers</span>
            </h2>
            <span className="text-[11px] font-mono bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant font-bold">
              {filteredPeers.length}
            </span>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-base">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search peers…"
              className="w-full rounded-xl border border-outline-variant/60 bg-surface-container-low pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {onlinePeers.length > 0 && (
              <div className="space-y-1.5">
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online ({onlinePeers.length})
                </p>
                {onlinePeers.map((peer) => {
                  const isSelected = peer.id === receiverId;
                  return (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => handleSelectPeer(peer)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all ${
                        isSelected
                          ? 'bg-brand text-white shadow-md shadow-brand/20'
                          : 'hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <Avatar
                        name={peer.fullname || peer.login}
                        src={peer.avatar_url}
                        online
                        className="h-9 w-9 text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs truncate">
                          {peer.fullname || peer.login}
                        </p>
                        <p
                          className={`font-mono text-[10px] truncate ${
                            isSelected ? 'text-white/80' : 'text-on-surface-variant'
                          }`}
                        >
                          @{peer.login}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {offlinePeers.length > 0 && (
              <div className="space-y-1.5">
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-outline flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-outline/60" />
                  Offline ({offlinePeers.length})
                </p>
                {offlinePeers.map((peer) => {
                  const isSelected = peer.id === receiverId;
                  return (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => handleSelectPeer(peer)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all ${
                        isSelected
                          ? 'bg-brand text-white shadow-md shadow-brand/20'
                          : 'hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <Avatar
                        name={peer.fullname || peer.login}
                        src={peer.avatar_url}
                        online={false}
                        className="h-9 w-9 text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs truncate">
                          {peer.fullname || peer.login}
                        </p>
                        <p
                          className={`font-mono text-[10px] truncate ${
                            isSelected ? 'text-white/80' : 'text-on-surface-variant'
                          }`}
                        >
                          @{peer.login}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredPeers.length === 0 && (
              <p className="text-center text-xs text-outline py-6">
                No peers found.
              </p>
            )}
          </div>
        </aside>

        {/* Right Side: Conversation Pane */}
        <section className="flex flex-col rounded-3xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-low/50 px-5 py-4">
            {selectedPeer ? (
              <div className="flex items-center gap-3">
                <Avatar
                  name={selectedPeer.fullname || selectedPeer.login}
                  src={selectedPeer.avatar_url}
                  online={!!selectedPeer.is_online}
                  className="h-10 w-10 text-sm"
                />
                <div>
                  <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span>{selectedPeer.fullname || selectedPeer.login}</span>
                    {selectedPeer.is_online ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Online
                      </span>
                    ) : (
                      <span className="rounded-full bg-outline/10 px-2 py-0.5 text-[10px] font-semibold text-outline">
                        Offline
                      </span>
                    )}
                  </h3>
                  <p className="font-mono text-xs text-on-surface-variant">
                    @{selectedPeer.login}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-lg">chat_bubble_outline</span>
                <span>Select a peer from the list to start chatting</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
              <span
                className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-400'}`}
              />
              <span>{active ? 'Live' : 'Connecting…'}</span>
            </div>
          </div>

          <div
            aria-label="Conversation history"
            className="flex-1 min-h-[380px] max-h-[520px] space-y-3 overflow-y-auto p-5 bg-surface/30"
          >
            {!receiverId ? (
              <div className="grid h-full min-h-64 place-items-center text-center">
                <div className="space-y-2">
                  <span className="material-symbols-outlined text-4xl text-outline">chat</span>
                  <p className="font-bold text-sm text-on-surface">No conversation selected</p>
                  <p className="text-xs text-on-surface-variant max-w-sm">
                    Choose an online or offline peer from the sidebar to view your message history and chat.
                  </p>
                </div>
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="grid h-full min-h-64 place-items-center text-center">
                <div className="space-y-1">
                  <span className="material-symbols-outlined text-3xl text-outline">
                    waving_hand
                  </span>
                  <p className="font-semibold text-sm text-on-surface">
                    Say hello to {selectedPeer?.fullname || selectedPeer?.login}!
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    No previous messages found. Type below to start the conversation.
                  </p>
                </div>
              </div>
            ) : (
              displayMessages.map((message, index) => {
                const isMine = message.senderId === currentUser?.id;
                return (
                  <article
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    key={message.id || `${message.createdAt}-${index}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 md:max-w-[70%] shadow-2xs ${
                        isMine
                          ? 'rounded-br-sm bg-brand text-white'
                          : 'rounded-bl-sm bg-surface-container text-on-surface'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.content}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] opacity-75">
                        <time dateTime={message.createdAt}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                        {message.offlineMessage && <span>&bull; Delivered on reconnect</span>}
                        {isMine && message.delivered === false && <span>&bull; Saved for later</span>}
                        {isMine && message.read && <span>&bull; Read</span>}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="flex gap-3 border-t border-outline-variant/40 p-4 bg-surface"
            onSubmit={sendMessage}
          >
            <input
              className="min-w-0 flex-1 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              disabled={!active || !receiverId}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                !receiverId
                  ? 'Select a peer from the sidebar…'
                  : `Message ${selectedPeer?.fullname || selectedPeer?.login || 'peer'}…`
              }
              value={draft}
            />
            <button
              className="flex items-center gap-1.5 rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!active || sending || !draft.trim() || !receiverId}
              type="submit"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">send</span>
              )}
              <span>Send</span>
            </button>
          </form>
        </section>
      </div>

      {error && (
        <p
          className="rounded-2xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container shadow-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
};
