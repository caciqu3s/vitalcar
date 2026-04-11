# VitalCar

Predictive vehicle maintenance using OBD2 sensor data, machine learning, and explainable AI. The mobile app connects to an ELM327 Bluetooth adapter, streams live engine readings to a cloud API, and shows the driver their vehicle health score plus the top factors driving any alert — powered by a Random Forest model and SHAP.

Built as a Computer Science undergraduate thesis (TCC) at UNIP.

**Live API:** `https://vitalcar-api-q42eksufca-uc.a.run.app`

---

## How it works

```
OBD2 port  ──BLE──►  Mobile app  ──HTTPS──►  Cloud Run API
(ELM327)              (Expo/RN)               (FastAPI)
                                                   │
                                            Random Forest
                                            + StandardScaler
                                            + SHAP TreeExplainer
                                                   │
                                              BigQuery (logs)
                                              GCS (models)
```

1. The mobile app reads six engine PIDs every 5 seconds via Bluetooth from an ELM327 OBD2 adapter.
2. Raw readings are sent to the FastAPI backend on Cloud Run.
3. The backend applies the same feature engineering used during training (derives `temp_diff` and `power_proxy`), scales the features with a stored `StandardScaler`, and runs the Random Forest.
4. The response includes a health score (0–100), failure probability, alert flag, SHAP-based top factors, and a plain-language recommendation.
5. Every prediction is asynchronously logged to BigQuery for analytics.
6. The mobile app renders results across five screens: health gauge, sensor readings, alert history, fault code lookup, and a SHAP explainability chart.

---

## Repository structure

```
vitalcar/
├── ml_pipeline/          # Offline training pipeline
│   ├── main.py           # Entry point — runs all 6 steps
│   ├── src/
│   │   ├── preprocess.py # Cleaning, feature engineering, SMOTE
│   │   ├── train.py      # Model definitions (RF, XGBoost, LR, SVM)
│   │   ├── evaluate.py   # Metrics, ROC curves, SHAP plots
│   │   └── utils.py      # Dataset loader
│   ├── data/raw/         # ai4i2020.csv (gitignored)
│   └── outputs/          # models/, figures/, reports/ (gitignored)
│
├── backend/              # FastAPI inference server
│   ├── app/
│   │   ├── main.py       # Routes: /predict, /dtc/{code}, /health
│   │   ├── predict.py    # ML inference + SHAP
│   │   ├── dtc_codes.py  # Fault code database
│   │   └── bigquery_client.py  # Async logging
│   ├── tests/
│   │   └── test_predict.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── mobile/               # React Native app (Expo SDK 51)
│   ├── App.tsx           # Bottom-tab navigator (5 screens)
│   ├── src/
│   │   ├── screens/      # HomeScreen, SensorsScreen, AlertsScreen,
│   │   │                 # DTCScreen, ExplainScreen
│   │   ├── components/   # ConnectModal (BLE connect/disconnect UI)
│   │   ├── services/
│   │   │   ├── obd2.ts   # ELM327 BLE protocol
│   │   │   ├── api.ts    # HTTP client for backend
│   │   │   ├── demo.ts   # Offline demo scenarios
│   │   │   └── bleSession.ts  # Subscription lifecycle
│   │   └── store/
│   │       └── vehicleStore.ts  # Zustand global state
│   ├── assets/
│   ├── app.json          # Expo config (bundle ID, permissions)
│   └── package.json
│
├── infra/                # Terraform — GCP infrastructure
│   ├── main.tf           # Resource definitions
│   ├── variables.tf      # project_id, region, environment
│   └── outputs.tf        # cloudrun_url, registry_url, etc.
│
├── bigquery/             # Analytics SQL queries
├── .github/workflows/
│   └── deploy.yml        # 6-job CI/CD pipeline
└── bootstrap.sh          # One-time GCP project setup
```

---

## ML pipeline

### Dataset

[AI4I 2020 Predictive Maintenance Dataset](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset) (UCI) — 10,000 records of synthetic CNC machine sensor readings with a 3.7% failure rate.

### Features

| Feature | Source | Description |
|---|---|---|
| `Type` | OBD2 vehicle_type | Vehicle category (0=economy, 1=mid, 2=heavy) |
| `Air temperature [K]` | PID 0F | Intake air temperature |
| `Process temperature [K]` | PID 05 | Engine coolant temperature |
| `Rotational speed [rpm]` | PID 0C | Engine RPM |
| `Torque [Nm]` | PID 04 | Engine load (%) used as torque proxy |
| `Tool wear [min]` | PID 1F | Engine run time since start (minutes) |
| `temp_diff` | **derived** | `process_temp − air_temp` |
| `power_proxy` | **derived** | `rpm × torque` (estimated power) |

All features are scaled with `StandardScaler` before training and inference.

### Training

```bash
cd ml_pipeline
pip install -r requirements.txt
# Download the dataset to data/raw/ai4i2020.csv first
python main.py
```

The pipeline runs six steps:

1. Load and clean the raw CSV
2. Derive `temp_diff` and `power_proxy`
3. Train/test split (80/20, stratified) + StandardScaler
4. Apply SMOTE to balance the training set
5. Stratified 5-fold cross-validation across four model families
6. Final training + test-set evaluation + SHAP plots

Outputs land in `outputs/` (gitignored):

```
outputs/
├── models/
│   ├── Random_Forest.pkl   (~26 MB)
│   ├── XGBoost.pkl
│   ├── SVM.pkl
│   └── scaler.pkl
├── figures/                # confusion matrices, ROC curves, SHAP summary
└── reports/                # CV results JSON, model comparison CSV
```

### Model selection

| Model | CV F1 | Test ROC-AUC | Notes |
|---|---|---|---|
| **Random Forest** | **0.9679** | **0.8978** | Selected for production |
| XGBoost | 0.9658 | 0.8639 | |
| SVM | 0.8965 | 0.8763 | |
| Logistic Regression | 0.7792 | 0.7685 | Baseline |

Random Forest was chosen for its combination of accuracy and native compatibility with `shap.TreeExplainer`, which produces exact SHAP values efficiently.

### SHAP explainability

Every prediction includes per-feature SHAP values. A critical decision during implementation: the `TreeExplainer` must receive **scaled** features (the same space the tree was trained on), not raw sensor values. Passing raw values produces identical SHAP outputs for all inputs because all raw readings fall into the same leaf nodes relative to the scaler-calibrated split thresholds.

---

## Backend API

### Running locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Set the GCS bucket with the trained models
export MODELS_BUCKET=vitalcar-tcc-models

uvicorn app.main:app --reload --port 8080
```

Interactive docs: `http://localhost:8080/docs`

### Endpoints

#### `POST /predict`

Accepts a sensor reading and returns a prediction with SHAP explainability.

**Request body:**
```json
{
  "vehicle_id": "my-car-001",
  "vehicle_type": 1,
  "air_temp": 298.0,
  "process_temp": 308.0,
  "rpm": 1500.0,
  "torque": 42.0,
  "tool_wear": 80.0,
  "speed_kmh": 60.0,
  "fuel_trim": 1.5
}
```

**Response:**
```json
{
  "prediction": 0,
  "probability": 0.0054,
  "health_score": 99.5,
  "status": "NORMAL",
  "alert": false,
  "top_factors": [
    { "feature": "temp_diff",        "impact": -0.1613 },
    { "feature": "Tool wear [min]",  "impact": -0.1145 },
    { "feature": "power_proxy",      "impact": -0.1111 }
  ],
  "recommendation": "Vehicle in good condition. Keep up with regular maintenance.",
  "model_version": "1.0.0",
  "shap_values": { "Type": -0.002, "Air temperature [K]": -0.04, ... }
}
```

`alert` is `true` when `probability > 0.30`. The `status` field is `"IMMINENT FAILURE"` when `prediction == 1`.

#### `GET /dtc/{code}`

Look up a fault code. Returns a structured explanation optimised for a non-technical driver.

```
GET /dtc/P0300
```
```json
{
  "code": "P0300",
  "found": true,
  "description": "Random misfire detected",
  "system": "ignition",
  "severity": "HIGH",
  "explanation": "One or more cylinders are not firing correctly...",
  "urgency": "Take to a shop within 48 hours."
}
```

#### `GET /health`

Liveness probe used by Cloud Run and the CI/CD smoke test.

```json
{ "status": "ok", "service": "VitalCar API" }
```

### Architecture decisions

**Model loading on first request, not at startup.** `_load_models()` is called lazily inside `predict()`, guarded by a `None` check. This keeps Cloud Run's cold start under 2 seconds (no 26 MB GCS download at startup). The models are cached in the process for all subsequent requests.

**Async BigQuery logging.** FastAPI's `BackgroundTasks` writes sensor readings and predictions to BigQuery after the response is returned. This keeps `/predict` latency unaffected by logging latency (typically 300–700 ms for BQ inserts).

**Docker image.** `python:3.11-slim` base, no dev dependencies. The models are not baked into the image — they are pulled from GCS at runtime, so image rebuilds don't require retraining.

---

## Mobile app

### Tech stack

- **React Native 0.74** via **Expo SDK 51** (managed workflow)
- **react-native-ble-plx 3.1** — BLE central mode for ELM327 communication
- **Zustand 4.5** — global state (vehicle store, BLE status)
- **React Navigation 6** — bottom-tab navigator
- **axios 1.7** — HTTP client

### Running the app

```bash
cd mobile
npm install

# Web (browser, for quick UI testing)
npx expo start --web

# iOS simulator (requires Xcode and iOS simulator runtime)
npx expo run:ios

# Android emulator
npx expo run:android
```

The `EXPO_PUBLIC_API_URL` environment variable overrides the default Cloud Run URL:

```bash
echo "EXPO_PUBLIC_API_URL=http://localhost:8080" > .env
```

### Screens

| Tab | Screen | What it shows |
|---|---|---|
| 🏠 VitalCar | `HomeScreen` | Health gauge (0–100), BLE connection strip, demo mode toggle |
| 📊 Sensors | `SensorsScreen` | Health score card + SHAP feature contributions (color-coded) |
| 🔔 Alerts | `AlertsScreen` | Alert history — every prediction that crossed the threshold |
| 🔍 Fault Codes | `DTCScreen` | Search bar + demo chips; full DTC explanation from the API |
| 🧠 Why? | `ExplainScreen` | SHAP bar chart, failure probability, recommendation |

### OBD2 Bluetooth integration

The `obd2.ts` service implements the ELM327 SPP-over-BLE protocol:

- **Service UUID:** `0000fff0-0000-1000-8000-00805f9b34fb`
- **TX characteristic:** `fff1` (write commands)
- **RX characteristic:** `fff2` (read responses)
- Commands are base64-encoded; responses are decoded from ASCII hex.

**PIDs read on each poll:**

| PID | Data |
|---|---|
| `01 0C` | Engine RPM |
| `01 05` | Engine coolant temperature (°C → K) |
| `01 0F` | Intake air temperature (°C → K) |
| `01 04` | Engine load (% → used as torque proxy) |
| `01 0D` | Vehicle speed (km/h) |
| `01 07` | Short-term fuel trim (%) |
| `01 1F` | Engine run time since start (s ÷ 60 → `tool_wear` minutes) |

ELM327 init sequence on connect: `ATZ` (reset) → `ATE0` (echo off) → `ATL0` (linefeeds off) → `ATSP0` (auto-detect protocol).

**`tool_wear` note.** The AI4I training dataset uses minutes of machine operation as a wear proxy. OBD2 PID `0x1F` (engine run time since ignition) maps naturally to this. If the vehicle ECU doesn't support PID `0x1F` (returns `NO DATA`), the app falls back to wall-clock time since BLE connection was established.

**iOS Simulator.** The simulator has no Bluetooth hardware — `BleManager.state()` returns `'Unknown'`. The app detects this immediately in `scanForDevice()` and shows a clean error message instead of hanging.

### Demo mode

When no physical adapter is available, toggle **Demo Mode** on the Home screen to run one of three pre-defined scenarios against the live API:

| Scenario | key readings | expected result |
|---|---|---|
| Healthy Vehicle | rpm 1500–2000, wear 80 | ~93/100, NORMAL |
| Degrading Vehicle | rpm 1200–1400, wear 190 | ~88/100, caution |
| Imminent Failure | rpm 1700, torque 68, wear 240 | ~30/100, CRITICAL alert |

---

## Infrastructure

All GCP resources are managed with Terraform.

### Resources

| Resource | Purpose |
|---|---|
| Cloud Run | Hosts the FastAPI container (max 3 instances, publicly accessible) |
| Artifact Registry | Stores Docker images (`vitalcar/api`) |
| Cloud Storage | ML models bucket (`vitalcar-tcc-models`) with versioning and 3-version lifecycle |
| BigQuery | `vitalcar_analytics` dataset for sensor readings and predictions |
| Firestore | Real-time vehicle state |
| Secret Manager | API keys |
| Service Account | Runtime identity for Cloud Run (BQ, GCS, Firestore access) |

### First-time GCP setup

```bash
# 1. Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Bootstrap: creates Terraform state bucket, service accounts, WIF provider
chmod +x bootstrap.sh
./bootstrap.sh

# 3. Set GitHub secrets (output by bootstrap.sh):
#    GCP_PROJECT_ID, GCP_REGION, GCP_WIF_PROVIDER, GCP_WIF_SA, TFSTATE_BUCKET
```

### Manual Terraform

```bash
cd infra
terraform init -backend-config="bucket=YOUR_TFSTATE_BUCKET"
terraform plan  -var="project_id=YOUR_PROJECT_ID"
terraform apply -var="project_id=YOUR_PROJECT_ID"
```

### Uploading models to GCS

After training, upload the two required model files:

```bash
gsutil cp ml_pipeline/outputs/models/Random_Forest.pkl gs://vitalcar-tcc-models/
gsutil cp ml_pipeline/outputs/models/scaler.pkl       gs://vitalcar-tcc-models/
```

The CI/CD pipeline automates this only when `ml_pipeline/**` files change (path filter on the `upload-model` job).

---

## CI/CD pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) has six jobs:

```
push to main
    │
    ├─► test           Python unit tests + ruff lint
    ├─► tf-apply       terraform apply (infrastructure changes)
    ├─► build-push     docker build → Artifact Registry (tagged with commit SHA + latest)
    ├─► deploy         gcloud run deploy → smoke test GET /health
    └─► upload-model   (only if ml_pipeline/** changed) train → gsutil cp

pull request to main
    └─► tf-plan        terraform plan output posted as PR comment
```

Authentication uses **Workload Identity Federation** — no static service account JSON keys are stored in GitHub secrets. The workflow exchanges a GitHub OIDC token for a short-lived GCP access token.

---

## Development

### Backend tests

```bash
cd backend
pip install -r requirements.txt pytest
pytest tests/ -v
```

### Adding a new DTC code

Edit `backend/app/dtc_codes.py` — each entry is a dict with `description`, `system`, `severity`, `explanation`, and `urgency`.

### Adding a demo scenario

Edit `mobile/src/services/demo.ts` — add an entry to `DEMO_SCENARIOS` with a `label` and a `readings` array. The demo picker on the Home screen will show it automatically.

### Changing the ML model

1. Retrain in `ml_pipeline/` — `python main.py`
2. Upload the new `.pkl` files to GCS
3. The Cloud Run instance picks up the new files on its next cold start (or force a new revision with `gcloud run deploy`)

No backend code change is needed as long as the feature set (`FEATURE_NAMES` in `predict.py`) stays the same.

### Environment variables

| Variable | Where | Default | Description |
|---|---|---|---|
| `MODELS_BUCKET` | backend (Cloud Run) | `vitalcar-tcc-models` | GCS bucket for model files |
| `EXPO_PUBLIC_API_URL` | mobile `.env` | live Cloud Run URL | Backend URL override |

### GitHub secrets required

| Secret | Description |
|---|---|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_REGION` | Deployment region (e.g. `us-central1`) |
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider resource name |
| `GCP_WIF_SA` | Service account email for WIF impersonation |
| `TFSTATE_BUCKET` | GCS bucket for Terraform remote state |

---

## Key technical decisions

**Why Random Forest over XGBoost?** Both achieve similar accuracy (~0.97 F1 on CV). Random Forest was chosen because `shap.TreeExplainer` computes exact Shapley values for tree ensembles in polynomial time, while XGBoost requires approximation for the same. Since explainability is a first-class requirement of the TCC, the tie goes to the model with the better SHAP story.

**Why SMOTE?** The AI4I dataset has a 3.7% failure rate. Without balancing, models achieve ~96% accuracy by predicting "no failure" for everything. SMOTE oversamples the minority (failure) class in feature space before training, forcing the model to learn the failure boundary. The StandardScaler is fit before SMOTE and the same scaler is saved for inference.

**Why Cloud Run over a VM?** The inference server is stateless (models are cached in memory per instance). Cloud Run scales to zero between requests, which keeps costs near zero for a thesis project with low traffic. The 26 MB model download on cold start is the only overhead, which is acceptable.

**Why Workload Identity Federation?** Static service account keys stored in GitHub are a credential leak risk even in private repos. WIF ties GitHub Actions job identity to a specific repo and branch, issuing short-lived tokens. No long-lived credentials exist anywhere in the pipeline.

**Why Zustand over Redux?** The mobile app has a single global store with ~15 fields. Zustand's minimal boilerplate (no reducers, no actions-as-objects) is the right fit for this scale. The entire store fits in one file.

**Why ELM327 SPP-over-BLE UUIDs `fff0/fff1/fff2`?** This is the most common BLE profile for ELM327 clones (VEEPEAK, OBDLink Bluetooth LE). Cheap adapters using the older `ffe0/ffe1` single-characteristic profile are not supported. If connecting to a different adapter, inspect its BLE services with nRF Connect and update the UUID constants in `obd2.ts`.

---

## License

MIT
