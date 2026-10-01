from fastapi.responses import RedirectResponse
import secrets
import hashlib
import base64


class AuthClient:
    def __init__(self, redirect_uri: str):
        self.redirect_uri = redirect_uri
        self.state = self.generate_state()
        self.code_verifier = self.generate_code_verifier()
        self.code_challenge = self.generate_code_challenge()

    def generate_state(self) -> str:
        return secrets.token_urlsafe(16)

    def generate_code_verifier(self) -> str:
        return secrets.token_urlsafe(32)

    def generate_code_challenge(self) -> str:
        pass


async def redirect_to_forttytwo():
    client = AuthClient(redirect_uri="http://localhost:8000/api/v1/auth/oauth/42/callback")
