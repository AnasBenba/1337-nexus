import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type FriendUser = {
  id: string;
  login: string;
  fullname: string;
  avatar_url: string | null;
  campus: string | null;
  bio: string | null;
  role: string;
  is_online?: boolean;
  friended_at?: string | null;
};

type CampusUser = {
  id: string;
  login: string;
  fullname: string;
  avatar_url: string | null;
  campus: string | null;
  bio: string | null;
  role: string;
  is_friend: boolean;
};

export const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'friends' | 'discover'>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [campusUsers, setCampusUsers] = useState<CampusUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/friends', { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to load friends');
      }
      const data: FriendUser[] = await res.json();
      setFriends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading friends');
    } finally {
      setLoading(false);
    }
  };

  const loadCampusUsers = async (query = '') => {
    try {
      setLoading(true);
      const url = query ? `/api/v1/users?q=${encodeURIComponent(query)}` : '/api/v1/users';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to load students directory');
      }
      const data: CampusUser[] = await res.json();
      setCampusUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'friends') {
      void loadFriends();
    } else {
      void loadCampusUsers(searchQuery);
    }
  }, [activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'discover') {
      void loadCampusUsers(searchQuery);
    }
  };

  const handleAddFriend = async (userId: string) => {
    try {
      setActionLoading(userId);
      setError(null);
      const res = await fetch(`/api/v1/friends/${userId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail || 'Could not add friend');
      }
      setSuccessMessage('Friend added successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setCampusUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_friend: true } : u)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add friend');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) {
      return;
    }
    try {
      setActionLoading(friendId);
      setError(null);
      const res = await fetch(`/api/v1/friends/${friendId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to remove friend');
      }
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      setSuccessMessage('Friend removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      f.login.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.fullname.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">group</span>
            1337 Student Network
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Connect, collaborate, and chat with fellow peers across Benguerir, Khouribga, and Med.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'friends'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">favorite</span>
            My Friends
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'friends'
                  ? 'bg-on-primary/20 text-on-primary'
                  : 'bg-surface-container-highest text-on-surface-variant'
              }`}
            >
              {friends.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'discover'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person_search</span>
            Find Students
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-error-container text-on-error-container text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-green-100 text-green-900 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-green-700">check_circle</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-3 text-outline text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'friends'
                ? 'Search your friends by login or name...'
                : 'Search all students by login or name (e.g. yassine, soufiane)...'
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline text-sm focus:outline-none focus:border-primary"
          />
        </div>
        {activeTab === 'discover' && (
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary text-on-primary font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity"
          >
            Search
          </button>
        )}
      </form>

      {/* Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Loading students...</p>
        </div>
      ) : activeTab === 'friends' ? (
        filteredFriends.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant p-8">
            <span className="material-symbols-outlined text-outline text-[48px] mb-2">group_off</span>
            <h3 className="font-bold text-lg text-on-surface">No friends found</h3>
            <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'No friends match your search.'
                : 'You have not added any friends yet. Explore campus students to connect!'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setActiveTab('discover')}
                className="mt-4 px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-xl"
              >
                Find Students
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <div className="relative">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.login}
                          className="w-13 h-13 rounded-full object-cover border border-outline-variant"
                        />
                      ) : (
                        <div className="w-13 h-13 rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center text-lg">
                          {friend.login.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-surface" />
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <Link
                        to={`/profile/${friend.id}`}
                        className="font-bold text-on-surface hover:text-primary transition-colors truncate block"
                      >
                        {friend.fullname}
                      </Link>
                      <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">@{friend.login}</span>
                        <span>•</span>
                        <span>{friend.campus || '1337'}</span>
                      </div>
                    </div>
                  </div>

                  {friend.bio && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-3 bg-surface-container-low p-2 rounded-lg">
                      {friend.bio}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={() => navigate(`/messages?user=${friend.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    Message
                  </button>
                  <Link
                    to={`/profile/${friend.id}`}
                    className="py-2 px-3 bg-surface-container text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container-high transition-colors"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    title="Remove Friend"
                    disabled={actionLoading === friend.id}
                    onClick={() => handleRemoveFriend(friend.id)}
                    className="p-2 text-outline hover:text-error hover:bg-error-container/30 rounded-xl transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : campusUsers.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant p-8">
          <span className="material-symbols-outlined text-outline text-[48px] mb-2">search_off</span>
          <h3 className="font-bold text-lg text-on-surface">No students found</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Try searching with a different login or name.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campusUsers.map((user) => (
            <div
              key={user.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <div className="relative">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.login}
                        className="w-13 h-13 rounded-full object-cover border border-outline-variant"
                      />
                    ) : (
                      <div className="w-13 h-13 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold flex items-center justify-center text-lg">
                        {user.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <Link
                      to={`/profile/${user.id}`}
                      className="font-bold text-on-surface hover:text-primary transition-colors truncate block"
                    >
                      {user.fullname}
                    </Link>
                    <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono">@{user.login}</span>
                      <span>•</span>
                      <span>{user.campus || '1337'}</span>
                    </div>
                  </div>
                </div>

                {user.bio && (
                  <p className="text-xs text-on-surface-variant line-clamp-2 mt-3 bg-surface-container-low p-2 rounded-lg">
                    {user.bio}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-outline-variant">
                {user.is_friend ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/messages?user=${user.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    Message
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actionLoading === user.id}
                    onClick={() => handleAddFriend(user.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    {actionLoading === user.id ? 'Adding...' : 'Add Friend'}
                  </button>
                )}
                <Link
                  to={`/profile/${user.id}`}
                  className="py-2 px-3 bg-surface-container text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container-high transition-colors"
                >
                  Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
