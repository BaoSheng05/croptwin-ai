"""Tests for the global exception layer in :mod:`app.core.exceptions`."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.exceptions import (
    AppError,
    BadRequestError,
    BusinessRuleError,
    NotFoundError,
    register_exception_handlers,
)


def _build_app() -> FastAPI:
    """Create a minimal app with handlers + a route that raises each error."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/raise/{kind}")
    def _raise(kind: str) -> dict:
        if kind == "not_found":
            raise NotFoundError("missing", details={"id": "x"})
        if kind == "bad_request":
            raise BadRequestError("bad")
        if kind == "business":
            raise BusinessRuleError("nope")
        if kind == "app":
            raise AppError("base", code="custom_code", status_code=418)
        if kind == "uncaught":
            raise RuntimeError("boom")
        return {"ok": True}

    return app


class ExceptionEnvelopeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(_build_app(), raise_server_exceptions=False)

    def test_not_found_returns_404_envelope(self) -> None:
        response = self.client.get("/raise/not_found")
        self.assertEqual(response.status_code, 404)
        body = response.json()
        self.assertEqual(body["error"]["code"], "not_found")
        self.assertEqual(body["error"]["message"], "missing")
        self.assertEqual(body["error"]["details"], {"id": "x"})

    def test_bad_request_returns_400(self) -> None:
        response = self.client.get("/raise/bad_request")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "bad_request")

    def test_business_rule_returns_409(self) -> None:
        response = self.client.get("/raise/business")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "business_rule_violation")

    def test_custom_app_error_uses_overridden_status_and_code(self) -> None:
        response = self.client.get("/raise/app")
        self.assertEqual(response.status_code, 418)
        self.assertEqual(response.json()["error"]["code"], "custom_code")

    def test_uncaught_exception_returns_500_envelope(self) -> None:
        response = self.client.get("/raise/uncaught")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error"]["code"], "internal_server_error")


if __name__ == "__main__":
    unittest.main()
