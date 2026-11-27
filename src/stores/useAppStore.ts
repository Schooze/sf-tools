import { create } from 'zustand';
import { AppView, ToastMessage } from '../types';

interface AppStore {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  removeToast: (id: string) => void;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'overview',
  setCurrentView: (view) => set({ currentView: view }),
  isSidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  sidebarWidth: 256,
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(480, width)) }),
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toasts: [],
  addToast: (type, title, message) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, type, title, message, timestamp: Date.now() };
    set((s) => ({ toasts: [...s.toasts, newToast] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  developerMode: true,
  setDeveloperMode: (enabled) => set({ developerMode: enabled }),
}));
