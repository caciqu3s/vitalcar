import joblib
import pandas as pd
import shap
from google.cloud import storage
import os

MODEL_VERSION = "1.0.0"
_model = None
_scaler = None
_explainer = None

FEATURE_NAMES = [
    "Type", "Air temperature [K]", "Process temperature [K]",
    "Rotational speed [rpm]", "Torque [Nm]", "Tool wear [min]",
    "temp_diff", "power_proxy",
]


def _load_models():
    global _model, _scaler, _explainer
    if _model is not None:
        return

    bucket_name = os.environ.get("MODELS_BUCKET", "vitalcar-tcc-models")
    gcs = storage.Client()
    bucket = gcs.bucket(bucket_name)

    for filename in ["Random_Forest.pkl", "scaler.pkl"]:
        blob = bucket.blob(filename)
        blob.download_to_filename(f"/tmp/{filename}")

    _model = joblib.load("/tmp/Random_Forest.pkl")
    _scaler = joblib.load("/tmp/scaler.pkl")
    _explainer = shap.TreeExplainer(_model)


def predict(sensors: dict) -> dict:
    _load_models()

    # Feature engineering (must match training pipeline)
    air_temp    = sensors["air_temp"]
    process_temp = sensors["process_temp"]
    rpm         = sensors["rpm"]
    torque      = sensors["torque"]

    row = {
        "Type":                     sensors.get("vehicle_type", 1),
        "Air temperature [K]":      air_temp,
        "Process temperature [K]":  process_temp,
        "Rotational speed [rpm]":   rpm,
        "Torque [Nm]":              torque,
        "Tool wear [min]":          sensors.get("tool_wear", 0),
        "temp_diff":                process_temp - air_temp,
        "power_proxy":              rpm * torque,
    }
    X = pd.DataFrame([row], columns=FEATURE_NAMES)
    X_scaled = _scaler.transform(X)

    prediction  = int(_model.predict(X_scaled)[0])
    probability = float(_model.predict_proba(X_scaled)[0][1])

    # SHAP — explainability using new Explanation API (shap >= 0.46)
    explanation = _explainer(X)
    if explanation.values.ndim == 3:
        shap_arr = explanation.values[0, :, 1]  # failure class
    else:
        shap_arr = explanation.values[0]

    shap_dict   = {FEATURE_NAMES[i]: float(shap_arr[i]) for i in range(len(FEATURE_NAMES))}
    top_factors = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:3]

    health_score = round((1 - probability) * 100, 1)

    return {
        "prediction":   prediction,
        "probability":  round(probability, 4),
        "health_score": health_score,
        "status":       "IMMINENT FAILURE" if prediction == 1 else "NORMAL",
        "alert":        probability > 0.30,
        "top_factors":  [
            {"feature": name, "impact": round(val, 4)}
            for name, val in top_factors
        ],
        "recommendation": _get_recommendation(probability, top_factors),
        "model_version":  MODEL_VERSION,
        "shap_values":    shap_dict,
    }


def _get_recommendation(probability: float, top_factors: list) -> str:
    if probability < 0.10:
        return "Vehicle in good condition. Keep up with regular maintenance."
    elif probability < 0.30:
        return "Caution: some parameters out of range. Check at your next service."
    elif probability < 0.60:
        return (f"Warning: moderate failure risk. "
                f"Check the system related to {top_factors[0][0]} soon.")
    else:
        return "CRITICAL: High risk of mechanical failure. Take the vehicle to a mechanic immediately."
