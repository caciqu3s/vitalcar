variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Primary region for GCP resources"
  type        = string
  default     = "us-central1"
}

variable "firestore_region" {
  description = "Firestore region (must be multi-region or nam5/eur3)"
  type        = string
  default     = "nam5" # US multi-region — more generous free tier
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be: development, staging, or production."
  }
}

variable "cloudrun_max_instances" {
  description = "Maximum number of Cloud Run instances (cost control)"
  type        = number
  default     = 3
}
