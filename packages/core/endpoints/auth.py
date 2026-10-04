"""Authentication helpers for endpoints that access LLM resources."""

from __future__ import annotations

import hmac
import os

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


LLM_ENDPOINTS_BEARER_TOKEN_ENV = "LLM_ENDPOINTS_BEARER_TOKEN"
_bearer_scheme = HTTPBearer(auto_error=False)


def configure_llm_endpoint_auth(app) -> None:
    """Load the required LLM endpoint token into application state."""
    token = os.environ.get(LLM_ENDPOINTS_BEARER_TOKEN_ENV, "")
    if not token.strip():
        raise RuntimeError(
            f"{LLM_ENDPOINTS_BEARER_TOKEN_ENV} must be set to a non-blank value."
        )
    app.state.llm_endpoints_bearer_token = token


def _unauthorized() -> HTTPException:
    """Return a uniform response for all client authentication failures."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_llm_endpoint_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> None:
    """Require the configured shared bearer token for an LLM endpoint."""
    expected_token = getattr(request.app.state, "llm_endpoints_bearer_token", None)
    if not isinstance(expected_token, str) or not expected_token:
        # This should be unreachable because startup validates the setting.
        raise RuntimeError("LLM endpoint authentication has not been configured.")

    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not hmac.compare_digest(credentials.credentials, expected_token)
    ):
        raise _unauthorized()
