# terraform.tfvars — project default values
# Do NOT commit sensitive values here — use Secret Manager or env vars

project_id             = "vitalcar-tcc"
region                 = "us-central1"
firestore_region       = "nam5"
environment            = "production"
cloudrun_max_instances = 3
