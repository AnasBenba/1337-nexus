from sqlalchemy import and_, case, delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.oauth.user import Users
from app.user.friends import presence
from app.user.friends.models import Friendship
from app.user.friends.schemas import FriendsOverview, FriendStatus, FriendSummary


def _between(a_id: int, b_id: int):  # noqa: ANN202 - SQL expression
    return or_(
        and_(Friendship.requester_id == a_id, Friendship.addressee_id == b_id),
        and_(Friendship.requester_id == b_id, Friendship.addressee_id == a_id),
    )


async def _get(session: AsyncSession, a_id: int, b_id: int) -> Friendship | None:
    result = await session.execute(select(Friendship).where(_between(a_id, b_id)))
    return result.scalar_one_or_none()


def status_for(friendship: Friendship | None, me_id: int) -> FriendStatus:
    if friendship is None:
        return "none"
    if friendship.status == "accepted":
        return "friends"
    return "outgoing" if friendship.requester_id == me_id else "incoming"


async def get_status(session: AsyncSession, me: Users, other: Users) -> FriendStatus:
    return status_for(await _get(session, me.id, other.id), me.id)


async def add_friend(session: AsyncSession, me: Users, other: Users) -> FriendStatus:
    """"Add friend" button: sends a request, or accepts theirs if they already asked me."""
    if me.id == other.id:
        raise ValueError("You can't add yourself as a friend.")

    friendship = await _get(session, me.id, other.id)
    if friendship is None:
        session.add(Friendship(requester_id=me.id, addressee_id=other.id, status="pending"))
        try:
            await session.commit()
            return "outgoing"
        except IntegrityError:
            # They sent me a request at the same moment; the unique pair index stopped a
            # duplicate row. Use their row instead (accept it below).
            await session.rollback()
            friendship = await _get(session, me.id, other.id)
            if friendship is None:  # pragma: no cover - row vanished again; let caller retry
                raise

    if friendship.status == "pending" and friendship.addressee_id == me.id:
        friendship.status = "accepted"
        await session.commit()

    return status_for(friendship, me.id)


async def remove_friend(session: AsyncSession, me: Users, other: Users) -> FriendStatus:
    """Unfriend, cancel my request, or decline theirs. All three just delete the row."""
    await session.execute(delete(Friendship).where(_between(me.id, other.id)))
    await session.commit()
    return "none"


async def overview(session: AsyncSession, me: Users) -> FriendsOverview:
    other_id = case(
        (Friendship.requester_id == me.id, Friendship.addressee_id),
        else_=Friendship.requester_id,
    )
    rows = await session.execute(
        select(Users, Friendship)
        .join(Friendship, Users.id == other_id)
        .where(or_(Friendship.requester_id == me.id, Friendship.addressee_id == me.id))
        .order_by(Users.login)
    )

    buckets: dict[FriendStatus, list[FriendSummary]] = {"friends": [], "incoming": [], "outgoing": []}
    for user, friendship in rows.all():
        status = status_for(friendship, me.id)
        summary = FriendSummary.model_validate(user)
        summary.online = status == "friends" and presence.is_online(user.id)
        buckets[status].append(summary)
    return FriendsOverview(**buckets)


async def friend_ids(session: AsyncSession, user_id: int) -> list[int]:
    """Ids of everyone who has an accepted friendship with user_id."""
    other_id = case((Friendship.requester_id == user_id, Friendship.addressee_id), else_=Friendship.requester_id)
    result = await session.execute(
        select(other_id).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    )
    return list(result.scalars().all())
