import axios from 'axios';

// Replace with Cloud Run URL after deploy (printed by terraform output cloudrun_url)
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://vitalcar-api-q42eksufca-uc.a.run.app';

export interface SensorReading {
  vehicle_id: string;
  session_id?: string;
  vehicle_type?: number;
  air_temp: number;
  process_temp: number;
  rpm: number;
  torque: number;
  tool_wear: number;
  speed_kmh?: number;
  fuel_trim?: number;
}

export interface TopFactor {
  feature: string;
  impact: number;
}

export interface PredictionResult {
  prediction: number;
  probability: number;
  health_score: number;
  status: string;
  alert: boolean;
  top_factors: TopFactor[];
  recommendation: string;
  model_version: string;
  shap_values: Record<string, number>;
}

export interface DTCInfo {
  code: string;
  found: boolean;
  description: string;
  system: string;
  severity: string;
  explanation: string;
  urgency: string;
}

export const api = {
  predict: async (sensors: SensorReading): Promise<PredictionResult> => {
    const { data } = await axios.post<PredictionResult>(`${API_BASE}/predict`, sensors, {
      timeout: 10_000,
    });
    return data;
  },

  getDTC: async (code: string, vehicleId?: string): Promise<DTCInfo> => {
    const params = vehicleId ? `?vehicle_id=${vehicleId}` : '';
    const { data } = await axios.get<DTCInfo>(`${API_BASE}/dtc/${code}${params}`, {
      timeout: 5_000,
    });
    return data;
  },

  health: async (): Promise<boolean> => {
    try {
      const { data } = await axios.get(`${API_BASE}/health`, { timeout: 3_000 });
      return data.status === 'ok';
    } catch {
      return false;
    }
  },
};
