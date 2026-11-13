import { FormEvent, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RefineProjectModal } from '@/flows/user/projects/refine_project';

export const CATEGORIES = [
  {
    id: 'Technology',
    name: 'Technology',
    icon: 'terminal',
    badge: 'C/C++, Systems, Web',
    description: 'Algorithms, systems, tools, and technical frameworks',
  },
  {
    id: 'Education',
    name: 'Education',
    icon: 'school',
    badge: 'Peer Learning & Piscine',
    description: 'Peer evaluation aids, coding tutorials, and study resources',
  },
  {
    id: 'Social Impact',
    name: 'Social Impact',
    icon: 'volunteer_activism',
    badge: 'Community & Culture',
    description: 'Campus life improvement, community tools, and peer wellness',
  },
  {
    id: 'Entertainment',
    name: 'Entertainment',
    icon: 'sports_esports',
    badge: 'Gaming & Graphics',
    description: 'Game design, 3D graphics, Raycasting, and interactive media',
  },
  {
    id: 'Business',
    name: 'Business',
    icon: 'storefront',
    badge: 'Startups & SaaS',
    description: 'Incubator products, entrepreneurial ventures, and micro-SaaS',
  },
  {
    id: 'Environment',
    name: 'Environment',
    icon: 'eco',
    badge: 'Green Tech & IoT',
    description: 'Eco-tracking, hardware automation, and energy-saving tools',
  },
  {
    id: 'Finance',
    name: 'Finance',
    icon: 'payments',
    badge: 'FinTech & Tokenomics',
    description: 'Expense splitters, campus trade, crypto, and payment protocols',
  },
  {
    id: 'Health',
    name: 'Health',
    icon: 'favorite',
    badge: 'Wellness & Fitness',
    description: 'Ergonomics, posture, hydration, and student mental wellness',
  },
  {
    id: 'Food & Beverage',
    name: 'Food & Beverage',
    icon: 'restaurant',
    badge: 'Bocal & Cafeteria',
    description: 'Cafeteria menus, meal swaps, and campus food delivery',
  },
  {
    id: 'Fashion & Design',
    name: 'Fashion & Design',
    icon: 'palette',
    badge: 'UI/UX & 3D Art',
    description: 'Campus merch, design systems, vector art, and 3D printing',
  },
] as const;

export type PitchCategory = (typeof CATEGORIES)[number]['id'];
export type PitchStatus = 'draft' | 'published';

type PitchForm = {
  title: string;
  description: string;
  content: string;
  category: PitchCategory | '';
};

type CreatedPitch = {
  id: string;
  title: string;
  state: string;
  category: string;
  description: string | null;
  content: string;
};

const emptyForm: PitchForm = {
  title: '',
  description: '',
  content: '',
  category: '',
};

const TITLE_SUGGESTIONS = [
  'StudySync — 1337 Peer Defense Matcher',
  'Cub3D WebGL Live Previewer',
  'Minishell Visual Ast & Signal Tester',
  'Norminette Realtime VSCode Companion',
];

const TEMPLATES: Record<string, { label: string; icon: string; markdown: string }> = {
  standard: {
    label: '1337 Capstone Scaffold',
    icon: 'assignment',
    markdown: `## 1. Problem Statement
Students struggle to find structured peer evaluation sessions before tough graphics defenses. Mismatched peer knowledge leads to repeated failed defenses.

## 2. Proposed Solution
An automated matching system using Intra data that pairs students preparing for defense with peers who previously scored 100+ on the same project.

## 3. Architecture & Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, PostgreSQL, pgvector
- **Realtime:** Socket.IO for instant peer notifications

## 4. Target 1337 Peers & Collaborators
- Looking for 1 backend developer proficient in async Python/FastAPI
- Looking for 1 UI/UX enthusiast to polish the review dashboard

## 5. Expected Milestones
- [ ] Week 1: Core API & Intra OAuth integration
- [ ] Week 2: Matchmaking algorithm & test coverage
- [ ] Week 3: Campus Beta launch
`,
  },
  minimal: {
    label: 'Elevator Pitch',
    icon: 'bolt',
    markdown: `### 💡 The Big Idea
A lightweight campus tool that makes sharing and reviewing student coding notes friction-free.

### 🎯 Who is this for?
All 1337 students currently in Common Core Circles 01 to 04.

### 🛠️ Key Deliverables
- Simple markdown search and bookmarking
- Upvoting peer cheat sheets
- Campus Discord / Slack webhooks
`,
  },
  hackathon: {
    label: 'Weekend Sprint',
    icon: 'timer',
    markdown: `## ⚡ 48-Hour Weekend Sprint Scope
Build and demonstrate a working prototype of a collaborative code scratchpad for 1337 clusters.

## 🎯 Target MVP
- Real-time text sync between two cluster computers
- Zero auth required for temporary peer rooms
- Export as Gist or Pastebin
`,
  },
};

function getErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return null;
  }

  const detail = body.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === 'object' &&
        item !== null &&
        'msg' in item &&
        typeof item.msg === 'string'
          ? item.msg
          : null,
      )
      .filter((message): message is string => message !== null)
      .join(' ');
  }
  return null;
}

async function fetchPitchApi<T = unknown>(url: string, options: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error(
      `Unable to reach backend: ${err instanceof Error ? err.message : 'Connection failed'}. Please make sure the backend server is running on port 8000.`,
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = getErrorMessage(data);
    if (errorMsg) {
      throw new Error(errorMsg);
    }
    if (response.status === 401) {
      throw new Error('Authentication required: Please sign in via 42 Intra to save or publish pitches.');
    }
    if (response.status === 403) {
      throw new Error('Permission denied: You can only edit your own pitches.');
    }
    if (response.status === 500 || response.status === 502 || response.status === 504) {
      throw new Error(
        text.trim() || 'Backend server is not responding (port 8000). Please make sure the backend service is running.',
      );
    }
    throw new Error(text.trim() || `Request failed with HTTP status ${response.status}`);
  }

  if (data === null) {
    throw new Error('Server returned an empty response.');
  }

  return data as T;
}

export const CreatePitchPage = () => {
  const [form, setForm] = useState<PitchForm>(emptyForm);
  const [createdPitch, setCreatedPitch] = useState<CreatedPitch | null>(null);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRefinerOpen, setIsRefinerOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'write' | 'split' | 'preview'>('split');
  const [categoryQuery, setCategoryQuery] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateForm = <K extends keyof PitchForm>(key: K, value: PitchForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  // Word and character stats
  const stats = useMemo(() => {
    const trimmed = form.content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = form.content.length;
    const readMinutes = Math.max(1, Math.ceil(words / 160));
    return { words, chars, readMinutes };
  }, [form.content]);

  // Form completion progress
  const progress = useMemo(() => {
    let score = 0;
    if (form.title.trim().length >= 5) score += 30;
    if (form.category) score += 30;
    if (form.content.trim().length >= 40) score += 40;
    return score;
  }, [form.title, form.category, form.content]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    const q = categoryQuery.toLowerCase().trim();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.badge.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q),
    );
  }, [categoryQuery]);

  // Insert markdown helpers into textarea
  const insertMarkdown = (prefix: string, suffix: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.content;
    const selected = text.slice(start, end);
    const insertion = selected || placeholder;

    const newContent = text.slice(0, start) + prefix + insertion + suffix + text.slice(end);
    updateForm('content', newContent);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + insertion.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const applyTemplate = (key: string) => {
    const template = TEMPLATES[key];
    if (!template) return;
    if (
      form.content.trim().length > 0 &&
      !window.confirm('Applying this template will replace your current content. Continue?')
    ) {
      return;
    }
    updateForm('content', template.markdown);
  };

  // Simple and direct save action: handles both 'draft' and 'published'
  const handleSave = async (targetStatus: PitchStatus) => {
    if (!form.title.trim()) {
      setError('Please provide a title for your pitch.');
      return;
    }
    if (!form.category) {
      setError('Please choose a category that best describes your project.');
      return;
    }
    if (!form.content.trim()) {
      setError('Please describe your idea or solution in the pitch content.');
      return;
    }

    setSaving(true);
    setError('');
    setNotification(null);

    try {
      const pitchId = createdPitch?.id;
      const pitchTitle = form.title.trim();
      const pitchDesc = form.description.trim() || null;
      const pitchContent = form.content.trim();

      if (pitchId) {
        // Update existing pitch
        await fetchPitchApi(`/api/v1/user/pitches/${pitchId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: pitchTitle,
            description: pitchDesc,
            content: pitchContent,
            category: form.category,
            status: targetStatus,
          }),
        });

        setCreatedPitch({
          id: pitchId,
          title: pitchTitle,
          state: targetStatus,
          category: form.category,
          description: pitchDesc,
          content: pitchContent,
        });

        setNotification(
          targetStatus === 'published'
            ? '🚀 Pitch published successfully to the campus community!'
            : '💾 Pitch draft saved successfully.',
        );
      } else {
        // Create new pitch
        const data = await fetchPitchApi<{
          id: string;
          title: string;
          state: string;
        }>('/api/v1/user/pitches', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: pitchTitle,
            description: pitchDesc,
            content: pitchContent,
            category: form.category,
            status: targetStatus,
          }),
        });

        setCreatedPitch({
          id: data.id,
          title: data.title,
          state: data.state,
          category: form.category,
          description: pitchDesc,
          content: pitchContent,
        });

        setNotification(
          targetStatus === 'published'
            ? '🚀 Pitch published successfully to the campus community!'
            : '💾 Pitch draft saved successfully.',
        );
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save pitch.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Direct trigger when finished writing: saves draft seamlessly and opens RefineProjectModal
  const handleRefineWithAI = async () => {
    if (!form.title.trim()) {
      setError('Please provide a pitch title before refining with AI.');
      return;
    }
    if (!form.category) {
      setError('Please select a category before refining with AI.');
      return;
    }
    if (!form.content.trim()) {
      setError('Please write your pitch idea or problem statement before refining with AI.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let pitchId = createdPitch?.id;
      const pitchTitle = form.title.trim();
      const pitchDesc = form.description.trim() || null;
      const pitchContent = form.content.trim();

      if (pitchId) {
        // Pitch already exists, update draft with current editor state
        await fetchPitchApi(`/api/v1/user/pitches/${pitchId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: pitchTitle,
            description: pitchDesc,
            content: pitchContent,
            category: form.category,
            status: createdPitch?.state || 'draft',
          }),
        });

        setCreatedPitch((prev) =>
          prev
            ? {
                ...prev,
                title: pitchTitle,
                description: pitchDesc,
                content: pitchContent,
              }
            : null,
        );
      } else {
        // Save new pitch draft
        const data = await fetchPitchApi<{
          id: string;
          title: string;
          state: string;
        }>('/api/v1/user/pitches', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: pitchTitle,
            description: pitchDesc,
            content: pitchContent,
            category: form.category,
            status: 'draft',
          }),
        });

        pitchId = data.id;
        setCreatedPitch({
          id: data.id,
          title: data.title,
          state: data.state,
          category: form.category,
          description: pitchDesc,
          content: pitchContent,
        });
      }

      // Open the AI Refiner modal
      setIsRefinerOpen(true);
    } catch (refineError) {
      setError(
        refineError instanceof Error
          ? refineError.message
          : 'Could not initialize AI pitch refiner.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Called when AI suggestions are accepted in the modal
  const handlePitchUpdated = async () => {
    if (!createdPitch?.id) return;
    try {
      const data = await fetchPitchApi<{
        content?: string;
        title?: string;
        description?: string | null;
      }>(`/api/v1/user/pitches/${createdPitch.id}`, {
        credentials: 'include',
      });
      if (typeof data.content === 'string') {
        updateForm('content', data.content);
      }
      if (typeof data.title === 'string') {
        updateForm('title', data.title);
      }
      if (typeof data.description === 'string' || data.description === null) {
        updateForm('description', data.description || '');
      }
      setCreatedPitch((prev) =>
        prev
          ? {
              ...prev,
              title: data.title ?? prev.title,
              content: data.content ?? prev.content,
              description: data.description ?? prev.description,
            }
          : null,
      );
      setNotification('✨ AI critique suggestions applied to your idea!');
      setTimeout(() => setNotification(null), 5000);
    } catch {
      // Non-critical background refresh
    }
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Default form submit saves as draft
    handleSave('draft');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Top Banner / Breadcrumb & Header */}
      <div className="flex flex-col gap-4 border-b border-outline-variant/50 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-outline">
            <span>Pitches &amp; Ideas</span>
            <span>/</span>
            <span className="text-primary font-bold">New Pitch Incubator</span>
            <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-sans font-semibold text-on-primary-fixed">
              Peer Review Ready
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface lg:text-4xl">
            Pitch Your Idea to 1337
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Articulate the problem, propose your solution, and find passionate peer teammates.
            Your idea supports live Markdown and can be refined instantly with the 1337 AI Copilot.
          </p>
        </div>

        {/* Readiness Meter & AI Refine Shortcut */}
        <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 py-3 shadow-sm">
          <div className="relative flex h-11 w-11 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface-container-high"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-brand transition-all duration-500 ease-out"
                strokeDasharray={`${progress}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute font-mono text-xs font-bold text-on-surface">
              {progress}%
            </span>
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-2">
              <p className="font-bold text-on-surface">Pitch Readiness</p>
              {progress >= 60 && (
                <button
                  type="button"
                  onClick={handleRefineWithAI}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand hover:bg-brand hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  Refine
                </button>
              )}
            </div>
            <p className="text-on-surface-variant">
              {progress === 100
                ? 'Ready to refine or publish!'
                : progress >= 60
                  ? 'Idea content required'
                  : 'Title & category needed'}
            </p>
          </div>
        </div>
      </div>

      {/* Ephemeral Notification Banner */}
      {notification && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm transition-all">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span className="font-semibold">{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Notification Banner & AI Refiner Trigger */}
      {createdPitch && (
        <section
          className="relative overflow-hidden rounded-3xl border border-brand/40 bg-gradient-to-r from-brand/10 via-brand/5 to-surface-container-lowest p-6 shadow-md transition-all"
          role="status"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">
                  <span className="material-symbols-outlined text-base">check</span>
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand">
                  Pitch Saved Successfully
                </span>
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold capitalize text-on-surface">
                  {createdPitch.state}
                </span>
              </div>
              <h2 className="text-xl font-bold text-on-surface">
                “{createdPitch.title}”
              </h2>
              <p className="text-xs font-mono text-outline">
                Reference ID: {createdPitch.id} &bull; Category: {createdPitch.category}
              </p>
              <p className="text-xs text-on-surface-variant">
                Your pitch is safely saved. You can run the 1337 AI Pitch Refiner anytime
                to analyze your problem statement, target users, and defense milestones.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95"
                onClick={handleRefineWithAI}
                type="button"
              >
                <span className="material-symbols-outlined text-base animate-pulse">
                  auto_awesome
                </span>
                Refine with AI
              </button>
              <button
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container"
                onClick={() => {
                  setCreatedPitch(null);
                  setForm(emptyForm);
                }}
                type="button"
              >
                Create Another
              </button>
            </div>
          </div>
        </section>
      )}

      {/* AI Refiner Modal */}
      {createdPitch && (
        <RefineProjectModal
          isOpen={isRefinerOpen}
          onClose={() => setIsRefinerOpen(false)}
          pitchId={createdPitch.id}
          projectTitle={createdPitch.title}
          onPitchUpdated={handlePitchUpdated}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-error/30 bg-error-container p-4 text-sm text-on-error-container shadow-sm"
          role="alert"
        >
          <span className="material-symbols-outlined text-xl text-error">error</span>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Main Pitch Creation Form */}
      <form onSubmit={handleFormSubmit} className="space-y-8">
        {/* 1. Title Section */}
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm transition-all md:p-8 space-y-4">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <div>
              <label
                htmlFor="pitch-title-input"
                className="flex items-center gap-2 text-sm font-bold text-on-surface"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                  1
                </span>
                Pitch Title
                <span className="text-xs font-normal text-error">*</span>
              </label>
              <p className="text-xs text-on-surface-variant">
                Give your idea a concise, memorable name that resonates with fellow 1337 coders.
              </p>
            </div>
            <span
              className={`font-mono text-xs ${
                form.title.length > 90
                  ? 'text-error font-semibold'
                  : 'text-on-surface-variant'
              }`}
            >
              {form.title.length} / 100
            </span>
          </div>

          <div className="relative">
            <input
              id="pitch-title-input"
              autoComplete="off"
              className="w-full rounded-2xl border border-outline-variant/70 bg-surface px-4 py-3.5 text-base font-semibold text-on-surface placeholder:text-outline focus:border-brand focus:bg-surface-container-lowest focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all"
              maxLength={100}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="e.g. StudySync — Peer Tutoring & Code Review"
              required
              value={form.title}
            />
          </div>

          {/* Quick inspiration chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-outline">Need inspiration?</span>
            {TITLE_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => updateForm('title', suggestion)}
                className="rounded-lg border border-outline-variant/50 bg-surface px-2.5 py-1 text-[11px] font-medium text-on-surface-variant hover:border-brand hover:bg-brand/5 hover:text-brand transition-all"
              >
                + {suggestion.split(' — ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Category Picker Section */}
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm transition-all md:p-8 space-y-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-on-surface">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                  2
                </span>
                Project Category
                <span className="text-xs font-normal text-error">*</span>
              </label>
              <p className="text-xs text-on-surface-variant">
                Select the primary field your project belongs to. This guides matchmaking and search indexing.
              </p>
            </div>

            {/* Quick search/filter input */}
            <div className="relative w-full sm:w-60">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline">
                search
              </span>
              <input
                type="text"
                placeholder="Filter categories…"
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/60 bg-surface py-1.5 pl-8 pr-3 text-xs text-on-surface placeholder:text-outline focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {/* Interactive Category Cards Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {filteredCategories.map((cat) => {
              const isSelected = form.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => updateForm('category', cat.id)}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-brand bg-brand/5 shadow-sm ring-2 ring-brand/20'
                      : 'border-outline-variant/50 bg-surface hover:border-outline hover:bg-surface-container-low'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-brand text-white'
                            : 'bg-surface-container text-outline group-hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {cat.icon}
                        </span>
                      </span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-sm font-bold text-brand">
                          check_circle
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-xs text-on-surface tracking-tight">
                      {cat.name}
                    </p>
                    <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                      {cat.badge}
                    </p>
                  </div>
                  <p className="mt-2 text-[10px] text-outline leading-tight line-clamp-2">
                    {cat.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Fallback accessible select */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-outline">
              Selected: <strong className="text-on-surface">{form.category || 'None'}</strong>
            </span>
            <select
              className="rounded-lg border border-outline-variant/60 bg-surface px-2.5 py-1 text-xs text-on-surface focus:border-brand focus:outline-none"
              onChange={(e) => updateForm('category', e.target.value as PitchCategory)}
              value={form.category}
            >
              <option disabled value="">
                Or pick from dropdown…
              </option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.badge})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Short Elevator Pitch (Description) */}
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm transition-all md:p-8 space-y-3">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <div>
              <label
                htmlFor="pitch-description-input"
                className="flex items-center gap-2 text-sm font-bold text-on-surface"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                  3
                </span>
                Elevator Pitch / Tagline
                <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold text-outline">
                  Optional
                </span>
              </label>
              <p className="text-xs text-on-surface-variant">
                A brief 1-2 sentence hook displayed on feed cards and peer search results.
              </p>
            </div>
            <span
              className={`font-mono text-xs ${
                form.description.length > 270
                  ? 'text-error font-semibold'
                  : 'text-on-surface-variant'
              }`}
            >
              {form.description.length} / 300
            </span>
          </div>

          <textarea
            id="pitch-description-input"
            className="w-full min-h-20 resize-y rounded-2xl border border-outline-variant/70 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:border-brand focus:bg-surface-container-lowest focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all"
            maxLength={300}
            onChange={(e) => updateForm('description', e.target.value)}
            placeholder="Smart peer-tutoring and evaluation matchmaking for 1337 coding school peers."
            value={form.description}
          />
        </div>

        {/* 4. Idea Workspace & Live Markdown Editor ("Place to write his idea") */}
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm transition-all md:p-8 space-y-5">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-on-surface">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                  4
                </span>
                Write Your Idea (Full Pitch &amp; Architecture)
                <span className="text-xs font-normal text-error">*</span>
              </label>
              <p className="text-xs text-on-surface-variant">
                Express your vision thoroughly. Markdown is fully supported (headers, code snippets, lists, checkboxes).
              </p>
            </div>

            {/* Mode Selector (Write / Split / Preview) */}
            <div className="flex items-center gap-1 rounded-xl bg-surface-container p-1 text-xs">
              <button
                type="button"
                onClick={() => setEditorMode('write')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                  editorMode === 'write'
                    ? 'bg-surface-container-lowest text-brand shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Write
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('split')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                  editorMode === 'split'
                    ? 'bg-surface-container-lowest text-brand shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">vertical_split</span>
                Split Preview
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('preview')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                  editorMode === 'preview'
                    ? 'bg-surface-container-lowest text-brand shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                Preview
              </button>
            </div>
          </div>

          {/* Quick Scaffold Templates Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-outline-variant/40 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider mr-1">
                Insert Scaffold:
              </span>
              {Object.entries(TEMPLATES).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyTemplate(key)}
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 bg-surface px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:border-brand hover:text-brand transition-all"
                >
                  <span className="material-symbols-outlined text-xs">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Markdown Quick Formatting Buttons */}
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                title="Heading 2"
                onClick={() => insertMarkdown('## ', '\n', 'Section Title')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="font-bold font-mono text-xs">H2</span>
              </button>
              <button
                type="button"
                title="Heading 3"
                onClick={() => insertMarkdown('### ', '\n', 'Subheading')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="font-bold font-mono text-xs">H3</span>
              </button>
              <button
                type="button"
                title="Bold"
                onClick={() => insertMarkdown('**', '**', 'bold text')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="font-bold text-xs">B</span>
              </button>
              <button
                type="button"
                title="Italic"
                onClick={() => insertMarkdown('*', '*', 'italic text')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="italic text-xs">I</span>
              </button>
              <button
                type="button"
                title="Code block"
                onClick={() => insertMarkdown('\n```c\n', '\n```\n', '// 1337 code snippet')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-sm">code</span>
              </button>
              <button
                type="button"
                title="Quote"
                onClick={() => insertMarkdown('> ', '\n', 'Important quote')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-sm">format_quote</span>
              </button>
              <button
                type="button"
                title="Bullet List"
                onClick={() => insertMarkdown('- ', '\n', 'List item')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
              </button>
              <button
                type="button"
                title="Task List"
                onClick={() => insertMarkdown('- [ ] ', '\n', 'Todo milestone')}
                className="rounded p-1.5 text-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-sm">check_box</span>
              </button>
            </div>
          </div>

          {/* Editor / Preview Body */}
          <div
            className={`grid gap-4 ${
              editorMode === 'split'
                ? 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {/* Markdown Textarea */}
            {(editorMode === 'write' || editorMode === 'split') && (
              <div className="flex flex-col space-y-2">
                <textarea
                  ref={textareaRef}
                  className="w-full min-h-[380px] resize-y rounded-2xl border border-outline-variant/70 bg-surface p-4 font-mono text-sm leading-relaxed text-on-surface placeholder:text-outline focus:border-brand focus:bg-surface-container-lowest focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all"
                  onChange={(e) => updateForm('content', e.target.value)}
                  placeholder={`## 1. Problem Statement\nWhat challenges do students or users face?\n\n## 2. Proposed Solution\nHow does your software solve this?\n\n## 3. Tech Stack & Architecture\nWhich technologies will you use?`}
                  required
                  value={form.content}
                />
              </div>
            )}

            {/* Live Markdown Rendered Preview */}
            {(editorMode === 'preview' || editorMode === 'split') && (
              <div className="flex flex-col rounded-2xl border border-outline-variant/50 bg-surface/80 p-5 overflow-y-auto max-h-[500px]">
                <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2 mb-3 text-xs font-mono text-outline">
                  <span className="flex items-center gap-1 font-semibold text-on-surface">
                    <span className="material-symbols-outlined text-xs text-brand">visibility</span>
                    Live Pitch Preview
                  </span>
                  <span>{stats.readMinutes} min read</span>
                </div>

                {form.content.trim() ? (
                  <div className="prose prose-slate max-w-none text-on-surface leading-relaxed text-sm space-y-3">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ ...props }) => (
                          <h1 className="text-xl font-extrabold text-on-surface border-b pb-1 mt-4 mb-2" {...props} />
                        ),
                        h2: ({ ...props }) => (
                          <h2 className="text-base font-bold text-on-surface border-b border-outline-variant/30 pb-1 mt-3 mb-2" {...props} />
                        ),
                        h3: ({ ...props }) => (
                          <h3 className="text-sm font-semibold text-on-surface mt-2 mb-1" {...props} />
                        ),
                        p: ({ ...props }) => (
                          <p className="text-sm text-on-surface-variant leading-relaxed mb-2" {...props} />
                        ),
                        ul: ({ ...props }) => (
                          <ul className="list-disc list-inside space-y-1 text-sm text-on-surface-variant my-2" {...props} />
                        ),
                        ol: ({ ...props }) => (
                          <ol className="list-decimal list-inside space-y-1 text-sm text-on-surface-variant my-2" {...props} />
                        ),
                        blockquote: ({ ...props }) => (
                          <blockquote className="border-l-4 border-brand bg-brand/5 px-3 py-1.5 rounded-r text-on-surface-variant italic text-xs my-2" {...props} />
                        ),
                        code: ({ children, ...props }) => (
                          <code className="bg-surface-container px-1.5 py-0.5 rounded font-mono text-xs text-primary font-semibold" {...props}>
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {form.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-outline space-y-2">
                    <span className="material-symbols-outlined text-3xl">draw</span>
                    <p className="text-xs">Your live pitch preview will render here automatically.</p>
                    <p className="text-[11px] text-on-surface-variant/70">
                      Use the templates above or start typing in the editor on the left.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant border-t border-outline-variant/40 pt-3">
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span><strong>{stats.words}</strong> words</span>
              <span><strong>{stats.chars}</strong> characters</span>
              <span>~<strong>{stats.readMinutes}</strong> min read</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-outline">
              <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
              <span>Server-side HTML sanitization enabled</span>
            </div>
          </div>

          {/* Finished Writing Callout: Refine with AI */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-brand/40 bg-gradient-to-r from-brand/15 via-brand/5 to-surface-container-low p-4 shadow-sm transition-all hover:border-brand/60">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-brand/25">
                <span className="material-symbols-outlined text-2xl animate-pulse">auto_awesome</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-on-surface">Finished writing your idea?</p>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-mono font-bold text-brand">
                    1337 Copilot
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Have the AI critique your problem statement, target audience, and defense feasibility before sharing.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleRefineWithAI}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
            >
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              <span>Refine with AI</span>
            </button>
          </div>
        </div>

        {/* 5. Simple Action Bar: Save as Draft & Publish */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-xs text-on-surface-variant">
            Save your draft to work on it privately, or publish to share it with the 1337 community.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="flex items-center gap-2 rounded-2xl border border-outline-variant/70 bg-surface px-5 py-3 text-xs font-bold text-on-surface hover:bg-surface-container transition-all active:scale-98 disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">save</span>
              )}
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('published')}
              className="flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-xs font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-98 disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">send</span>
              )}
              <span>Publish</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
