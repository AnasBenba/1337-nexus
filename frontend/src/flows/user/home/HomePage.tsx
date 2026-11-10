import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '@/lib/auth';

interface UserProfile {
  id: string;
  login: string;
  fullname: string;
  campus?: string;
  avatar_url?: string;
  bio?: string;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  git_repo_url?: string;
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  status: string;
  required_skills: string[];
}

interface Pitch {
  id: string;
  title: string;
  category: string;
  status: string;
  description?: string;
}

interface Friend {
  id: string;
  friend_id: string;
  friend_login: string;
  friend_fullname: string;
  friend_campus?: string;
  friend_avatar_url?: string;
  is_online?: boolean;
}

export const HomePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [profRes, projRes, oppsRes, pitchesRes, friendsRes] = await Promise.allSettled([
          authFetch('/api/v1/profile/me').then((r) => (r.ok ? r.json() : null)),
          authFetch('/projects/mine').then((r) => (r.ok ? r.json() : [])),
          authFetch('/opportunities/?limit=6').then((r) => (r.ok ? r.json() : [])),
          authFetch('/api/v1/user/pitches').then((r) => (r.ok ? r.json() : [])),
          authFetch('/api/v1/friends').then((r) => (r.ok ? r.json() : [])),
        ]);

        if (profRes.status === 'fulfilled' && profRes.value) setProfile(profRes.value);
        if (projRes.status === 'fulfilled' && Array.isArray(projRes.value)) setProjects(projRes.value);
        if (oppsRes.status === 'fulfilled' && Array.isArray(oppsRes.value)) setOpportunities(oppsRes.value);
        if (pitchesRes.status === 'fulfilled' && Array.isArray(pitchesRes.value)) setPitches(pitchesRes.value);
        if (friendsRes.status === 'fulfilled' && Array.isArray(friendsRes.value)) setFriends(friendsRes.value);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboardData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary-container/10 to-surface-container-low border border-outline-variant/50 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary text-on-primary flex items-center justify-center text-2xl font-bold shadow-md overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.login} className="w-full h-full object-cover" />
              ) : (
                (profile?.login || '42').slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface">
                  Welcome back, {profile?.fullname || 'Student'}!
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary text-white">
                  @{profile?.login || 'peer'}
                </span>
              </div>
              <p className="text-on-surface-variant text-sm mt-1 max-w-xl">
                {profile?.bio || 'Collaborate on campus projects, refine your ideas with AI, and connect with peers.'}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                  {profile?.campus || '1337 Coding School'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Intra Sync Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/refine-project"
              className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Refine Pitch (AI)
            </Link>
            <Link
              to="/discover"
              className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-medium text-sm flex items-center gap-2 hover:bg-surface-container-highest transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">explore</span>
              Find Opportunities
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/projects"
          className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-xl">folder_open</span>
          </div>
          <h3 className="font-bold text-on-surface text-base group-hover:text-primary transition-colors">My Projects</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {projects.length} active workspaces &amp; Kanban boards
          </p>
        </Link>

        <Link
          to="/discover"
          className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-xl">group_add</span>
          </div>
          <h3 className="font-bold text-on-surface text-base group-hover:text-emerald-500 transition-colors">
            Opportunities
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {opportunities.length} open recruitment roles
          </p>
        </Link>

        <Link
          to="/messages"
          className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-xl">chat_bubble</span>
          </div>
          <h3 className="font-bold text-on-surface text-base group-hover:text-purple-500 transition-colors">Messages</h3>
          <p className="text-xs text-on-surface-variant mt-1">Real-time chat with friends and teams</p>
        </Link>

        <Link
          to="/copilot"
          className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-xl">psychology</span>
          </div>
          <h3 className="font-bold text-on-surface text-base group-hover:text-amber-500 transition-colors">AI Copilot</h3>
          <p className="text-xs text-on-surface-variant mt-1">Ask anything about 42 curriculum &amp; subjects</p>
        </Link>
      </div>

      {/* Main Grid: Projects & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 spans): Active Projects & Open Opportunities */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Projects */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">dashboard_customize</span>
                <h2 className="text-lg font-bold text-on-surface">My Projects &amp; Workspaces</h2>
              </div>
              <Link to="/projects" className="text-xs font-semibold text-primary hover:underline">
                View all ({projects.length}) →
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-on-surface-variant text-sm">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-xl p-6">
                <p className="text-sm">You don't have any registered projects yet.</p>
                <Link
                  to="/projects"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Create Your First Project
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-xl border border-outline-variant/60 bg-surface hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-on-surface text-sm truncate">{proj.title}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary uppercase">
                          {proj.status}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">
                        {proj.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                      <span className="text-[11px] text-outline font-mono">
                        {proj.git_repo_url ? 'Git linked' : 'Internal'}
                      </span>
                      <Link
                        to={`/projects`}
                        className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
                      >
                        Open Workspace
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Campus Opportunities */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-xl">work_outline</span>
                <h2 className="text-lg font-bold text-on-surface">Campus Opportunities</h2>
              </div>
              <Link to="/discover" className="text-xs font-semibold text-primary hover:underline">
                Explore All Opportunities →
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-on-surface-variant text-sm">Loading opportunities...</div>
            ) : opportunities.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-xl p-6">
                <p className="text-sm">No open opportunities right now. Be the first to recruit teammates!</p>
                <Link
                  to="/discover"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Post an Opportunity
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.slice(0, 4).map((opp) => (
                  <div
                    key={opp.id}
                    className="p-4 rounded-xl border border-outline-variant/60 bg-surface hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-on-surface text-sm">{opp.title}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                          {opp.status}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">{opp.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {opp.required_skills?.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link
                      to="/discover"
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors text-center"
                    >
                      Apply Now
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Friends & Pitches */}
        <div className="space-y-8">
          {/* Peer Friends */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">group</span>
                <h3 className="font-bold text-on-surface text-base">Friends ({friends.length})</h3>
              </div>
              <Link to="/friends" className="text-xs font-semibold text-primary hover:underline">
                Manage →
              </Link>
            </div>

            {friends.length === 0 ? (
              <div className="text-center py-6 text-on-surface-variant text-xs">
                <p>No friends added yet.</p>
                <Link to="/friends" className="mt-2 text-primary font-medium inline-block hover:underline">
                  Find peers on campus
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="relative w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {f.friend_avatar_url ? (
                          <img src={f.friend_avatar_url} alt={f.friend_login} className="w-full h-full object-cover" />
                        ) : (
                          f.friend_login.slice(0, 2).toUpperCase()
                        )}
                        {f.is_online && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-on-surface truncate">{f.friend_fullname}</div>
                        <div className="text-[11px] text-outline">@{f.friend_login}</div>
                      </div>
                    </div>
                    <Link
                      to="/messages"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Chat"
                    >
                      <span className="material-symbols-outlined text-[18px]">chat</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Pitches */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-xl">lightbulb</span>
                <h3 className="font-bold text-on-surface text-base">Idea Pitches</h3>
              </div>
              <Link to="/refine-project" className="text-xs font-semibold text-primary hover:underline">
                New Pitch →
              </Link>
            </div>

            {pitches.length === 0 ? (
              <div className="text-center py-6 text-on-surface-variant text-xs">
                <p>No project pitches yet.</p>
                <Link to="/refine-project" className="mt-2 text-primary font-medium inline-block hover:underline">
                  Pitch an idea with AI
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {pitches.slice(0, 4).map((p) => (
                  <div key={p.id} className="p-3 rounded-xl border border-outline-variant/40 bg-surface">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-on-surface truncate">{p.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">
                        {p.category}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-1">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
