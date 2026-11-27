import { create } from 'zustand';
import type { Diagnostics } from '../types';
import { SFBridge } from '../lib/tauri-bridge';
import { useConnectionStore } from './useConnectionStore';
import { useAppStore } from './useAppStore';
export const useDeviceStore = create<{
  diagnostics: Diagnostics | null;
  refresh: () => Promise<void>;
}>((set) => ({
  diagnostics: null,
  refresh: async () => {
    try {
      const d = await SFBridge.getDiagnostics();
      set({ diagnostics: d });
      if (useConnectionStore.getState().isConnected && !d.connected)
        useConnectionStore.getState().connectionLost(d.error ?? 'Transport closed');
    } catch (e) {
      if (useConnectionStore.getState().isConnected)
        useConnectionStore.getState().connectionLost(String(e));
    }
  },
}));
export async function runDeviceAction<T>(
  title: string,
  action: () => Promise<T>,
  success?: string,
): Promise<T | undefined> {
  const c = useConnectionStore.getState();
  if (!c.isConnected) {
    useAppStore.getState().addToast('error', 'Connect a device first');
    return;
  }
  if (c.busy) {
    useAppStore.getState().addToast('warning', 'Another device operation is running');
    return;
  }
  useConnectionStore.setState({ busy: true });
  try {
    const result = await action();
    if (success) useAppStore.getState().addToast('success', title, success);
    return result;
  } catch (e) {
    useAppStore.getState().addToast('error', title, String(e));
    return;
  } finally {
    useConnectionStore.setState({ busy: false });
    void useDeviceStore.getState().refresh();
  }
}
