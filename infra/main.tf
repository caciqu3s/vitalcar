# =============================================================================
# VitalCar — GCP Infrastructure with Terraform
# Manages: Cloud Run, BigQuery, Firestore, Artifact Registry,
#          Cloud Storage (ML models), Secret Manager
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Remote backend — bucket created by bootstrap.sh
  backend "gcs" {
    bucket = "vitalcar-tcc-tfstate"   # overridden via -backend-config
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  labels = {
    project     = "vitalcar"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# =============================================================================
# ARTIFACT REGISTRY — Docker image repository
# =============================================================================
resource "google_artifact_registry_repository" "vitalcar" {
  repository_id = "vitalcar"
  location      = var.region
  format        = "DOCKER"
  description   = "VitalCar Docker images"
  labels        = local.labels
}

# =============================================================================
# CLOUD STORAGE — serialized ML models
# =============================================================================
resource "google_storage_bucket" "models" {
  name                        = "${var.project_id}-models"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3  # keep only the 3 most recent model versions
    }
    action {
      type = "Delete"
    }
  }

  labels = local.labels
}

# =============================================================================
# BIGQUERY — analytical layer
# =============================================================================
resource "google_bigquery_dataset" "analytics" {
  dataset_id  = "vitalcar_analytics"
  description = "VitalCar analytical dataset — OBD2 readings and ML predictions"
  location    = "US"
  labels      = local.labels

  delete_contents_on_destroy = false
}

resource "google_bigquery_table" "sensor_readings" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "sensor_readings"
  description         = "Real-time OBD2 sensor readings"
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  clustering = ["vehicle_id"]
  labels     = local.labels

  schema = jsonencode([
    { name = "timestamp",           type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "session_id",          type = "STRING",    mode = "NULLABLE" },
    { name = "vehicle_id",          type = "STRING",    mode = "REQUIRED" },
    { name = "rpm",                 type = "FLOAT",     mode = "NULLABLE" },
    { name = "engine_temp_k",       type = "FLOAT",     mode = "NULLABLE" },
    { name = "engine_load",         type = "FLOAT",     mode = "NULLABLE" },
    { name = "speed_kmh",           type = "FLOAT",     mode = "NULLABLE" },
    { name = "torque_nm",           type = "FLOAT",     mode = "NULLABLE" },
    { name = "fuel_trim",           type = "FLOAT",     mode = "NULLABLE" },
    { name = "health_score",        type = "FLOAT",     mode = "NULLABLE" },
    { name = "failure_probability", type = "FLOAT",     mode = "NULLABLE" },
    { name = "alert_triggered",     type = "BOOLEAN",   mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "dtc_events" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "dtc_events"
  description         = "Detected DTC fault codes"
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  clustering = ["vehicle_id", "severity"]
  labels     = local.labels

  schema = jsonencode([
    { name = "timestamp",        type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "vehicle_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "dtc_code",         type = "STRING",    mode = "REQUIRED" },
    { name = "dtc_description",  type = "STRING",    mode = "NULLABLE" },
    { name = "severity",         type = "STRING",    mode = "NULLABLE" },
    { name = "resolved_at",      type = "TIMESTAMP", mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "model_predictions" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "model_predictions"
  description         = "Log of all ML model predictions"
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  clustering = ["vehicle_id", "model_version"]
  labels     = local.labels

  schema = jsonencode([
    { name = "timestamp",         type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "vehicle_id",        type = "STRING",    mode = "REQUIRED" },
    { name = "features_json",     type = "JSON",      mode = "NULLABLE" },
    { name = "prediction",        type = "INTEGER",   mode = "NULLABLE" },
    { name = "probability",       type = "FLOAT",     mode = "NULLABLE" },
    { name = "shap_values_json",  type = "JSON",      mode = "NULLABLE" },
    { name = "model_version",     type = "STRING",    mode = "NULLABLE" },
  ])
}

# =============================================================================
# FIRESTORE — operational app data
# =============================================================================
resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.firestore_region
  type        = "FIRESTORE_NATIVE"

  deletion_policy = "DELETE"  # change to ABANDON in real production
}

# =============================================================================
# SECRET MANAGER — sensitive API variables
# =============================================================================
resource "google_secret_manager_secret" "api_keys" {
  secret_id = "vitalcar-api-keys"
  labels    = local.labels

  replication {
    auto {}
  }
}

# =============================================================================
# SERVICE ACCOUNT — Cloud Run
# =============================================================================
resource "google_service_account" "cloudrun_sa" {
  account_id   = "vitalcar-cloudrun"
  display_name = "VitalCar Cloud Run Service Account"
}

locals {
  cloudrun_roles = [
    "roles/bigquery.dataEditor",         # insert rows into tables
    "roles/bigquery.jobUser",            # run query jobs
    "roles/datastore.user",              # read/write Firestore
    "roles/storage.objectViewer",        # download models from bucket
    "roles/secretmanager.secretAccessor",
  ]
}

resource "google_project_iam_member" "cloudrun_roles" {
  for_each = toset(local.cloudrun_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# =============================================================================
# CLOUD RUN — FastAPI
# =============================================================================
resource "google_cloud_run_v2_service" "api" {
  name     = "vitalcar-api"
  location = var.region

  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun_sa.email

    scaling {
      min_instance_count = 0   # scales to zero — no cost when idle
      max_instance_count = var.cloudrun_max_instances
    }

    containers {
      # Image updated by GitHub Actions on every push to main
      image = "${var.region}-docker.pkg.dev/${var.project_id}/vitalcar/api:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true   # release CPU when not processing requests
        startup_cpu_boost = true   # extra CPU on cold start
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "MODELS_BUCKET"
        value = google_storage_bucket.models.name
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds = 30
      }
    }
  }

  labels = local.labels

  depends_on = [
    google_artifact_registry_repository.vitalcar,
    google_project_iam_member.cloudrun_roles,
  ]
}

# Public access — mobile app calls the API directly without authentication
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
