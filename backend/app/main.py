from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from . import predict as predictor
from .bigquery_client import log_sensor_reading, log_prediction, log_dtc_event
from .dtc_codes import get_dtc_info

app = FastAPI(
    title="VitalCar API",
    description="Vehicle predictive maintenance system with OBD2 and AI",
    version="1.0.0"
)


class SensorReading(BaseModel):
    vehicle_id: str
    session_id: Optional[str] = None
    vehicle_type: int = 1          # 0=economy, 1=mid-range, 2=heavy
    air_temp: float                # air temperature (K) — IAT OBD2 PID 0F
    process_temp: float            # engine temperature (K) — ECT OBD2 PID 05
    rpm: float                     # engine speed — PID 0C
    torque: float                  # estimated torque — derived from PID 04
    tool_wear: float               # wear proxy (km / hours of use)
    speed_kmh: Optional[float] = 0
    fuel_trim: Optional[float] = 0


@app.post("/predict")
async def predict_failure(reading: SensorReading, background_tasks: BackgroundTasks):
    try:
        result = predictor.predict(reading.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Async BQ log — does not affect response latency
    background_tasks.add_task(
        log_sensor_reading,
        {
            "session_id":         reading.session_id,
            "vehicle_id":         reading.vehicle_id,
            "rpm":                reading.rpm,
            "engine_temp_k":      reading.process_temp,
            "engine_load":        reading.torque,
            "speed_kmh":          reading.speed_kmh,
            "torque_nm":          reading.torque,
            "fuel_trim":          reading.fuel_trim,
            "health_score":       result["health_score"],
            "failure_probability": result["probability"],
            "alert_triggered":    result["alert"],
        }
    )
    background_tasks.add_task(
        log_prediction,
        reading.vehicle_id,
        reading.model_dump(),
        result["prediction"],
        result["probability"],
        result["shap_values"],
        result["model_version"],
    )

    return result


@app.get("/dtc/{code}")
async def get_dtc(code: str, vehicle_id: Optional[str] = None,
                  background_tasks: BackgroundTasks = None):
    info = get_dtc_info(code)

    if vehicle_id and info["found"] and background_tasks is not None:
        background_tasks.add_task(
            log_dtc_event,
            vehicle_id, code, info["description"], info["severity"]
        )

    return info


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "VitalCar API"}
