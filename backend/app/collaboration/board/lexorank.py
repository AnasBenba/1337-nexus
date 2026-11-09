from collections.abc import Sequence

ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
RANK_LENGTH = 20
_BASE = len(ALPHABET)
_MAX_VALUE = _BASE**RANK_LENGTH - 1


class RankSpaceExhausted(ValueError):
    """Raised when two ranks have no representable rank between them."""


def _value(rank: str) -> int:
    if len(rank) != RANK_LENGTH or any(character not in ALPHABET for character in rank):
        raise ValueError(f"Invalid LexoRank: {rank!r}")
    value = 0
    for character in rank:
        value = value * _BASE + ALPHABET.index(character)
    return value


def _rank(value: int) -> str:
    if not 0 <= value <= _MAX_VALUE:
        raise RankSpaceExhausted("LexoRank boundary exhausted")
    characters: list[str] = []
    for _ in range(RANK_LENGTH):
        value, remainder = divmod(value, _BASE)
        characters.append(ALPHABET[remainder])
    return "".join(reversed(characters))


def rank_between(lower: str | None, upper: str | None) -> str:
    """Return a fixed-width base-36 rank strictly between two ranks.

    Fixed-width ranks make PostgreSQL's ``COLLATE "C"`` ordering identical to
    Python's ordering and leave a large, deterministic insertion space.
    """
    lower_value = -1 if lower is None else _value(lower)
    upper_value = _MAX_VALUE + 1 if upper is None else _value(upper)
    if lower_value >= upper_value - 1:
        raise RankSpaceExhausted("No LexoRank space remains between the bounds")
    return _rank((lower_value + upper_value) // 2)


def rebalance_ranks(ranks: Sequence[str]) -> dict[str, str]:
    """Assign evenly spaced ranks while preserving the supplied order."""
    if not ranks:
        return {}
    step = (_MAX_VALUE + 1) // (len(ranks) + 1)
    if step == 0:
        raise RankSpaceExhausted("Too many cards to rebalance")
    return {rank: _rank(step * index) for index, rank in enumerate(ranks, start=1)}
