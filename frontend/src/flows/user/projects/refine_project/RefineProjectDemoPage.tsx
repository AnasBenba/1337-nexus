import React, { useEffect, useState } from 'react';
import { RefineEntryButton } from './RefineEntryButton';
import { RefineProjectModal } from './RefineProjectModal';
import { ModalState } from './types';

interface PitchItem {
  id: string;
  title: string;
  content: string;
  rendered_content?: string;
  category?: string;
  status?: string;
  description?: string;
  author_id?: string;
}

const FALLBACK_PITCH: PitchItem = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'StudySync: Peer Code Review Network',
  content:
    'Problem: 1337 students often wait hours for peer evaluations on graphics and algorithm projects.\n\n' +
    'Solution: A campus-native peer review matchmaking tool that pairs students based on project progression and intra evaluation points.\n\n' +
    'Impact: Reduce idle evaluation waiting time by 60% across Circles 01-04.',
  category: 'Technology',
  status: 'draft',
  description: 'Campus-native peer review matchmaking',
};

export const RefineProjectDemoPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePreviewState, setActivePreviewState] = useState<ModalState | undefined>(undefined);
  const [pitches, setPitches] = useState<PitchItem[]>([]);
  const [selectedPitchId, setSelectedPitchId] = useState<string>('');
  const [isLoadingPitches, setIsLoadingPitches] = useState(true);

  // Load real pitches from database
  const loadPitches = () => {
    setIsLoadingPitches(true);
    fetch('/api/v1/user/pitches')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data: PitchItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setPitches(data);
          setSelectedPitchId((prev) => (prev && data.some((p) => p.id === prev) ? prev : data[0].id));
        } else {
          setPitches([]);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Could not load database pitches, using fallback:', err);
      })
      .finally(() => {
        setIsLoadingPitches(false);
      });
  };

  useEffect(() => {
    loadPitches();
  }, []);

  // Determine active pitch (from database or fallback)
  const activePitch: PitchItem =
    pitches.find((p) => p.id === selectedPitchId) || (pitches.length > 0 ? pitches[0] : FALLBACK_PITCH);

  const [pitchContentOverride, setPitchContentOverride] = useState<string | null>(null);

  // Reset content override when active pitch changes
  useEffect(() => {
    setPitchContentOverride(null);
  }, [activePitch.id]);

  const displayContent = pitchContentOverride ?? activePitch.content;

  const openInState = (state?: ModalState) => {
    setActivePreviewState(state);
    setIsModalOpen(true);
  };

  const handlePitchUpdated = (newVersionToken: string) => {
    // eslint-disable-next-line no-console
    console.log('Pitch updated via AI suggestion! New version token:', newVersionToken);
    setPitchContentOverride((prev) => (prev ?? activePitch.content) + '\n\n[Updated with AI Refinement: ' + newVersionToken.slice(0, 8) + ']');
    // Also re-fetch pitches to ensure DB sync
    loadPitches();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in">
      {/* Developer State Switcher Toolbar */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs font-bold text-slate-200 tracking-wider uppercase">
              Developer State Preview Toolbar (States A to J)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            AI-302 Pitch Refiner
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => openInState(undefined)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-brand text-white hover:bg-brand-hover shadow-sm transition-all"
          >
            ⚡ Live Backend Flow
          </button>
          <button
            type="button"
            onClick={() => openInState('A')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            A: Start
          </button>
          <button
            type="button"
            onClick={() => openInState('B')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            B: Submitting
          </button>
          <button
            type="button"
            onClick={() => openInState('C')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            C: Queued (3-Step)
          </button>
          <button
            type="button"
            onClick={() => openInState('D')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            D: Results
          </button>
          <button
            type="button"
            onClick={() => openInState('G')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            G: Stale
          </button>
          <button
            type="button"
            onClick={() => openInState('I')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            I: Failed
          </button>
          <button
            type="button"
            onClick={() => openInState('J')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            J: Empty
          </button>
        </div>
      </div>

      {/* Database Pitch Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">database</span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
              Database Pitch Selector
            </h4>
            <p className="text-xs text-slate-500">
              {pitches.length > 0
                ? `${pitches.length} real pitch(es) loaded from PostgreSQL`
                : isLoadingPitches
                  ? 'Loading pitches from database...'
                  : 'No database pitches found (using demo fallback)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pitches.length > 0 ? (
            <select
              value={activePitch.id}
              onChange={(e) => setSelectedPitchId(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
            >
              {pitches.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || 'Untitled Pitch'} ({p.category || 'TECH'})
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            onClick={loadPitches}
            title="Refresh pitches from database"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Pitch Dashboard View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-surface to-surface-container-low">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-brand/10 text-brand">
                {activePitch.category || 'Technology'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-200 capitalize">
                {activePitch.status || 'Draft'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                UUID: {activePitch.id}
              </span>
            </div>

            <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 tracking-tight">
              {activePitch.title}
            </h1>

            <p className="text-xs md:text-sm text-slate-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-slate-400">person</span>
              <span>
                {activePitch.author_id ? `Author: ${activePitch.author_id.slice(0, 8)}...` : 'Soufiane El B. (@sel-bou) · 1337 Benguerir · Circle 04'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sparkle "Refine with AI" Entry Button */}
            <RefineEntryButton
              onClick={() => openInState(undefined)}
              className="shadow-md"
            />
          </div>
        </div>

        {/* Pitch Content Details */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <h3 className="font-display font-bold text-slate-900 text-sm uppercase font-mono tracking-wider text-slate-500">
              Project Description &amp; Pitch Content
            </h3>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm text-slate-800 whitespace-pre-line leading-relaxed font-sans">
              {displayContent}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-xs font-mono text-slate-500 uppercase font-bold">Category</span>
              <p className="text-sm font-semibold text-slate-900">{activePitch.category || 'Technology'}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-xs font-mono text-slate-500 uppercase font-bold">Status</span>
              <p className="text-sm font-semibold text-slate-900 capitalize">{activePitch.status || 'Draft'}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-xs font-mono text-slate-500 uppercase font-bold">Tech Stack</span>
              <p className="text-sm font-semibold text-slate-900">FastAPI, PostgreSQL, React, SSE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Refine Project Modal */}
      <RefineProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        pitchId={activePitch.id}
        projectTitle={activePitch.title}
        initialState={activePreviewState}
        onPitchUpdated={handlePitchUpdated}
      />
    </div>
  );
};
