from typing import Literal

from pydantic import BaseModel

from app.user.profile.schemas import UserSummary

# How the current user relates to another user.
FriendStatus = Literal["none", "outgoing", "incoming", "friends"]


class FriendSummary(UserSummary):
    online: bool = False  # only ever true for accepted friends


class FriendshipStatus(BaseModel):
    status: FriendStatus
    online: bool = False  # only shared with friends


class FriendsOverview(BaseModel):
    friends: list[FriendSummary]
    incoming: list[FriendSummary]  # requests waiting for my answer
    outgoing: list[FriendSummary]  # requests I sent
