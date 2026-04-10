import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useVehicleStore } from '../store/vehicleStore';

interface SensorRow {
  label: string;
  key: string;
  unit: string;
  digits: number;
  warn?: (v: number) => boolean;
}

const SENSORS: SensorRow[] = [
  { label: 'Engine RPM',          key: 'rpm',          unit: 'rpm', digits: 0, warn: (v) => v > 6000 || v < 600 },
  { label: 'Engine Temp',         key: 'process_temp', unit: 'K',   digits: 1, warn: (v) => v > 373 },
  { label: 'Air Temp (Intake)',   key: 'air_temp',     unit: 'K',   digits: 1 },
  { label: 'Engine Load/Torque',  key: 'torque',       unit: 'Nm',  digits: 1, warn: (v) => v > 70 },
  { label: 'Vehicle Speed',       key: 'speed_kmh',    unit: 'km/h',digits: 0 },
  { label: 'Fuel Trim',           key: 'fuel_trim',    unit: '%',   digits: 1 },
  { label: 'Accumulated Wear',    key: 'tool_wear',    unit: 'min', digits: 0, warn: (v) => v > 200 },
];

export default function SensorsScreen() {
  const { latestResult } = useVehicleStore();

  // Reconstruct a mock sensor object from shap_values and latest result
  // In production these would come directly from OBD2 readings
  const shap = latestResult?.shap_values ?? {};
  const health = latestResult?.health_score;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Live Sensor Readings</Text>

      {!latestResult ? (
        <Text style={styles.empty}>
          No data yet — enable Demo Mode on the Home screen or connect an OBD2 adapter.
        </Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Health Score</Text>
            <Text style={[styles.cardValue, { color: health! >= 80 ? '#22c55e' : health! >= 50 ? '#f59e0b' : '#ef4444' }]}>
              {health?.toFixed(1)} / 100
            </Text>
          </View>

          <Text style={styles.sectionTitle}>SHAP Feature Contributions</Text>
          {Object.entries(shap).map(([feature, value]) => (
            <View key={feature} style={styles.row}>
              <Text style={styles.rowLabel}>{feature.replace(/_/g, ' ')}</Text>
              <Text style={[styles.rowValue, { color: value > 0 ? '#ef4444' : '#22c55e' }]}>
                {value > 0 ? '+' : ''}{(value as number).toFixed(4)}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, padding: 20, backgroundColor: '#f8fafc' },
  title:        { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  empty:        { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 40 },
  card:         {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardLabel:    { fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  cardValue:    { fontSize: 28, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  row:          {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 6,
  },
  rowLabel:     { fontSize: 14, color: '#334155', flex: 1 },
  rowValue:     { fontSize: 14, fontWeight: '600' },
});
