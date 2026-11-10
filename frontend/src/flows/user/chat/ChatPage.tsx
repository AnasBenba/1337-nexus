import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { authFetch, getAuthToken } from '@/lib/auth';

type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  offlineMessage?: boolean;
  delivered?: boolean;
  read?: boolean;
};

type ConversationPeer = {
  id: string;
  login: string;
  fullname: string;
  avatar_url?: string | null;
  campus?: string | null;
  is_online?: boolean;
};

type Conversation = {
  peer: ConversationPeer;
  last_message?: {
    id: string;
    content: string;
    sender_id: string;
    receiver_id?: string;
    created_at: string;
    is_read: boolean;
  } | null;
  unread_count: number;
};

type SendAck = {
  status: 'ok' | 'error';
  message?: string;
  message_id?: string;
  delivered?: boolean;
};

function parseMessage(value: unknown): ChatMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const senderId = String(raw.from ?? raw.sender_id ?? '');
  const receiverId = String(raw.to ?? raw.receiver_id ?? '');
  const content = String(raw.content ?? '');
  if (!senderId || !content) return null;

  return {
    id: String(raw.id ?? ''),
    senderId,
    receiverId,
    content,
    createdAt: String(raw.created_at ?? new Date().toISOString()),
    offlineMessage: Boolean(raw.offline_message),
    delivered: raw.is_delivered !== undefined ? Boolean(raw.is_delivered) : undefined,
    read: raw.is_read !== undefined ? Boolean(raw.is_read) : false,
  };
}

export const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const directPeerId = searchParams.get('user');

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedPeerRef = useRef<ConversationPeer | null>(null);
  const currentUserIdRef = useRef<string>('');

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserLogin, setCurrentUserLogin] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<ConversationPeer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<ConversationPeer | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  // Keep refs in sync with state for Socket.IO event closures
  useEffect(() => {
    selectedPeerRef.current = selectedPeer;
  }, [selectedPeer]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // 1. Fetch current authenticated user
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await authFetch('/api/v1/profile/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.id);
          setCurrentUserLogin(data.login);
        }
      } catch {
        // Fallback
      }
    };
    void fetchMe();
  }, []);

  // 2. Fetch conversations and friends
  const loadConversationsAndFriends = async () => {
    try {
      const [convRes, friendsRes] = await Promise.all([
        authFetch('/api/v1/chat/conversations'),
        authFetch('/api/v1/friends'),
      ]);

      if (convRes.ok) {
        const convData: Conversation[] = await convRes.json();
        setConversations(convData);
      }
      if (friendsRes.ok) {
        const friendsData: ConversationPeer[] = await friendsRes.json();
        setFriends(friendsData);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    void loadConversationsAndFriends();
  }, []);

  // 3. Connect Socket.IO to /chat namespace ONCE on mount
  useEffect(() => {
    const token = getAuthToken();
    const socket = io('/chat', {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      withCredentials: true,
      autoConnect: true,
      auth: token ? { token } : undefined,
      query: token ? { token } : undefined,
    });
    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', () => {
      setStatus('connected');
      setError(null);
    });

    socket.on('connect_error', (err) => {
      setStatus('disconnected');
      setError(`Realtime chat error: ${err.message}`);
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('receive_dm', (payload: unknown) => {
      const msg = parseMessage(payload);
      if (!msg) return;

      const activePeer = selectedPeerRef.current;
      if (
        activePeer &&
        (msg.senderId === activePeer.id || msg.receiverId === activePeer.id)
      ) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id && msg.id !== '');
          if (!exists) {
            return [...prev, msg];
          }
          return prev;
        });

        // Acknowledge read if it's sent to me
        if (msg.senderId === activePeer.id && msg.id) {
          socket.emit('dm_read', { message_id: msg.id });
        }
      }

      // Update conversations list so sidebar snippet and badge update immediately
      void loadConversationsAndFriends();
    });

    socket.on('dm_read_receipt', (payload: unknown) => {
      if (typeof payload === 'object' && payload !== null) {
        const { message_id } = payload as { message_id?: string };
        if (message_id) {
          setMessages((prev) =>
            prev.map((m) => (m.id === message_id ? { ...m, read: true } : m)),
          );
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // 4. Handle directPeerId query param
  useEffect(() => {
    if (directPeerId) {
      // Check if peer is already in conversations or friends
      const peer =
        conversations.find((c) => c.peer.id === directPeerId)?.peer ||
        friends.find((f) => f.id === directPeerId);

      if (peer) {
        setSelectedPeer(peer);
      } else {
        // Fetch peer profile directly
        void authFetch(`/api/v1/profile/${directPeerId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.id) {
              setSelectedPeer({
                id: data.id,
                login: data.login,
                fullname: data.fullname,
                avatar_url: data.avatar_url,
                campus: data.campus,
                is_online: true,
              });
            }
          });
      }
    }
  }, [directPeerId, conversations, friends]);

  // 5. Load history when selectedPeer changes
  useEffect(() => {
    if (!selectedPeer) return;

    const loadHistory = async () => {
      try {
        const res = await authFetch(`/api/v1/chat/messages/${selectedPeer.id}`);
        if (res.ok) {
          const body: unknown[] = await res.json();
          const history = body
            .map(parseMessage)
            .filter((m): m is ChatMessage => m !== null);
          setMessages(history);

          // Mark unread incoming messages as read
          for (const m of history) {
            if (m.senderId === selectedPeer.id && !m.read && m.id && socketRef.current) {
              socketRef.current.emit('dm_read', { message_id: m.id });
            }
          }
        }
      } catch {
        // Ignored
      }
    };

    void loadHistory();
  }, [selectedPeer]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !selectedPeer || sending) return;

    setSending(true);
    setDraft('');

    const socket = socketRef.current;
    if (socket && socket.connected) {
      // Send via Socket.IO
      socket.emit(
        'send_dm',
        { receiver_id: selectedPeer.id, content },
        (ack?: SendAck) => {
          setSending(false);
          const newMsg: ChatMessage = {
            id: ack?.message_id || `temp-${Date.now()}`,
            senderId: currentUserId || currentUserIdRef.current,
            receiverId: selectedPeer.id,
            content,
            createdAt: new Date().toISOString(),
            delivered: ack?.delivered ?? false,
            read: false,
          };
          setMessages((prev) => [...prev, newMsg]);
          void loadConversationsAndFriends();
        },
      );
    } else {
      // Fallback via REST
      try {
        const res = await authFetch('/api/v1/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiver_id: selectedPeer.id, content }),
        });
        if (res.ok) {
          const data = await res.json();
          const newMsg: ChatMessage = {
            id: data.id,
            senderId: currentUserId,
            receiverId: selectedPeer.id,
            content,
            createdAt: data.created_at,
            delivered: data.is_delivered,
            read: false,
          };
          setMessages((prev) => [...prev, newMsg]);
          void loadConversationsAndFriends();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        setSending(false);
      }
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.peer.fullname.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.peer.login.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-6.5rem)] flex flex-col md:flex-row gap-4">
      {/* LEFT COLUMN: Conversations & Friends */}
      <aside className="w-full md:w-84 lg:w-96 flex flex-col bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-on-surface">Messages</h1>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'connected'
                  ? 'bg-green-500'
                  : status === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-outline'
              }`}
              title={`Socket.IO: ${status}`}
            />
          </div>
          <Link
            to="/friends"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">group</span>
            Friends
          </Link>
        </div>

        {/* Filter input */}
        <div className="p-3 border-b border-outline-variant">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Filter chats or friends..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Quick Friends Horizontal Carousel */}
        {friends.length > 0 && (
          <div className="p-3 border-b border-outline-variant bg-surface-container-low/40">
            <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Friends Quick Access
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {friends.map((friend) => (
                <button
                  type="button"
                  key={friend.id}
                  onClick={() => setSelectedPeer(friend)}
                  className={`flex flex-col items-center gap-1 shrink-0 p-1 rounded-xl transition-transform hover:scale-105 ${
                    selectedPeer?.id === friend.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="relative">
                    {friend.avatar_url ? (
                      <img
                        src={friend.avatar_url}
                        alt={friend.login}
                        className="w-10 h-10 rounded-full object-cover border border-outline-variant"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container font-bold text-xs flex items-center justify-center">
                        {friend.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-surface" />
                  </div>
                  <span className="text-[10px] font-mono text-on-surface truncate w-12 text-center">
                    {friend.login}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/40">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-4 text-on-surface-variant">
              <span className="material-symbols-outlined text-[36px] text-outline mb-1">
                chat_bubble_outline
              </span>
              <p className="text-xs font-semibold">No conversations yet</p>
              <p className="text-[11px] text-outline mt-1">
                Click a friend above or visit the Friends page to start chatting!
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedPeer?.id === conv.peer.id;
              return (
                <button
                  type="button"
                  key={conv.peer.id}
                  onClick={() => setSelectedPeer(conv.peer)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                    isSelected
                      ? 'bg-primary-fixed/30 border-l-4 border-primary'
                      : 'hover:bg-surface-container'
                  }`}
                >
                  <div className="relative shrink-0">
                    {conv.peer.avatar_url ? (
                      <img
                        src={conv.peer.avatar_url}
                        alt={conv.peer.login}
                        className="w-11 h-11 rounded-full object-cover border border-outline-variant"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container font-bold text-sm flex items-center justify-center">
                        {conv.peer.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-surface" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-on-surface truncate">
                        {conv.peer.fullname}
                      </span>
                      {conv.last_message && (
                        <span className="text-[10px] text-on-surface-variant font-mono">
                          {new Date(conv.last_message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant flex items-center justify-between mt-1">
                      <p className="truncate pr-2">
                        {conv.last_message ? conv.last_message.content : 'No messages'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT COLUMN: Active Chat Thread */}
      <section className="flex-1 flex flex-col bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        {selectedPeer ? (
          <>
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/30">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {selectedPeer.avatar_url ? (
                    <img
                      src={selectedPeer.avatar_url}
                      alt={selectedPeer.login}
                      className="w-10 h-10 rounded-full object-cover border border-outline-variant"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container font-bold text-xs flex items-center justify-center">
                      {selectedPeer.login.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-surface" />
                </div>

                <div>
                  <h2 className="font-bold text-sm text-on-surface flex items-center gap-2">
                    {selectedPeer.fullname}
                    <span className="text-xs font-mono text-on-surface-variant font-normal">
                      @{selectedPeer.login}
                    </span>
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">
                    {selectedPeer.campus || '1337 Benguerir'} • Realtime Direct Messaging
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/profile/${selectedPeer.id}`}
                  className="px-3 py-1.5 bg-surface-container text-on-surface text-xs font-semibold rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  Profile
                </Link>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-surface/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[44px] text-outline mb-2">
                    forum
                  </span>
                  <p className="font-semibold text-sm">Say hello to {selectedPeer.fullname}!</p>
                  <p className="text-xs text-outline mt-1 max-w-xs">
                    Messages are delivered in real time via Socket.IO and stored safely for offline
                    delivery.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const myId = (currentUserId || currentUserIdRef.current || '').toLowerCase();
                  const peerId = (selectedPeer?.id || '').toLowerCase();
                  const sId = (message.senderId || '').toLowerCase();
                  const isMine =
                    (Boolean(myId) && sId === myId) ||
                    (Boolean(peerId) && sId !== peerId);

                  return (
                    <div
                      key={message.id || `${message.createdAt}-${index}`}
                      className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2 my-1`}
                    >
                      {/* Peer avatar on left */}
                      {!isMine && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 shadow-xs overflow-hidden border border-primary/20 mb-1">
                          {selectedPeer.avatar_url ? (
                            <img
                              src={selectedPeer.avatar_url}
                              alt={selectedPeer.login}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            selectedPeer.login.slice(0, 2).toUpperCase()
                          )}
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                          isMine
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {/* Sender header */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`text-[11px] font-bold ${
                              isMine ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {isMine ? 'You' : selectedPeer.fullname}
                          </span>
                          <span
                            className={`text-[10px] ${
                              isMine ? 'text-blue-200/80' : 'text-slate-400'
                            }`}
                          >
                            @{isMine ? currentUserLogin || 'me' : selectedPeer.login}
                          </span>
                        </div>

                        {/* Content */}
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                          {message.content}
                        </p>

                        {/* Timestamp & Delivery */}
                        <div
                          className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                            isMine ? 'text-blue-100/80' : 'text-slate-400'
                          }`}
                        >
                          <time dateTime={message.createdAt}>
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                          {isMine && (
                            <span className="material-symbols-outlined text-[14px]">
                              {message.read ? 'done_all' : 'done'}
                            </span>
                          )}
                          {message.offlineMessage && (
                            <span className="italic text-[9px]">• offline synced</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3.5 border-t border-outline-variant flex items-center gap-2 bg-surface-container-lowest">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Write a message to ${selectedPeer.fullname}...`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="px-5 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span>{sending ? 'Sending...' : 'Send'}</span>
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant">
            <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-4 shadow-sm">
              <span className="material-symbols-outlined text-[32px]">chat</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface">1337 Real-Time Chat</h2>
            <p className="text-sm text-outline mt-1.5 max-w-sm">
              Select an active conversation on the left or click any friend to start messaging
              instantly.
            </p>
          </div>
        )}
      </section>

      {error && (
        <div className="fixed bottom-4 right-4 bg-error-container text-on-error-container p-3 rounded-xl shadow-lg text-xs z-50">
          {error}
        </div>
      )}
    </div>
  );
};
