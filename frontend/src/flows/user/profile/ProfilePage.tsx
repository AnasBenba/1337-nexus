import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

type UserProfile = {
  id: string;
  login: string;
  fullname: string;
  email: string | null;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  campus: string | null;
  created_at: string | null;
  is_self: boolean;
  is_friend: boolean;
  stats: {
    friends_count?: number;
    projects_count?: number;
    pitches_count?: number;
  };
};

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullname: '',
    bio: '',
    campus: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = userId ? `/api/v1/profile/${userId}` : '/api/v1/profile/me';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to load profile (${res.status})`);
      }
      const data: UserProfile = await res.json();
      setProfile(data);
      setEditForm({
        fullname: data.fullname || '',
        bio: data.bio || '',
        campus: data.campus || '1337 Benguerir',
        avatar_url: data.avatar_url || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [userId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/v1/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail || 'Failed to update profile');
      }
      const updated: UserProfile = await res.json();
      setProfile(updated);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFriend = async () => {
    if (!profile) return;
    try {
      setFriendActionLoading(true);
      setError(null);
      if (profile.is_friend) {
        const res = await fetch(`/api/v1/friends/${profile.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to remove friend');
        setProfile((prev) => (prev ? { ...prev, is_friend: false } : null));
        setSuccessMessage('Friend removed.');
      } else {
        const res = await fetch(`/api/v1/friends/${profile.id}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to add friend');
        setProfile((prev) => (prev ? { ...prev, is_friend: true } : null));
        setSuccessMessage('Friend added!');
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Friendship action failed');
    } finally {
      setFriendActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant text-center">
        <span className="material-symbols-outlined text-error text-[40px] mb-2">error</span>
        <h2 className="text-lg font-bold text-on-surface">Profile unavailable</h2>
        <p className="text-sm text-on-surface-variant mt-1">{error || 'User not found'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-green-100 text-green-900 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-green-700">check_circle</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Profile Card Header */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        {/* Cover / Gradient Strip */}
        <div className="h-36 bg-gradient-to-r from-primary to-primary-container relative">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="bg-black/30 backdrop-blur-md text-white text-xs font-mono font-bold px-3 py-1 rounded-full">
              42 NETWORK
            </span>
          </div>
        </div>

        {/* User Info Bar */}
        <div className="px-8 pb-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 mb-6">
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.login}
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-surface shadow-md"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-secondary-fixed text-on-secondary-fixed font-bold text-3xl flex items-center justify-center border-4 border-surface shadow-md">
                  {profile.login.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-surface" />
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              {profile.is_self ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface font-semibold text-sm rounded-xl hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isEditing ? 'close' : 'edit'}
                  </span>
                  {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(`/messages?user=${profile.id}`)}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary font-bold text-sm rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    Message
                  </button>
                  <button
                    type="button"
                    disabled={friendActionLoading}
                    onClick={handleToggleFriend}
                    className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm rounded-xl transition-colors ${
                      profile.is_friend
                        ? 'bg-surface-container text-error hover:bg-error-container/30'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {profile.is_friend ? 'person_remove' : 'person_add'}
                    </span>
                    {friendActionLoading
                      ? 'Updating...'
                      : profile.is_friend
                        ? 'Remove Friend'
                        : 'Add Friend'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-on-surface">{profile.fullname}</h1>
              <span className="text-sm font-mono text-on-surface-variant">@{profile.login}</span>
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary-container/20 text-primary-container">
                {profile.role}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-on-surface-variant mt-2 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                {profile.campus || '1337 Benguerir'}
              </span>
              {profile.email && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  {profile.email}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                Member since {new Date(profile.created_at || Date.now()).toLocaleDateString()}
              </span>
            </div>

            {profile.bio && (
              <p className="text-sm text-on-surface mt-4 whitespace-pre-line bg-surface-container-low p-4 rounded-xl border border-outline-variant/50">
                {profile.bio}
              </p>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-outline-variant">
            <button
              type="button"
              onClick={() => navigate('/friends')}
              className="p-3 bg-surface-container-low rounded-xl text-center hover:bg-surface-container transition-colors"
            >
              <div className="text-xl font-bold text-on-surface">
                {profile.stats?.friends_count ?? 0}
              </div>
              <div className="text-xs text-on-surface-variant font-medium">Friends</div>
            </button>
            <div className="p-3 bg-surface-container-low rounded-xl text-center">
              <div className="text-xl font-bold text-on-surface">
                {profile.stats?.projects_count ?? 0}
              </div>
              <div className="text-xs text-on-surface-variant font-medium">Projects</div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl text-center">
              <div className="text-xl font-bold text-on-surface">
                {profile.stats?.pitches_count ?? 0}
              </div>
              <div className="text-xs text-on-surface-variant font-medium">Pitches</div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form Modal/Section */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <h3 className="font-bold text-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">edit</span>
            Update Profile Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={editForm.fullname}
                onChange={(e) => setEditForm({ ...editForm, fullname: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Campus</label>
              <select
                value={editForm.campus}
                onChange={(e) => setEditForm({ ...editForm, campus: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm"
              >
                <option value="1337 Benguerir">1337 Benguerir</option>
                <option value="1337 Khouribga">1337 Khouribga</option>
                <option value="1337 Med">1337 Med (Tetouan)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">
              Avatar Image URL
            </label>
            <input
              type="url"
              placeholder="https://example.com/avatar.jpg"
              value={editForm.avatar_url}
              onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Bio</label>
            <textarea
              rows={3}
              placeholder="Tell other students about your skills, interests, and current 42 projects..."
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-surface-container text-on-surface text-sm font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
