import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { LayoutContext } from '@/components/Layout';
import { authFetch } from '@/lib/http';

type TeamMessage = {
  id: string;
  team_id: string;
  sender_id: string;
  sender_login?: string | null;
  sender_name?: string | null;
  content: string;
  created_at: string;
};

type TeamAck = {
  status: 'ok' | 'error';
  message?: string;
  detail?: string;
  message_id?: string;
  team_id?: string;
  pitch_id?: string;
  role?: string;
};

export interface TeamChatPanelProps {
  initialTeamId?: string;
  initialRole?: string;
  embedded?: boolean;
}

function mergeTeamMessages(current: TeamMessage[], incoming: TeamMessage[]): TeamMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    messages.set(message.id, message);
  }
  return [...messages.values()].sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );
}

export const TeamChatPanel = ({
  initialTeamId = '',
  initialRole = '',
  embedded = false,
}: TeamChatPanelProps = {}) => {
  const outletCtx = useOutletContext<LayoutContext | undefined>();
  const currentUserId = outletCtx?.me?.id;

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [pitchId, setPitchId] = useState('');
  const [teamId, setTeamId] = useState(initialTeamId);
  const [role, setRole] = useState(initialRole);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadHistory = useCallback(async (id: string) => {
    const response = await authFetch(`/messages/team/${id}`);
    if (!response.ok) {
      throw new Error(`Could not load team messages (${response.status})`);
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error('The team history endpoint returned an unexpected response');
    }
    const history = body.filter(
      (message): message is TeamMessage =>
        typeof message?.id === 'string' &&
        typeof message?.team_id === 'string' &&
        typeof message?.sender_id === 'string' &&
        typeof message?.content === 'string' &&
        typeof message?.created_at === 'string',
    );
    setMessages((current) => mergeTeamMessages(current, history));
  }, []);

  const connectToTeam = useCallback(
    (requestedTeamId: string) => {
      const normalizedTeamId = requestedTeamId.trim();
      if (!normalizedTeamId) {
        setError('Enter a team UUID to connect.');
        return;
      }

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setMessages([]);
      setTeamId(normalizedTeamId);
      setError('');
      setBusy(true);

      const socket = io('/chat', {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        withCredentials: true,
        forceNew: true,
        autoConnect: false,
        auth: currentUserId ? { user_id: currentUserId } : undefined,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (socketRef.current !== socket) return;

        socket.timeout(10000).emit(
          'join_team',
          { team_id: normalizedTeamId },
          async (timeoutError: Error | null, ack?: TeamAck) => {
            if (socketRef.current !== socket) return;

            if (timeoutError || !ack || ack.status !== 'ok') {
              setBusy(false);
              setConnected(false);
              setError(ack?.message ?? 'Could not join this team chat.');
              socket.removeAllListeners();
              socket.disconnect();
              return;
            }
            try {
              setRole(ack.role ?? initialRole ?? '');
              await loadHistory(normalizedTeamId);
              if (socketRef.current !== socket) return;
              setBusy(false);
              setConnected(true);
            } catch (historyError) {
              if (socketRef.current !== socket) return;
              setBusy(false);
              setError(
                historyError instanceof Error
                  ? historyError.message
                  : 'Could not load team messages.',
              );
              socket.removeAllListeners();
              socket.disconnect();
            }
          },
        );
      });

      socket.on('connect_error', (connectError) => {
        if (socketRef.current !== socket) return;
        setBusy(false);
        setConnected(false);
        setError(`${connectError.message}. Check that you are signed in to the backend.`);
      });

      socket.on('disconnect', () => {
        if (socketRef.current !== socket) return;
        setBusy(false);
        setConnected(false);
      });

      socket.on('receive_team_message', (payload: unknown) => {
        if (socketRef.current !== socket) return;
        if (
          typeof payload !== 'object' ||
          payload === null ||
          !('id' in payload) ||
          !('team_id' in payload) ||
          !('sender_id' in payload) ||
          !('content' in payload) ||
          !('created_at' in payload)
        ) {
          return;
        }

        const message = payload as TeamMessage;
        if (
          typeof message.id === 'string' &&
          message.team_id === normalizedTeamId &&
          typeof message.sender_id === 'string' &&
          typeof message.content === 'string' &&
          typeof message.created_at === 'string'
        ) {
          setMessages((current) => mergeTeamMessages(current, [message]));
        }
      });

      socket.connect();
    },
    [currentUserId, initialRole, loadHistory],
  );

  useEffect(() => {
    if (initialTeamId) {
      connectToTeam(initialTeamId);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initialTeamId, connectToTeam]);

  const createPitchWorkspace = async () => {
    const id = pitchId.trim();
    if (!id) {
      setError('Enter the pitch UUID first.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await authFetch(`/api/v1/teams/pitches/${id}/workspace`, {
        method: 'POST',
      });
      const result = (await response.json()) as TeamAck;
      if (!response.ok || !result.team_id) {
        throw new Error(result.message ?? result.detail ?? `Request failed (${response.status})`);
      }
      setRole(result.role ?? '');
      setTeamId(result.team_id);
      connectToTeam(result.team_id);
    } catch (workspaceError) {
      setBusy(false);
      setError(
        workspaceError instanceof Error
          ? workspaceError.message
          : 'Could not create the pitch workspace.',
      );
    }
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const socket = socketRef.current;
    const content = draft.trim();
    if (!socket?.connected || !connected) {
      setError('Join a team before sending a message.');
      return;
    }
    if (!content) {
      setError('Enter a message first.');
      return;
    }

    setBusy(true);
    setError('');
    socket.timeout(10000).emit(
      'send_team_message',
      { team_id: teamId, content },
      (timeoutError: Error | null, ack?: TeamAck) => {
        setBusy(false);
        if (timeoutError || !ack || ack.status !== 'ok') {
          setError(ack?.message ?? 'The server did not accept the team message.');
          return;
        }
        setDraft('');
      },
    );
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave_team', { team_id: teamId });
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  };

  return (
    <section className="flex h-full min-h-[32rem] flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 pb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">forum</span>
            Team Chat
          </p>
          <h2 className="mt-0.5 text-base font-bold text-on-surface">
            Workspace Conversation
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {role && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              {role}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              connected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {busy && !connected ? 'Connecting…' : connected ? 'Connected' : 'Disconnected'}
          </span>
          {!connected && teamId && (
            <button
              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary cursor-pointer"
              onClick={() => connectToTeam(teamId)}
              type="button"
            >
              Reconnect
            </button>
          )}
        </div>
      </header>

      {!embedded && (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              id="team-chat-pitch-uuid"
              name="pitch-uuid"
              aria-label="Pitch UUID"
              className="min-w-0 rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm"
              onChange={(event) => setPitchId(event.target.value)}
              placeholder="Pitch UUID (owner: create/open team)"
              value={pitchId}
            />
            <button
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50"
              disabled={busy}
              onClick={() => void createPitchWorkspace()}
              type="button"
            >
              Create / open pitch team
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              id="team-chat-team-uuid"
              name="team-uuid"
              aria-label="Team UUID"
              className="min-w-0 rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm"
              disabled={connected}
              onChange={(event) => setTeamId(event.target.value)}
              placeholder="Team UUID (members connect here)"
              value={teamId}
            />
            <button
              className="rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-bold text-on-surface disabled:opacity-50"
              disabled={busy || connected}
              onClick={() => connectToTeam(teamId)}
              type="button"
            >
              {busy ? 'Connecting…' : connected ? 'Connected' : 'Join team'}
            </button>
            {connected && (
              <button
                className="rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-bold text-on-surface"
                onClick={disconnect}
                type="button"
              >
                Leave
              </button>
            )}
          </div>
        </>
      )}

      <div className="flex min-h-[22rem] flex-1 flex-col gap-2.5 overflow-y-auto rounded-xl bg-surface-container-low p-3">
        {messages.length === 0 ? (
          <div className="m-auto text-center text-xs text-on-surface-variant py-8">
            <span className="material-symbols-outlined text-[28px] text-outline mb-1 block">
              chat_bubble_outline
            </span>
            {connected
              ? 'No messages in this workspace yet. Say hello to your team!'
              : 'Connecting to workspace team chat…'}
          </div>
        ) : (
          messages.map((message) => {
            const displayAuthor =
              message.sender_name ||
              (message.sender_login ? `@${message.sender_login}` : message.sender_id.slice(0, 8));
            const displayLogin =
              message.sender_name && message.sender_login ? `@${message.sender_login}` : '';
            return (
              <article
                className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-2xs"
                key={message.id}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface">{displayAuthor}</span>
                    {displayLogin && (
                      <span className="text-[11px] font-mono text-primary">{displayLogin}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-on-surface-variant">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-on-surface">
                  {message.content}
                </p>
              </article>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="flex gap-2" onSubmit={sendMessage}>
        <input
          id="team-chat-message-input"
          name="team-chat-message"
          className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
          disabled={!connected}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={connected ? 'Write a message to your team…' : 'Connecting to team chat…'}
          value={draft}
        />
        <button
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          disabled={!connected || busy || !draft.trim()}
          type="submit"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          Send
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error-container px-3 py-2 text-xs text-on-error-container">
          {error}
        </p>
      )}
    </section>
  );
};
