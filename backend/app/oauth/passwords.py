"""Password hashing with Argon2id (pwdlib's recommended setup).

Each hash gets its own random salt and stores its parameters, e.g.
"$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>", so we never keep the password
itself and can raise the cost later (verify() then returns an upgraded hash).
"""

from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()

# Verifying against this when the email doesn't exist takes as long as a real check,
# so response time doesn't reveal which emails have an account.
_DUMMY_HASH = _hasher.hash("timing-equalizer-not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> tuple[bool, str | None]:
    """(is_valid, new_hash_or_None). new_hash is set when the stored hash should be upgraded."""
    if password_hash is None:
        _hasher.verify(password, _DUMMY_HASH)
        return False, None
    return _hasher.verify_and_update(password, password_hash)
