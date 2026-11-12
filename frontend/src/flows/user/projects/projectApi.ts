import { authFetch } from '@/lib/auth';

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived' | string;
}

export async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  const error = await response.json().catch(() => ({}));
  throw new Error(error.detail || fallback);
}

export async function listMyProjects(): Promise<Project[]> {
  return readJson<Project[]>(await authFetch('/projects/mine'), 'Could not load your projects');
}

export async function listRecommendedProjects(): Promise<Project[]> {
  return readJson<Project[]>(await authFetch('/projects/recommended'), 'Could not load recommended projects');
}

export async function createProject(title: string, description: string): Promise<Project> {
  return readJson<Project>(await authFetch('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  }), 'Could not create project');
}

export async function updateProject(id: string, title: string, description: string): Promise<Project> {
  return readJson<Project>(await authFetch(`/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  }), 'Could not update project');
}

export async function changeProjectStatus(id: string, action: 'publish' | 'archive'): Promise<Project> {
  return readJson<Project>(await authFetch(`/projects/${id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }), `Could not ${action} project`);
}
