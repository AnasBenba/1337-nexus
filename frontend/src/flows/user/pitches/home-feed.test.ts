import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  AuthorProfile,
  FeedPitch,
  PitchFilterOptions,
  PitchVotes,
  filterAndSortPitches,
  formatPitchRelativeTime,
} from './HomePitchFeedPage';

const AUTHORS: Record<string, AuthorProfile> = {
  'user-1': { id: 'user-1', login: 'yassine', fullname: 'Yassine A.' },
  'user-2': { id: 'user-2', login: 'zoubair', fullname: 'Zoubair B.' },
};

const PITCHES: FeedPitch[] = [
  {
    id: 'pitch-1',
    title: 'StudySync — Peer Defense Matcher',
    content: '## Problem\nStudents need better mock defense pairing.',
    category: 'Education',
    state: 'published',
    description: 'Match peers preparing for 1337 project defenses.',
    author_id: 'user-1',
    created_at: '2026-11-10T10:00:00Z',
  },
  {
    id: 'pitch-2',
    title: 'Cub3D WebGL Preview',
    content: '## Architecture\nBrowser raycaster sandbox using WebGL shaders.',
    category: 'Entertainment',
    state: 'draft',
    description: 'Live 3D raycasting map debugger in browser.',
    author_id: 'user-2',
    created_at: '2026-11-12T10:00:00Z',
  },
  {
    id: 'pitch-3',
    title: 'Campus Energy Tracker',
    content: '## IoT Sensors\nMonitor cluster power usage in Benguerir.',
    category: 'Environment',
    state: 'published',
    description: null,
    author_id: 'user-1',
    created_at: '2026-11-11T10:00:00Z',
  },
];

const VOTES: Record<string, PitchVotes> = {
  'pitch-1': { pitch_id: 'pitch-1', upvotes: 12, downvotes: 2, my_vote: 'up' },
  'pitch-2': { pitch_id: 'pitch-2', upvotes: 3, downvotes: 1, my_vote: null },
  'pitch-3': { pitch_id: 'pitch-3', upvotes: 20, downvotes: 1, my_vote: null },
};

const BASE_OPTIONS: PitchFilterOptions = {
  category: 'all',
  status: 'all',
  onlyMine: false,
  currentUserId: null,
  query: '',
  sort: 'newest',
};

describe('filterAndSortPitches', () => {
  it('sorts newest pitches first by default', () => {
    const result = filterAndSortPitches(PITCHES, BASE_OPTIONS, VOTES, AUTHORS);
    expect(result.map((p) => p.id)).toEqual(['pitch-2', 'pitch-3', 'pitch-1']);
  });

  it('sorts most upvoted pitches first when sort is popular', () => {
    const result = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, sort: 'popular' },
      VOTES,
      AUTHORS,
    );
    expect(result.map((p) => p.id)).toEqual(['pitch-3', 'pitch-1', 'pitch-2']);
  });

  it('filters by category', () => {
    const result = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, category: 'Education' },
      VOTES,
      AUTHORS,
    );
    expect(result.map((p) => p.id)).toEqual(['pitch-1']);
  });

  it('filters by status', () => {
    const published = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, status: 'published' },
      VOTES,
      AUTHORS,
    );
    expect(published.map((p) => p.id)).toEqual(['pitch-3', 'pitch-1']);

    const drafts = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, status: 'draft' },
      VOTES,
      AUTHORS,
    );
    expect(drafts.map((p) => p.id)).toEqual(['pitch-2']);
  });

  it('filters by onlyMine using currentUserId', () => {
    const mine = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, onlyMine: true, currentUserId: 'user-1' },
      VOTES,
      AUTHORS,
    );
    expect(mine.map((p) => p.id)).toEqual(['pitch-3', 'pitch-1']);

    const signedOut = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, onlyMine: true, currentUserId: null },
      VOTES,
      AUTHORS,
    );
    expect(signedOut).toEqual([]);
  });

  it('matches search queries across title, content, and author handle/name', () => {
    const byContent = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, query: 'webgl' },
      VOTES,
      AUTHORS,
    );
    expect(byContent.map((p) => p.id)).toEqual(['pitch-2']);

    const byAuthor = filterAndSortPitches(
      PITCHES,
      { ...BASE_OPTIONS, query: 'zoubair' },
      VOTES,
      AUTHORS,
    );
    expect(byAuthor.map((p) => p.id)).toEqual(['pitch-2']);
  });
});

describe('formatPitchRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T21:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles missing or invalid dates gracefully', () => {
    expect(formatPitchRelativeTime(null)).toBe('Recently');
    expect(formatPitchRelativeTime(undefined)).toBe('Recently');
    expect(formatPitchRelativeTime('not-a-date')).toBe('Recently');
  });

  it('formats recent relative intervals cleanly', () => {
    expect(formatPitchRelativeTime('2026-11-13T20:59:30Z')).toBe('Just now');
    expect(formatPitchRelativeTime('2026-11-13T20:45:00Z')).toBe('15m ago');
    expect(formatPitchRelativeTime('2026-11-13T18:00:00Z')).toBe('3h ago');
    expect(formatPitchRelativeTime('2026-11-11T21:00:00Z')).toBe('2d ago');
  });

  it('formats dates older than 7 days using locale short date', () => {
    const older = formatPitchRelativeTime('2026-11-01T12:00:00Z');
    expect(older).not.toBe('Recently');
    expect(older).not.toMatch(/ago$/);
  });
});
