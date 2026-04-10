"""
Unit tests for VitalCar backend.

The predict module requires GCS credentials to load models.
These tests cover the DTC dictionary and the health endpoint
without touching GCS, making them safe to run in CI with no credentials.

The predict route itself is tested via a mock that short-circuits
the GCS download so the test validates the full response schema.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


# ── DTC tests (no mocking needed) ──────────────────────────────────────────

def test_get_dtc_known_code():
    from app.dtc_codes import get_dtc_info
    info = get_dtc_info("P0217")
    assert info["found"] is True
    assert info["severity"] == "HIGH"
    assert "engine" in info["system"] or info["system"] == "cooling"


def test_get_dtc_unknown_code():
    from app.dtc_codes import get_dtc_info
    info = get_dtc_info("P9999")
    assert info["found"] is False
    assert info["code"] == "P9999"
    assert info["severity"] == "UNKNOWN"


def test_get_dtc_case_insensitive():
    from app.dtc_codes import get_dtc_info
    assert get_dtc_info("p0300")["found"] is True
    assert get_dtc_info("P0300")["found"] is True


def test_infer_system_body_code():
    from app.dtc_codes import _infer_system
    assert _infer_system("B1234") == "body"


def test_infer_system_chassis_code():
    from app.dtc_codes import _infer_system
    assert _infer_system("C0001") == "chassis/brakes"


# ── Health endpoint (no GCS) ───────────────────────────────────────────────

def test_health_endpoint():
    with patch("app.predict._load_models"):   # prevent GCS access on import
        from app.main import app
        client = TestClient(app)
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ── DTC endpoint via HTTP ──────────────────────────────────────────────────

def test_dtc_endpoint_known():
    with patch("app.predict._load_models"):
        from app.main import app
        client = TestClient(app)
        response = client.get("/dtc/P0300")
    assert response.status_code == 200
    data = response.json()
    assert data["found"] is True
    assert data["code"] == "P0300"


def test_dtc_endpoint_unknown():
    with patch("app.predict._load_models"):
        from app.main import app
        client = TestClient(app)
        response = client.get("/dtc/ZZZZ")
    assert response.status_code == 200
    assert response.json()["found"] is False


# ── Predict endpoint (mocked model) ───────────────────────────────────────

FAKE_PREDICT_RESULT = {
    "prediction": 0,
    "probability": 0.05,
    "health_score": 95.0,
    "status": "NORMAL",
    "alert": False,
    "top_factors": [
        {"feature": "tool_wear", "impact": 0.02},
        {"feature": "temp_diff", "impact": 0.01},
        {"feature": "rpm", "impact": 0.005},
    ],
    "recommendation": "Vehicle in good condition.",
    "model_version": "1.0.0",
    "shap_values": {"tool_wear": 0.02},
}


async def _noop(*args, **kwargs):
    pass


def test_predict_endpoint_returns_schema():
    # Patch in the namespace where main.py imported them, not where they're defined
    with patch("app.predict.predict", return_value=FAKE_PREDICT_RESULT), \
         patch("app.predict._load_models"), \
         patch("app.main.log_sensor_reading", side_effect=_noop), \
         patch("app.main.log_prediction", side_effect=_noop):
        from app.main import app
        client = TestClient(app)
        payload = {
            "vehicle_id": "test-001",
            "vehicle_type": 1,
            "air_temp": 298.0,
            "process_temp": 308.0,
            "rpm": 1500,
            "torque": 40.0,
            "tool_wear": 100,
        }
        response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "health_score" in data
    assert "status" in data
    assert "top_factors" in data
    assert isinstance(data["top_factors"], list)
