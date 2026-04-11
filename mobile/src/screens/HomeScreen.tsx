import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useVehicleStore, type DemoScenario } from '../store/vehicleStore';
import { api } from '../services/api';
import { getDemoReading, DEMO_SCENARIOS } from '../services/demo';

const POLL_INTERVAL_MS = 5_000;

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';  // green
  if (score >= 50) return '#f59e0b';  // amber
  return '#ef4444';                   // red
}

export default function HomeScreen() {
  const {
    isDemoMode, demoScenario, vehicleId,
    latestResult, isLoading, lastError,
    setDemoMode, setDemoScenario, setResult, setLoading, setError,
  } = useVehicleStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const score  = latestResult?.health_score ?? 100;
  const color  = scoreColor(score);
  const status = latestResult?.status ?? 'CONNECTING…';

  async function poll() {
    if (!isDemoMode) return; // real OBD2 polling handled by obd2.ts flow
    setLoading(true);
    try {
      const raw = getDemoReading(demoScenario);
      const result = await api.predict({
        vehicle_id:   vehicleId,
        vehicle_type: 1,
        air_temp:     raw.air_temp,
        process_temp: raw.process_temp,
        rpm:          raw.rpm,
        torque:       raw.torque,
        tool_wear:    raw.tool_wear,
      });
      setResult(result);
      if (result.alert) {
        Alert.alert(
          'Vehicle Alert',
          result.recommendation,
          [{ text: 'OK' }],
        );
      }
    } catch (e: any) {
      setError(e?.message ?? 'API error');
    }
  }

  useEffect(() => {
    if (isDemoMode) {
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDemoMode, demoScenario]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Vehicle Health</Text>

      {/* Circular health gauge */}
      <View style={[styles.gauge, { borderColor: color }]}>
        <Text style={[styles.scoreText, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.scoreLabel}>/ 100</Text>
      </View>

      <Text style={[styles.statusText, { color }]}>{status}</Text>

      {lastError && (
        <Text style={styles.errorText}>Error: {lastError}</Text>
      )}

      {isLoading && <ActivityIndicator color="#3b82f6" style={{ marginTop: 8 }} />}

      {latestResult && (
        <Text style={styles.recommendation}>
          {latestResult.recommendation}
        </Text>
      )}

      {/* Demo mode toggle */}
      <View style={styles.demoRow}>
        <Text style={styles.demoLabel}>Demo Mode</Text>
        <Switch
          value={isDemoMode}
          onValueChange={(v) => setDemoMode(v, 'healthy')}
          trackColor={{ true: '#3b82f6' }}
        />
      </View>

      {isDemoMode && (
        <View style={styles.scenarioRow}>
          {(Object.keys(DEMO_SCENARIOS) as Array<keyof typeof DEMO_SCENARIOS>).map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.scenarioBtn,
                demoScenario === key && styles.scenarioBtnActive,
              ]}
              onPress={() => setDemoScenario(key as DemoScenario)}
            >
              <Text style={styles.scenarioBtnText}>
                {DEMO_SCENARIOS[key].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title:          { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 24 },
  gauge:          {
    width: 180, height: 180, borderRadius: 90, borderWidth: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  scoreText:      { fontSize: 56, fontWeight: '800' },
  scoreLabel:     { fontSize: 16, color: '#64748b' },
  statusText:     { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  recommendation: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  errorText:      { color: '#ef4444', fontSize: 13, marginTop: 8 },
  demoRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 12 },
  demoLabel:      { fontSize: 15, color: '#334155' },
  scenarioRow:    { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  scenarioBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  scenarioBtnActive: { backgroundColor: '#3b82f6' },
  scenarioBtnText:   { fontSize: 13, color: '#1e293b' },
});
