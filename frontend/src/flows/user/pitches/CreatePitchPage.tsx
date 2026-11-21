import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

type ViewMode = 'hub' | 'write' | 'detail';

type PitchForm = {
  title: string;
  description: string;
  content: string;
  category: PitchCategory | '';
};

type SavedPitch = {
  id: string;
  title: string;
  state: string;
  category: string;
  description: string | null;
  content: string;
  created_at?: string | null;
};

const emptyForm: PitchForm = {
  title: '',
  description: '',
  content: '',
  category: '',
};

const CATEGORY_MAP = new Map<string, (typeof CATEGORIES)[number]>(
  CATEGORIES.map((category) => [category.id, category]),
);

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

const markdownComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className="text-xl font-extrabold text-on-surface border-b pb-1 mt-4 mb-2"
      {...props}
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="text-base font-bold text-on-surface border-b border-outline-variant/30 pb-1 mt-3 mb-2"
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-semibold text-on-surface mt-2 mb-1" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-sm text-on-surface-variant leading-relaxed mb-2" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-inside space-y-1 text-sm text-on-surface-variant my-2" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside space-y-1 text-sm text-on-surface-variant my-2" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-brand bg-brand/5 px-3 py-1.5 rounded-r text-on-surface-variant italic text-xs my-2"
      {...props}
    />
  ),
  code: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="bg-surface-container px-1.5 py-0.5 rounded font-mono text-xs text-primary font-semibold"
      {...props}
    >
      {children}
    </code>
  ),
};

function formatRelativeDate(isoDate?: string | null): string {
  if (!isoDate) return 'Recently';
  const date = new Date(isoDate);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return 'Recently';

  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - timestamp) / 1000);
  if (diffSeconds < 60) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getExcerpt(pitch: SavedPitch): string {
  if (pitch.description && pitch.description.trim()) {
    return pitch.description.trim();
  }
  const plain = pitch.content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'No summary provided yet.';
  return plain.length > 150 ? `${plain.slice(0, 147).trimEnd()}...` : plain;
}

function getStatusBadgeClasses(state: string): string {
  switch (state.toLowerCase()) {
    case 'published':
      return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
    case 'draft':
      return 'bg-amber-500/15 text-amber-800 border-amber-500/30';
    default:
      return 'bg-surface-container text-outline border-outline-variant/60';
  }
}

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

class HttpStatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
      throw new HttpStatusError(response.status, errorMsg);
    }
    if (response.status === 401) {
      throw new HttpStatusError(
        401,
        'Authentication required: Please sign in via 42 Intra to view or save your pitches.',
      );
    }
    if (response.status === 403) {
      throw new HttpStatusError(403, 'Permission denied: You can only edit your own pitches.');
    }
    if (response.status === 500 || response.status === 502 || response.status === 504) {
      throw new HttpStatusError(
        response.status,
        text.trim() || 'Backend server is not responding (port 8000). Please make sure the backend service is running.',
      );
    }
    throw new HttpStatusError(
      response.status,
      text.trim() || `Request failed with HTTP status ${response.status}`,
    );
  }

  if (data === null) {
    throw new Error('Server returned an empty response.');
  }

  return data as T;
}

export const CreatePitchPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('hub');
  const [myPitches, setMyPitches] = useState<SavedPitch[]>([]);
  const [loadingPitches, setLoadingPitches] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  const [form, setForm] = useState<PitchForm>(emptyForm);
  const [createdPitch, setCreatedPitch] = useState<SavedPitch | null>(null);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preparingRefine, setPreparingRefine] = useState(false);
  const [isRefinerOpen, setIsRefinerOpen] = useState(false);
  const [deletingPitchId, setDeletingPitchId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'write' | 'split' | 'preview'>('split');
  const [categoryQuery, setCategoryQuery] = useState('');

  // Create Opportunity from Pitch modal state
  const [opportunityTargetPitch, setOpportunityTargetPitch] = useState<SavedPitch | null>(null);
  const [existingOpportunityPitchIds, setExistingOpportunityPitchIds] = useState<Set<string>>(new Set());
  const [oppTitle, setOppTitle] = useState('');
  const [oppSkills, setOppSkills] = useState('');
  const [oppDesc, setOppDesc] = useState('');
  const [oppSaving, setOppSaving] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);

  const openOpportunityModal = (pitch: SavedPitch, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (pitch.state.toLowerCase() !== 'published') {
      setError(`Please publish "${pitch.title}" before creating an opportunity from it.`);
      return;
    }
    if (existingOpportunityPitchIds.has(pitch.id)) {
      setError(`An opportunity has already been created for "${pitch.title}".`);
      return;
    }
    setOpportunityTargetPitch(pitch);
    setOppTitle('');
    setOppSkills('');
    setOppDesc('');
    setOppError(null);
  };

  const handleCreateOpportunityFromPitch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!opportunityTargetPitch) return;
    setOppSaving(true);
    setOppError(null);

    const skillsArray = oppSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/opportunities/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: opportunityTargetPitch.id,
          title: oppTitle.trim(),
          description: oppDesc.trim(),
          required_skills: skillsArray,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        setOppError(err.detail || 'Failed to create opportunity');
        return;
      }
      const created = (await res.json()) as { id: string; title: string };
      setExistingOpportunityPitchIds((prev) => new Set([...prev, opportunityTargetPitch.id]));
      await fetch(`/api/opportunities/${created.id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      setOpportunityTargetPitch(null);
      setNotification(`Opportunity "${created.title}" created from "${opportunityTargetPitch.title}"! View it in Opportunities.`);
    } catch {
      setOppError('Network error while creating opportunity');
    } finally {
      setOppSaving(false);
    }
  };

  const renderOpportunityModal = () =>
    opportunityTargetPitch ? (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-surface rounded-2xl border border-outline-variant/60 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Create Opportunity</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                From pitch: <span className="font-semibold text-primary">{opportunityTargetPitch.title}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpportunityTargetPitch(null)}
              className="text-outline hover:text-on-surface text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>

          {oppError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
              {oppError}
            </div>
          )}

          <form onSubmit={handleCreateOpportunityFromPitch} className="space-y-4">
            <div>
              <label htmlFor="opp-title-input" className="block text-xs font-semibold text-on-surface mb-1">
                Opportunity Title / Role
              </label>
              <input
                id="opp-title-input"
                name="opp-title"
                type="text"
                placeholder="e.g. Backend Engineer (Python / FastAPI / PostgreSQL)"
                value={oppTitle}
                onChange={(e) => setOppTitle(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label htmlFor="opp-skills-input" className="block text-xs font-semibold text-on-surface mb-1">
                Required Skills (comma separated)
              </label>
              <input
                id="opp-skills-input"
                name="opp-skills"
                type="text"
                placeholder="e.g. Python, Docker, FastAPI, React"
                value={oppSkills}
                onChange={(e) => setOppSkills(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label htmlFor="opp-desc-input" className="block text-xs font-semibold text-on-surface mb-1">
                Description &amp; Responsibilities
              </label>
              <textarea
                id="opp-desc-input"
                name="opp-description"
                rows={4}
                placeholder="Describe what the teammate will work on, timeline, and expectations..."
                value={oppDesc}
                onChange={(e) => setOppDesc(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpportunityTargetPitch(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={oppSaving}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {oppSaving ? 'Creating...' : 'Create & Publish'}
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMyPitches = useCallback(async () => {
    setLoadingPitches(true);
    setError('');

    try {
      const [pitchesRes, meRes, oppsRes] = await Promise.allSettled([
        fetchPitchApi<SavedPitch[]>('/api/v1/user/pitches/me', {
          credentials: 'include',
        }),
        fetch('/api/v1/users/me', { credentials: 'include' }),
        fetch('/api/opportunities/mine', { credentials: 'include' }).then((r) =>
          r.ok ? r.json() : [],
        ),
      ]);

      if (oppsRes.status === 'fulfilled' && Array.isArray(oppsRes.value)) {
        const pitchIds = new Set<string>(
          oppsRes.value.map((o: any) => o.project_id).filter(Boolean),
        );
        setExistingOpportunityPitchIds(pitchIds);
      }

      if (meRes.status === 'fulfilled' && meRes.value.ok) {
        const meData = (await meRes.value.json()) as { id?: string };
        if (typeof meData?.id === 'string') {
          setCurrentUserId(meData.id);
        }
      }

      if (pitchesRes.status === 'fulfilled') {
        setMyPitches(pitchesRes.value);
        setAuthRequired(false);
      } else {
        const reason = pitchesRes.reason;
        if (reason instanceof HttpStatusError && reason.status === 401) {
          setAuthRequired(true);
          setMyPitches([]);
        } else {
          setError(
            reason instanceof Error ? reason.message : 'Unable to load your pitches right now.',
          );
        }
      }
    } finally {
      setLoadingPitches(false);
    }
  }, []);

  useEffect(() => {
    void loadMyPitches();
  }, [loadMyPitches]);

  const updateForm = <K extends keyof PitchForm>(key: K, value: PitchForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const populateFormFromPitch = (pitch: SavedPitch) => {
    const matchedCategory = CATEGORY_MAP.has(pitch.category)
      ? (pitch.category as PitchCategory)
      : '';
    setForm({
      title: pitch.title,
      description: pitch.description ?? '',
      content: pitch.content,
      category: matchedCategory,
    });
  };

  const startNewPitch = () => {
    setCreatedPitch(null);
    setForm(emptyForm);
    setError('');
    setNotification(null);
    setViewMode('write');
  };

  const openPitchDetail = (pitch: SavedPitch) => {
    setCreatedPitch(pitch);
    populateFormFromPitch(pitch);
    setError('');
    setNotification(null);
    setViewMode('detail');
  };

  const openPitchEditor = (pitch: SavedPitch) => {
    setCreatedPitch(pitch);
    populateFormFromPitch(pitch);
    setError('');
    setNotification(null);
    setViewMode('write');
  };

  const backToHub = () => {
    setError('');
    setNotification(null);
    setViewMode('hub');
    void loadMyPitches();
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

  // Step 1 ("Next"): persist pitch to DB as draft so it has a DB id, then move to 'detail' view
  const handleNextStep = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setError('Please provide a title for your pitch.');
      return;
    }
    if (!form.category) {
      setError('Please choose a category that best describes your project.');
      return;
    }
    if (!form.description.trim()) {
      setError('Please provide an elevator pitch or tagline for your project.');
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
      const pitchTitle = form.title.trim();
      const pitchDesc = form.description.trim() || null;
      const pitchContent = form.content.trim();
      const existingId = createdPitch?.id;

      const saved = existingId
        ? await fetchPitchApi<SavedPitch>(`/api/v1/user/pitches/${existingId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: pitchTitle,
              description: pitchDesc,
              content: pitchContent,
              category: form.category,
              status: 'draft',
            }),
          })
        : await fetchPitchApi<SavedPitch>('/api/v1/user/pitches', {
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

      setCreatedPitch(saved);
      setMyPitches((prev) => {
        const filtered = prev.filter((item) => item.id !== saved.id);
        return [saved, ...filtered];
      });
      setNotification(
        'Pitch saved to the database! You can now optionally refine it with AI, keep it as a draft, or publish it.',
      );
      setViewMode('detail');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save pitch.');
    } finally {
      setSaving(false);
    }
  };

  // Step 2 ("Save as Draft" / "Publish Pitch" on the detail screen)
  const handleSetPitchStatus = async (targetStatus: PitchStatus) => {
    if (!createdPitch) return;

    setSaving(true);
    setError('');
    setNotification(null);

    try {
      const updated = await fetchPitchApi<SavedPitch>(
        `/api/v1/user/pitches/${createdPitch.id}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: createdPitch.title,
            description: createdPitch.description,
            content: createdPitch.content,
            category: createdPitch.category,
            status: targetStatus,
          }),
        },
      );

      setCreatedPitch(updated);
      setMyPitches((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNotification(
        targetStatus === 'published'
          ? '🚀 Pitch published successfully to the 1337 campus feed!'
          : '💾 Pitch saved as draft. You can come back and refine or publish it later.',
      );
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update pitch status.');
    } finally {
      setSaving(false);
    }
  };

  // Delete a pitch
  const handleDeletePitch = async (
    pitchId: string,
    pitchTitle?: string,
    e?: React.MouseEvent,
  ) => {
    if (e) {
      e.stopPropagation();
    }

    const confirmMsg = `Are you sure you want to delete "${pitchTitle || 'this pitch'}"? If an opportunity was created from this pitch, it will also be deleted. This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingPitchId(pitchId);
    setError('');
    setNotification(null);

    try {
      await fetchPitchApi(`/api/v1/user/pitches/${pitchId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      setMyPitches((prev) => prev.filter((p) => p.id !== pitchId));
      setExistingOpportunityPitchIds((prev) => {
        const next = new Set(prev);
        next.delete(pitchId);
        return next;
      });
      if (createdPitch?.id === pitchId) {
        setCreatedPitch(null);
        setViewMode('hub');
      }
      setNotification('Pitch and its associated opportunities were successfully deleted.');
    } catch (delError) {
      setError(delError instanceof Error ? delError.message : 'Could not delete pitch.');
    } finally {
      setDeletingPitchId(null);
    }
  };

  // Trigger AI Refiner from detail mode (ensures pitch is in 'draft' status in DB first)
  const handleOpenRefine = async () => {
    if (!createdPitch) return;

    setError('');
    if (createdPitch.state.toLowerCase() === 'draft') {
      setIsRefinerOpen(true);
      return;
    }

    setPreparingRefine(true);
    try {
      const updated = await fetchPitchApi<SavedPitch>(
        `/api/v1/user/pitches/${createdPitch.id}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: createdPitch.title,
            description: createdPitch.description,
            content: createdPitch.content,
            category: createdPitch.category,
            status: 'draft',
          }),
        },
      );
      setCreatedPitch(updated);
      setMyPitches((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setIsRefinerOpen(true);
    } catch (refinePrepError) {
      setError(
        refinePrepError instanceof Error
          ? refinePrepError.message
          : 'Could not prepare this pitch for AI refinement.',
      );
    } finally {
      setPreparingRefine(false);
    }
  };

  // Called when AI suggestions are accepted in the modal
  const handlePitchUpdated = async () => {
    if (!createdPitch?.id) return;
    try {
      const refreshed = await fetchPitchApi<SavedPitch>(
        `/api/v1/user/pitches/${createdPitch.id}`,
        { credentials: 'include' },
      );
      setCreatedPitch(refreshed);
      populateFormFromPitch(refreshed);
      setMyPitches((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
      setNotification('✨ AI critique suggestions applied to your pitch!');
    } catch {
      // Non-critical background refresh
    }
  };

  // ============================================================================
  // VIEW 1: MY PITCHES HUB
  // ============================================================================
  if (viewMode === 'hub') {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-16">
        {/* Hub Header */}
        <section className="flex flex-col gap-5 rounded-3xl border border-outline-variant/50 bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-primary-fixed/40 p-6 md:p-8 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-mono font-bold text-on-primary-fixed">
              <span className="material-symbols-outlined text-[15px] text-primary">folder_special</span>
              <span>Pitch Workspace</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface lg:text-4xl">
              Your Pitches
            </h1>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Select one of your existing pitches to view, refine with AI later, or publish — or start
              a brand new pitch from scratch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void loadMyPitches()}
              disabled={loadingPitches}
              title="Refresh my pitches"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant/70 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[20px] ${loadingPitches ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
            <button
              type="button"
              onClick={startNewPitch}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>Create New Pitch</span>
            </button>
          </div>
        </section>

        {/* Auth Notice or Error */}
        {authRequired && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
            role="status"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-700">lock</span>
              <span>Sign in via 42 Intra to load your saved pitches and persist new ones.</span>
            </div>
            <a
              href="/auth/login"
              className="rounded-xl bg-amber-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-800 transition-colors"
            >
              Sign in with 42 Intra
            </a>
          </div>
        )}

        {error && (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border border-error/30 bg-error-container p-4 text-sm text-on-error-container shadow-sm"
            role="alert"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-xl text-error">error</span>
              <span className="font-medium">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadMyPitches()}
              className="rounded-xl bg-surface-container-lowest px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container"
            >
              Retry
            </button>
          </div>
        )}

        {/* My Pitches Grid / Empty State */}
        {loadingPitches ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-6 w-28 rounded-full bg-surface-container" />
                  <div className="h-5 w-16 rounded-full bg-surface-container" />
                </div>
                <div className="h-6 w-2/3 rounded-lg bg-surface-container" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-surface-container-low" />
                  <div className="h-4 w-4/5 rounded bg-surface-container-low" />
                </div>
              </div>
            ))}
          </div>
        ) : myPitches.length === 0 ? (
          <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-3xl">edit_note</span>
            </div>
            <div className="space-y-1 max-w-md">
              <h2 className="text-lg font-bold text-on-surface">
                You haven&apos;t created any pitches yet
              </h2>
              <p className="text-sm text-on-surface-variant">
                Draft your idea first, save it to the database, and optionally refine it with the
                1337 AI Copilot whenever you&apos;re ready.
              </p>
            </div>
            <button
              type="button"
              onClick={startNewPitch}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-hover transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Create New Pitch</span>
            </button>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {myPitches.map((pitch) => {
              const catMeta = CATEGORY_MAP.get(pitch.category);
              return (
                <article
                  key={pitch.id}
                  onClick={() => openPitchDetail(pitch)}
                  className="group cursor-pointer flex flex-col justify-between rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-brand/60 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed/80 px-3 py-1 text-xs font-semibold text-on-primary-fixed">
                        <span className="material-symbols-outlined text-[15px] text-primary">
                          {catMeta?.icon ?? 'category'}
                        </span>
                        <span>{catMeta?.name ?? pitch.category}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadgeClasses(pitch.state)}`}
                        >
                          {pitch.state}
                        </span>
                        <span className="font-mono text-[11px] text-outline">
                          {formatRelativeDate(pitch.created_at)}
                        </span>
                      </div>
                    </div>

                    <h2 className="text-lg font-extrabold tracking-tight text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                      {pitch.title}
                    </h2>

                    <p className="text-sm leading-relaxed text-on-surface-variant line-clamp-3">
                      {getExcerpt(pitch)}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant/40 pt-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDeletePitch(pitch.id, pitch.title, e)}
                        disabled={deletingPitchId === pitch.id}
                        title="Delete pitch"
                        className="inline-flex items-center gap-1 rounded-xl bg-error/10 px-2.5 py-1.5 text-xs font-bold text-error hover:bg-error hover:text-white transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                        <span>Delete</span>
                      </button>
                      {existingOpportunityPitchIds.has(pitch.id) ? (
                        <Link
                          to="/opportunities"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">work</span>
                          <span>View Opportunity</span>
                        </Link>
                      ) : pitch.state.toLowerCase() === 'published' ? (
                        <button
                          type="button"
                          onClick={(e) => openOpportunityModal(pitch, e)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">work</span>
                          <span>Create Opportunity</span>
                        </button>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand group-hover:bg-brand group-hover:text-white transition-all">
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        <span>View &amp; Refine</span>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
        {renderOpportunityModal()}
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: PITCH DETAIL, OPTIONAL AI REFINE & PUBLISH/DRAFT
  // ============================================================================
  if (viewMode === 'detail' && createdPitch) {
    const categoryMeta = CATEGORY_MAP.get(createdPitch.category);
    const isDraft = createdPitch.state.toLowerCase() === 'draft';

    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={backToHub}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to My Pitches</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDeletePitch(createdPitch.id, createdPitch.title)}
              disabled={deletingPitchId === createdPitch.id}
              title="Delete this pitch"
              className="inline-flex items-center gap-1.5 rounded-xl border border-error/30 bg-error/10 px-3.5 py-2 text-xs font-bold text-error hover:bg-error hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Delete Pitch</span>
            </button>
            {existingOpportunityPitchIds.has(createdPitch.id) ? (
              <Link
                to="/opportunities"
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">work</span>
                <span>View Opportunity</span>
              </Link>
            ) : !isDraft ? (
              <button
                type="button"
                onClick={() => openOpportunityModal(createdPitch)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">work</span>
                <span>Create Opportunity</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openPitchEditor(createdPitch)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>Edit Pitch</span>
            </button>
            <button
              type="button"
              onClick={startNewPitch}
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create New Pitch</span>
            </button>
          </div>
        </div>

        {/* Ephemeral Notification */}
        {notification && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm"
            role="status"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
              <span className="font-semibold">{notification}</span>
            </div>
            <div className="flex items-center gap-3">
              {createdPitch.state.toLowerCase() === 'published' && (
                <Link to="/" className="text-xs font-bold text-emerald-800 underline">
                  View on Home Feed →
                </Link>
              )}
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-xs text-emerald-700 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
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

        {/* Saved Pitch Overview Card */}
        <section className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-8 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-on-primary-fixed">
                <span className="material-symbols-outlined text-[15px] text-primary">
                  {categoryMeta?.icon ?? 'category'}
                </span>
                <span>{categoryMeta?.name ?? createdPitch.category}</span>
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadgeClasses(createdPitch.state)}`}
              >
                {createdPitch.state}
              </span>
              <span className="font-mono text-xs text-outline">
                {formatRelativeDate(createdPitch.created_at)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">
              {createdPitch.title}
            </h1>
            {createdPitch.description && (
              <p className="text-sm font-medium text-on-surface-variant">
                {createdPitch.description}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant/40 bg-surface/70 p-5">
            <div className="prose prose-slate max-w-none text-sm leading-relaxed text-on-surface">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {createdPitch.content}
              </ReactMarkdown>
            </div>
          </div>
        </section>

        {/* Optional AI Pitch Refiner Card */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-brand/40 bg-gradient-to-r from-brand/15 via-brand/5 to-surface-container-low p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-brand/25">
              <span className="material-symbols-outlined text-2xl animate-pulse">auto_awesome</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface">
                  Refine Your Pitch with AI (Optional)
                </h2>
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-mono font-bold text-brand">
                  1337 Copilot
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                {isDraft
                  ? 'Your pitch is saved in the database. Run an AI critique on your problem statement, scope, and milestones — or skip straight to publishing.'
                  : 'This pitch is currently published. Clicking Refine with AI will switch it back to draft so you can review and apply AI improvements.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={preparingRefine || saving}
            onClick={() => void handleOpenRefine()}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-xs font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50 shrink-0"
          >
            {preparingRefine ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">auto_awesome</span>
            )}
            <span>Refine with AI</span>
          </button>
        </section>

        {/* Final Decision Bar: Save as Draft or Publish Pitch */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-xs text-on-surface-variant">
            Keep this pitch private as a draft to refine later, or publish it to share with the
            1337 community feed.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSetPitchStatus('draft')}
              className="flex items-center gap-2 rounded-2xl border border-outline-variant/70 bg-surface px-5 py-3 text-xs font-bold text-on-surface hover:bg-surface-container transition-all disabled:opacity-50"
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
              onClick={() => void handleSetPitchStatus('published')}
              className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-on-primary shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">send</span>
              )}
              <span>Publish Pitch</span>
            </button>
          </div>
        </section>

        {/* AI Refiner Modal */}
        <RefineProjectModal
          isOpen={isRefinerOpen}
          onClose={() => setIsRefinerOpen(false)}
          pitchId={createdPitch.id}
          projectTitle={createdPitch.title}
          currentUserId={currentUserId}
          onPitchUpdated={() => void handlePitchUpdated()}
        />
        {renderOpportunityModal()}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: PITCH CREATION / EDIT FORM ("Next" saves to DB & opens detail view)
  // ============================================================================
  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Top Bar: Back to My Pitches */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={backToHub}
          className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Pitches</span>
        </button>
      </div>

      {/* Top Banner / Breadcrumb & Readiness Meter */}
      <div className="flex flex-col gap-4 border-b border-outline-variant/50 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-outline">
            <span>Pitches &amp; Ideas</span>
            <span>/</span>
            <span className="text-primary font-bold">
              {createdPitch ? 'Edit Pitch' : 'New Pitch Incubator'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface lg:text-4xl">
            {createdPitch ? 'Update Your Pitch' : 'Pitch Your Idea to 1337'}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Articulate the problem and propose your solution. Click <strong>Next</strong> when
            you&apos;re done to save your pitch and unlock optional AI refinement and publishing.
          </p>
        </div>

        {/* Readiness Meter */}
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
            <p className="font-bold text-on-surface">Pitch Readiness</p>
            <p className="text-on-surface-variant">
              {progress === 100
                ? 'Ready for Next step!'
                : progress >= 60
                  ? 'Idea content required'
                  : 'Title & category needed'}
            </p>
          </div>
        </div>
      </div>

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
      <form onSubmit={handleNextStep} className="space-y-8">
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
              name="pitch-title"
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
              <label
                htmlFor="pitch-category-select"
                className="flex items-center gap-2 text-sm font-bold text-on-surface"
              >
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
                id="pitch-category-filter"
                name="pitch-category-filter"
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
              id="pitch-category-select"
              name="pitch-category"
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
                <span className="text-xs font-normal text-error">*</span>
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
            name="pitch-description"
            required
            className="w-full min-h-20 resize-y rounded-2xl border border-outline-variant/70 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:border-brand focus:bg-surface-container-lowest focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all"
            maxLength={300}
            onChange={(e) => updateForm('description', e.target.value)}
            placeholder="Smart peer-tutoring and evaluation matchmaking for 1337 coding school peers."
            value={form.description}
          />
        </div>

        {/* 4. Idea Workspace & Live Markdown Editor */}
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm transition-all md:p-8 space-y-5">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <label
                htmlFor="pitch-content-input"
                className="flex items-center gap-2 text-sm font-bold text-on-surface"
              >
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
                  id="pitch-content-input"
                  name="pitch-content"
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
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
        </div>

        {/* 5. Next Step Action Bar (saves pitch to database first, then reveals Refine & Draft/Publish) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-xs text-on-surface-variant">
            Clicking <strong>Next</strong> saves your pitch to the database so you can review,
            optionally refine with AI, or publish it.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={backToHub}
              className="rounded-2xl border border-outline-variant/70 bg-surface px-5 py-3 text-xs font-bold text-on-surface hover:bg-surface-container transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-brand px-7 py-3 text-xs font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Next</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
