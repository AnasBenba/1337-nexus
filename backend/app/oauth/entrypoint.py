from fastapi.responses import RedirectResponse
import secrets

#generate state random code for redirect url (prevent CSRF attacks)
def generate_state() -> str:
    return secrets.token_urlsafe(16)

def generate_url(state: str) -> str:
    authorization_url = (
    "https://api.intra.42.fr/oauth/authorize"
    "?client_id=u-s4t2ud-a2e145baf8d905d3d8f1eb9eeb2044e8ad85a03118051a2407dbd97632e4348f"
    "&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fapi%2Fv1%2Fauth%2Foauth%2F42%2Fcallback"
    "&response_type=code"
    f"&state={state}"
)
    return authorization_url

async def redirect_to_forttytwo():
    state = generate_state()
    authorization_url = generate_url(state)
    print(f"Redirecting to: {authorization_url}")
    return RedirectResponse(url=authorization_url)