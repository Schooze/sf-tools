import { create } from 'zustand';
import type { MotorConfig } from '../types';
import { SFBridge } from '../lib/tauri-bridge';
import {
  DEFAULT_MOTOR_CONFIG,
  dirtyKeys,
  mergeApply,
  importProfile,
  download,
  validateConfig,
} from '../lib/config-model';
import { useAppStore } from './useAppStore';
import { useConnectionStore } from './useConnectionStore';
import { useTelemetryStore } from './useTelemetryStore';
interface ConfigStore {
  deviceConfig: MotorConfig;
  localConfig: MotorConfig;
  dirtyKeys: Set<string>;
  isLoading: boolean;
  isSaving: boolean;
  errors: Record<string, string>;
  loaded: boolean;
  updateParameter: (key: string, value: number) => void;
  loadConfig: (c: MotorConfig) => void;
  mergeFromDevice: (c: MotorConfig) => void;
  reset: () => void;
  readFromDevice: () => Promise<void>;
  writeToDevice: () => Promise<boolean>;
  saveToFlash: () => Promise<void>;
  discardChanges: () => void;
  restoreDefaults: () => Promise<void>;
  exportProfile: () => void;
  importProfile: (text: string) => boolean;
}
const toast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) =>
  useAppStore.getState().addToast(type, title, message);
export const useConfigStore = create<ConfigStore>((set, get) => ({
  deviceConfig: {},
  localConfig: { ...DEFAULT_MOTOR_CONFIG },
  dirtyKeys: new Set(),
  isLoading: false,
  isSaving: false,
  errors: {},
  loaded: false,
  updateParameter: (key, value) => {
    const localConfig = { ...get().localConfig, [key]: value };
    set({
      localConfig,
      dirtyKeys: dirtyKeys(localConfig, get().deviceConfig),
      errors: validateConfig(localConfig),
    });
  },
  loadConfig: (c) =>
    set({
      deviceConfig: { ...c },
      localConfig: { ...c },
      dirtyKeys: new Set(),
      errors: {},
      loaded: true,
    }),
  mergeFromDevice: (c) => {
    const previous = get();
    const localConfig = { ...c };
    for (const k of previous.dirtyKeys) localConfig[k] = previous.localConfig[k];
    set({
      deviceConfig: { ...c },
      localConfig,
      dirtyKeys: dirtyKeys(localConfig, c),
      loaded: true,
    });
  },
  reset: () =>
    set({
      deviceConfig: {},
      localConfig: { ...DEFAULT_MOTOR_CONFIG },
      dirtyKeys: new Set(),
      errors: {},
      loaded: false,
    }),
  readFromDevice: async () => {
    set({ isLoading: true });
    try {
      get().loadConfig(await SFBridge.readConfig());
    } catch (e) {
      toast('error', 'Read failed', String(e));
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },
  writeToDevice: async () => {
    const { localConfig, dirtyKeys: keys } = get();
    const errors = validateConfig(localConfig);
    if (Object.keys(errors).length) {
      set({ errors });
      toast('error', 'Invalid configuration', 'Correct highlighted values');
      return false;
    }
    const patch = Object.fromEntries([...keys].map((k) => [k, localConfig[k]]));
    if (!keys.size) return true;
    set({ isSaving: true });
    try {
      const result = await SFBridge.writeConfig(patch);
      set({
        ...mergeApply(get().localConfig, get().deviceConfig, result, patch),
        errors: result.failed,
      });
      const count = Object.keys(result.failed).length;
      toast(
        count ? 'warning' : 'success',
        count ? 'Apply partially failed' : 'Applied and verified',
        count
          ? Object.entries(result.failed)
              .map(([k, v]) => k + ': ' + v)
              .join('; ')
          : 'Changes are active or staged as indicated. Save to flash separately.',
      );
      return count === 0;
    } catch (e) {
      toast('error', 'Apply failed', String(e));
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
  saveToFlash: async () => {
    if (get().dirtyKeys.size) {
      toast('warning', 'Apply changes first');
      return;
    }
    set({ isSaving: true });
    try {
      get().loadConfig(await SFBridge.saveConfig());
      toast(
        'success',
        'Flash save acknowledged',
        'Stored parameters require restart where indicated.',
      );
    } catch (e) {
      toast('error', 'Save failed', String(e));
    } finally {
      set({ isSaving: false });
    }
  },
  discardChanges: () => {
    const c = get().deviceConfig;
    set({ localConfig: { ...c }, dirtyKeys: new Set(), errors: {} });
  },
  restoreDefaults: async () => {
    set({ isSaving: true });
    try {
      const result = await SFBridge.restoreDefaults();
      get().loadConfig(result.config);
      useConnectionStore.setState({ nodeId: result.info.node_id, deviceInfo: result.info });
      toast(
        'success',
        'Firmware defaults restored',
        'Active node is now 0. Save to flash separately.',
      );
      useTelemetryStore.getState().clearHistory();
      await useTelemetryStore.getState().syncChannels();
    } catch (e) {
      toast('error', 'Restore failed', String(e));
    } finally {
      set({ isSaving: false });
    }
  },
  exportProfile: () =>
    download(
      'sf-profile.sfconfig',
      JSON.stringify({ format: 2, firmware: '0.3.0', parameters: get().localConfig }, null, 2),
      'application/json',
    ),
  importProfile: (text) => {
    try {
      const { parameters, warnings } = importProfile(
        text,
        get().loaded ? get().deviceConfig : DEFAULT_MOTOR_CONFIG,
      );
      set({
        localConfig: parameters,
        dirtyKeys: dirtyKeys(parameters, get().deviceConfig),
        errors: {},
      });
      toast(
        warnings.length ? 'warning' : 'success',
        'Profile imported',
        warnings.join('; ') || 'Review and Apply to device',
      );
      return true;
    } catch (e) {
      toast('error', 'Import failed', String(e));
      return false;
    }
  },
}));
