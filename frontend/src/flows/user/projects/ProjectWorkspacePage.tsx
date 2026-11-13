import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { WhiteboardPage } from '@/flows/user/canvas/WhiteboardPage';
import type { OpportunityWorkspaceBundle } from './OpportunityDetailsPage';

interface TeamChatMessage {
  id: string;
  sender_id: string;
  sender_login: string;
  sender_fullname: string;
  team_id: string;
  content: string;
  created_at: string | null;
}

export const ProjectWorkspacePage: React.FC = () => {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { user } = useAuth();

  const [bundle, setBundle] = useState<OpportunityWorkspaceBundle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Presence state from /chat and /canvas
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [canvasPeerLogins, setCanvasPeerLogins] = useState<string[]>([]);

  // Team Group Chat state
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatConnected, setChatConnected] = useState<boolean>(false);
  const chatSocketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!opportunityId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/opportunities/${opportunityId}/workspace`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Not authorized to access this project workspace.');
        setLoading(false);
        return;
      }

      const data: OpportunityWorkspaceBundle = await res.json();
      setBundle(data);

      // Load team chat history
      const histRes = await fetch(
        `/api/v1/messages/team/${data.workspace.team_id}`,
        { credentials: 'include' }
      );
      if (histRes.ok) {
        const histData = await histRes.json();
        if (Array.isArray(histData)) {
          setMessages(histData);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  // Connect to /chat Socket.IO namespace for Team Group Chat + Presence
  useEffect(() => {
    const teamId = bundle?.workspace.team_id;
    if (!teamId) return;

    const socket = io('/chat', {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    chatSocketRef.current = socket;

    socket.on('connect', () => {
      setChatConnected(true);
      socket.emit(
        'join_team',
        { team_id: teamId },
        (ack?: { status?: string; online_user_ids?: string[] }) => {
          if (ack?.online_user_ids) {
            setOnlineUserIds(ack.online_user_ids);
          }
        }
      );
    });

    socket.on('disconnect', () => {
      setChatConnected(false);
    });

    socket.on(
      'team_presence',
      (payload: { team_id?: string; online_user_ids?: string[] }) => {
        if (payload?.team_id === teamId && Array.isArray(payload.online_user_ids)) {
          setOnlineUserIds(payload.online_user_ids);
        }
      }
    );

    socket.on('receive_team_message', (msg: TeamChatMessage) => {
      if (msg.team_id !== teamId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.emit('leave_team', { team_id: teamId });
      socket.disconnect();
      chatSocketRef.current = null;
    };
  }, [bundle?.workspace.team_id]);

  // Auto-scroll group chat to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendTeamMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    const teamId = bundle?.workspace.team_id;
    if (!trimmed || !teamId || !chatSocketRef.current) return;

    setChatInput('');
    chatSocketRef.current.emit(
      'send_team_message',
      { team_id: teamId, content: trimmed },
      (ack?: { status?: string; message?: TeamChatMessage }) => {
        if (ack?.status === 'ok' && ack.message) {
          const confirmed = ack.message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === confirmed.id)) return prev;
            return [...prev, confirmed];
          });
        }
      }
    );
  };

  // Compute online/offline status for each teammate in the roster
  const membersWithPresence = useMemo(() => {
    if (!bundle) return [];
    const onlineSet = new Set(onlineUserIds);
    const canvasLoginSet = new Set(canvasPeerLogins);

    return bundle.members.map((member) => {
      const isOnline =
        (user && member.id === user.id) ||
        onlineSet.has(member.id) ||
        canvasLoginSet.has(member.login);
      return {
        ...member,
        isOnline: Boolean(isOnline),
      };
    });
  }, [bundle, onlineUserIds, canvasPeerLogins, user]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-on-surface-variant text-xs">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span>Provisioning team workspace, whiteboard &amp; group chat...</span>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-4">
        <div className="p-6 rounded-2xl bg-error-container text-on-error-container text-xs font-semibold">
          {error || 'Workspace not found.'}
        </div>
        <Link
          to="/my-projects"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to My Projects
        </Link>
      </div>
    );
  }

  const onlineCount = membersWithPresence.filter((m) => m.isOnline).length;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-3">
      {/* Workspace Top Bar */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/my-projects"
            className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center gap-1 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>My Projects</span>
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold text-on-surface truncate">
                {bundle.opportunity.title}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary-fixed text-on-primary-fixed shrink-0">
                Workspace
              </span>
            </div>
            {bundle.pitch && (
              <p className="text-[11px] text-on-surface-variant truncate">
                Pitch: {bundle.pitch.title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/my-projects/${bundle.opportunity.id}`}
            className="px-3 py-1.5 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">info</span>
            <span>Opportunity Details</span>
          </Link>
        </div>
      </div>

      {/* Split-Screen Main Area: Left/Center = Collaborative Whiteboard, Right Sidebar = Presence + Team Group Chat */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
        {/* Main Stage: Collaborative Whiteboard */}
        <div className="flex-1 min-w-0 min-h-[420px] lg:min-h-0 flex flex-col">
          <WhiteboardPage
            embeddedDocumentId={bundle.workspace.canvas_document_id}
            hideHeader={true}
            onPeersChange={setCanvasPeerLogins}
          />
        </div>

        {/* Right Sidebar (Top-to-Bottom: Teammates Online/Offline + Real-Time Group Chat) */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0 bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden h-[520px] lg:h-full">
          {/* Top Section: Teammates Online / Offline */}
          <div className="p-3.5 border-b border-outline-variant bg-surface-container-low/60 shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  groups
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface font-mono">
                  Teammates ({membersWithPresence.length})
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                {onlineCount} Connected
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {membersWithPresence.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-surface border border-outline-variant/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">
                        {member.fullname.slice(0, 2).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          member.isOnline ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate leading-tight">
                        {member.fullname}
                      </p>
                      <p className="text-[10px] text-on-surface-variant truncate">
                        @{member.login} · {member.role}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      member.isOnline
                        ? 'bg-green-100 text-green-800'
                        : 'bg-surface-container text-outline'
                    }`}
                  >
                    {member.isOnline ? 'Connected' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Section (Top-to-Bottom Flex-1): Real-Time Team Group Chat */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-3.5 py-2.5 border-b border-outline-variant flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  forum
                </span>
                <span className="text-xs font-bold text-on-surface">
                  Team Group Chat
                </span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    chatConnected ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                />
                {chatConnected ? 'Live' : 'Connecting'}
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 bg-surface/50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[32px] text-outline mb-1">
                    chat_bubble_outline
                  </span>
                  <p className="text-xs font-semibold">No team messages yet</p>
                  <p className="text-[11px] text-outline mt-0.5">
                    Say hello to your teammates while collaborating on the whiteboard!
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = Boolean(user && msg.sender_id === user.id);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 px-1">
                        <span className="text-[10px] font-bold text-on-surface-variant">
                          {isMe ? 'You' : msg.sender_fullname || `@${msg.sender_login}`}
                        </span>
                        {msg.created_at && (
                          <span className="text-[9px] text-outline">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                          isMe
                            ? 'bg-primary text-on-primary rounded-br-xs'
                            : 'bg-surface-container-high text-on-surface rounded-bl-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Bar */}
            <form
              onSubmit={handleSendTeamMessage}
              className="p-2.5 border-t border-outline-variant bg-surface-container-lowest flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message your team..."
                className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                aria-label="Send team message"
                className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:opacity-90 disabled:opacity-40 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
};

