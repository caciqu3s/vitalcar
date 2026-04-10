import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView,
} from 'react-native';
import { api } from '../services/api';
import { DEMO_DTC_CODES } from '../services/demo';
import { useVehicleStore } from '../store/vehicleStore';
import type { DTCInfo } from '../services/api';

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:    '#ef4444',
  MEDIUM:  '#f59e0b',
  LOW:     '#22c55e',
  UNKNOWN: '#94a3b8',
};

export default function DTCScreen() {
  const { vehicleId, addDTC } = useVehicleStore();
  const [code, setCode]       = useState('');
  const [result, setResult]   = useState<DTCInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function lookup(dtcCode: string) {
    const c = dtcCode.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError(null);
    try {
      const info = await api.getDTC(c, vehicleId);
      setResult(info);
      if (info.found) addDTC(info);
    } catch (e: any) {
      setError(e?.message ?? 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  const severityColor = result ? (SEVERITY_COLORS[result.severity] ?? '#94a3b8') : '#94a3b8';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Fault Code Reader</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. P0300"
          placeholderTextColor="#94a3b8"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity style={styles.btn} onPress={() => lookup(code)}>
          <Text style={styles.btnText}>Look up</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.demoHint}>Demo codes:</Text>
      <View style={styles.demoRow}>
        {DEMO_DTC_CODES.map((c) => (
          <TouchableOpacity
            key={c}
            style={styles.demoChip}
            onPress={() => { setCode(c); lookup(c); }}
          >
            <Text style={styles.demoChipText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color="#3b82f6" style={{ marginTop: 24 }} />}
      {error   && <Text style={styles.errorText}>{error}</Text>}

      {result && !loading && (
        <View style={[styles.card, { borderTopColor: severityColor, borderTopWidth: 4 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.codeText}>{result.code}</Text>
            <View style={[styles.badge, { backgroundColor: severityColor }]}>
              <Text style={styles.badgeText}>{result.severity}</Text>
            </View>
          </View>

          <Text style={styles.description}>{result.description}</Text>
          <Text style={styles.system}>System: {result.system}</Text>

          <Text style={styles.sectionLabel}>What it means</Text>
          <Text style={styles.bodyText}>{result.explanation}</Text>

          <Text style={styles.sectionLabel}>What to do</Text>
          <Text style={[styles.bodyText, { fontWeight: '600' }]}>{result.urgency}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flexGrow: 1, padding: 20, backgroundColor: '#f8fafc' },
  title:       { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  inputRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:       {
    flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    padding: 12, fontSize: 16, backgroundColor: '#fff', color: '#1e293b',
  },
  btn:         { backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  demoHint:    { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  demoRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  demoChip:    { backgroundColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  demoChipText:{ fontSize: 12, color: '#334155', fontWeight: '600' },
  errorText:   { color: '#ef4444', marginTop: 8 },
  card:        {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codeText:    { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  badge:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  description: { fontSize: 15, color: '#334155', marginBottom: 8 },
  system:      { fontSize: 13, color: '#64748b', marginBottom: 16 },
  sectionLabel:{ fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' },
  bodyText:    { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 14 },
});
