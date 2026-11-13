"""In-memory Socket.IO global peer presence tracker."""

from __future__ import annotations

from collections import defaultdict


class PresenceManager:
    """Tracks active Socket.IO connections and online presence per user ID."""

    def __init__(self) -> None:
        self._user_sids: dict[str, set[str]] = defaultdict(set)
        self._sid_user: dict[str, str] = {}

    def add_connection(self, user_id: str, sid: str) -> bool:
        """Record a connection for user_id; returns True if the user transitioned online."""
        uid = str(user_id)
        was_offline = len(self._user_sids[uid]) == 0
        self._user_sids[uid].add(sid)
        self._sid_user[sid] = uid
        return was_offline

    def remove_connection(self, sid: str) -> tuple[str | None, bool]:
        """Remove a socket connection; returns (user_id, became_offline)."""
        user_id = self._sid_user.pop(sid, None)
        if user_id is None:
            return None, False

        sids = self._user_sids.get(user_id)
        if sids:
            sids.discard(sid)
            if not sids:
                self._user_sids.pop(user_id, None)
                return user_id, True

        return user_id, False

    def is_user_online(self, user_id: str) -> bool:
        """Return True when the user currently has at least one connected socket."""
        return len(self._user_sids.get(str(user_id), set())) > 0

    def get_online_user_ids(self) -> set[str]:
        """Return the set of currently online user UUID strings."""
        return set(self._user_sids.keys())


presence_manager = PresenceManager()

