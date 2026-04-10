# Most common DTC codes with severity and affected system
DTC_DATABASE = {
    "P0101": {
        "description": "Mass Airflow (MAF) sensor reading out of range",
        "system": "engine",
        "severity": "MEDIUM",
        "explanation": (
            "The MAF sensor is sending abnormal readings. "
            "May cause excessive fuel consumption and loss of power."
        ),
        "urgency": "Check within the next week."
    },
    "P0217": {
        "description": "Engine coolant temperature above limit",
        "system": "cooling",
        "severity": "HIGH",
        "explanation": (
            "The engine is overheating. Can cause serious engine damage "
            "if not corrected. Check coolant level immediately."
        ),
        "urgency": "Pull over safely and check immediately."
    },
    "P0300": {
        "description": "Random misfire detected",
        "system": "ignition",
        "severity": "HIGH",
        "explanation": (
            "One or more cylinders are not firing correctly. "
            "May damage the catalytic converter and cause power loss."
        ),
        "urgency": "Take to a shop within 48 hours."
    },
    "P0420": {
        "description": "Catalytic converter efficiency below threshold — bank 1",
        "system": "emissions",
        "severity": "MEDIUM",
        "explanation": (
            "The catalytic converter is not working efficiently. "
            "Causes increased pollutant emissions."
        ),
        "urgency": "Schedule a service within 30 days."
    },
    "P0442": {
        "description": "Small leak detected in EVAP system",
        "system": "fuel",
        "severity": "LOW",
        "explanation": (
            "A small fuel vapor leak was detected. "
            "Usually caused by a loose or missing fuel cap."
        ),
        "urgency": "Check the fuel cap. If it persists, schedule a service."
    },
    "P0171": {
        "description": "Fuel system too lean — bank 1",
        "system": "fuel",
        "severity": "MEDIUM",
        "explanation": (
            "The engine is running with too little fuel relative to air. "
            "Common causes: vacuum leak, dirty MAF sensor, or weak fuel pump."
        ),
        "urgency": "Diagnose within the next week to avoid engine damage."
    },
    "P0301": {
        "description": "Cylinder 1 misfire detected",
        "system": "ignition",
        "severity": "HIGH",
        "explanation": (
            "Cylinder 1 is misfiring. Likely cause: worn spark plug, bad coil, or injector issue."
        ),
        "urgency": "Take to a shop within 48 hours."
    },
    "P0455": {
        "description": "Large EVAP system leak detected",
        "system": "fuel",
        "severity": "MEDIUM",
        "explanation": (
            "A significant fuel vapor leak was detected. "
            "Check fuel cap and fuel lines."
        ),
        "urgency": "Schedule a service within two weeks."
    },
    "P0505": {
        "description": "Idle air control system malfunction",
        "system": "engine",
        "severity": "MEDIUM",
        "explanation": (
            "The idle speed control is not functioning correctly. "
            "Engine may stall or idle roughly."
        ),
        "urgency": "Check within the next week."
    },
    "P0700": {
        "description": "Transmission control system malfunction",
        "system": "transmission",
        "severity": "HIGH",
        "explanation": (
            "The transmission control module has detected a fault. "
            "Could affect gear shifting and fuel economy."
        ),
        "urgency": "Take to a shop as soon as possible."
    },
}


def get_dtc_info(code: str) -> dict:
    code = code.upper().strip()
    if code in DTC_DATABASE:
        return {"code": code, "found": True, **DTC_DATABASE[code]}

    # Fallback for unknown codes
    system = _infer_system(code)
    return {
        "code": code,
        "found": False,
        "description": f"Code {code} — consult a mechanic for diagnosis",
        "system": system,
        "severity": "UNKNOWN",
        "explanation": (
            "This code is not in the local database. "
            "A professional scan tool is recommended for diagnosis."
        ),
        "urgency": "Have a professional evaluate it."
    }


def _infer_system(code: str) -> str:
    if code.startswith("P0"):
        return "powertrain"
    if code.startswith("P1"):
        return "powertrain (manufacturer-specific)"
    if code.startswith("B"):
        return "body"
    if code.startswith("C"):
        return "chassis/brakes"
    if code.startswith("U"):
        return "communication network"
    return "unknown"
