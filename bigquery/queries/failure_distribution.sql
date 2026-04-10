-- Distribution of detected failure types
-- Shows which components fail most often in the demo fleet

SELECT
  dtc_code,
  dtc_description,
  severity,
  COUNT(*)                                                        AS occurrences,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)             AS percentage
FROM `vitalcar-tcc.vitalcar_analytics.dtc_events`
GROUP BY 1, 2, 3
ORDER BY 4 DESC
