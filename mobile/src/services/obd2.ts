/**
 * OBD2 Bluetooth service for ELM327 adapters.
 *
 * Uses react-native-ble-plx to scan, connect, and send AT/OBD2 commands.
 * All numeric results are converted to SI units before being returned
 * so the rest of the app never has to deal with raw hex strings.
 */

import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// Standard ELM327 service / characteristic UUIDs (SPP over BLE)
const ELM327_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const ELM327_TX_UUID      = '0000fff1-0000-1000-8000-00805f9b34fb';
const ELM327_RX_UUID      = '0000fff2-0000-1000-8000-00805f9b34fb';

let manager: BleManager | null = null;
let connectedDevice: Device | null = null;

function getManager(): BleManager {
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}

/** Scan and return the first ELM327 device found (times out after timeoutMs). */
export function scanForDevice(timeoutMs = 10_000): Promise<Device> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      getManager().stopDeviceScan();
      reject(new Error('OBD2 device not found within timeout'));
    }, timeoutMs);

    getManager().startDeviceScan(null, null, (error, device) => {
      if (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }
      if (device?.name?.toUpperCase().includes('OBD') || device?.name?.toUpperCase().includes('ELM')) {
        clearTimeout(timer);
        getManager().stopDeviceScan();
        resolve(device);
      }
    });
  });
}

/** Connect to a device and initialise the ELM327 adapter. */
export async function connectToDevice(device: Device): Promise<void> {
  connectedDevice = await device.connect();
  await connectedDevice.discoverAllServicesAndCharacteristics();
  await sendCommand('ATZ');      // reset
  await sendCommand('ATE0');     // echo off
  await sendCommand('ATL0');     // linefeeds off
  await sendCommand('ATSP0');    // auto-detect protocol
}

/** Send a raw AT/OBD2 command and return the trimmed response string. */
async function sendCommand(cmd: string): Promise<string> {
  if (!connectedDevice) throw new Error('Not connected to OBD2 device');

  const encoded = Buffer.from(`${cmd}\r`).toString('base64');
  await connectedDevice.writeCharacteristicWithResponseForService(
    ELM327_SERVICE_UUID, ELM327_TX_UUID, encoded,
  );

  // Wait for response on RX characteristic (simple polling approach)
  await new Promise((r) => setTimeout(r, 300));
  const char: Characteristic = await connectedDevice.readCharacteristicForService(
    ELM327_SERVICE_UUID, ELM327_RX_UUID,
  );
  return Buffer.from(char.value ?? '', 'base64').toString('ascii').trim();
}

/** Read a single OBD2 PID and return the raw hex value string. */
async function readPID(mode: string, pid: string): Promise<string> {
  const response = await sendCommand(`${mode}${pid}`);
  // Response format: "41 XX YY ZZ >" — strip mode/PID bytes
  const parts = response.replace(/[^0-9A-Fa-f ]/g, '').trim().split(/\s+/);
  return parts.slice(2).join('');
}

export interface OBD2Reading {
  rpm: number;
  process_temp: number;  // engine coolant temp in Kelvin
  air_temp: number;      // intake air temp in Kelvin
  torque: number;        // engine load as proxy (%)
  speed_kmh: number;
  fuel_trim: number;
}

/** Read the full set of sensor values needed by the ML model. */
export async function readSensors(): Promise<OBD2Reading> {
  const [rpmHex, ectHex, iatHex, loadHex, speedHex, ftHex] = await Promise.all([
    readPID('01', '0C'),  // Engine RPM
    readPID('01', '05'),  // Engine Coolant Temp
    readPID('01', '0F'),  // Intake Air Temp
    readPID('01', '04'),  // Engine Load
    readPID('01', '0D'),  // Vehicle Speed
    readPID('01', '07'),  // Short-term Fuel Trim
  ]);

  const A = (hex: string) => parseInt(hex.slice(0, 2), 16);
  const B = (hex: string) => parseInt(hex.slice(2, 4), 16);

  const rpm       = ((A(rpmHex) * 256) + B(rpmHex)) / 4;
  const ect_c     = A(ectHex) - 40;
  const iat_c     = A(iatHex) - 40;
  const load_pct  = (A(loadHex) / 255) * 100;
  const speed_kmh = A(speedHex);
  const fuel_trim = ((A(ftHex) - 128) / 128) * 100;

  return {
    rpm,
    process_temp: ect_c + 273.15,  // °C → K
    air_temp:     iat_c + 273.15,  // °C → K
    torque:       load_pct,        // use load % as torque proxy
    speed_kmh,
    fuel_trim,
  };
}

/** Read active DTC codes (mode 03). Returns array of code strings like "P0300". */
export async function readDTCCodes(): Promise<string[]> {
  const response = await sendCommand('03');
  if (!response || response.includes('NO DATA')) return [];

  const hex = response.replace(/[^0-9A-Fa-f ]/g, '').trim().split(/\s+/);
  const codes: string[] = [];

  for (let i = 0; i < hex.length - 1; i += 2) {
    const b1 = parseInt(hex[i],     16);
    const b2 = parseInt(hex[i + 1], 16);
    if (b1 === 0 && b2 === 0) continue;

    const prefix = ['P', 'C', 'B', 'U'][(b1 >> 6) & 0x03];
    const digits = (((b1 & 0x3F) << 8) | b2).toString(16).toUpperCase().padStart(4, '0');
    codes.push(`${prefix}${digits}`);
  }

  return codes;
}

export function disconnect(): void {
  connectedDevice?.cancelConnection();
  connectedDevice = null;
}
