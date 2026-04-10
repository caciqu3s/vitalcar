// Demo mode — essential for capstone presentation without physical OBD2 hardware

import type { SensorReading } from './api';

interface DemoScenario {
  label: string;
  readings: Omit<SensorReading, 'vehicle_id' | 'session_id' | 'vehicle_type'>[];
}

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  healthy: {
    label: 'Healthy Vehicle',
    readings: [
      { rpm: 1500, process_temp: 308, air_temp: 298, torque: 35, tool_wear: 80 },
      { rpm: 2000, process_temp: 309, air_temp: 298, torque: 42, tool_wear: 80 },
      { rpm: 1800, process_temp: 308, air_temp: 298, torque: 38, tool_wear: 81 },
    ],
  },
  degrading: {
    label: 'Degrading Vehicle',
    readings: [
      { rpm: 1400, process_temp: 311, air_temp: 298, torque: 55, tool_wear: 190 },
      { rpm: 1300, process_temp: 313, air_temp: 298, torque: 60, tool_wear: 191 },
      { rpm: 1200, process_temp: 315, air_temp: 298, torque: 65, tool_wear: 192 },
    ],
  },
  critical: {
    label: 'Imminent Failure',
    readings: [
      { rpm: 1100, process_temp: 318, air_temp: 298, torque: 72, tool_wear: 230 },
    ],
  },
};

const indices: Record<string, number> = {};

export function getDemoReading(
  scenario: keyof typeof DEMO_SCENARIOS,
): Omit<SensorReading, 'vehicle_id' | 'session_id' | 'vehicle_type'> {
  const readings = DEMO_SCENARIOS[scenario].readings;
  const idx = (indices[scenario] ?? 0) % readings.length;
  indices[scenario] = idx + 1;
  return { ...readings[idx] };
}

export function resetDemo(): void {
  Object.keys(indices).forEach((k) => {
    indices[k] = 0;
  });
}

export const DEMO_DTC_CODES = ['P0217', 'P0300', 'P0420', 'P0442', 'P0171'];
