import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["DATABASE_URL"] = "sqlite:///./croptwin.db"

from app.main import app  # noqa: E402
from app.database import get_db  # noqa: E402
from app.store import LAYERS  # noqa: E402


class _NoopSession:
    def add(self, item: object) -> None:
        pass

    def commit(self) -> None:
        pass


def _noop_db():
    yield _NoopSession()


app.dependency_overrides[get_db] = _noop_db


def _reading(layer_id: str, temperature: float) -> dict:
    return {
        "layer_id": layer_id,
        "temperature": temperature,
        "humidity": 55,
        "soil_moisture": 65,
        "ph": 6.2,
        "light_intensity": 600,
        "water_level": 80,
    }


def test_climate_fields_and_ai_commands() -> None:
    client = TestClient(app)
    farm = client.get("/api/farm")
    assert farm.status_code == 200
    devices = farm.json()["layers"][0]["devices"]
    assert devices["climate_heating"] is False
    assert devices["climate_cooling"] is False

    low_layer = "a_01"
    assert client.post("/api/sensors/readings", json=_reading(low_layer, 10)).status_code == 200
    low_decision = client.post("/api/ai/control-decision", json={"layer_id": low_layer})
    assert low_decision.status_code == 200
    assert any(cmd["device"] == "climate_heating" for cmd in low_decision.json()["commands"])

    high_layer = "a_02"
    assert client.post("/api/sensors/readings", json=_reading(high_layer, 35)).status_code == 200
    high_decision = client.post("/api/ai/control-decision", json={"layer_id": high_layer})
    assert high_decision.status_code == 200
    assert any(cmd["device"] == "climate_cooling" for cmd in high_decision.json()["commands"])


def test_safe_climate_commands() -> None:
    client = TestClient(app)
    layer_id = "b_02"
    LAYERS[layer_id].devices.climate_heating = False
    LAYERS[layer_id].devices.climate_cooling = False

    heat = client.post(
        "/api/ai/execute-safe-command",
        json={"layer_id": layer_id, "device": "climate_heating", "value": True, "duration_minutes": 1},
    )
    assert heat.status_code == 200
    assert heat.json()["devices"]["climate_heating"] is True
    assert heat.json()["devices"]["climate_cooling"] is False

    LAYERS[layer_id].devices.climate_heating = False
    cool = client.post(
        "/api/ai/execute-safe-command",
        json={"layer_id": layer_id, "device": "climate_cooling", "value": True, "duration_minutes": 1},
    )
    assert cool.status_code == 200
    assert cool.json()["devices"]["climate_heating"] is False
    assert cool.json()["devices"]["climate_cooling"] is True


if __name__ == "__main__":
    test_climate_fields_and_ai_commands()
    test_safe_climate_commands()
    print("climate control smoke tests passed")
