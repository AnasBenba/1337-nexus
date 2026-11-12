from uuid import UUID

from sqlalchemy import exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.user.notifications.models import Notification, NotificationType


async def create_notification(
    db: AsyncSession,
    recipient_id: UUID,
    notification_type: NotificationType,
    notification_request_id: UUID | None = None,
) -> Notification:
    notification = Notification(
        recipient_id=recipient_id,
        type=notification_type,
        notification_request_id=notification_request_id,
    )
    db.add(notification)
    await db.flush()
    return notification


async def has_unread_activity(db: AsyncSession, user_id: UUID) -> bool:
    unread_notification_exists = exists(
        select(Notification.id).where(
            Notification.recipient_id == user_id,
            Notification.is_read.is_(False),
        )
    )
    unread_direct_message_exists = exists(
        select(Message.id).where(
            Message.receiver_id == user_id,
            Message.team_id.is_(None),
            Message.is_read.is_(False),
        )
    )
    result = await db.execute(
        select(or_(unread_notification_exists, unread_direct_message_exists))
    )
    return result.scalar_one()
