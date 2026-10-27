import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestRefine,
  getRefineStatus,
  applySuggestion,
  dismissSuggestion,
  ApiError,
} from './api';

describe('Refine Project API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requestRefine sends POST and returns job details', async () => {
    const mockResponse = {
      job_id: 'job-1234',
      status: 'queued',
      base_hash: 'hash-abc',
      message: 'Critique request submitted successfully',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await requestRefine('pitch-uuid-1', 42);

    expect(fetch).toHaveBeenCalledWith(
      '/api/user/projects/refine-project/pitch-uuid-1/refine',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': '42',
        },
      })
    );
    expect(result.job_id).toBe('job-1234');
    expect(result.status).toBe('queued');
  });

  it('getRefineStatus sends GET and parses dynamic is_stale and suggestions', async () => {
    const mockStatus = {
      job_id: 'job-1234',
      status: 'succeeded',
      summary: {
        executive_assessment: 'Solid pitch with strong potential.',
        strengths: ['Clear vision', 'Good scope'],
      },
      suggestions: [
        {
          id: 'sug-1',
          field: 'title',
          section_label: 'Title',
          severity: 'minor',
          title: 'Sharpen title',
          original_excerpt: 'Old Title',
          suggested_text: 'Better Title',
          rationale: 'More punchy',
          status: 'pending',
        },
      ],
      version_token: 'token-xyz',
      is_stale: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    } as Response);

    const result = await getRefineStatus('pitch-uuid-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/user/projects/refine-project/pitch-uuid-1/status',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(result.is_stale).toBe(false);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].title).toBe('Sharpen title');
  });

  it('applySuggestion sends version_token and advances version token on success', async () => {
    const mockApplyResponse = {
      suggestion_id: 'sug-1',
      status: 'applied',
      new_version_token: 'token-updated-999',
      applied_field: 'title',
      message: 'Suggestion applied successfully',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApplyResponse,
    } as Response);

    const result = await applySuggestion(
      'pitch-uuid-1',
      'sug-1',
      'token-initial-111',
      42
    );

    expect(fetch).toHaveBeenCalledWith(
      '/api/user/projects/refine-project/pitch-uuid-1/suggestions/sug-1/apply',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': '42',
        },
        body: JSON.stringify({ version_token: 'token-initial-111' }),
      })
    );
    expect(result.status).toBe('applied');
    expect(result.new_version_token).toBe('token-updated-999');
  });

  it('applySuggestion throws ApiError with isConflict=true on 409 conflict', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        detail:
          'Conflict: Pitch has been modified since critique was generated (version token mismatch)',
      }),
    } as Response);

    await expect(
      applySuggestion('pitch-uuid-1', 'sug-1', 'stale-token')
    ).rejects.toThrow(ApiError);

    try {
      await applySuggestion('pitch-uuid-1', 'sug-1', 'stale-token');
    } catch (err: any) {
      expect(err.isConflict).toBe(true);
      expect(err.isStale).toBe(true);
      expect(err.status).toBe(409);
    }
  });

  it('dismissSuggestion sends POST to dismiss endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion_id: 'sug-1', status: 'dismissed' }),
    } as Response);

    const result = await dismissSuggestion('pitch-uuid-1', 'sug-1');
    expect(result.status).toBe('dismissed');
  });
});
