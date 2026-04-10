# =============================================================================
# outputs.tf — values exported after apply
# Used by GitHub Actions to configure the deploy step
# =============================================================================

output "cloudrun_url" {
  description = "Public URL of the Cloud Run API"
  value       = google_cloud_run_v2_service.api.uri
}

output "artifact_registry_url" {
  description = "Docker repository URL in Artifact Registry"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/vitalcar"
}

output "models_bucket_name" {
  description = "GCS bucket name for ML models"
  value       = google_storage_bucket.models.name
}

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID"
  value       = google_bigquery_dataset.analytics.dataset_id
}

output "cloudrun_sa_email" {
  description = "Cloud Run Service Account email"
  value       = google_service_account.cloudrun_sa.email
}
