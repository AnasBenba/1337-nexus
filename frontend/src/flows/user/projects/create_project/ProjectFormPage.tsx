import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createProject, listMyProjects, updateProject } from '../projectApi';

export const ProjectFormPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const editing = Boolean(projectId);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    void listMyProjects().then((projects) => {
      const project = projects.find((item) => item.id === projectId);
      if (!project) setError('Project not found'); else { setTitle(project.title); setDescription(project.description); }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load project')).finally(() => setLoading(false));
  }, [projectId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try { if (editing && projectId) await updateProject(projectId, title.trim(), description.trim()); else await createProject(title.trim(), description.trim()); navigate('/projects'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save project'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-20 text-center text-sm text-on-surface-variant">Loading project...</div>;
  return <div className="max-w-2xl mx-auto space-y-6"><Link to="/projects" className="text-xs font-semibold text-primary hover:underline">← My projects</Link><div><h1 className="text-2xl font-extrabold text-on-surface">{editing ? 'Edit project' : 'Create project'}</h1><p className="text-sm text-on-surface-variant mt-1">{editing ? 'Draft projects can be edited before publishing.' : 'Set up a workspace for your next collaboration.'}</p></div><form onSubmit={submit} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-5">{error && <div className="p-3 rounded-xl bg-red-500/10 text-red-600 text-xs">{error}</div>}<div><label htmlFor="project-title" className="block text-xs font-semibold text-on-surface mb-1">Title</label><input id="project-title" required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/60 text-sm outline-none focus:border-primary" /></div><div><label htmlFor="project-description" className="block text-xs font-semibold text-on-surface mb-1">Description</label><textarea id="project-description" required rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/60 text-sm outline-none focus:border-primary resize-none" /></div><div className="flex justify-end gap-2"><Link to="/projects" className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant">Cancel</Link><button disabled={saving} className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save changes' : 'Create project'}</button></div></form></div>;
};
export default ProjectFormPage;
