import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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

export type PeerUser = {
  id: string;
  login: string;
  fullname: string;
  role: string;
  is_self?: boolean;
  is_online?: boolean;
};

export type CurrentUser = {
  id: string;
  login: string;
  fullname: string;
  role: string;
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
  const [activeTab, setActiveTab] = useState<'direct' | 'team'>('direct');

  // Auto-fetch current user profile from backend on mount
  useEffect(() => {
    const fetchMeAndPeers = async () => {
      try {
        // Fetch current user
        const meRes = await fetch('/api/v1/users/me', { credentials: 'include' });
        if (meRes.ok) {
          const meData = (await meRes.json()) as CurrentUser;
          if (meData?.id) {
            setCurrentUser(meData);
          }
        }
      } catch {
        // Dev fallback handled gracefully
      }

      try {
        // Fetch peers list
        const peersRes = await fetch('/messages/peers', { credentials: 'include' });
        if (peersRes.ok) {
          const peersData = (await peersRes.json()) as PeerUser[];
          if (Array.isArray(peersData)) {
            setPeers(peersData);
          }
        }
      } catch {
        // Fallback peers list
      }
    };

    void fetchMeAndPeers();
  }, []);

  // Connect socket automatically
  useEffect(() => {
    setError('');
    setStatus('connecting');

    const socket = io('/chat', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
    });

    socket.on('connect_error', (connectError) => {
      setStatus('disconnected');
      setError(
        `${connectError.message}. Make sure the backend server is running on port 8000.`,
      );
    });

    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      if (reason !== 'io client disconnect') {
        setError(`Chat disconnected: ${reason}`);
      }
    });

    // Identity and presence list from backend
    socket.on('my_identity', (payload: { id: string; login: string; fullname: string; role: string; online_user_ids?: string[] }) => {
      if (payload?.id) {
        setCurrentUser((prev) => prev ?? {
          id: payload.id,
          login: payload.login,
          fullname: payload.fullname,
          role: payload.role,
        });
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
    });

    // Real-time presence updates (user went online/offline)
    socket.on('presence_change', (payload: { user_id: string; status: 'online' | 'offline' }) => {
      if (payload?.user_id) {
        setPeers((prev) =>
          prev.map((peer) =>
            peer.id === payload.user_id
              ? { ...peer, is_online: payload.status === 'online' }
              : peer,
          ),
        );
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Load chat history whenever receiverId or currentUser.id changes
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

  const handleSelectPeer = (peer: PeerUser) => {
    setReceiverId(peer.id);
    setError('');
    void loadHistory(peer.id);
  };

  // Auto-scroll to bottom of conversation
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
      setError('Chat is currently disconnected. Reconnecting...');
      return;
    }
    if (!peerId) {
      setError('Please select a friend from the list to message.');
      return;
    }
    if (!content) return;
    if (!myId) {
      setError('User identity not loaded from backend yet. Please wait a moment.');
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

  // Selected friend object
  const selectedPeer = useMemo(
    () => peers.find((p) => p.id === receiverId) ?? null,
    [peers, receiverId],
  );

  // Filter peers by search query and exclude self
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

  // Mark unread messages as read
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

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl flex-col gap-6 pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant/50 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-outline mb-1">
            <span>Realtime Collaboration</span>
            <span>/</span>
            <span className="text-primary font-bold">Messages</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface lg:text-4xl">
            Messages
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Connect and communicate directly with peers or collaborate inside your project team workspaces.
          </p>
        </div>

        {/* Identity Badge from Backend */}
        <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 py-2.5 shadow-sm">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-xs">
            {currentUser?.fullname
              ? currentUser.fullname.slice(0, 2).toUpperCase()
              : currentUser?.login
                ? currentUser.login.slice(0, 2).toUpperCase()
                : 'ME'}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                active ? 'bg-emerald-500' : 'bg-outline'
              }`}
            />
          </div>
          <div className="text-left text-xs">
            <p className="font-bold text-on-surface leading-tight">
              {currentUser?.fullname || currentUser?.login || 'Loading user…'}
            </p>
            <p className="font-mono text-[11px] text-on-surface-variant">
              @{currentUser?.login || 'you'} &bull;{' '}
              <span className={active ? 'text-emerald-700 font-semibold' : 'text-outline'}>
                {active ? 'Online' : 'Connecting…'}
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* Unified Messages Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('direct')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'direct'
              ? 'border-brand text-brand'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">chat</span>
          <span>Direct Messages</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'team'
              ? 'border-brand text-brand'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">groups</span>
          <span>Team Workspaces</span>
        </button>
      </div>

      {activeTab === 'direct' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* LEFT SIDEBAR: Friends / Peers List (Online & Offline) */}
          <aside className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-brand">contacts</span>
                <h2 className="text-sm font-bold text-on-surface">Campus Friends</h2>
              </div>
              <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {onlinePeers.length} online
              </span>
            </div>

            {/* Filter Search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline">
                search
              </span>
              <input
                type="text"
                placeholder="Search friends…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/60 bg-surface py-1.5 pl-8 pr-3 text-xs text-on-surface placeholder:text-outline focus:border-brand focus:outline-none"
              />
            </div>

            {/* Peers List Scroll Area */}
            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
              {/* Online Friends Section */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline px-2">
                  Online — {onlinePeers.length}
                </p>
                {onlinePeers.length === 0 ? (
                  <p className="text-xs text-outline px-2 py-1 italic">No friends currently online</p>
                ) : (
                  onlinePeers.map((peer) => {
                    const isSelected = receiverId === peer.id;
                    return (
                      <button
                        key={peer.id}
                        type="button"
                        onClick={() => handleSelectPeer(peer)}
                        className={`w-full flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left transition-all ${
                          isSelected
                            ? 'bg-brand/10 border border-brand/30 shadow-2xs'
                            : 'hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-on-surface font-bold text-xs">
                            {peer.fullname ? peer.fullname.slice(0, 2).toUpperCase() : peer.login.slice(0, 2).toUpperCase()}
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">
                              {peer.fullname || peer.login}
                            </p>
                            <p className="text-[11px] font-mono text-outline truncate">
                              @{peer.login}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm text-brand font-bold">
                            chevron_right
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Offline Friends Section */}
              <div className="space-y-1 pt-2 border-t border-outline-variant/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline px-2">
                  Offline — {offlinePeers.length}
                </p>
                {offlinePeers.length === 0 ? (
                  <p className="text-xs text-outline px-2 py-1 italic">No offline friends</p>
                ) : (
                  offlinePeers.map((peer) => {
                    const isSelected = receiverId === peer.id;
                    return (
                      <button
                        key={peer.id}
                        type="button"
                        onClick={() => handleSelectPeer(peer)}
                        className={`w-full flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left transition-all ${
                          isSelected
                            ? 'bg-brand/10 border border-brand/30 shadow-2xs'
                            : 'hover:bg-surface-container opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container text-outline font-semibold text-xs">
                            {peer.fullname ? peer.fullname.slice(0, 2).toUpperCase() : peer.login.slice(0, 2).toUpperCase()}
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-outline" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-on-surface truncate">
                              {peer.fullname || peer.login}
                            </p>
                            <p className="text-[11px] font-mono text-outline truncate">
                              @{peer.login}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm text-brand font-bold">
                            chevron_right
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT SIDE: Active Conversation Box */}
          <section className="flex min-h-[38rem] flex-col overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
            {/* Conversation Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/40 px-6 py-4 bg-surface-container-low/40">
              {selectedPeer ? (
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white font-bold text-sm">
                    {selectedPeer.fullname ? selectedPeer.fullname.slice(0, 2).toUpperCase() : selectedPeer.login.slice(0, 2).toUpperCase()}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                        selectedPeer.is_online ? 'bg-emerald-500' : 'bg-outline'
                      }`}
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-on-surface">
                      {selectedPeer.fullname || selectedPeer.login}
                    </h2>
                    <p className="text-xs text-on-surface-variant font-mono">
                      @{selectedPeer.login} &bull;{' '}
                      <span className={selectedPeer.is_online ? 'text-emerald-700 font-semibold' : 'text-outline'}>
                        {selectedPeer.is_online ? 'Active now' : 'Offline (offline queue enabled)'}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium">
                  <span className="material-symbols-outlined text-base text-outline">forum</span>
                  <span>Select a friend on the left to start direct chatting</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {status}
                </span>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-6 max-h-[500px]">
              {!receiverId ? (
                <div className="grid h-full min-h-64 place-items-center text-center">
                  <div className="space-y-2">
                    <span className="material-symbols-outlined text-4xl text-outline">chat</span>
                    <p className="font-bold text-sm text-on-surface">No conversation selected</p>
                    <p className="text-xs text-on-surface-variant max-w-sm">
                      Choose any online or offline friend from the sidebar to view your message history and start chatting.
                    </p>
                  </div>
                </div>
              ) : displayMessages.length === 0 ? (
                <div className="grid h-full min-h-64 place-items-center text-center">
                  <div className="space-y-1">
                    <span className="material-symbols-outlined text-3xl text-outline">waving_hand</span>
                    <p className="font-semibold text-sm text-on-surface">Say hello to {selectedPeer?.fullname || selectedPeer?.login}!</p>
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

            {/* Input Bar */}
            <form className="flex gap-3 border-t border-outline-variant/40 p-4 bg-surface" onSubmit={sendMessage}>
              <input
                className="min-w-0 flex-1 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                disabled={!active || !receiverId}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  !receiverId
                    ? 'Select a friend from the left sidebar…'
                    : `Message ${selectedPeer?.fullname || selectedPeer?.login || 'friend'}…`
                }
                value={draft}
              />
              <button
                className="flex items-center gap-1.5 rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
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
      ) : (
        <TeamChatPanel />
      )}

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
