import React, { useEffect, useRef } from 'react';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useDeviceStore } from '../stores/useDeviceStore';
import { MotionView } from '../features/motion/MotionView';
import { installExternalLinks } from '../lib/external-links';
import { Titlebar } from '../components/titlebar/Titlebar';
import { Sidebar } from '../components/sidebar/Sidebar';
import { BottomDock } from '../components/bottomdock/BottomDock';
import { CommandPalette } from '../components/command-palette/CommandPalette';
import { ToastContainer } from '../components/toast/ToastContainer';
import { useAppStore } from '../stores/useAppStore';

import { OverviewView } from '../features/overview/OverviewView';
import { ConfigView } from '../features/configuration/ConfigView';
import { TelemetryView } from '../features/telemetry/TelemetryView';
import { CommissioningView } from '../features/commissioning/CommissioningView';
import { DiagnosticsView } from '../features/diagnostics/DiagnosticsView';
import { FirmwareView } from '../features/firmware/FirmwareView';
import { TerminalView } from '../features/terminal/TerminalView';
import { SettingsView } from '../features/settings/SettingsView';

export const App: React.FC = () => {
  const { currentView } = useAppStore();
  const isConnected = useConnectionStore(s => s.isConnected);
  const lastEvent = useRef(0);
  useEffect(installExternalLinks, []);
  useEffect(() => {
    if (!isConnected) { lastEvent.current = 0; return; }
    let alive = true;
    const poll = async () => {
      await useDeviceStore.getState().refresh();
      if (!alive) return;
      const node = useConnectionStore.getState().nodeId;
      for (const e of useDeviceStore.getState().diagnostics?.events ?? []) {
        if (e.sequence > lastEvent.current && e.node_id === node && e.code >= 2) useAppStore.getState().addToast('error', 'Device protection event', e.name);
        lastEvent.current = Math.max(lastEvent.current, e.sequence);
      }
    };
    void poll(); const timer = setInterval(() => void poll(), 500);
    return () => { alive = false; clearInterval(timer); };
  }, [isConnected]);

  const renderActiveView = () => {
    switch (currentView) {
      case 'overview':
        return <OverviewView />;
      case 'configuration':
        return <ConfigView />;
      case 'motion':
        return <MotionView />;
      case 'telemetry':
        return <TelemetryView />;
      case 'commissioning':
        return <CommissioningView />;
      case 'diagnostics':
        return <DiagnosticsView />;
      case 'firmware':
        return <FirmwareView />;
      case 'terminal':
        return <TerminalView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-sf-text font-sans overflow-hidden select-none">
      {/* Top Custom Titlebar */}
      <Titlebar />

      {/* Main App Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Center Workspace Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-background">
          <div className="flex-1 overflow-hidden relative">
            {renderActiveView()}
          </div>

          {/* Floating Bottom Action Dock */}
          <BottomDock />
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette />

      {/* Toast Notification Container */}
      <ToastContainer />
    </div>
  );
};

export default App;
