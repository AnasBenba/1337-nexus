import { api } from '@/lib/http';

export type UserSummary = { id: number; login: string; fullname: string; avatar_url: string | null };

/** How I relate to another user. */
export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friends';

/** `online` is only ever true for accepted friends (the backend doesn't share it otherwise). */
export type FriendSummary = UserSummary & { online: boolean };

export type FriendsOverview = {
  friends: FriendSummary[];
  incoming: FriendSummary[];
  outgoing: FriendSummary[];
};

const url = (login: string) => `/api/v1/friends/${encodeURIComponent(login)}`;
type StatusBody = { status: FriendStatus };

export const getFriends = () => api<FriendsOverview>('/api/v1/friends');

/** My relationship with a user, plus whether they're online (friends only). */
export const getFriendStatus = (login: string) => api<StatusBody & { online: boolean }>(url(login));

/** Sends a request, or accepts theirs if they already asked me. */
export const addFriend = async (login: string) =>
  (await api<StatusBody>(url(login), { method: 'POST' })).status;

/** Unfriend, cancel my request, or decline theirs. */
export const removeFriend = async (login: string) =>
  (await api<StatusBody>(url(login), { method: 'DELETE' })).status;

export const searchUsers = (q: string) =>
  api<UserSummary[]>(`/api/v1/users?q=${encodeURIComponent(q)}`);

/** Derive my status with a user from the overview I already have (no extra request). */
export function statusFromOverview(overview: FriendsOverview, login: string): FriendStatus {
  const has = (list: UserSummary[]) => list.some((u) => u.login === login);
  if (has(overview.friends)) return 'friends';
  if (has(overview.incoming)) return 'incoming';
  if (has(overview.outgoing)) return 'outgoing';
  return 'none';
}
