import base64
import hashlib
import os
import secrets
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi.responses import RedirectResponse


class AuthClient:
    def __init__(self, redirect_uri: str):
        self.authorize_url = os.getenv("AUTH_URL")
        self.client = os.getenv("UID")
        self.redirect_uri = redirect_uri
        self.state = self.generate_state()
        self.code_verifier = self.generate_code_verifier()
        self.code_challenge = self.generate_code_challenge()

    def generate_state(self) -> str:
        return secrets.token_urlsafe(16)

    def generate_code_verifier(self) -> str:
        return secrets.token_urlsafe(32)

    def generate_code_challenge(self) -> str:
        hash = self.code_verifier.encode()
        hash_obj = hashlib.sha256(hash)
        finale_hash = base64.urlsafe_b64encode(hash_obj.digest())
        return finale_hash.rstrip(b"=").decode()

    def get_FortyTwo_auth_url(self) -> str:
        parts = urlsplit(self.authorize_url)
        query = parse_qsl(parts.query, keep_blank_values=True)
        query.extend(
            [
                ("client_id", self.client),
                ("state", self.state),
                ("code_challenge", self.code_challenge),
                ("code_challenge_method", "S256"),
                ("redirect_uri", self.redirect_uri),
                ("response_type", "code"),
            ]
        )
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def redirect_to_forttytwo():
    redirect_uri = os.getenv("REDIRECT_URL")
    if not redirect_uri:
        raise RuntimeError("REDIRECT_URL is not configured")

    client = AuthClient(redirect_uri=redirect_uri)
    response = RedirectResponse(client.get_FortyTwo_auth_url())
    response.set_cookie(key="state", value=client.state, httponly=True)
    response.set_cookie(key="code_verifier", value=client.code_verifier, httponly=True)
    return response
