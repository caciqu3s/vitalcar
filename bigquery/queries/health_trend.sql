-- Health score trend per vehicle over the last 30 days
-- Generates the gradual degradation chart for the capstone presentation

SELECT
  DATE(timestamp)                  AS date,
  vehicle_id,
  AVG(health_score)                AS avg_health_score,
  AVG(failure_probability)         AS avg_failure_probability,
  COUNTIF(alert_triggered)         AS alerts_triggered,
  COUNT(*)                         AS total_readings
FROM `vitalcar-tcc.vitalcar_analytics.sensor_readings`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY 1, 2
ORDER BY 1 ASC
