import { create } from 'zustand';
import type { PredictionResult, DTCInfo } from '../services/api';

export type DemoScenario = 'healthy' | 'degrading' | 'critical';

interface VehicleState {
  // Connection
  isConnected: boolean;
  isDemoMode: boolean;
  demoScenario: DemoScenario;
  vehicleId: string;

  // Latest prediction
  latestResult: PredictionResult | null;
  isLoading: boolean;
  lastError: string | null;

  // Alert history
  alerts: PredictionResult[];

  // DTC codes
  dtcCodes: DTCInfo[];

  // Actions
  setConnected: (v: boolean) => void;
  setDemoMode: (v: boolean, scenario?: DemoScenario) => void;
  setDemoScenario: (s: DemoScenario) => void;
  setResult: (result: PredictionResult) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  addDTC: (dtc: DTCInfo) => void;
  clearDTCs: () => void;
}

export const useVehicleStore = create<VehicleState>((set) => ({
  isConnected: false,
  isDemoMode:  false,
  demoScenario: 'healthy',
  vehicleId:   'demo-vehicle-001',

  latestResult: null,
  isLoading:    false,
  lastError:    null,

  alerts:   [],
  dtcCodes: [],

  setConnected:   (v) => set({ isConnected: v }),
  setDemoMode:    (v, scenario) =>
    set({ isDemoMode: v, demoScenario: scenario ?? 'healthy' }),
  setDemoScenario: (s) => set({ demoScenario: s }),

  setResult: (result) =>
    set((state) => ({
      latestResult: result,
      isLoading:    false,
      lastError:    null,
      alerts:       result.alert
        ? [result, ...state.alerts].slice(0, 50)  // keep last 50
        : state.alerts,
    })),

  setLoading: (v) => set({ isLoading: v }),
  setError:   (msg) => set({ lastError: msg, isLoading: false }),

  addDTC:    (dtc)  => set((state) => ({ dtcCodes: [dtc, ...state.dtcCodes] })),
  clearDTCs: ()     => set({ dtcCodes: [] }),
}));
