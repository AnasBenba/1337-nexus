from fastapi.responses import RedirectResponse
import secrets
import hashlib
import base64
import os


class AuthClient:
    def __init__(self, redirect_uri: str):
        self.authorize_url = os.getenv("AUTH_URL")
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
        return (
            f"{self.authorize_url}"
            f"&state={self.state}"
            f"&code_challenge={self.code_challenge}"
            f"&code_challenge_method=S256"
        )

async def redirect_to_forttytwo():
    client = AuthClient(redirect_uri="http://localhost:8000/api/v1/auth/oauth/42/callback")
    return RedirectResponse(client.get_FortyTwo_auth_url())