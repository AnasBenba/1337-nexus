from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Project


async def create_project(
    db: AsyncSession, *, owner_id: int, title: str, description: str
) -> Project:
    project = Project(owner_id=owner_id, title=title, description=description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def list_my_projects(db: AsyncSession, *, owner_id: int) -> list[Project]:
    result = await db.scalars(
        select(Project)
        .where(Project.owner_id == owner_id)
        .order_by(Project.updated_at.desc(), Project.id)
    )
    return list(result.all())


async def list_recommended_projects(
    db: AsyncSession, *, exclude_owner_id: int | None = None
) -> list[Project]:
    statement = select(Project).where(Project.status == "published")
    if exclude_owner_id is not None:
        statement = statement.where(Project.owner_id != exclude_owner_id)
    result = await db.scalars(statement.order_by(Project.updated_at.desc(), Project.id))
    return list(result.all())


async def update_project(
    db: AsyncSession,
    *,
    project_id: UUID,
    owner_id: int,
    title: str | None = None,
    description: str | None = None,
) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")
    if project.owner_id != owner_id:
        raise PermissionError("You do not own this project")
    if project.status != "draft":
        raise ValueError("Only draft projects can be edited")
    if title is not None:
        project.title = title
    if description is not None:
        project.description = description
    await db.commit()
    await db.refresh(project)
    return project


async def change_project_status(
    db: AsyncSession, *, project_id: UUID, owner_id: int, status: str
) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")
    if project.owner_id != owner_id:
        raise PermissionError("You do not own this project")
    if status == "published" and project.status != "draft":
        raise ValueError("Only draft projects can be published")
    if status == "archived" and project.status not in {"draft", "published"}:
        raise ValueError("Project is already archived")
    project.status = status
    await db.commit()
    await db.refresh(project)
    return project
