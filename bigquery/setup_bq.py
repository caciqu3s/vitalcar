"""
VitalCar — BigQuery dataset and table creation script.
Run this once after Terraform has provisioned the project (Terraform creates the dataset
and tables, but this script can also be used to recreate them in a fresh dev environment).

Usage:
  pip install google-cloud-bigquery
  python bigquery/setup_bq.py
"""

from google.cloud import bigquery

PROJECT  = "vitalcar-tcc"
DATASET  = "vitalcar_analytics"
LOCATION = "US"

client = bigquery.Client(project=PROJECT)

# ── Create dataset ────────────────────────────────────────────────────────────
ds_ref = bigquery.Dataset(f"{PROJECT}.{DATASET}")
ds_ref.location = LOCATION
ds_ref.description = "VitalCar analytical dataset — OBD2 readings and ML predictions"
dataset = client.create_dataset(ds_ref, exists_ok=True)
print(f"Dataset ready: {PROJECT}.{DATASET}")

# ── Table schemas ─────────────────────────────────────────────────────────────
tables = {
    "sensor_readings": [
        bigquery.SchemaField("timestamp",           "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("session_id",          "STRING",    mode="NULLABLE"),
        bigquery.SchemaField("vehicle_id",          "STRING",    mode="REQUIRED"),
        bigquery.SchemaField("rpm",                 "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("engine_temp_k",       "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("engine_load",         "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("speed_kmh",           "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("torque_nm",           "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("fuel_trim",           "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("health_score",        "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("failure_probability", "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("alert_triggered",     "BOOLEAN",   mode="NULLABLE"),
    ],
    "dtc_events": [
        bigquery.SchemaField("timestamp",       "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("vehicle_id",      "STRING",    mode="REQUIRED"),
        bigquery.SchemaField("dtc_code",        "STRING",    mode="REQUIRED"),
        bigquery.SchemaField("dtc_description", "STRING",    mode="NULLABLE"),
        bigquery.SchemaField("severity",        "STRING",    mode="NULLABLE"),
        bigquery.SchemaField("resolved_at",     "TIMESTAMP", mode="NULLABLE"),
    ],
    "model_predictions": [
        bigquery.SchemaField("timestamp",        "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("vehicle_id",       "STRING",    mode="REQUIRED"),
        bigquery.SchemaField("features_json",    "JSON",      mode="NULLABLE"),
        bigquery.SchemaField("prediction",       "INTEGER",   mode="NULLABLE"),
        bigquery.SchemaField("probability",      "FLOAT",     mode="NULLABLE"),
        bigquery.SchemaField("shap_values_json", "JSON",      mode="NULLABLE"),
        bigquery.SchemaField("model_version",    "STRING",    mode="NULLABLE"),
    ],
}

for table_id, schema in tables.items():
    full_ref = f"{PROJECT}.{DATASET}.{table_id}"
    table    = bigquery.Table(full_ref, schema=schema)

    if table_id == "sensor_readings":
        table.time_partitioning = bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY, field="timestamp"
        )
        table.clustering_fields = ["vehicle_id"]

    elif table_id == "dtc_events":
        table.time_partitioning = bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY, field="timestamp"
        )
        table.clustering_fields = ["vehicle_id", "severity"]

    elif table_id == "model_predictions":
        table.time_partitioning = bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY, field="timestamp"
        )
        table.clustering_fields = ["vehicle_id", "model_version"]

    client.create_table(table, exists_ok=True)
    print(f"Table ready: {full_ref}")

print("\nBigQuery setup complete.")
