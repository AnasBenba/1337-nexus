import React, { useState } from 'react';
import { RefineEntryButton } from './RefineEntryButton';
import { RefineProjectModal } from './RefineProjectModal';
import { ModalState } from './types';

export const RefineProjectDemoPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePreviewState, setActivePreviewState] = useState<ModalState | undefined>(undefined);
  const pitchTitle = 'StudySync: Peer Code Review Network';
  const [pitchContent, setPitchContent] = useState(
    'Problem: 1337 students often wait hours for peer evaluations on graphics and algorithm projects.\n\n' +
      'Solution: A campus-native peer review matchmaking tool that pairs students based on project progression and intra evaluation points.\n\n' +
      'Impact: Reduce idle evaluation waiting time by 60% across Circles 01-04.'
  );

  // Demo pitch ID (UUID format)
  const [demoPitchId] = useState('00000000-0000-0000-0000-000000000001');

  const openInState = (state?: ModalState) => {
    setActivePreviewState(state);
    setIsModalOpen(true);
  };

  const handlePitchUpdated = (newVersionToken: string) => {
    // eslint-disable-next-line no-console
    console.log('Pitch updated via AI suggestion! New version token:', newVersionToken);
    setPitchContent((prev) => prev + '\n\n[Updated with AI Refinement: ' + newVersionToken.slice(0, 8) + ']');
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

      {/* Pitch Dashboard View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-surface to-surface-container-low">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-brand/10 text-brand">
                Technology
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Draft
              </span>
              <span className="text-xs font-mono text-slate-500">
                Created: Today, 14:30
              </span>
            </div>

            <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 tracking-tight">
              {pitchTitle}
            </h1>

            <p className="text-xs md:text-sm text-slate-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-slate-400">person</span>
              <span>Soufiane El B. (@sel-bou) · 1337 Benguerir · Circle 04</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >
              Edit Pitch
            </button>

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
              {pitchContent}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-xs font-mono text-slate-500 uppercase font-bold">Target Campus</span>
              <p className="text-sm font-semibold text-slate-900">1337 Benguerir &amp; Khouribga</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-xs font-mono text-slate-500 uppercase font-bold">Evaluation Circle</span>
              <p className="text-sm font-semibold text-slate-900">Circles 01 - 04 Capstone</p>
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
        pitchId={demoPitchId}
        projectTitle={pitchTitle}
        initialState={activePreviewState}
        onPitchUpdated={handlePitchUpdated}
      />
    </div>
  );
};
