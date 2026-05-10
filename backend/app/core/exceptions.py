"""Application-wide exception types and FastAPI handlers.

This module defines a small hierarchy of typed exceptions raised by
the service layer and converted to consistent HTTP responses by the
handlers registered in :mod:`app.main`.

Why use these instead of raising :class:`fastapi.HTTPException` everywhere?
  * Service layer stays decoupled from HTTP concerns (it only raises
    domain errors; routers/handlers translate them).
  * Status codes and error shapes are declared in one place.
  * New error categories can be added without touching every router.

The standard error response body is::

    {
      "error": {
        "code": "not_found",
        "message": "Unknown farm layer",
        "details": {...}
      }
    }
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for all domain errors raised by the service layer.

    Attributes:
        code: Short machine-readable error identifier (e.g. ``"not_found"``).
        message: Human-readable error description.
        status_code: HTTP status code to return when this error escapes
            to the API boundary.
        details: Optional structured context useful for clients.
    """

    code: str = "app_error"
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(
        self,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""

    code = "not_found"
    status_code = status.HTTP_404_NOT_FOUND


class BadRequestError(AppError):
    """Raised when request payload fails domain validation."""

    code = "bad_request"
    status_code = status.HTTP_400_BAD_REQUEST


class BusinessRuleError(AppError):
    """Raised when a request is well-formed but violates a business rule."""

    code = "business_rule_violation"
    status_code = status.HTTP_409_CONFLICT


class ExternalServiceError(AppError):
    """Raised when a downstream service (LLM, third-party API) fails."""

    code = "external_service_error"
    status_code = status.HTTP_502_BAD_GATEWAY


def _error_payload(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build the standard error response body."""
    payload: dict[str, Any] = {"code": code, "message": message}
    if details:
        payload["details"] = jsonable_encoder(details)
    return {"error": payload}


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI app.

    Args:
        app: The FastAPI application instance.
    """

    @app.exception_handler(AppError)
    async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_payload(
                "validation_error",
                "Request payload failed validation.",
                {"errors": exc.errors()},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        # Preserve existing HTTPException usage but wrap it in our envelope.
        message = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        details = None if isinstance(exc.detail, str) else {"detail": exc.detail}
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(f"http_{exc.status_code}", message, details),
        )

    @app.exception_handler(Exception)
    async def _handle_uncaught(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_payload(
                "internal_server_error",
                "An unexpected error occurred. The incident has been logged.",
            ),
        )
