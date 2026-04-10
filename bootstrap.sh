#!/usr/bin/env bash
# =============================================================================
# VitalCar — GCP Bootstrap
# Run ONCE to prepare the project before Terraform takes over.
#
# What this script does:
#   1. Creates the GCP project
#   2. Enables required APIs
#   3. Creates the Terraform remote state bucket
#   4. Creates the Terraform Service Account
#   5. Configures Workload Identity Federation (WIF) for GitHub Actions
#   6. Grants all required IAM permissions
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Owner or roles/resourcemanager.projectCreator on the org/billing account
#
# Usage:
#   chmod +x bootstrap.sh
#   ./bootstrap.sh
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION — edit these before running
# =============================================================================
export PROJECT_ID="vitalcar-tcc"
export PROJECT_NAME="VitalCar TCC"
export REGION="us-central1"
export BILLING_ACCOUNT_ID="01FD72-09D268-354E95"
export GITHUB_ORG="caciqu3s"
export GITHUB_REPO="vitalcar"         # GitHub repository name
export TFSTATE_BUCKET="${PROJECT_ID}-tfstate"
export TF_SERVICE_ACCOUNT="terraform-sa"
export WIF_POOL_ID="github-pool"
export WIF_PROVIDER_ID="github-provider"

# =============================================================================
# VALIDATION
# =============================================================================
if [[ -z "$BILLING_ACCOUNT_ID" ]]; then
  echo "❌ BILLING_ACCOUNT_ID is not set."
  echo "   Run: gcloud billing accounts list"
  echo "   Copy the ACCOUNT_ID and set BILLING_ACCOUNT_ID in this script."
  exit 1
fi

if [[ "$GITHUB_ORG" == "your-username" ]]; then
  echo "❌ Please set GITHUB_ORG and GITHUB_REPO in this script before running."
  exit 1
fi

echo "============================================================"
echo "  VitalCar — GCP Bootstrap"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  GitHub  : $GITHUB_ORG/$GITHUB_REPO"
echo "============================================================"
echo ""

# =============================================================================
# 1. CREATE GCP PROJECT
# =============================================================================
echo "▶ [1/6] Creating GCP project..."

if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
  echo "  ✓ Project $PROJECT_ID already exists, skipping creation."
else
  gcloud projects create "$PROJECT_ID" \
    --name="$PROJECT_NAME" \
    --set-as-default
  echo "  ✓ Project created: $PROJECT_ID"
fi

gcloud config set project "$PROJECT_ID"

# Link billing account (skip if already linked)
CURRENT_BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null)
if [[ "$CURRENT_BILLING" == "True" ]]; then
  echo "  ✓ Billing account already linked, skipping."
else
  gcloud billing projects link "$PROJECT_ID" \
    --billing-account="$BILLING_ACCOUNT_ID"
  echo "  ✓ Billing account linked."
fi

# =============================================================================
# 2. ENABLE APIS
# =============================================================================
echo ""
echo "▶ [2/6] Enabling APIs..."

APIS=(
  "cloudresourcemanager.googleapis.com"
  "iam.googleapis.com"
  "iamcredentials.googleapis.com"   # required for WIF
  "sts.googleapis.com"              # Security Token Service (WIF)
  "storage.googleapis.com"
  "run.googleapis.com"
  "bigquery.googleapis.com"
  "firestore.googleapis.com"
  "artifactregistry.googleapis.com"
  "cloudbuild.googleapis.com"
  "secretmanager.googleapis.com"
)

gcloud services enable "${APIS[@]}" --project="$PROJECT_ID"
echo "  ✓ APIs enabled."

# =============================================================================
# 3. TFSTATE BUCKET
# =============================================================================
echo ""
echo "▶ [3/6] Creating Terraform state bucket..."

if gsutil ls -b "gs://${TFSTATE_BUCKET}" &>/dev/null; then
  echo "  ✓ Bucket gs://${TFSTATE_BUCKET} already exists."
else
  gsutil mb \
    -p "$PROJECT_ID" \
    -l "$REGION" \
    -b on \
    "gs://${TFSTATE_BUCKET}"

  # Versioning is required for tfstate
  gsutil versioning set on "gs://${TFSTATE_BUCKET}"

  # Block all public access
  gsutil pap set enforced "gs://${TFSTATE_BUCKET}"

  echo "  ✓ Bucket created: gs://${TFSTATE_BUCKET} (versioning enabled)"
fi

# =============================================================================
# 4. TERRAFORM SERVICE ACCOUNT
# =============================================================================
echo ""
echo "▶ [4/6] Creating Terraform Service Account..."

TF_SA_EMAIL="${TF_SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$TF_SA_EMAIL" &>/dev/null; then
  echo "  ✓ Service Account $TF_SA_EMAIL already exists."
else
  gcloud iam service-accounts create "$TF_SERVICE_ACCOUNT" \
    --display-name="Terraform Service Account" \
    --project="$PROJECT_ID"
  echo "  ✓ Service Account created: $TF_SA_EMAIL"
fi

# Roles required for Terraform to manage all project infrastructure
TF_ROLES=(
  "roles/run.admin"
  "roles/bigquery.admin"
  "roles/datastore.owner"               # Firestore
  "roles/storage.admin"
  "roles/artifactregistry.admin"
  "roles/iam.serviceAccountAdmin"
  "roles/iam.workloadIdentityPoolAdmin"
  "roles/resourcemanager.projectIamAdmin"
  "roles/secretmanager.admin"
)

echo "  Granting roles to Terraform Service Account..."
for ROLE in "${TF_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${TF_SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done
echo "  ✓ Roles granted."

# Write access to the tfstate bucket
gsutil iam ch \
  "serviceAccount:${TF_SA_EMAIL}:roles/storage.objectAdmin" \
  "gs://${TFSTATE_BUCKET}"
echo "  ✓ tfstate bucket access granted."

# =============================================================================
# 5. WORKLOAD IDENTITY FEDERATION (WIF)
# =============================================================================
echo ""
echo "▶ [5/6] Configuring Workload Identity Federation for GitHub Actions..."

# Create WIF Pool
if gcloud iam workload-identity-pools describe "$WIF_POOL_ID" \
  --location="global" --project="$PROJECT_ID" &>/dev/null; then
  echo "  ✓ WIF Pool $WIF_POOL_ID already exists."
else
  gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    --project="$PROJECT_ID"
  echo "  ✓ WIF Pool created: $WIF_POOL_ID"
fi

# Create WIF OIDC Provider for GitHub
if gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" \
  --workload-identity-pool="$WIF_POOL_ID" \
  --location="global" --project="$PROJECT_ID" &>/dev/null; then
  echo "  ✓ WIF Provider $WIF_PROVIDER_ID already exists."
else
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
    --workload-identity-pool="$WIF_POOL_ID" \
    --location="global" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'" \
    --project="$PROJECT_ID"
  echo "  ✓ OIDC WIF Provider created for GitHub Actions."
fi

# Get the full WIF Pool resource name for the binding
WIF_POOL_NAME=$(gcloud iam workload-identity-pools describe "$WIF_POOL_ID" \
  --location="global" \
  --project="$PROJECT_ID" \
  --format="value(name)")

# Allow the specific GitHub repository to impersonate the Terraform SA
gcloud iam service-accounts add-iam-policy-binding "$TF_SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WIF_POOL_NAME}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
  --project="$PROJECT_ID"

echo "  ✓ WIF binding created for ${GITHUB_ORG}/${GITHUB_REPO}"

# =============================================================================
# 6. OUTPUT VALUES FOR GITHUB SECRETS
# =============================================================================
echo ""
echo "▶ [6/6] Collecting output values..."

WIF_PROVIDER_FULL=$(gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" \
  --workload-identity-pool="$WIF_POOL_ID" \
  --location="global" \
  --project="$PROJECT_ID" \
  --format="value(name)")

echo ""
echo "============================================================"
echo "  ✅ Bootstrap completed successfully!"
echo "============================================================"
echo ""
echo "Add the following secrets to your GitHub repository:"
echo "  Settings → Secrets and variables → Actions"
echo ""
echo "  GCP_PROJECT_ID         = $PROJECT_ID"
echo "  GCP_REGION             = $REGION"
echo "  WIF_PROVIDER           = $WIF_PROVIDER_FULL"
echo "  WIF_SERVICE_ACCOUNT    = $TF_SA_EMAIL"
echo "  TFSTATE_BUCKET         = $TFSTATE_BUCKET"
echo ""
echo "Next step: run Terraform"
echo "  cd infra/"
echo "  terraform init"
echo "  terraform plan"
echo "  terraform apply"
echo "============================================================"
