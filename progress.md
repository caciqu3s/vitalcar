# VitalCar — Implementation Progress

## Session 1 — ML Pipeline

### Status: IN PROGRESS

### Tasks
- [x] Create progress tracking file
- [ ] Create ml_pipeline folder structure
- [ ] Create ml_pipeline/requirements.txt
- [ ] Create ml_pipeline/src/utils.py
- [ ] Create ml_pipeline/src/preprocess.py
- [ ] Create ml_pipeline/src/train.py
- [ ] Create ml_pipeline/src/evaluate.py
- [ ] Create ml_pipeline/main.py
- [ ] Create ml_pipeline/simulate_obd2.py
- [ ] Download AI4I 2020 dataset
- [ ] Install dependencies
- [ ] Run full pipeline (python main.py)
- [ ] Validate outputs: Random_Forest.pkl, scaler.pkl, figures, reports
- [ ] Run simulate_obd2.py

### Expected Outputs
- `ml_pipeline/outputs/models/Random_Forest.pkl`
- `ml_pipeline/outputs/models/scaler.pkl`
- `ml_pipeline/outputs/figures/` (confusion_matrices.png, roc_curves.png, shap_summary.png, feature_importance.png)
- `ml_pipeline/outputs/reports/` (cv_results.json, test_results.json, model_comparison.csv)

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

### Files Created
- `bootstrap.sh` — run once before Terraform to set up GCP project
- `infra/variables.tf` — Terraform variable declarations
- `infra/main.tf` — all GCP infrastructure as code
- `infra/outputs.tf` — exported values after apply
- `infra/terraform.tfvars` — default variable values
- `.github/workflows/deploy.yml` — full CI/CD pipeline

### Next Steps (manual)
1. Edit `bootstrap.sh` — set `BILLING_ACCOUNT_ID` and `GITHUB_ORG`
2. Run `./bootstrap.sh`
3. Add the 5 secrets printed by bootstrap to GitHub repo settings
4. Run `cd infra && terraform init && terraform plan && terraform apply`
5. Upload ML models: `gsutil cp ml_pipeline/outputs/models/*.pkl gs://vitalcar-tcc-models/`

---

## Session 3 — Backend FastAPI (PENDING)
## Session 4 — Mobile React Native (PENDING)
## Session 5 — Analytics BigQuery (PENDING)
