import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '@/lib/auth';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  git_repo_url?: string;
  created_at?: string;
}

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // New Project modal state
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/projects/mine');
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await authFetch('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || 'Failed to create project');
      } else {
        setShowModal(false);
        setTitle('');
        setDescription('');
        await fetchProjects();
      }
    } catch {
      setErrorMsg('Network error while creating project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">folder_open</span>
            My Projects &amp; Workspaces
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Manage your peer projects, organize tasks with Kanban boards, and build together.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 shadow-sm transition-all self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          New Project
        </button>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="py-20 text-center text-on-surface-variant text-sm">Loading your projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant p-8">
          <span className="material-symbols-outlined text-5xl text-outline mb-3">create_new_folder</span>
          <h3 className="text-base font-bold text-on-surface">No projects yet</h3>
          <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
            Get started by initializing a project. You will get dedicated workspaces, team collaboration, and a Kanban
            board.
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-all inline-flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary uppercase">
                    {proj.status}
                  </span>
                  <span className="text-[11px] font-mono text-outline">
                    {proj.git_repo_url ? 'Git Repository' : 'Peer Workspace'}
                  </span>
                </div>

                <h3 className="font-bold text-lg text-on-surface">{proj.title}</h3>
                <p className="text-xs text-on-surface-variant mt-2 line-clamp-3 leading-relaxed">
                  {proj.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-outline-variant/40 space-y-3">
                <div className="flex items-center justify-between">
                  <Link
                    to={`/boards/${proj.id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">view_kanban</span>
                    Open Board
                  </Link>

                  <Link
                    to="/discover"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    Recruit Peers →
                  </Link>
                </div>
                <Link
                  to={`/projects/${proj.id}/recruitment`}
                  className="w-full text-center px-3 py-2 rounded-xl border border-outline-variant/60 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">rate_review</span>
                  Review applicants
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/60 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_box</span>
                Create New Project
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-outline hover:text-on-surface text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ft_transcendence or Distributed Key-Value Store"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the scope, tech stack, and goals for this project..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
