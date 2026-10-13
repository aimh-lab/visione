"""Authentication helpers for endpoints that access LLM resources."""

from __future__ import annotations

import hmac
import os
import threading
from pathlib import Path
from typing import FrozenSet, Tuple

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


LLM_ENDPOINTS_TOKEN_FILE_ENV = "LLM_ENDPOINTS_TOKEN_FILE"
DEFAULT_LLM_ENDPOINTS_TOKEN_FILE = "tokens.txt"
_bearer_scheme = HTTPBearer(auto_error=False)
_FileSignature = Tuple[int, int, int, int]


class TokenFileUnavailableError(RuntimeError):
    """Raised when the configured token file cannot supply a valid token set."""


class TokenFileValidator:
    """Cache tokens from a file and refresh the cache when that file changes."""

    def __init__(self, path: Path):
        self.path = path
        self._signature: _FileSignature | None = None
        self._tokens: FrozenSet[str] = frozenset()
        self._lock = threading.Lock()

    @staticmethod
    def _file_signature(path: Path) -> _FileSignature:
        stats = path.stat()
        return (stats.st_ino, stats.st_mtime_ns, stats.st_ctime_ns, stats.st_size)

    def _read_tokens(self) -> FrozenSet[str]:
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
        except OSError as exc:
            raise TokenFileUnavailableError("Token file is unavailable.") from exc

        tokens = frozenset(
            token
            for line in lines
            if (token := line.strip()) and not token.startswith("#")
        )
        if not tokens:
            raise TokenFileUnavailableError("Token file contains no valid tokens.")
        return tokens

    def tokens(self) -> FrozenSet[str]:
        """Return the current tokens, reloading after an atomic file replacement."""
        with self._lock:
            try:
                signature = self._file_signature(self.path)
            except OSError as exc:
                self._tokens = frozenset()
                self._signature = None
                raise TokenFileUnavailableError("Token file is unavailable.") from exc

            if signature != self._signature:
                try:
                    tokens = self._read_tokens()
                except TokenFileUnavailableError:
                    self._tokens = frozenset()
                    self._signature = None
                    raise
                self._tokens = tokens
                self._signature = signature
            return self._tokens


def configure_llm_endpoint_auth(app) -> None:
    """Configure and validate the required token-file authentication source."""
    token_file = Path(
        os.environ.get(LLM_ENDPOINTS_TOKEN_FILE_ENV, DEFAULT_LLM_ENDPOINTS_TOKEN_FILE)
    )
    validator = TokenFileValidator(token_file)
    validator.tokens()
    app.state.llm_endpoints_token_validator = validator


def _unauthorized() -> HTTPException:
    """Return a uniform response for all client authentication failures."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _token_file_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Token validation unavailable",
    )


async def require_llm_endpoint_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> None:
    """Require a currently configured shared bearer token for an LLM endpoint."""
    validator = getattr(request.app.state, "llm_endpoints_token_validator", None)
    if not isinstance(validator, TokenFileValidator):
        raise RuntimeError("LLM endpoint authentication has not been configured.")

    try:
        tokens = validator.tokens()
    except TokenFileUnavailableError as exc:
        raise _token_file_unavailable() from exc

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    token_matches = False
    for configured_token in tokens:
        token_matches |= hmac.compare_digest(credentials.credentials, configured_token)
    if not token_matches:
        raise _unauthorized()
