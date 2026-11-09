"""convert user primary and foreign keys to UUID

Revision ID: 7d3e9a1c5f20
Revises: 6a2b9c4d1e8f
Create Date: 2026-11-08 22:59:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "7d3e9a1c5f20"
down_revision: str | Sequence[str] | None = "6a2b9c4d1e8f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("users"):
        raise RuntimeError("Cannot convert user IDs: users table does not exist")

    user_id = next(
        column
        for column in inspector.get_columns("users")
        if column["name"] == "id"
    )
    if isinstance(user_id["type"], postgresql.UUID):
        return
    if not isinstance(user_id["type"], sa.Integer):
        raise RuntimeError(
            f"Cannot convert users.id from unsupported type {user_id['type']}"
        )

    op.add_column(
        "users",
        sa.Column(
            "id_uuid_migration",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
    )
    op.execute(
        sa.text(
            "UPDATE users SET id_uuid_migration = gen_random_uuid() "
            "WHERE id_uuid_migration IS NULL"
        )
    )
    op.alter_column(
        "users",
        "id_uuid_migration",
        server_default=None,
    )

    table_names = set(inspector.get_table_names())
    candidate_columns = {
        "pitches": {"author_id"},
        "messages": {"sender_id", "receiver_id"},
        "workspace_team_members": {"user_id"},
        "applications": {"user_id"},
    }

    foreign_keys_by_table: dict[str, list[dict]] = {}
    referenced_columns: dict[str, set[str]] = {}
    for table_name in table_names:
        for foreign_key in inspector.get_foreign_keys(table_name):
            if (
                foreign_key.get("referred_table") == "users"
                and foreign_key.get("referred_columns") == ["id"]
            ):
                foreign_keys_by_table.setdefault(table_name, []).append(foreign_key)
                referenced_columns.setdefault(table_name, set()).update(
                    foreign_key["constrained_columns"]
                )

    for table_name, columns in candidate_columns.items():
        if table_name in table_names:
            referenced_columns.setdefault(table_name, set()).update(columns)

    conversions: dict[str, dict[str, bool]] = {}
    for table_name, columns in referenced_columns.items():
        table_columns = {
            column["name"]: column
            for column in inspector.get_columns(table_name)
        }
        for column_name in columns:
            column = table_columns.get(column_name)
            if column is not None and isinstance(column["type"], sa.Integer):
                conversions.setdefault(table_name, {})[column_name] = column["nullable"]

    constraints_to_restore: dict[str, list[dict]] = {}
    indexes_to_restore: dict[str, list[dict]] = {}
    for table_name, columns in conversions.items():
        foreign_keys = foreign_keys_by_table.get(table_name, [])
        for foreign_key in foreign_keys:
            if set(foreign_key["constrained_columns"]) & columns.keys():
                if foreign_key.get("name") is None:
                    raise RuntimeError(
                        f"Cannot safely migrate unnamed foreign key in {table_name}"
                    )
                op.drop_constraint(
                    foreign_key["name"],
                    table_name,
                    type_="foreignkey",
                )

        constraints: list[dict] = []
        primary_key = inspector.get_pk_constraint(table_name)
        if set(primary_key.get("constrained_columns") or []) & columns.keys():
            constraints.append({"kind": "primary", **primary_key})
        constraints.extend(
            {
                "kind": "unique",
                **constraint,
            }
            for constraint in inspector.get_unique_constraints(table_name)
            if set(constraint.get("column_names") or []) & columns.keys()
        )
        for constraint in constraints:
            if constraint.get("name") is None:
                raise RuntimeError(
                    f"Cannot safely migrate unnamed key constraint in {table_name}"
                )
            op.drop_constraint(
                constraint["name"],
                table_name,
                type_="primary" if constraint["kind"] == "primary" else "unique",
            )
        constraints_to_restore[table_name] = constraints

        constraint_names = {
            constraint["name"]
            for constraint in constraints
        }
        indexes = [
            index
            for index in inspector.get_indexes(table_name)
            if set(index.get("column_names") or []) & columns.keys()
            and index["name"] not in constraint_names
        ]
        for index in indexes:
            op.drop_index(index["name"], table_name=table_name)
        indexes_to_restore[table_name] = indexes

        preparer = bind.dialect.identifier_preparer
        quoted_table = preparer.quote(table_name)
        quoted_users = preparer.quote("users")
        for column_name, nullable in columns.items():
            temporary_name = f"{column_name}_uuid_migration"
            quoted_column = preparer.quote(column_name)
            quoted_temporary = preparer.quote(temporary_name)
            op.add_column(
                table_name,
                sa.Column(temporary_name, postgresql.UUID(as_uuid=True), nullable=True),
            )
            op.execute(
                sa.text(
                    f"UPDATE {quoted_table} AS child "
                    f"SET {quoted_temporary} = parent.id_uuid_migration "
                    f"FROM {quoted_users} AS parent "
                    f"WHERE child.{quoted_column} = parent.id"
                )
            )
            unmatched = bind.execute(
                sa.text(
                    f"SELECT count(*) FROM {quoted_table} "
                    f"WHERE {quoted_column} IS NOT NULL "
                    f"AND {quoted_temporary} IS NULL"
                )
            ).scalar_one()
            if unmatched:
                raise RuntimeError(
                    f"Cannot map {unmatched} {table_name}.{column_name} values "
                    "to existing users"
                )
            op.drop_column(table_name, column_name)
            op.alter_column(
                table_name,
                temporary_name,
                new_column_name=column_name,
                existing_type=postgresql.UUID(as_uuid=True),
                nullable=nullable,
            )

    user_primary_key = inspector.get_pk_constraint("users")
    primary_key_name = user_primary_key.get("name")
    if primary_key_name is None:
        raise RuntimeError("Cannot safely migrate unnamed users primary key")
    op.drop_constraint(primary_key_name, "users", type_="primary")
    op.drop_column("users", "id")
    op.alter_column(
        "users",
        "id_uuid_migration",
        new_column_name="id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.create_primary_key(primary_key_name, "users", ["id"])

    for table_name, constraints in constraints_to_restore.items():
        for constraint in constraints:
            if constraint["kind"] == "primary":
                op.create_primary_key(
                    constraint["name"],
                    table_name,
                    constraint["constrained_columns"],
                )
            else:
                op.create_unique_constraint(
                    constraint["name"],
                    table_name,
                    constraint["column_names"],
                )
        for index in indexes_to_restore[table_name]:
            op.create_index(
                index["name"],
                table_name,
                index["column_names"],
                unique=index.get("unique", False),
            )

    for table_name, foreign_keys in foreign_keys_by_table.items():
        for foreign_key in foreign_keys:
            if not (set(foreign_key["constrained_columns"]) & conversions.get(table_name, {}).keys()):
                continue
            op.create_foreign_key(
                foreign_key["name"],
                table_name,
                "users",
                foreign_key["constrained_columns"],
                foreign_key["referred_columns"],
                onupdate=foreign_key.get("options", {}).get("onupdate"),
                ondelete=foreign_key.get("options", {}).get("ondelete"),
                deferrable=foreign_key.get("options", {}).get("deferrable"),
                initially=foreign_key.get("options", {}).get("initially"),
                match=foreign_key.get("options", {}).get("match"),
            )

    for table_name, columns in conversions.items():
        existing_references = {
            column_name
            for foreign_key in foreign_keys_by_table.get(table_name, [])
            for column_name in foreign_key["constrained_columns"]
        }
        for column_name in columns.keys() - existing_references:
            op.create_foreign_key(
                f"fk_{table_name}_{column_name}_users",
                table_name,
                "users",
                [column_name],
                ["id"],
            )


def downgrade() -> None:
    raise RuntimeError(
        "Converting UUID user IDs back to integers is not supported because new "
        "user UUIDs have no corresponding legacy integer IDs."
    )
