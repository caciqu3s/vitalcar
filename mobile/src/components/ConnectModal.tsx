import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, PermissionsAndroid,
} from 'react-native';
import {
  scanForDevice, connectToDevice, subscribeDisconnect, disconnect, cancelScan,
} from '../services/obd2';
import {
  setDisconnectSubscription, removeDisconnectSubscription,
} from '../services/bleSession';
import { useVehicleStore } from '../store/vehicleStore';

interface ConnectModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ConnectModal({ visible, onClose }: ConnectModalProps) {
  const {
    bleStatus, connectedDeviceName, bleError,
    setConnected, setBleStatus, setConnectedDeviceName, setBleError,
  } = useVehicleStore();

  async function handleConnect() {
    // Android 12+ requires runtime permission request before scanning
    if (Platform.OS === 'android') {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const allGranted = Object.values(grants).every(
        (g) => g === PermissionsAndroid.RESULTS.GRANTED,
      );
      if (!allGranted) {
        setBleStatus('error');
        setBleError('Bluetooth permissions required. Please allow in Settings.');
        return;
      }
    }

    setBleStatus('scanning');
    setBleError(null);
    try {
      const device = await scanForDevice(12_000);
      setBleStatus('connecting');
      setConnectedDeviceName(device.name ?? 'OBD2 Adapter');
      await connectToDevice(device);

      // Wire disconnect event BEFORE declaring success
      const sub = subscribeDisconnect(device.id, (err) => {
        removeDisconnectSubscription();
        setConnected(false);
        setBleStatus('idle');
        setConnectedDeviceName(null);
        if (err) setBleError('Adapter disconnected: ' + err.message);
      });
      setDisconnectSubscription(sub);

      setConnected(true);
      setBleStatus('connected');
    } catch (e: any) {
      setBleStatus('error');
      setBleError(e?.message ?? 'Connection failed');
    }
  }

  function handleDisconnect() {
    // Remove subscription BEFORE cancelConnection to suppress spurious callback
    removeDisconnectSubscription();
    disconnect();
    setConnected(false);
    setBleStatus('idle');
    setConnectedDeviceName(null);
    setBleError(null);
    onClose();
  }

  function handleCancel() {
    if (bleStatus === 'scanning') cancelScan();
    else if (bleStatus === 'connecting') disconnect();
    setBleStatus('idle');
    setBleError(null);
    setConnectedDeviceName(null);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>OBD2 Adapter</Text>

          {bleStatus === 'idle' && (
            <>
              <Text style={styles.hint}>
                Make sure your ELM327 Bluetooth adapter is plugged into the OBD2 port.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleConnect}>
                <Text style={styles.primaryBtnText}>Scan for Adapter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={handleCancel}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {(bleStatus === 'scanning' || bleStatus === 'connecting') && (
            <>
              <ActivityIndicator size="large" color="#3b82f6" style={{ marginBottom: 16 }} />
              <Text style={styles.statusText}>
                {bleStatus === 'scanning'
                  ? 'Scanning for OBD2 adapter…'
                  : `Connecting to ${connectedDeviceName ?? 'adapter'}…`}
              </Text>
              <TouchableOpacity style={styles.ghostBtn} onPress={handleCancel}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {bleStatus === 'connected' && (
            <>
              <View style={styles.connectedRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.deviceName}>
                  {connectedDeviceName ?? 'OBD2 Adapter'}
                </Text>
              </View>
              <Text style={styles.hint}>Vehicle data is being read every 5 seconds.</Text>
              <TouchableOpacity style={styles.dangerBtn} onPress={handleDisconnect}>
                <Text style={styles.dangerBtnText}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
                <Text style={styles.ghostBtnText}>Close</Text>
              </TouchableOpacity>
            </>
          )}

          {bleStatus === 'error' && (
            <>
              <Text style={styles.errorText}>{bleError ?? 'Unknown error'}</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => { setBleStatus('idle'); setBleError(null); }}
              >
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={handleCancel}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet:        {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 28, paddingBottom: 44, alignItems: 'center',
  },
  title:        { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  hint:         { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  statusText:   { fontSize: 15, color: '#334155', marginBottom: 24, textAlign: 'center' },
  errorText:    { fontSize: 14, color: '#ef4444', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dotGreen:     { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e' },
  deviceName:   { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  primaryBtn:   {
    backgroundColor: '#3b82f6', borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14, width: '100%',
    alignItems: 'center', marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dangerBtn:    {
    backgroundColor: '#fee2e2', borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14, width: '100%',
    alignItems: 'center', marginBottom: 10,
  },
  dangerBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  ghostBtn:     {
    paddingVertical: 12, width: '100%', alignItems: 'center',
  },
  ghostBtnText: { color: '#64748b', fontSize: 14 },
});
