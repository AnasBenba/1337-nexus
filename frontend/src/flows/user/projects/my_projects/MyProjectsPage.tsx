import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { changeProjectStatus, listMyProjects, Project } from '../projectApi';

export const MyProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setProjects(await listMyProjects()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load projects'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const changeStatus = async (project: Project, action: 'publish' | 'archive') => {
    try {
      const updated = await changeProjectStatus(project.id, action);
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Could not ${action} project`); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Workspace management</p><h1 className="text-2xl md:text-3xl font-extrabold text-on-surface mt-1">My projects</h1><p className="text-sm text-on-surface-variant mt-1">Create, publish, and maintain the projects you own.</p></div>
        <div className="flex gap-2"><Link to="/projects/recommended" className="px-4 py-2.5 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:border-primary">Find projects</Link><Link to="/projects/new" className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold">New project</Link></div>
      </header>
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs">{error}</div>}
      {loading ? <div className="py-20 text-center text-sm text-on-surface-variant">Loading your projects...</div> : projects.length === 0 ? <div className="py-20 text-center border border-dashed border-outline-variant rounded-2xl"><h2 className="font-bold text-on-surface">No projects yet</h2><Link to="/projects/new" className="inline-flex mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold">Create your first project</Link></div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{projects.map((project) => <article key={project.id} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 space-y-5"><div><div className="flex justify-between gap-2"><span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">{project.status}</span><span className="text-[10px] text-outline font-mono">{project.id.slice(0, 8)}</span></div><h2 className="text-lg font-bold text-on-surface mt-3">{project.title}</h2><p className="text-xs text-on-surface-variant mt-2 line-clamp-3">{project.description}</p></div><div className="flex flex-wrap gap-2 pt-3 border-t border-outline-variant/40"><Link to={`/boards/${project.id}`} className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold">Open board</Link><Link to={`/projects/${project.id}/edit`} className="px-3 py-2 rounded-xl bg-surface-container text-xs font-semibold text-on-surface">Edit</Link><Link to={`/projects/${project.id}/recruitment`} className="px-3 py-2 rounded-xl bg-surface-container text-xs font-semibold text-on-surface">Applicants</Link>{project.status === 'draft' && <button type="button" onClick={() => void changeStatus(project, 'publish')} className="px-3 py-2 rounded-xl border border-primary text-primary text-xs font-semibold">Publish</button>}{project.status !== 'archived' && <button type="button" onClick={() => void changeStatus(project, 'archive')} className="px-3 py-2 rounded-xl border border-red-300 text-red-600 text-xs font-semibold">Archive</button>}</div></article>)}</div>}
    </div>
  );
};
export default MyProjectsPage;
