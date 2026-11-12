import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRecommendedProjects, Project } from '../projectApi';

export const RecommendedProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listRecommendedProjects().then(setProjects).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load recommendations')); }, []);
  return <div className="max-w-7xl mx-auto space-y-6"><Link to="/projects" className="text-xs font-semibold text-primary hover:underline">← My projects</Link><div><h1 className="text-2xl font-extrabold text-on-surface">Recommended projects</h1><p className="text-sm text-on-surface-variant mt-1">Published projects from other students looking for collaborators.</p></div>{error && <div className="p-3 rounded-xl bg-red-500/10 text-red-600 text-xs">{error}</div>}{projects.length === 0 ? <div className="py-16 text-center text-sm text-on-surface-variant">No published projects are available right now.</div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{projects.map((project) => <article key={project.id} className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5"><span className="text-[10px] font-bold uppercase text-primary">Published</span><h2 className="text-lg font-bold text-on-surface mt-3">{project.title}</h2><p className="text-xs text-on-surface-variant mt-2 leading-relaxed">{project.description}</p><Link to="/discover" className="inline-flex mt-5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold">Explore opportunities</Link></article>)}</div>}</div>;
};
export default RecommendedProjectsPage;
