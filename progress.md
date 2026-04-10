# VitalCar — Implementation Progress

## Session 1 — ML Pipeline

### Status: COMPLETE

### Tasks
- [x] Create progress tracking file
- [x] Create ml_pipeline folder structure
- [x] Create ml_pipeline/requirements.txt
- [x] Create ml_pipeline/src/utils.py
- [x] Create ml_pipeline/src/preprocess.py
- [x] Create ml_pipeline/src/train.py
- [x] Create ml_pipeline/src/evaluate.py
- [x] Create ml_pipeline/main.py
- [x] Create ml_pipeline/simulate_obd2.py
- [x] Generate AI4I 2020 dataset (3.7% failure rate, faithful to UCI paper)
- [x] Install dependencies (Python 3.13 compatible)
- [x] Run full pipeline (python main.py) — all 6 steps completed
- [x] Validate outputs: Random_Forest.pkl, scaler.pkl, figures, reports
- [x] Run simulate_obd2.py — healthy 0%, degrading 25.5%

### Outputs generated
- `ml_pipeline/outputs/models/Random_Forest.pkl` (27MB)
- `ml_pipeline/outputs/models/scaler.pkl`
- `ml_pipeline/outputs/models/XGBoost.pkl`
- `ml_pipeline/outputs/models/SVM.pkl`
- `ml_pipeline/outputs/figures/confusion_matrices.png`
- `ml_pipeline/outputs/figures/roc_curves.png`
- `ml_pipeline/outputs/figures/feature_importance.png`
- `ml_pipeline/outputs/figures/shap_summary.png`
- `ml_pipeline/outputs/reports/cv_results.json`
- `ml_pipeline/outputs/reports/test_results.json`
- `ml_pipeline/outputs/reports/model_comparison.csv`

### Model Results (cross-validation on SMOTE-balanced data)
| Model               | CV F1  | Test ROC-AUC |
|---------------------|--------|--------------|
| Logistic Regression | 0.7792 | 0.7685       |
| Random Forest       | 0.9679 | 0.8978       |
| XGBoost             | 0.9658 | 0.8639       |
| SVM                 | 0.8965 | 0.8763       |

---

## Session 2 — GCP Bootstrap + Terraform

### Status: COMPLETE

### Tasks
- [x] Create bootstrap.sh (GCP project, APIs, tfstate bucket, SA, WIF)
- [x] Create infra/variables.tf
- [x] Create infra/main.tf (Artifact Registry, Cloud Storage, BigQuery, Firestore, Secret Manager, Cloud Run)
- [x] Create infra/outputs.tf
- [x] Create infra/terraform.tfvars
- [x] Create .github/workflows/deploy.yml (CI/CD: test → tf-plan → tf-apply → build-push → deploy → upload-model)

### Next Steps (manual — requires GCP account)
1. Edit `bootstrap.sh` — set `BILLING_ACCOUNT_ID` and `GITHUB_ORG`
2. Run `chmod +x bootstrap.sh && ./bootstrap.sh`
3. Add the 5 GitHub secrets printed by bootstrap.sh
4. Run `cd infra && terraform init && terraform plan && terraform apply`
5. Upload ML models: `gsutil cp ml_pipeline/outputs/models/Random_Forest.pkl gs://vitalcar-tcc-models/ && gsutil cp ml_pipeline/outputs/models/scaler.pkl gs://vitalcar-tcc-models/`

---

## Session 3 — Backend FastAPI

### Status: COMPLETE

### Tasks
- [x] Create backend/requirements.txt
- [x] Create backend/app/__init__.py
- [x] Create backend/app/bigquery_client.py (lazy-init, async logging)
- [x] Create backend/app/predict.py (GCS model loading, SHAP v0.51 API)
- [x] Create backend/app/dtc_codes.py (10 common codes + fallback)
- [x] Create backend/app/main.py (FastAPI: /predict, /dtc/:code, /health)
- [x] Create backend/Dockerfile
- [x] Create backend/tests/test_predict.py — 9/9 passing locally

---

## Session 4 — Mobile React Native

### Status: COMPLETE

### Tasks
- [x] Create mobile/package.json and app.json (Expo + BLE permissions)
- [x] Create mobile/src/services/api.ts (typed axios wrappers)
- [x] Create mobile/src/services/demo.ts (3 demo scenarios)
- [x] Create mobile/src/services/obd2.ts (ELM327 BLE communication)
- [x] Create mobile/src/store/vehicleStore.ts (Zustand global state)
- [x] Create mobile/src/screens/HomeScreen.tsx (health gauge, demo mode)
- [x] Create mobile/src/screens/SensorsScreen.tsx (SHAP feature values)
- [x] Create mobile/src/screens/AlertsScreen.tsx (alert history)
- [x] Create mobile/src/screens/DTCScreen.tsx (fault code lookup)
- [x] Create mobile/src/screens/ExplainScreen.tsx (SHAP bar chart, XAI)
- [x] Create mobile/App.tsx (bottom-tab navigator)

### Next Steps (manual)
1. `cd mobile && npm install`
2. `npx expo start`
3. Enable Demo Mode on HomeScreen → set scenario → test all screens

---

## Session 5 — Analytics BigQuery

### Status: COMPLETE

### Tasks
- [x] Create bigquery/queries/health_trend.sql
- [x] Create bigquery/queries/failure_distribution.sql
- [x] Create bigquery/queries/alert_accuracy.sql
- [x] Create bigquery/setup_bq.py

### Next Steps (manual — after GCP is live)
1. Run `python bigquery/setup_bq.py` (optional — Terraform already creates tables)
2. Generate demo data: run simulate_obd2.py adapted to POST to API
3. Open BigQuery Console → run each .sql query
4. Open Looker Studio → connect to `vitalcar-tcc.vitalcar_analytics`
5. Build dashboard: health trend line, failure pie chart, top alerts table

---

## Final Checklist

### ML Pipeline
- [x] AI4I 2020 dataset generated (~3.7% failure rate)
- [x] 4 models trained and compared
- [x] Random_Forest.pkl and scaler.pkl generated
- [x] All evaluation charts generated

### GCP Bootstrap & Terraform
- [ ] bootstrap.sh executed (requires GCP account + billing)
- [ ] 5 GitHub secrets configured
- [ ] terraform apply completed
- [ ] Cloud Run live with public URL

### Backend
- [x] FastAPI with /predict and /dtc/:code implemented
- [x] Async BigQuery logging
- [x] Docker build defined
- [x] 9/9 unit tests passing
- [ ] Deployed to Cloud Run (requires GCP)

### Mobile
- [x] All 5 screens implemented
- [x] Demo mode with 3 scenarios
- [x] SHAP explainability screen
- [ ] Tested in simulator (requires npm install + expo start)

### BigQuery / Analytics
- [x] 3 SQL queries written
- [x] setup_bq.py created
- [ ] Data streaming after deploy (requires Cloud Run to be live)
- [ ] Looker Studio dashboard (requires live data)
