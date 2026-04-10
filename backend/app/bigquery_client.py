from google.cloud import bigquery
from datetime import datetime, timezone
import asyncio

client = bigquery.Client(project="vitalcar-tcc")
DATASET = "vitalcar-tcc.vitalcar_analytics"


async def log_sensor_reading(data: dict):
    """Async BQ ingestion — does not block the API response"""
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **data
    }
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: client.insert_rows_json(f"{DATASET}.sensor_readings", [row])
    )


async def log_prediction(vehicle_id: str, features: dict, prediction: int,
                          probability: float, shap_values: dict, model_version: str):
    import json
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vehicle_id": vehicle_id,
        "features_json": json.dumps(features),
        "prediction": prediction,
        "probability": probability,
        "shap_values_json": json.dumps(shap_values),
        "model_version": model_version,
    }
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: client.insert_rows_json(f"{DATASET}.model_predictions", [row])
    )


async def log_dtc_event(vehicle_id: str, dtc_code: str,
                         description: str, severity: str):
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vehicle_id": vehicle_id,
        "dtc_code": dtc_code,
        "dtc_description": description,
        "severity": severity,
        "resolved_at": None,
    }
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: client.insert_rows_json(f"{DATASET}.dtc_events", [row])
    )
