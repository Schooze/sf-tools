import React, { useEffect, useState, useCallback } from 'react';
import {
  Home,
  Sliders,
  Activity,
  Wrench,
  ShieldAlert,
  Cpu,
  Terminal as TermIcon,
  Settings as SettingsIcon,
  Cable,
  Power,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { AppView } from '../../types';
import { SfLogo } from '../common/SfLogo';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, sidebarWidth, setSidebarWidth, isSidebarCollapsed } =
    useAppStore();

  const {
    isConnected,
    isConnecting,
    selectedPort,
    setSelectedPort,
    availablePorts,
    fetchPorts,
    connect,
    disconnect,
    deviceInfo,
  } = useConnectionStore();
  const { dirtyKeys } = useConfigStore();

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isDragging) {
        setSidebarWidth(mouseMoveEvent.clientX);
      }
    },
    [isDragging, setSidebarWidth],
  );

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isDragging, resize, stopResizing]);

  const navItems: { id: AppView; label: string; icon: LucideIcon; badge?: string | number }[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    {
      id: 'configuration',
      label: 'Motor Configuration',
      icon: Sliders,
      badge: dirtyKeys.size > 0 ? `${dirtyKeys.size}` : undefined,
    },
    { id: 'motion', label: 'Motion Control', icon: Activity },
    { id: 'telemetry', label: 'Realtime Telemetry', icon: Activity },
    { id: 'commissioning', label: 'Self Commissioning', icon: Wrench },
    { id: 'diagnostics', label: 'Diagnostics & Faults', icon: ShieldAlert },
    { id: 'firmware', label: 'Firmware Manager', icon: Cpu },
    { id: 'terminal', label: 'Terminal Console', icon: TermIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  if (isSidebarCollapsed) {
    return null;
  }

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative bg-sidebar border-r border-border flex flex-col justify-between flex-shrink-0 select-none text-xs font-sans h-full transition-[width] duration-0"
    >
      {/* Top Section */}
      <div className="p-3 space-y-4 overflow-y-auto flex-1">
        {/* Project / Controller Header Pill */}
        <div className="p-2.5 rounded-xl bg-surface/80 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <SfLogo size={24} />
              <div>
                <div className="font-medium text-white text-xs leading-tight">SF-Motion</div>
                <div className="text-[11px] text-sf-subtle">FOC Controller Studio</div>
              </div>
            </div>
            <button
              onClick={fetchPorts}
              title="Refresh Ports"
              className="p-1 rounded hover:bg-surface text-sf-subtle hover:text-white transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* Navigation List */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-sf-subtle">
            WORKSPACE
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-surface text-white font-medium shadow-sm border border-border'
                    : 'text-sf-muted hover:bg-surface-hover hover:text-sf-text'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon size={15} className={isActive ? 'text-blue-400' : 'text-sf-subtle'} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Connection Widget */}
      <div className="p-3 border-t border-border bg-surface/30 flex-shrink-0">
        <div className="space-y-2">
          {/* Connection Status Label */}
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse-subtle' : 'bg-zinc-600'}`}
              />
              <span className="text-sf-text font-medium truncate">
                {isConnected ? 'Device Connected' : 'Disconnected'}
              </span>
            </div>
            <span className="text-[10px] text-sf-subtle font-mono flex-shrink-0">
              {isConnected
                ? deviceInfo?.firmware_version
                  ? `FW v${deviceInfo.firmware_version}`
                  : 'Online'
                : 'Offline'}
            </span>
          </div>

          {/* Port Selector Dropdown */}
          <div className="flex items-center space-x-1.5">
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              disabled={isConnected}
              className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-sf-text focus:outline-none focus:border-blue-500 disabled:opacity-60 font-mono"
            >
              {availablePorts.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.is_virtual ? '(Simulator)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Connect / Disconnect Action Button */}
          <NodeSelector />
          {isConnected ? (
            <button
              onClick={disconnect}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors font-medium text-xs"
            >
              <Power size={13} />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition-colors text-xs disabled:opacity-50"
            >
              <Cable size={13} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Device'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Draggable Resizer Edge */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setSidebarWidth(256)}
        title="Drag to resize sidebar (Double click to reset)"
        className={`absolute top-0 -right-1 w-2.5 h-full cursor-col-resize z-40 transition-colors group flex items-center justify-center ${
          isDragging ? 'bg-blue-500/30' : 'hover:bg-blue-500/20'
        }`}
      >
        <div
          className={`w-[2px] h-full transition-colors ${
            isDragging
              ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
              : 'bg-transparent group-hover:bg-blue-400/80'
          }`}
        />
      </div>
    </aside>
  );
};

const NodeSelector: React.FC = () => {
  const { nodeId, setNodeId, busy, isConnecting, baudrate, setBaudrate, isConnected } =
    useConnectionStore();
  const [draft, setDraft] = useState(String(nodeId));
  useEffect(() => setDraft(String(nodeId)), [nodeId]);
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-2 text-sf-muted">
        <span>Node (0–255)</span>
        <input
          aria-label="Active node"
          type="number"
          min={0}
          max={255}
          step={1}
          value={draft}
          disabled={busy || isConnecting}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 bg-background border border-border rounded px-2 py-1 text-white"
        />
      </label>
      <button
        disabled={
          busy ||
          isConnecting ||
          draft === '' ||
          !Number.isInteger(Number(draft)) ||
          Number(draft) < 0 ||
          Number(draft) > 255 ||
          Number(draft) === nodeId
        }
        onClick={() => void setNodeId(Number(draft))}
        className="w-full py-1 text-blue-300 disabled:opacity-40"
      >
        Select node
      </button>
      <label className="flex items-center justify-between gap-2 text-sf-muted">
        <span>Baudrate</span>
        <select
          aria-label="Baudrate"
          value={baudrate}
          disabled={isConnected || isConnecting}
          onChange={(e) => setBaudrate(Number(e.target.value))}
          className="bg-background border border-border rounded px-1 py-1 text-white"
        >
          {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
