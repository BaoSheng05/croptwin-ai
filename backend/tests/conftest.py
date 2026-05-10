"""Shared test fixtures.

This module forces the application to use an in-memory SQLite database
**before** any ``app.*`` modules are imported, so tests do not touch
the real ``croptwin.db`` file on disk.
"""

from __future__ import annotations

import os

# Use an isolated, ephemeral SQLite database for every test run.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("DEEPSEEK_API_KEY", "")
os.environ.setdefault("GEMINI_API_KEY", "")
