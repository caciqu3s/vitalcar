import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { useVehicleStore } from '../store/vehicleStore';

const FEATURE_LABELS: Record<string, string> = {
  'Type':                     'Vehicle Category',
  'Air temperature [K]':      'Intake Air Temperature',
  'Process temperature [K]':  'Engine Coolant Temperature',
  'Rotational speed [rpm]':   'Engine Speed (RPM)',
  'Torque [Nm]':              'Torque / Engine Load',
  'Tool wear [min]':          'Accumulated Wear (Mileage Proxy)',
  'temp_diff':                'Thermal Differential (ECT − IAT)',
  'power_proxy':              'Estimated Power (RPM × Torque)',
};

const MAX_BAR_WIDTH = 240; // px

export default function ExplainScreen() {
  const { latestResult } = useVehicleStore();

  if (!latestResult) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>
          Run a prediction first — enable Demo Mode on the Home screen.
        </Text>
      </View>
    );
  }

  const { top_factors, probability, recommendation } = latestResult;
  const maxAbs = Math.max(...top_factors.map((f) => Math.abs(f.impact)), 0.001);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Why this alert?</Text>
      <Text style={styles.subtitle}>
        Failure probability: {(probability * 100).toFixed(1)}%
      </Text>

      <Text style={styles.sectionLabel}>Top factors driving the prediction</Text>

      {top_factors.map((factor) => {
        const label      = FEATURE_LABELS[factor.feature] ?? factor.feature.replace(/_/g, ' ');
        const isPositive = factor.impact > 0;
        const barWidth   = (Math.abs(factor.impact) / maxAbs) * MAX_BAR_WIDTH;
        const barColor   = isPositive ? '#ef4444' : '#22c55e';

        return (
          <View key={factor.feature} style={styles.factorRow}>
            <Text style={styles.factorLabel}>{label}</Text>
            <View style={styles.barContainer}>
              <View style={[styles.bar, { width: barWidth, backgroundColor: barColor }]} />
              <Text style={[styles.barValue, { color: barColor }]}>
                {isPositive ? '+' : ''}{factor.impact.toFixed(4)}
              </Text>
            </View>
            <Text style={styles.factorExplain}>
              {isPositive
                ? `This reading is pushing the prediction toward failure.`
                : `This reading is pushing the prediction toward normal.`}
            </Text>
          </View>
        );
      })}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Increases failure risk</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>Decreases failure risk</Text>
        </View>
      </View>

      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationLabel}>RECOMMENDATION</Text>
        <Text style={styles.recommendationText}>{recommendation}</Text>
      </View>

      <Text style={styles.footnote}>
        Explainability powered by SHAP (SHapley Additive exPlanations).{'\n'}
        Vehicles with mechanical failures have up to 3× higher accident risk
        (Scaringella Traffic Institute, 2016).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flexGrow: 1, padding: 20, backgroundColor: '#f8fafc' },
  centered:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title:               { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  subtitle:            { fontSize: 14, color: '#64748b', marginBottom: 20 },
  sectionLabel:        { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase' },
  empty:               { color: '#64748b', textAlign: 'center', fontSize: 14 },
  factorRow:           { marginBottom: 20 },
  factorLabel:         { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  barContainer:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bar:                 { height: 16, borderRadius: 4 },
  barValue:            { fontSize: 13, fontWeight: '600' },
  factorExplain:       { fontSize: 12, color: '#64748b' },
  legend:              { flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 20 },
  legendItem:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:           { width: 10, height: 10, borderRadius: 5 },
  legendText:          { fontSize: 12, color: '#64748b' },
  recommendationBox:   {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  recommendationLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 4, fontWeight: '700', textTransform: 'uppercase' },
  recommendationText:  { fontSize: 14, color: '#f8fafc', lineHeight: 20 },
  footnote:            { fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});
