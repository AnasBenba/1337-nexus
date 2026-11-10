import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authFetch } from '@/lib/auth';

interface Card {
  id: string;
  column_id: string;
  title: string;
  description?: string | null;
  rank: string;
}

interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  cards: Card[];
}

interface BoardDetail {
  id: string;
  team_id: string;
  name: string;
  board_revision: number;
  columns: Column[];
}

export const BoardPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New column modal
  const [showColModal, setShowColModal] = useState(false);
  const [colName, setColName] = useState('');

  // New card modal
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedColId, setSelectedColId] = useState<string | null>(null);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchBoard = async () => {
    if (!boardId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/boards/${boardId}`);
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
      } else {
        // Attempt team fallback if boardId was a team/project id
        const teamRes = await authFetch(`/boards/team/${boardId}`);
        if (teamRes.ok) {
          const data = await teamRes.json();
          setBoard(data);
        } else {
          setErrorMsg('Board not found or you do not have permission to access it.');
        }
      }
    } catch {
      setErrorMsg('Failed to connect to Kanban board service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, [boardId]);

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!board || !colName.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/boards/${board.id}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: colName.trim(),
          board_revision: board.board_revision,
        }),
      });

      if (res.ok) {
        setShowColModal(false);
        setColName('');
        await fetchBoard();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Could not add column');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!board || !selectedColId || !cardTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/boards/columns/${selectedColId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cardTitle.trim(),
          description: cardDesc.trim() || null,
          board_revision: board.board_revision,
        }),
      });

      if (res.ok) {
        setShowCardModal(false);
        setCardTitle('');
        setCardDesc('');
        setSelectedColId(null);
        await fetchBoard();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Could not create card');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveCard = async (cardId: string, destColId: string) => {
    if (!board) return;
    try {
      const res = await authFetch(`/boards/${board.id}/cards/${cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_column_id: destColId,
          board_revision: board.board_revision,
        }),
      });

      if (res.ok) {
        await fetchBoard();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Could not move card');
      }
    } catch {
      alert('Network error while moving card');
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!board || !confirm('Are you sure you want to delete this empty column?')) return;
    try {
      const res = await authFetch(`/boards/${board.id}/columns/${colId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_revision: board.board_revision,
        }),
      });

      if (res.ok) {
        await fetchBoard();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Cannot delete column (must be empty and retain at least one column)');
      }
    } catch {
      alert('Network error while deleting column');
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-on-surface-variant text-sm">Loading Kanban workspace...</div>;
  }

  if (errorMsg || !board) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-outline">view_kanban</span>
        <h2 className="text-xl font-bold text-on-surface">Workspace Board Unavailable</h2>
        <p className="text-xs text-on-surface-variant">{errorMsg || 'Could not load board.'}</p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4 animate-in fade-in duration-300">
      {/* Board Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-low text-on-surface hover:bg-surface-container"
            title="Back to Projects"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">view_kanban</span>
              {board.name}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-outline font-mono">
              <span>Revision #{board.board_revision}</span>
              <span>•</span>
              <span>{board.columns.length} Columns</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowColModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Add Column
          </button>
        </div>
      </div>

      {/* Kanban Horizontal Board Columns */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start select-none">
        {board.columns.map((col, colIdx) => (
          <div
            key={col.id}
            className="w-80 shrink-0 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl flex flex-col max-h-full shadow-sm"
          >
            {/* Column Header */}
            <div className="p-4 border-b border-outline-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <h3 className="font-bold text-sm text-on-surface">{col.name}</h3>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-mono">
                  {col.cards.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedColId(col.id);
                    setShowCardModal(true);
                  }}
                  className="w-7 h-7 rounded-lg text-outline hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                  title="Add Task"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                </button>
                {col.cards.length === 0 && board.columns.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteColumn(col.id)}
                    className="w-7 h-7 rounded-lg text-outline hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                    title="Delete Empty Column"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                )}
              </div>
            </div>

            {/* Column Cards */}
            <div className="p-3 flex-1 overflow-y-auto space-y-2.5">
              {col.cards.length === 0 ? (
                <div className="text-center py-8 text-[11px] text-outline border border-dashed border-outline-variant/40 rounded-xl">
                  No cards in this stage
                </div>
              ) : (
                col.cards.map((card) => (
                  <div
                    key={card.id}
                    className="p-3.5 bg-surface rounded-xl border border-outline-variant/60 shadow-sm hover:border-primary/40 transition-all"
                  >
                    <div className="font-semibold text-xs text-on-surface leading-snug">{card.title}</div>
                    {card.description && (
                      <p className="text-[11px] text-on-surface-variant mt-1.5 line-clamp-2 leading-relaxed">
                        {card.description}
                      </p>
                    )}

                    {/* Move controls */}
                    <div className="mt-3 pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] text-outline">
                      <span className="font-mono text-[9px] uppercase">Lexo #{card.rank.slice(0, 4)}</span>

                      <div className="flex items-center gap-1">
                        {colIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleMoveCard(card.id, board.columns[colIdx - 1].id)}
                            className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                            title={`Move to ${board.columns[colIdx - 1].name}`}
                          >
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                          </button>
                        )}
                        {colIdx < board.columns.length - 1 && (
                          <button
                            type="button"
                            onClick={() => void handleMoveCard(card.id, board.columns[colIdx + 1].id)}
                            className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                            title={`Move to ${board.columns[colIdx + 1].name}`}
                          >
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Add Button */}
            <div className="p-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => {
                  setSelectedColId(col.id);
                  setShowCardModal(true);
                }}
                className="w-full py-1.5 rounded-lg text-xs font-medium text-outline hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Card
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Column Modal */}
      {showColModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/60 max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-on-surface mb-3">Add Board Column</h3>
            <form onSubmit={handleCreateColumn} className="space-y-3">
              <input
                type="text"
                placeholder="Column name (e.g. In QA, Review)"
                value={colName}
                onChange={(e) => setColName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowColModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/60 max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-on-surface mb-3">Create Task Card</h3>
            <form onSubmit={handleCreateCard} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Implement WebSocket reconnection logic"
                  value={cardTitle}
                  onChange={(e) => setCardTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface mb-1">Description (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Details, steps, or acceptance criteria..."
                  value={cardDesc}
                  onChange={(e) => setCardDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardPage;
