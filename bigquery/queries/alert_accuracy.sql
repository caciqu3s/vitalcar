-- Failure probability distribution at prediction time
-- Validates whether the model is well-calibrated and alert threshold is sensible

SELECT
  CASE
    WHEN probability < 0.10 THEN '0-10%  (Low)'
    WHEN probability < 0.30 THEN '10-30% (Moderate)'
    WHEN probability < 0.60 THEN '30-60% (High)'
    ELSE                         '60-100% (Critical)'
  END                              AS risk_band,
  COUNT(*)                         AS predictions,
  ROUND(AVG(probability) * 100, 2) AS avg_probability_pct,
  COUNTIF(prediction = 1)          AS model_predicted_failure,
  COUNT(*)                         AS total
FROM `vitalcar-tcc.vitalcar_analytics.model_predictions`
GROUP BY 1
ORDER BY 2 DESC
