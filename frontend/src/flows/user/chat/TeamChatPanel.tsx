import { FormEvent, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

type TeamMessage = {
  id: string;
  team_id: string;
  sender_id: string;
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

type TeamUser = {
  id: string;
  login: string;
  fullname: string;
};

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

export const TeamChatPanel = () => {
  const socketRef = useRef<Socket | null>(null);
  const [pitchId, setPitchId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [availableMembers, setAvailableMembers] = useState<TeamUser[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [role, setRole] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(
    () => () => {
      socketRef.current?.disconnect();
    },
    [],
  );

  useEffect(() => {
    if (role !== 'admin' || !teamId) {
      setAvailableMembers([]);
      setSelectedMemberId('');
      return;
    }

    let cancelled = false;
    const query = new URLSearchParams();
    if (memberSearch.trim()) {
      query.set('search', memberSearch.trim());
    }
    const searchSuffix = query.size > 0 ? `?${query.toString()}` : '';
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/v1/teams/${teamId}/available-members${searchSuffix}`,
          { credentials: 'include' },
        );
        if (!response.ok) {
          throw new Error(`Could not load available members (${response.status})`);
        }
        const body: unknown = await response.json();
        if (!Array.isArray(body)) {
          throw new Error('The available members endpoint returned an unexpected response');
        }
        const users = body.filter(
          (user): user is TeamUser =>
            typeof user?.id === 'string' &&
            typeof user?.login === 'string' &&
            typeof user?.fullname === 'string',
        );
        if (!cancelled) {
          setAvailableMembers(users);
          setSelectedMemberId((current) =>
            users.some((user) => user.id === current) ? current : (users[0]?.id ?? ''),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load available members.',
          );
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [memberSearch, role, teamId]);

  const loadHistory = async (id: string) => {
    const response = await fetch(`/messages/team/${id}`, {
      credentials: 'include',
    });
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
  };

  const connectToTeam = (requestedTeamId: string) => {
    const normalizedTeamId = requestedTeamId.trim();
    if (!normalizedTeamId) {
      setError('Enter a team UUID to connect.');
      return;
    }

    socketRef.current?.disconnect();
    setMessages([]);
    setTeamId(normalizedTeamId);
    setRole('');
    setError('');
    setNotice('');
    setBusy(true);

    const socket = io('/chat', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.timeout(10000).emit(
        'join_team',
        { team_id: normalizedTeamId },
        async (timeoutError: Error | null, ack: TeamAck) => {
          if (timeoutError || ack.status !== 'ok') {
            setBusy(false);
            setConnected(false);
            setError(ack?.message ?? 'Could not join this team chat.');
            socket.disconnect();
            return;
          }
          try {
            setRole(ack.role ?? '');
            await loadHistory(normalizedTeamId);
            setBusy(false);
            setConnected(true);
          } catch (historyError) {
            setBusy(false);
            setError(
              historyError instanceof Error
                ? historyError.message
                : 'Could not load team messages.',
            );
            socket.disconnect();
          }
        },
      );
    });
    socket.on('connect_error', (connectError) => {
      setBusy(false);
      setConnected(false);
      setError(`${connectError.message}. Check that you are signed in to the backend.`);
    });
    socket.on('disconnect', () => {
      setBusy(false);
      setConnected(false);
    });
    socket.on('receive_team_message', (payload: unknown) => {
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
  };

  const createPitchWorkspace = async () => {
    const id = pitchId.trim();
    if (!id) {
      setError('Enter the pitch UUID first.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/v1/teams/pitches/${id}/workspace`, {
        method: 'POST',
        credentials: 'include',
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

  const addMember = async () => {
    const id = teamId.trim();
    const userId = selectedMemberId.trim();
    if (!id || !userId) {
      setError('Choose an available user to add.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/v1/teams/${id}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const result = (await response.json()) as TeamAck;
      if (!response.ok) {
        throw new Error(result.detail ?? `Request failed (${response.status})`);
      }
      setNotice('Member added. They can now connect to this team UUID.');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Could not add the member.');
    } finally {
      setBusy(false);
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
      (timeoutError: Error | null, ack: TeamAck) => {
        setBusy(false);
        if (timeoutError || ack.status !== 'ok') {
          setError(ack?.message ?? 'The server did not accept the team message.');
          return;
        }
        setDraft('');
      },
    );
  };

  const disconnect = () => {
    socketRef.current?.emit('leave_team', { team_id: teamId });
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  };

  return (
    <section className="flex min-h-[32rem] flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Team chat
        </p>
        <h2 className="mt-1 text-xl font-bold text-on-surface">Pitch workspace conversation</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          The pitch owner creates the workspace and becomes its admin. Only team members can join
          or read/send messages.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          aria-label="Pitch UUID"
          className="min-w-0 rounded-xl border-outline-variant bg-surface px-4 py-3 text-sm"
          onChange={(event) => setPitchId(event.target.value)}
          placeholder="Pitch UUID (owner: create/open team)"
          value={pitchId}
        />
        <button
          className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary disabled:opacity-50"
          disabled={busy}
          onClick={() => void createPitchWorkspace()}
          type="button"
        >
          Create / open pitch team
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          aria-label="Team UUID"
          className="min-w-0 rounded-xl border-outline-variant bg-surface px-4 py-3 text-sm"
          disabled={connected}
          onChange={(event) => setTeamId(event.target.value)}
          placeholder="Team UUID (members connect here)"
          value={teamId}
        />
        <button
          className="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-bold text-on-surface disabled:opacity-50"
          disabled={busy || connected}
          onClick={() => connectToTeam(teamId)}
          type="button"
        >
          {busy ? 'Connecting…' : connected ? 'Connected' : 'Join team'}
        </button>
        {connected && (
          <button
            className="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-bold text-on-surface"
            onClick={disconnect}
            type="button"
          >
            Leave
          </button>
        )}
      </div>

      {role === 'admin' && (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            aria-label="Search users to add"
            className="min-w-0 rounded-xl border-outline-variant bg-surface px-4 py-3 text-sm"
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Search users by name or login"
            value={memberSearch}
          />
          <select
            aria-label="Available team member"
            className="min-w-0 rounded-xl border-outline-variant bg-surface px-4 py-3 text-sm"
            onChange={(event) => setSelectedMemberId(event.target.value)}
            value={selectedMemberId}
          >
            {availableMembers.length === 0 ? (
              <option value="">No available users found</option>
            ) : (
              availableMembers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullname} (@{user.login})
                </option>
              ))
            )}
          </select>
          <button
            className="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-bold text-on-surface disabled:opacity-50"
            disabled={busy || !selectedMemberId}
            onClick={() => void addMember()}
            type="button"
          >
            Add member
          </button>
        </div>
      )}

      <div className="flex min-h-56 flex-1 flex-col gap-3 overflow-y-auto rounded-xl bg-surface-container-low p-4">
        {messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-on-surface-variant">
            Join a team to load its messages.
          </p>
        ) : (
          messages.map((message) => (
            <article
              className="rounded-xl bg-surface-container-lowest p-3"
              key={message.id}
            >
              <p className="whitespace-pre-wrap break-words text-sm text-on-surface">
                {message.content}
              </p>
              <p className="mt-2 text-[11px] text-on-surface-variant">
                {message.sender_id} · {new Date(message.created_at).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </div>

      <form className="flex gap-3" onSubmit={sendMessage}>
        <input
          className="min-w-0 flex-1 rounded-xl border-outline-variant bg-surface px-4 py-3 text-sm"
          disabled={!connected}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={connected ? 'Write to the team…' : 'Join a team to chat'}
          value={draft}
        />
        <button
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:opacity-50"
          disabled={!connected || busy || !draft.trim()}
          type="submit"
        >
          Send
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-primary/30 bg-primary-fixed px-4 py-3 text-sm text-on-surface">
          {notice}
        </p>
      )}
    </section>
  );
};
