"""migrate users primary key and all referencing columns to UUID

Revision ID: f7a2c9d4e681
Revises: c398bac4de76
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f7a2c9d4e681"
down_revision: str | None = "c398bac4de76"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Legacy int32 IDs map one-to-one into UUIDv4-shaped values. Keeping the original
# number in the low 48 bits makes the conversion reversible for existing records.
_TO_UUID = "('00000000-0000-4000-8000-' || lpad(to_hex(({column}::bigint + 2147483648)), 12, '0'))::uuid"
_TO_INTEGER = "((('x' || right({column}::text, 12))::bit(48)::bigint) - 2147483648)::integer"
_LEGACY_UUID_PREFIX = "00000000-0000-4000-8000-%"


def _user_foreign_keys(bind) -> list[dict]:  # noqa: ANN001
    inspector = sa.inspect(bind)
    result = []
    for table_name in inspector.get_table_names():
        for foreign_key in inspector.get_foreign_keys(table_name):
            if foreign_key.get("referred_table") == "users":
                if len(foreign_key["constrained_columns"]) != 1 or len(foreign_key["referred_columns"]) != 1:
                    raise RuntimeError(
                        f"Unsupported composite foreign key to users: {table_name}.{foreign_key['name']}"
                    )
                result.append({"table": table_name, **foreign_key})
    return result


def _convert(column: str, expression: str) -> str:
    identifier = '"' + column.replace('"', '""') + '"'
    return expression.format(column=identifier)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    users_id = next(c for c in inspector.get_columns("users") if c["name"] == "id")
    if not isinstance(users_id["type"], sa.Integer):
        raise RuntimeError("Expected users.id to be INTEGER before UUID migration")

    foreign_keys = _user_foreign_keys(bind)

    # PostgreSQL expression indexes bind to the old integer comparison operators.
    indexes = {idx["name"]: idx for idx in inspector.get_indexes("friendships")}
    friendship_checks = {check["name"]: check for check in inspector.get_check_constraints("friendships")}
    has_not_self_check = "ck_friendships_not_self" in friendship_checks
    if "uq_friendships_pair" in indexes:
        op.drop_index("uq_friendships_pair", table_name="friendships")
    if has_not_self_check:
        op.drop_constraint("ck_friendships_not_self", "friendships", type_="check")

    for fk in foreign_keys:
        op.drop_constraint(fk["name"], fk["table"], type_="foreignkey")

    # Remove SERIAL's integer default, retain its sequence so downgrade can restore it.
    op.alter_column("users", "id", server_default=None)
    op.alter_column(
        "users",
        "id",
        type_=postgresql.UUID(as_uuid=True),
        postgresql_using=_convert("id", _TO_UUID),
        server_default=sa.text("gen_random_uuid()"),
    )

    for fk in foreign_keys:
        table, column = fk["table"], fk["constrained_columns"][0]
        col = next(c for c in sa.inspect(bind).get_columns(table) if c["name"] == column)
        if not isinstance(col["type"], sa.Integer):
            raise RuntimeError(f"Expected {table}.{column} to be INTEGER before UUID migration")
        op.alter_column(
            table,
            column,
            type_=postgresql.UUID(as_uuid=True),
            postgresql_using=_convert(column, _TO_UUID),
        )

    for fk in foreign_keys:
        options = fk.get("options", {})
        op.create_foreign_key(
            fk["name"],
            fk["table"],
            "users",
            fk["constrained_columns"],
            fk["referred_columns"],
            onupdate=options.get("onupdate"),
            ondelete=options.get("ondelete"),
            deferrable=options.get("deferrable"),
            initially=options.get("initially"),
            match=options.get("match"),
        )

    if has_not_self_check:
        op.create_check_constraint(
            "ck_friendships_not_self", "friendships", "requester_id <> addressee_id"
        )
    if "uq_friendships_pair" in indexes:
        op.create_index(
            "uq_friendships_pair",
            "friendships",
            [sa.text("LEAST(requester_id, addressee_id)"), sa.text("GREATEST(requester_id, addressee_id)")],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    invalid = bind.execute(
        sa.text("SELECT count(*) FROM users WHERE id::text NOT LIKE :prefix"),
        {"prefix": _LEGACY_UUID_PREFIX},
    ).scalar_one()
    if invalid:
        raise RuntimeError(
            "Cannot downgrade user UUIDs: at least one UUID was not produced from a legacy integer ID."
        )

    foreign_keys = _user_foreign_keys(bind)
    inspector = sa.inspect(bind)
    indexes = {idx["name"]: idx for idx in inspector.get_indexes("friendships")}
    friendship_checks = {check["name"]: check for check in inspector.get_check_constraints("friendships")}
    has_not_self_check = "ck_friendships_not_self" in friendship_checks
    if "uq_friendships_pair" in indexes:
        op.drop_index("uq_friendships_pair", table_name="friendships")
    if has_not_self_check:
        op.drop_constraint("ck_friendships_not_self", "friendships", type_="check")

    for fk in foreign_keys:
        op.drop_constraint(fk["name"], fk["table"], type_="foreignkey")

    op.alter_column(
        "users",
        "id",
        server_default=None,
        type_=sa.Integer(),
        postgresql_using=_convert("id", _TO_INTEGER),
    )
    sequence = bind.execute(sa.text("SELECT pg_get_serial_sequence('users', 'id')")).scalar_one_or_none()
    if sequence:
        op.alter_column("users", "id", server_default=sa.text(f"nextval('{sequence}'::regclass)"))

    for fk in foreign_keys:
        table, column = fk["table"], fk["constrained_columns"][0]
        op.alter_column(
            table,
            column,
            type_=sa.Integer(),
            postgresql_using=_convert(column, _TO_INTEGER),
        )

    for fk in foreign_keys:
        options = fk.get("options", {})
        op.create_foreign_key(
            fk["name"],
            fk["table"],
            "users",
            fk["constrained_columns"],
            fk["referred_columns"],
            onupdate=options.get("onupdate"),
            ondelete=options.get("ondelete"),
            deferrable=options.get("deferrable"),
            initially=options.get("initially"),
            match=options.get("match"),
        )

    if has_not_self_check:
        op.create_check_constraint(
            "ck_friendships_not_self", "friendships", "requester_id <> addressee_id"
        )
    if "uq_friendships_pair" in indexes:
        op.create_index(
            "uq_friendships_pair",
            "friendships",
            [sa.text("LEAST(requester_id, addressee_id)"), sa.text("GREATEST(requester_id, addressee_id)")],
            unique=True,
        )
