import React from 'react';
import {
  View, Text, FlatList, StyleSheet,
} from 'react-native';
import { useVehicleStore } from '../store/vehicleStore';
import type { PredictionResult } from '../services/api';

function severityColor(prob: number): string {
  if (prob >= 0.60) return '#ef4444';
  if (prob >= 0.30) return '#f59e0b';
  return '#22c55e';
}

function AlertItem({ item }: { item: PredictionResult }) {
  const color = severityColor(item.probability);
  return (
    <View style={[styles.item, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemStatus, { color }]}>{item.status}</Text>
        <Text style={styles.itemProb}>{(item.probability * 100).toFixed(1)}% risk</Text>
      </View>
      <Text style={styles.itemRec}>{item.recommendation}</Text>
      {item.top_factors.length > 0 && (
        <Text style={styles.itemFactors}>
          Top factor: {item.top_factors[0].feature.replace(/_/g, ' ')}
        </Text>
      )}
    </View>
  );
}

export default function AlertsScreen() {
  const { alerts } = useVehicleStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alert History</Text>
      {alerts.length === 0 ? (
        <Text style={styles.empty}>No alerts yet — vehicle is operating normally.</Text>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <AlertItem item={item} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  title:       { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  empty:       { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 40 },
  item:        {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  itemHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemStatus:  { fontSize: 14, fontWeight: '700' },
  itemProb:    { fontSize: 13, color: '#64748b' },
  itemRec:     { fontSize: 13, color: '#334155', lineHeight: 18 },
  itemFactors: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
});
