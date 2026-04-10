"""
VitalCar — OBD2 Real-Time Prediction Simulation
Shows how the trained model would work with live sensor data from an ELM327 adapter.
Run after main.py has generated the .pkl files.
"""

import joblib
import numpy as np
import pandas as pd


# Load trained model and scaler
model = joblib.load('outputs/models/Random_Forest.pkl')
scaler = joblib.load('outputs/models/scaler.pkl')

FEATURE_NAMES = [
    'Type', 'Air temperature [K]', 'Process temperature [K]',
    'Rotational speed [rpm]', 'Torque [Nm]', 'Tool wear [min]',
    'temp_diff', 'power_proxy',
]


def predict_vehicle_health(sensor_reading: dict) -> dict:
    """
    Receives OBD2 sensor readings and returns a vehicle health prediction.

    Parameters (OBD2 analogs):
    - air_temp     : intake air temperature (IAT - PID 0F) in Kelvin
    - process_temp : engine coolant temperature (ECT - PID 05) in Kelvin
    - rpm          : engine speed (PID 0C)
    - torque       : estimated torque (derived from engine load PID 04)
    - tool_wear    : mileage / accumulated wear proxy
    - vehicle_type : 0=economy, 1=mid-range, 2=heavy
    """

    # Feature engineering (must match training pipeline)
    temp_diff   = sensor_reading['process_temp'] - sensor_reading['air_temp']
    power_proxy = sensor_reading['rpm'] * sensor_reading['torque']

    row = {
        'Type':                     sensor_reading['vehicle_type'],
        'Air temperature [K]':      sensor_reading['air_temp'],
        'Process temperature [K]':  sensor_reading['process_temp'],
        'Rotational speed [rpm]':   sensor_reading['rpm'],
        'Torque [Nm]':              sensor_reading['torque'],
        'Tool wear [min]':          sensor_reading['tool_wear'],
        'temp_diff':                temp_diff,
        'power_proxy':              power_proxy,
    }
    X = pd.DataFrame([row], columns=FEATURE_NAMES)
    X_scaled = scaler.transform(X)

    prediction  = int(model.predict(X_scaled)[0])
    probability = float(model.predict_proba(X_scaled)[0][1])

    return {
        'status':              'IMMINENT FAILURE' if prediction == 1 else 'NORMAL',
        'failure_probability': f"{probability*100:.1f}%",
        'alert':               probability > 0.3,
        'recommendation':      'Take the vehicle to a mechanic immediately'
                               if prediction == 1
                               else 'Vehicle in good condition.'
    }


# -- Test examples ------------------------------------------------------------

# Healthy vehicle
normal = predict_vehicle_health({
    'air_temp': 298.0, 'process_temp': 308.0,
    'rpm': 1500, 'torque': 40.0,
    'tool_wear': 100, 'vehicle_type': 1
})
print("\nHealthy vehicle:")
print(normal)

# Vehicle showing failure signs (high temperature, elevated wear)
failing = predict_vehicle_health({
    'air_temp': 298.0, 'process_temp': 315.0,
    'rpm': 1200, 'torque': 68.0,
    'tool_wear': 220, 'vehicle_type': 0
})
print("\nVehicle with failure signs:")
print(failing)
