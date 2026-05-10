"""Persistent user preference storage."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import UserPreferenceDB


def get_preference(db: Session, key: str, default: Any = None) -> Any:
    record = db.get(UserPreferenceDB, key)
    if not record:
        return default
    try:
        return json.loads(record.value_json)
    except json.JSONDecodeError:
        return default


def set_preference(db: Session, key: str, value: Any) -> Any:
    record = db.get(UserPreferenceDB, key)
    if not record:
        record = UserPreferenceDB(key=key)
        db.add(record)
    record.value_json = json.dumps(value)
    db.commit()
    return value
