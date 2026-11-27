import { create } from 'zustand';
import type { PlotterSignalInfo, TelemetrySample } from '../types';
import { REGISTERS, download } from '../lib/config-model';
import { SFBridge } from '../lib/tauri-bridge';
import { useAppStore } from './useAppStore';
const colors = [
  '#38bdf8',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#eab308',
  '#a855f7',
  '#14b8a6',
  '#f97316',
];
export const AVAILABLE_SIGNALS: PlotterSignalInfo[] = REGISTERS.filter(
  (r) => r.streaming && r.address !== 92,
).map((r, i) => ({
  id: r.name,
  name: r.name.replaceAll('_', ' '),
  unit: r.unit,
  color: colors[i % colors.length],
  code: r.address,
}));
interface TelemetryStore {
  isStreaming: boolean;
  isPaused: boolean;
  activeSignalIds: string[];
  history: TelemetrySample[];
  latestSample: TelemetrySample | null;
  fps: number;
  isRecording: boolean;
  recordedData: TelemetrySample[];
  changing: boolean;
  toggleSignal: (id: string) => Promise<void>;
  setSignalActive: (id: string, active: boolean) => Promise<void>;
  setPaused: (paused: boolean) => void;
  clearHistory: () => void;
  startStreaming: () => Promise<void>;
  stopStreaming: (remote?: boolean) => Promise<void>;
  syncChannels: () => Promise<void>;
  pushSample: (sample: TelemetrySample) => void;
  startRecording: () => void;
  stopRecording: () => void;
  exportCSV: () => void;
}
let timer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;
let lastTime = Date.now();
let frames = 0;
export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  isStreaming: false,
  isPaused: false,
  activeSignalIds: ['actual_rpm', 'rpm_ref', 'iq', 'id', 'v_bus'],
  history: [],
  latestSample: null,
  fps: 0,
  isRecording: false,
  recordedData: [],
  changing: false,
  toggleSignal: async (id) => get().setSignalActive(id, !get().activeSignalIds.includes(id)),
  setSignalActive: async (id, active) => {
    if (get().changing) return;
    const old = get().activeSignalIds;
    if (active && old.length >= 10) {
      useAppStore.getState().addToast('warning', 'Maximum 10 channels');
      return;
    }
    if (!AVAILABLE_SIGNALS.some((s) => s.id === id)) return;
    const next = active ? [...new Set([...old, id])] : old.filter((s) => s !== id);
    set({ changing: true });
    try {
      if (get().isStreaming)
        await SFBridge.setTelemetryChannels(
          AVAILABLE_SIGNALS.filter((s) => next.includes(s.id)).map((s) => s.code),
        );
      set({ activeSignalIds: next, history: [], latestSample: null });
    } catch (e) {
      useAppStore.getState().addToast('error', 'Channel update failed', String(e));
    } finally {
      set({ changing: false });
    }
  },
  syncChannels: async () => {
    await SFBridge.setTelemetryChannels(
      AVAILABLE_SIGNALS.filter((s) => get().activeSignalIds.includes(s.id)).map((s) => s.code),
    );
  },
  setPaused: (isPaused) => set({ isPaused }),
  clearHistory: () =>
    set({ history: [], latestSample: null, recordedData: [], isRecording: false, fps: 0 }),
  startStreaming: async () => {
    if (get().isStreaming) return;
    await get().syncChannels();
    set({ isStreaming: true });
    const token = ++generation;
    const poll = async () => {
      if (token !== generation || !get().isStreaming) return;
      try {
        const sample = await SFBridge.getTelemetrySample();
        if (
          token === generation &&
          sample.timestamp_ms &&
          sample.timestamp_ms !== get().latestSample?.timestamp_ms
        )
          get().pushSample(sample);
      } catch (e) {
        if (token === generation) {
          set({ isStreaming: false });
          useAppStore.getState().addToast('error', 'Telemetry unavailable', String(e));
        }
        return;
      }
      if (token === generation) timer = setTimeout(poll, 16);
    };
    void poll();
  },
  stopStreaming: async (remote = true) => {
    ++generation;
    if (timer) clearTimeout(timer);
    timer = null;
    const was = get().isStreaming;
    set({ isStreaming: false, isRecording: false });
    if (was && remote) {
      try {
        await SFBridge.setTelemetryChannels([]);
      } catch (e) {
        useAppStore.getState().addToast('error', 'Stream stop failed', String(e));
      }
    }
  },
  pushSample: (sample) => {
    frames++;
    const now = Date.now();
    if (now - lastTime >= 1000) {
      set({ fps: frames });
      frames = 0;
      lastTime = now;
    }
    const state = get();
    set({
      latestSample: sample,
      history: state.isPaused ? state.history : [...state.history.slice(-4999), sample],
      recordedData: state.isRecording ? [...state.recordedData, sample] : state.recordedData,
    });
  },
  startRecording: () => set({ isRecording: true, recordedData: [] }),
  stopRecording: () => {
    set({ isRecording: false });
    get().exportCSV();
  },
  exportCSV: () => {
    const samples = get().recordedData.length ? get().recordedData : get().history;
    if (!samples.length) {
      useAppStore.getState().addToast('info', 'No telemetry to export');
      return;
    }
    const ids = [...new Set(samples.flatMap((s) => Object.keys(s.values)))];
    const rows = samples.map((s) =>
      [
        s.timestamp_ms,
        s.node_id,
        ...ids.map((id) =>
          s.timestamp_ms - (s.updated_ms[id] ?? 0) <= 1000 ? (s.values[id] ?? '') : '',
        ),
      ].join(','),
    );
    download(
      'sf-telemetry-' + Date.now() + '.csv',
      ['timestamp_ms,node_id,' + ids.join(','), ...rows].join('\n'),
      'text/csv',
    );
  },
}));
