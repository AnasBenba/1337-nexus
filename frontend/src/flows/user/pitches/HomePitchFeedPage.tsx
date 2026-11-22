import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { LayoutContext } from '@/components/Layout';
import { RefineProjectModal } from '@/flows/user/projects/refine_project';
import { CATEGORIES, PitchCategory } from './CreatePitchPage';

export type FeedPitch = {
  id: string;
  title: string;
  content: string;
  rendered_content?: string | null;
  category: PitchCategory | string;
  state: string;
  description: string | null;
  author_id?: string | null;
  created_at?: string | null;
};

export type PitchVotes = {
  pitch_id: string;
  upvotes: number;
  downvotes: number;
  my_vote: 'up' | 'down' | null;
};

export type AuthorProfile = {
  id: string;
  login: string;
  fullname: string;
  role?: string;
};

export type PitchStatusFilter = 'all' | 'published' | 'draft';
export type PitchSortOption = 'newest' | 'popular';

export type PitchFilterOptions = {
  category: PitchCategory | 'all';
  status: PitchStatusFilter;
  onlyMine: boolean;
  currentUserId: string | null;
  query: string;
  sort: PitchSortOption;
};

const CATEGORY_META_MAP = new Map<string, (typeof CATEGORIES)[number]>(
  CATEGORIES.map((category) => [category.id, category]),
);

function getTimestampValue(isoDate?: string | null): number {
  if (!isoDate) return 0;
  const parsed = new Date(isoDate).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatPitchRelativeTime(isoDate?: string | null): string {
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

export function filterAndSortPitches(
  pitches: FeedPitch[],
  options: PitchFilterOptions,
  votesByPitchId: Record<string, PitchVotes>,
  authorsById: Record<string, AuthorProfile>,
): FeedPitch[] {
  const normalizedQuery = options.query.trim().toLowerCase();

  const filtered = pitches.filter((pitch) => {
    if (options.category !== 'all' && pitch.category !== options.category) {
      return false;
    }

    const normalizedState = pitch.state.toLowerCase();
    if (options.status !== 'all' && normalizedState !== options.status) {
      return false;
    }

    if (options.onlyMine) {
      if (!options.currentUserId || pitch.author_id !== options.currentUserId) {
        return false;
      }
    }

    if (normalizedQuery) {
      const author = pitch.author_id ? authorsById[pitch.author_id] : undefined;
      const searchableFields = [
        pitch.title,
        pitch.description ?? '',
        pitch.content,
        pitch.category,
        author?.fullname ?? '',
        author?.login ?? '',
      ];
      const matches = searchableFields.some((field) =>
        field.toLowerCase().includes(normalizedQuery),
      );
      if (!matches) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort((left, right) => {
    if (options.sort === 'popular') {
      const leftVotes = votesByPitchId[left.id];
      const rightVotes = votesByPitchId[right.id];
      const leftScore = (leftVotes?.upvotes ?? 0) - (leftVotes?.downvotes ?? 0);
      const rightScore = (rightVotes?.upvotes ?? 0) - (rightVotes?.downvotes ?? 0);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      const upvoteDiff = (rightVotes?.upvotes ?? 0) - (leftVotes?.upvotes ?? 0);
      if (upvoteDiff !== 0) {
        return upvoteDiff;
      }
    }

    return getTimestampValue(right.created_at) - getTimestampValue(left.created_at);
  });
}

function getPitchExcerpt(pitch: FeedPitch): string {
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
  return plain.length > 180 ? `${plain.slice(0, 177).trimEnd()}...` : plain;
}

function getInitials(name?: string | null): string {
  if (!name) return '13';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '13';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function parseErrorDetail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return null;
  }
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === 'string' ? detail : null;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (text.trim()) {
      const parsed = JSON.parse(text) as unknown;
      const detail = parseErrorDetail(parsed);
      if (detail) return detail;
    }
  } catch {
    // Ignore parse failure and fall back to status-based messages
  }
  if (response.status === 401) {
    return 'Sign in via 42 Intra to vote or manage pitches.';
  }
  if (response.status === 403) {
    return 'You can only modify or delete pitches you created.';
  }
  return fallback;
}

function getStatusBadgeClasses(state: string): string {
  switch (state.toLowerCase()) {
    case 'published':
      return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
    case 'draft':
      return 'bg-amber-500/15 text-amber-800 border-amber-500/30';
    case 'archived':
      return 'bg-surface-container text-outline border-outline-variant/60';
    default:
      return 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim';
  }
}

const markdownComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className="text-xl font-extrabold text-on-surface border-b border-outline-variant/40 pb-1 mt-4 mb-2"
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
    <p className="whitespace-pre-line text-sm text-on-surface-variant leading-relaxed mb-2" {...props} />
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

export const HomePitchFeedPage: React.FC = () => {
  const navigate = useNavigate();
  const outletCtx = useOutletContext<LayoutContext | undefined>();
  const signedInMe = outletCtx?.me ?? null;
  const [pitches, setPitches] = useState<FeedPitch[]>([]);
  const [semanticResults, setSemanticResults] = useState<FeedPitch[] | null>(null);
  const [semanticQueryLabel, setSemanticQueryLabel] = useState<string>('');
  const [votesByPitchId, setVotesByPitchId] = useState<Record<string, PitchVotes>>({});
  const [authorsById, setAuthorsById] = useState<Record<string, AuthorProfile>>({});
  const [currentUser, setCurrentUser] = useState<AuthorProfile | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<PitchCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PitchStatusFilter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<PitchSortOption>('newest');

  const [loading, setLoading] = useState(true);
  const [searchingSemantic, setSearchingSemantic] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [votingPitchId, setVotingPitchId] = useState<string | null>(null);
  const [deletingPitchId, setDeletingPitchId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<FeedPitch | null>(null);
  const [refiningPitch, setRefiningPitch] = useState<FeedPitch | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current));
    }, 4500);
  }, []);

  const loadVotesForPitches = useCallback(async (items: FeedPitch[]) => {
    if (items.length === 0) return;

    const settled = await Promise.allSettled(
      items.map(async (pitch) => {
        const res = await fetch(`/api/v1/user/pitches/${pitch.id}/votes`, {
          credentials: 'include',
        });
        if (!res.ok) return null;
        return (await res.json()) as PitchVotes;
      }),
    );

    const nextVotes: Record<string, PitchVotes> = {};
    for (const entry of settled) {
      if (entry.status === 'fulfilled' && entry.value) {
        nextVotes[entry.value.pitch_id] = entry.value;
      }
    }

    if (Object.keys(nextVotes).length > 0) {
      setVotesByPitchId((current) => ({ ...current, ...nextVotes }));
    }
  }, []);

  const loadAuthorsAndCurrentUser = useCallback(async () => {
    const nextAuthors: Record<string, AuthorProfile> = {};

    if (signedInMe) {
      const me: AuthorProfile = {
        id: signedInMe.id,
        login: signedInMe.login,
        fullname: signedInMe.fullname,
        role: signedInMe.role,
      };
      setCurrentUser(me);
      nextAuthors[me.id] = me;
    } else {
      setCurrentUser(null);
    }

    try {
      const peersRes = await fetch('/messages/peers', { credentials: 'include' });
      if (peersRes.ok) {
        const peersData = (await peersRes.json()) as unknown;
        if (Array.isArray(peersData)) {
          for (const item of peersData) {
            if (
              typeof item === 'object' &&
              item !== null &&
              typeof (item as AuthorProfile).id === 'string' &&
              typeof (item as AuthorProfile).login === 'string' &&
              typeof (item as AuthorProfile).fullname === 'string'
            ) {
              const peer = item as AuthorProfile;
              nextAuthors[peer.id] = peer;
            }
          }
        }
      }
    } catch {
      // Ignore network failure while resolving optional author names
    }

    if (Object.keys(nextAuthors).length > 0) {
      setAuthorsById((current) => ({ ...current, ...nextAuthors }));
    }
  }, [signedInMe]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/user/pitches/published', {
        credentials: 'include',
      });
      if (!response.ok) {
        const msg = await readErrorMessage(
          response,
          `Failed to load pitches (HTTP ${response.status}).`,
        );
        throw new Error(msg);
      }

      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response format from pitches endpoint.');
      }

      const loadedPitches = data as FeedPitch[];
      setPitches(loadedPitches);
      setSemanticResults(null);
      setSemanticQueryLabel('');

      void loadVotesForPitches(loadedPitches);
      void loadAuthorsAndCurrentUser();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the pitch feed right now.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadAuthorsAndCurrentUser, loadVotesForPitches]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!selectedPitch) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPitch(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPitch]);

  const handleSemanticSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSemanticResults(null);
      setSemanticQueryLabel('');
      return;
    }

    setSearchingSemantic(true);
    try {
      const params = new URLSearchParams({ query: trimmed, limit: '40' });
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      const response = await fetch(`/api/v1/user/pitches/search?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Semantic search unavailable (${response.status})`);
      }

      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) {
        throw new Error('Invalid semantic search response.');
      }

      const results = (data as FeedPitch[]).filter(
        (pitch) => pitch.state.toLowerCase() === 'published',
      );
      setSemanticResults(results);
      setSemanticQueryLabel(trimmed);
      void loadVotesForPitches(results);
    } catch {
      setSemanticResults(null);
      setSemanticQueryLabel('');
      showNotice('AI semantic search is unavailable right now — showing instant keyword matches instead.');
    } finally {
      setSearchingSemantic(false);
    }
  };

  const clearSemanticSearch = () => {
    setSemanticResults(null);
    setSemanticQueryLabel('');
  };

  const handleVote = async (pitchId: string, direction: 'up' | 'down') => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (votingPitchId) return;
    setVotingPitchId(pitchId);
    setError('');

    const currentVote = votesByPitchId[pitchId]?.my_vote ?? null;
    const isRemoving = currentVote === direction;

    try {
      const response = await fetch(`/api/v1/user/pitches/${pitchId}/vote`, {
        method: isRemoving ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: isRemoving ? undefined : { 'Content-Type': 'application/json' },
        body: isRemoving ? undefined : JSON.stringify({ direction }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response, `Could not update vote (${response.status}).`);
        throw new Error(msg);
      }

      const updatedVotes = (await response.json()) as PitchVotes;
      setVotesByPitchId((current) => ({
        ...current,
        [pitchId]: updatedVotes,
      }));
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Unable to cast vote.');
    } finally {
      setVotingPitchId(null);
    }
  };

  const handleDeletePitch = async (pitch: FeedPitch) => {
    if (deletingPitchId) return;
    if (!window.confirm(`Delete "${pitch.title}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingPitchId(pitch.id);
    setError('');

    try {
      const response = await fetch(`/api/v1/user/pitches/${pitch.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const msg = await readErrorMessage(response, `Could not delete pitch (${response.status}).`);
        throw new Error(msg);
      }

      setPitches((current) => current.filter((item) => item.id !== pitch.id));
      setSemanticResults((current) =>
        current ? current.filter((item) => item.id !== pitch.id) : null,
      );
      if (selectedPitch?.id === pitch.id) {
        setSelectedPitch(null);
      }
      showNotice(`Deleted "${pitch.title}".`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete pitch.');
    } finally {
      setDeletingPitchId(null);
    }
  };

  const handlePitchUpdated = async () => {
    if (!refiningPitch) return;
    try {
      const response = await fetch(`/api/v1/user/pitches/${refiningPitch.id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const updated = (await response.json()) as FeedPitch;
        setPitches((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        if (selectedPitch?.id === updated.id) {
          setSelectedPitch(updated);
        }
        showNotice('AI critique applied to your pitch.');
      }
    } catch {
      void loadFeed();
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pitch of pitches) {
      counts[pitch.category] = (counts[pitch.category] ?? 0) + 1;
    }
    return counts;
  }, [pitches]);

  const displayedPitches = useMemo(() => {
    if (semanticResults !== null) {
      return filterAndSortPitches(
        semanticResults,
        {
          category: selectedCategory,
          status: statusFilter,
          onlyMine,
          currentUserId: currentUser?.id ?? null,
          query: '',
          sort: sortBy,
        },
        votesByPitchId,
        authorsById,
      );
    }

    return filterAndSortPitches(
      pitches,
      {
        category: selectedCategory,
        status: statusFilter,
        onlyMine,
        currentUserId: currentUser?.id ?? null,
        query: searchQuery,
        sort: sortBy,
      },
      votesByPitchId,
      authorsById,
    );
  }, [
    authorsById,
    currentUser?.id,
    onlyMine,
    pitches,
    searchQuery,
    selectedCategory,
    semanticResults,
    sortBy,
    statusFilter,
    votesByPitchId,
  ]);

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    statusFilter !== 'all' ||
    onlyMine ||
    searchQuery.trim().length > 0 ||
    semanticResults !== null;

  const resetFilters = () => {
    setSelectedCategory('all');
    setStatusFilter('all');
    setOnlyMine(false);
    setSearchQuery('');
    setSemanticResults(null);
    setSemanticQueryLabel('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Hero / Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-outline-variant/50 bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-primary-fixed/40 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-mono font-bold text-on-primary-fixed">
              <span className="material-symbols-outlined text-[15px] text-primary">campaign</span>
              <span>1337.Nexus Community Feed</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface lg:text-4xl">
              1337 Campus Pitch Feed
            </h1>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Explore project ideas pitched by fellow 1337 peers, upvote promising concepts,
              and connect with builders looking for teammates.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link
              to={currentUser ? "/pitches" : "/login"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
              <span>My Pitches</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Ephemeral Notice */}
      {notice && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-fixed/60 px-4 py-3 text-sm text-on-primary-fixed shadow-sm"
          role="status"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">info</span>
            <span className="font-medium">{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-error/30 bg-error-container p-4 text-sm text-on-error-container shadow-sm"
          role="alert"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-xl text-error">error</span>
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadFeed()}
            className="rounded-xl bg-surface-container-lowest px-3.5 py-1.5 text-xs font-bold text-on-surface shadow-sm hover:bg-surface-container transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Search, Filter & Sort Toolbar */}
      <section className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input + Semantic Search Trigger */}
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[19px] text-outline">
                search
              </span>
              <input
                id="pitch-search"
                name="pitch-search"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (semanticResults !== null) {
                    setSemanticResults(null);
                    setSemanticQueryLabel('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    e.preventDefault();
                    void handleSemanticSearch();
                  }
                }}
                placeholder="Filter pitches by title, stack, description, or author..."
                className="w-full rounded-2xl border border-outline-variant/70 bg-surface py-2.5 pl-10 pr-9 text-sm text-on-surface placeholder:text-outline focus:border-brand focus:bg-surface-container-lowest focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchQuery('');
                    clearSemanticSearch();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleSemanticSearch()}
              disabled={searchingSemantic || !searchQuery.trim()}
              title="Run AI semantic similarity search on pitch content"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-2.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition-all disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
            >
              {searchingSemantic ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
              )}
              <span className="hidden sm:inline">AI Search</span>
            </button>

            <button
              type="button"
              onClick={() => void loadFeed()}
              disabled={loading}
              aria-label="Refresh feed"
              title="Refresh pitch feed"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all disabled:opacity-50 shrink-0"
            >
              <span className={`material-symbols-outlined text-[19px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
          </div>

          {/* Sort */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="pitch-sort"
              name="pitch-sort"
              aria-label="Sort pitches"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PitchSortOption)}
              className="rounded-xl border border-outline-variant/70 bg-surface px-3 py-2 text-xs font-semibold text-on-surface focus:border-brand focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="popular">Most Upvoted</option>
            </select>
          </div>
        </div>

        {/* Semantic search active indicator */}
        {semanticResults !== null && (
          <div className="flex items-center justify-between rounded-xl bg-brand/10 px-3.5 py-2 text-xs text-on-surface">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-brand">auto_awesome</span>
              <span>
                Showing AI semantic matches for <strong>“{semanticQueryLabel}”</strong> ({displayedPitches.length})
              </span>
            </div>
            <button
              type="button"
              onClick={clearSemanticSearch}
              className="font-bold text-brand hover:underline"
            >
              Back to all pitches
            </button>
          </div>
        )}

        {/* Category Pills */}
        <div className="hide-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto pb-1 pr-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'border-brand bg-brand text-white shadow-sm'
                : 'border-outline-variant/60 bg-surface text-on-surface-variant hover:border-outline hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">apps</span>
            <span>All Categories</span>
            {pitches.length > 0 && (
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 font-mono text-[10px]">
                {pitches.length}
              </span>
            )}
          </button>

          {CATEGORIES.map((category) => {
            const count = categoryCounts[category.id] ?? 0;
            const isActive = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'border-brand bg-brand text-white shadow-sm'
                    : 'border-outline-variant/60 bg-surface text-on-surface-variant hover:border-outline hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{category.icon}</span>
                <span>{category.name}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-container text-outline'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Feed Content */}
      {loading ? (
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
              <div className="h-6 w-3/4 rounded-lg bg-surface-container" />
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-surface-container-low" />
                <div className="h-4 w-5/6 rounded bg-surface-container-low" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="h-8 w-28 rounded-xl bg-surface-container" />
                <div className="h-8 w-24 rounded-xl bg-surface-container" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedPitches.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-3xl">lightbulb</span>
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-lg font-bold text-on-surface">
              {hasActiveFilters ? 'No pitches match your current filters' : 'No pitches in the feed yet'}
            </h2>
            <p className="text-sm text-on-surface-variant">
              {hasActiveFilters
                ? 'Try clearing your search query or switching category and status filters.'
                : 'Be the first 1337 student to pitch a project idea and recruit collaborators.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-2xl border border-outline-variant bg-surface px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container transition-all"
              >
                Reset Filters
              </button>
            )}
            <Link
              to="/pitches/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-hover transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              <span>Create a Pitch</span>
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {displayedPitches.map((pitch) => {
            const categoryMeta = CATEGORY_META_MAP.get(pitch.category);
            const author = pitch.author_id ? authorsById[pitch.author_id] : undefined;
            const authorName = author?.fullname || author?.login || '1337 Peer';
            const authorHandle = author?.login ? `@${author.login}` : 'Campus Builder';
            const isAuthor = Boolean(currentUser && pitch.author_id === currentUser.id);
            const votes = votesByPitchId[pitch.id];
            const netVotes = (votes?.upvotes ?? 0) - (votes?.downvotes ?? 0);
            const myVote = votes?.my_vote ?? null;

            return (
              <article
                key={pitch.id}
                className="group flex flex-col justify-between rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-brand/50 hover:shadow-md"
              >
                <div className="space-y-4">
                  {/* Top metadata row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed/75 px-3 py-1 text-xs font-semibold text-on-primary-fixed">
                      <span className="material-symbols-outlined text-[15px] text-primary">
                        {categoryMeta?.icon ?? 'category'}
                      </span>
                      <span>{categoryMeta?.name ?? pitch.category}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadgeClasses(pitch.state)}`}
                      >
                        {pitch.state}
                      </span>
                      <span className="font-mono text-[11px] text-outline">
                        {formatPitchRelativeTime(pitch.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Author row */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-[11px] font-bold text-on-primary-container">
                      {getInitials(author?.fullname || author?.login)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-bold text-on-surface">{authorName}</p>
                        {isAuthor && (
                          <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-[11px] text-outline">{authorHandle}</p>
                    </div>
                  </div>

                  {/* Title & Excerpt */}
                  <div className="space-y-2">
                    <h2
                      onClick={() => setSelectedPitch(pitch)}
                      className="cursor-pointer text-lg font-extrabold tracking-tight text-on-surface transition-colors group-hover:text-primary line-clamp-2"
                    >
                      {pitch.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-on-surface-variant line-clamp-3">
                      {getPitchExcerpt(pitch)}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 pt-4">
                  {/* Voting controls */}
                  <div className="inline-flex items-center rounded-xl border border-outline-variant/60 bg-surface p-0.5">
                    <button
                      type="button"
                      disabled={votingPitchId === pitch.id}
                      onClick={() => void handleVote(pitch.id, 'up')}
                      aria-label={`Upvote ${pitch.title}`}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        myVote === 'up'
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                      <span>{votes?.upvotes ?? 0}</span>
                    </button>

                    <span className="px-2 font-mono text-xs font-bold text-on-surface" title="Net score">
                      {netVotes >= 0 ? `+${netVotes}` : netVotes}
                    </span>

                    <button
                      type="button"
                      disabled={votingPitchId === pitch.id}
                      onClick={() => void handleVote(pitch.id, 'down')}
                      aria-label={`Downvote ${pitch.title}`}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        myVote === 'down'
                          ? 'bg-error/15 text-error'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                      <span>{votes?.downvotes ?? 0}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {isAuthor && pitch.state.toLowerCase() === 'draft' && (
                      <button
                        type="button"
                        onClick={() => setRefiningPitch(pitch)}
                        className="inline-flex items-center gap-1 rounded-xl border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                        <span>Refine</span>
                      </button>
                    )}

                    {isAuthor && (
                      <button
                        type="button"
                        disabled={deletingPitchId === pitch.id}
                        onClick={() => void handleDeletePitch(pitch)}
                        aria-label={`Delete ${pitch.title}`}
                        className="inline-flex items-center justify-center rounded-xl border border-error/30 bg-error-container/50 p-1.5 text-error hover:bg-error hover:text-white transition-all disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedPitch(pitch)}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-on-primary shadow-sm hover:bg-primary/90 transition-all"
                    >
                      <span>Read Full</span>
                      <span className="material-symbols-outlined text-[15px]">open_in_full</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Full Pitch Reader Modal */}
      {selectedPitch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPitch(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pitch-modal-title"
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/50 bg-surface-container-low px-6 py-5">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-0.5 text-xs font-semibold text-on-primary-fixed">
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      {CATEGORY_META_MAP.get(selectedPitch.category)?.icon ?? 'category'}
                    </span>
                    <span>{selectedPitch.category}</span>
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadgeClasses(selectedPitch.state)}`}
                  >
                    {selectedPitch.state}
                  </span>
                  <span className="font-mono text-xs text-outline">
                    {formatPitchRelativeTime(selectedPitch.created_at)}
                  </span>
                </div>
                <h2
                  id="pitch-modal-title"
                  className="text-xl font-extrabold tracking-tight text-on-surface md:text-2xl"
                >
                  {selectedPitch.title}
                </h2>
                {selectedPitch.description && (
                  <p className="whitespace-pre-line text-sm text-on-surface-variant">{selectedPitch.description}</p>
                )}
              </div>

              <button
                type="button"
                aria-label="Close pitch details"
                onClick={() => setSelectedPitch(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Markdown Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="prose prose-slate max-w-none text-sm leading-relaxed text-on-surface">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {selectedPitch.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/50 bg-surface-container-low px-6 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={votingPitchId === selectedPitch.id}
                  onClick={() => void handleVote(selectedPitch.id, 'up')}
                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    votesByPitchId[selectedPitch.id]?.my_vote === 'up'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700'
                      : 'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                  <span>{votesByPitchId[selectedPitch.id]?.upvotes ?? 0}</span>
                </button>
                <button
                  type="button"
                  disabled={votingPitchId === selectedPitch.id}
                  onClick={() => void handleVote(selectedPitch.id, 'down')}
                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    votesByPitchId[selectedPitch.id]?.my_vote === 'down'
                      ? 'border-error/40 bg-error/15 text-error'
                      : 'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                  <span>{votesByPitchId[selectedPitch.id]?.downvotes ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPitch(null)}
                  className="rounded-xl bg-on-surface px-4 py-1.5 text-xs font-bold text-inverse-on-surface hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Refiner Modal for Author Drafts */}
      {refiningPitch && (
        <RefineProjectModal
          isOpen={true}
          onClose={() => setRefiningPitch(null)}
          pitchId={refiningPitch.id}
          projectTitle={refiningPitch.title}
          currentUserId={currentUser?.id}
          onPitchUpdated={() => void handlePitchUpdated()}
        />
      )}
    </div>
  );
};
