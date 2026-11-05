from uuid import UUID

from pydantic import BaseModel


class WithdrawApplicationRequest(BaseModel):
    user_id: UUID
