import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WhiteboardPage } from '@/flows/user/canvas';
import { TeamChatPanel } from '@/flows/user/chat/TeamChatPanel';
import { authFetch } from '@/lib/http';

interface OpportunityWorkspaceData {
  team_id: string;
  opportunity_id: string;
  opportunity_title: string;
  pitch_id: string;
  pitch_title: string;
  document_id: string;
  board_id: string;
  channel_id: string;
  role: string;
}

type WorkspaceViewMode = 'split' | 'whiteboard' | 'chat';

export const OpportunityWorkspacePage: React.FC = () => {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<OpportunityWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('split');
  const [onlinePeers, setOnlinePeers] = useState<string[]>([]);

  useEffect(() => {
    if (!opportunityId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    authFetch(`/api/teams/opportunities/${opportunityId}/workspace`, {
      method: 'POST',
    })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(errBody.detail || `Could not open workspace (${res.status})`);
        }
        return res.json() as Promise<OpportunityWorkspaceData>;
      })
      .then((data) => {
        if (!cancelled) {
          setWorkspace(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load workspace');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-on-surface-variant">
        <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
          progress_activity
        </span>
        <p className="text-sm font-medium">Provisioning opportunity workspace…</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-2xl border border-error/30 bg-error-container p-6 text-on-error-container shadow-sm">
        <div className="flex items-center gap-2 font-bold text-base mb-2">
          <span className="material-symbols-outlined">error</span>
          Workspace Unavailable
        </div>
        <p className="text-sm mb-4">{error || 'Could not load opportunity workspace.'}</p>
        <button
          type="button"
          onClick={() => navigate('/opportunities')}
          className="px-4 py-2 rounded-xl bg-surface text-on-surface text-xs font-bold hover:opacity-90 cursor-pointer"
        >
          Back to Opportunities
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/opportunities')}
            title="Back to Opportunities"
            className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant bg-surface text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                {workspace.pitch_title}
              </span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                {workspace.role === 'admin' ? 'Owner / Admin' : 'Team Member'}
              </span>
              {onlinePeers.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 text-[11px] font-medium text-on-surface-variant">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {onlinePeers.length} on whiteboard
                </span>
              )}
            </div>
            <h1 className="mt-1 text-xl font-bold text-on-surface tracking-tight">
              {workspace.opportunity_title} — Team Workspace
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-surface-container p-1">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">vertical_split</span>
              Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('whiteboard')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'whiteboard'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">draw</span>
              Whiteboard
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chat')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'chat'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">forum</span>
              Team Chat
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/boards/${workspace.board_id}`)}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px] text-primary">view_kanban</span>
            View Board
          </button>
        </div>
      </div>

      {/* Main Workspace Area: Collaborative Whiteboard + Team Chat */}
      <div
        className={
          viewMode === 'split'
            ? 'grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5 items-stretch'
            : 'flex flex-col'
        }
      >
        {(viewMode === 'split' || viewMode === 'whiteboard') && (
          <div className="flex flex-col min-h-[38rem]">
            <WhiteboardPage
              embeddedDocumentId={workspace.document_id}
              hideHeader
              onPeersChange={setOnlinePeers}
            />
          </div>
        )}

        {(viewMode === 'split' || viewMode === 'chat') && (
          <div className="flex flex-col min-h-[38rem]">
            <TeamChatPanel
              initialTeamId={workspace.team_id}
              initialRole={workspace.role}
              embedded
            />
          </div>
        )}
      </div>
    </div>
  );
};
