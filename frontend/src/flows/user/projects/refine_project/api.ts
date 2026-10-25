import {
  ApplySuggestionResponse,
  DismissSuggestionResponse,
  RefineResponse,
  RefineStatusResponse,
} from './types';

export class ApiError extends Error {
  status: number;
  detail: string;
  isConflict: boolean;
  isStale: boolean;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.isConflict = status === 409;
    this.isStale =
      status === 409 &&
      (detail.toLowerCase().includes('version token') ||
        detail.toLowerCase().includes('stale'));
  }
}

function getHeaders(userId?: string | number): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId !== undefined) {
    headers['X-User-Id'] = String(userId);
  }
  return headers;
}

export async function requestRefine(
  pitchId: string,
  userId?: string | number
): Promise<RefineResponse> {
  const res = await fetch(`/api/user/projects/refine-project/${pitchId}/refine`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, errorBody.detail || 'Failed to submit refine request');
  }

  return res.json();
}

export async function getRefineStatus(
  pitchId: string,
  userId?: string | number
): Promise<RefineStatusResponse> {
  const res = await fetch(`/api/user/projects/refine-project/${pitchId}/status`, {
    method: 'GET',
    headers: getHeaders(userId),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, errorBody.detail || 'Failed to retrieve critique status');
  }

  return res.json();
}

export async function applySuggestion(
  pitchId: string,
  suggestionId: string,
  versionToken: string,
  userId?: string | number
): Promise<ApplySuggestionResponse> {
  const res = await fetch(
    `/api/user/projects/refine-project/${pitchId}/suggestions/${suggestionId}/apply`,
    {
      method: 'POST',
      headers: getHeaders(userId),
      body: JSON.stringify({ version_token: versionToken }),
    }
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, errorBody.detail || 'Failed to apply suggestion');
  }

  return res.json();
}

export async function dismissSuggestion(
  pitchId: string,
  suggestionId: string,
  userId?: string | number
): Promise<DismissSuggestionResponse> {
  const res = await fetch(
    `/api/user/projects/refine-project/${pitchId}/suggestions/${suggestionId}/dismiss`,
    {
      method: 'POST',
      headers: getHeaders(userId),
    }
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, errorBody.detail || 'Failed to dismiss suggestion');
  }

  return res.json();
}
