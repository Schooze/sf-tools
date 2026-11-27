import React, { useState, useRef, useEffect } from 'react';
import { SFBridge } from '../../lib/tauri-bridge';
import { invoke } from '@tauri-apps/api/core';
import {
  Search,
  Minus,
  Square,
  X,
  Cpu,
  FileText,
  FolderOpen,
  Save,
  Download,
  Power,
  RotateCcw,
  UploadCloud,
  RefreshCw,
  Trash2,
  LayoutDashboard,
  Sliders,
  Activity,
  Wrench,
  AlertTriangle,
  Flame,
  Terminal,
  Settings,
  PanelLeft,
  Command,
  Octagon,
  CheckCircle,
  HelpCircle,
  BookOpen,
  Info,
} from 'lucide-react';
import { AppView } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { AboutModal } from '../modals/AboutModal';
import { ProtocolModal } from '../modals/ProtocolModal';
import { SfLogo } from '../common/SfLogo';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const Titlebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    setCommandPaletteOpen,
    isSidebarCollapsed,
    toggleSidebar,
    addToast,
  } = useAppStore();

  const {
    isConnected,
    deviceInfo,
    selectedPort,
    connect,
    disconnect,
    fetchPorts,
  } = useConnectionStore();

  const {
    dirtyKeys,
    discardChanges,
    writeToDevice,
    restoreDefaults,
    exportProfile,
    importProfile,
  } = useConfigStore();

  const { exportCSV } = useTelemetryStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [protocolModalOpen, setProtocolModalOpen] = useState(false);

  const menuBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Window control commands
  const handleMinimize = async () => {
    if (isTauri) {
      try {
        await invoke('window_minimize');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleMaximize = async () => {
    if (isTauri) {
      try {
        await invoke('window_toggle_maximize');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      try {
        await invoke('window_close');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleTitlebarMouseDown = async (e: React.MouseEvent) => {
    // Only primary mouse button (left click)
    if (e.button !== 0) return;

    // Do not initiate window drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [data-no-drag]')) {
      return;
    }

    // Double-click to maximize / restore
    if (e.detail === 2) {
      await handleMaximize();
      return;
    }

    if (isTauri) {
      try {
        await invoke('window_start_dragging');
      } catch (err) {
        console.error('Window drag failed:', err);
      }
    }
  };

  // Actions
  const handleNewProfile = () => {
    restoreDefaults();
    setActiveMenu(null);
  };

  const handleOpenProfile = () => {
    setActiveMenu(null);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        importProfile(content);
      } catch (err) {
        addToast('error', 'Import Failed', 'Failed to parse configuration file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveProfile = () => {
    exportProfile();
    setActiveMenu(null);
  };

  const handleExportTelemetryCsv = () => {
    exportCSV();
    setActiveMenu(null);

  };

  const handleRevertChanges = () => {
    discardChanges();
    setActiveMenu(null);
  };

  const handleWriteChanges = async () => {
    setActiveMenu(null);
    await writeToDevice();
  };

  const handleResetDefaults = () => {
    restoreDefaults();
    setActiveMenu(null);
  };

  const handleClearTerminal = () => {
    setActiveMenu(null);
    setCurrentView('terminal');
    window.dispatchEvent(new Event('sf-tools-clear-terminal'));
  };

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    setActiveMenu(null);
  };

  const handleToggleSidebar = () => {
    toggleSidebar();
    setActiveMenu(null);
  };

  const handleEmergencyStop = async () => {
    setActiveMenu(null);
    try { await SFBridge.emergencyStop(); addToast('warning', 'E-STOP acknowledged', 'Motor disable and PVT stop acknowledged'); }
    catch (e) { addToast('error', 'E-STOP not confirmed', String(e)); }
  };

  const handleScanPorts = async () => {
    setActiveMenu(null);
    await fetchPorts();
    addToast('info', 'Ports Refreshed', 'Rescanned all hardware COM ports');
  };

  const handleToggleConnection = async () => {
    setActiveMenu(null);
    if (isConnected) {
      await disconnect();
    } else {
      await connect();
    }
  };

  const handleReboot = async () => {
    setActiveMenu(null);
    try { const response = await SFBridge.executeTerminal('reboot'); addToast('warning', 'Reset sent', response); }
    catch (e) { addToast('error', 'Reset failed', String(e)); }
  };

  const menus = ['File', 'Edit', 'View', 'Tools', 'Help'];

  return (
    <>
      <header
        data-tauri-drag-region
        onMouseDown={handleTitlebarMouseDown}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('button, input, select, textarea, a, [data-no-drag]')) {
            handleMaximize();
          }
        }}
        className="h-10 bg-sidebar border-b border-border flex items-center justify-between px-3 select-none text-xs text-sf-muted font-sans z-50 flex-shrink-0 relative cursor-default"
      >
        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.sfconfig"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Left: App Logo, Title, Menu items */}
        <div className="flex items-center space-x-3 flex-shrink-0" data-tauri-drag-region>
          <div className="flex items-center space-x-2 text-sf-text font-medium" data-tauri-drag-region>
            <SfLogo size={20} />
            <span className="tracking-tight text-white font-semibold">SF-Tools</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-sf-subtle font-mono">v0.1</span>
          </div>

          {/* Interactive Codex-style menus */}
          <div ref={menuBarRef} className="hidden md:flex items-center space-x-1 pl-2 relative">
            {menus.map((m) => (
              <div key={m} className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === m ? null : m)}
                  onMouseEnter={() => {
                    if (activeMenu !== null) setActiveMenu(m);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeMenu === m
                      ? 'bg-surface text-white shadow-sm'
                      : 'text-sf-muted hover:text-sf-text hover:bg-surface-hover'
                  }`}
                >
                  {m}
                </button>

                {/* Dropdown Menu Popover */}
                {activeMenu === m && (
                  <div className="absolute left-0 top-full mt-1.5 w-60 bg-surface-raised/95 backdrop-blur-md border border-border/90 rounded-xl shadow-2xl py-1.5 z-[100] text-xs animate-fade-in divide-y divide-border/50">
                    {/* FILE MENU */}
                    {m === 'File' && (
                      <>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={handleNewProfile}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <FileText size={14} className="text-sf-muted" />
                              <span>New Profile</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+N</span>
                          </button>
                          <button
                            onClick={handleOpenProfile}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <FolderOpen size={14} className="text-sf-muted" />
                              <span>Open Profile (.sfconfig)</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+O</span>
                          </button>
                          <button
                            onClick={handleSaveProfile}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Save size={14} className="text-sf-muted" />
                              <span>Save Profile (.sfconfig)</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+S</span>
                          </button>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={handleExportTelemetryCsv}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Download size={14} className="text-emerald-400" />
                              <span>Export Telemetry CSV</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+Shift+E</span>
                          </button>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={handleClose}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-300 text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Power size={14} className="text-rose-400" />
                              <span>Exit Application</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Alt+F4</span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* EDIT MENU */}
                    {m === 'Edit' && (
                      <>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={handleRevertChanges}
                            disabled={dirtyKeys.size === 0}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              dirtyKeys.size === 0
                                ? 'opacity-40 cursor-not-allowed text-sf-muted'
                                : 'hover:bg-blue-600/20 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <RotateCcw size={14} className="text-sf-muted" />
                              <span>Revert Unsaved Changes</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+Z</span>
                          </button>
                          <button
                            onClick={handleWriteChanges}
                            disabled={dirtyKeys.size === 0}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              dirtyKeys.size === 0
                                ? 'opacity-40 cursor-not-allowed text-sf-muted'
                                : 'hover:bg-blue-600/20 hover:text-white text-blue-400 font-medium'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <UploadCloud size={14} />
                              <span>Apply to Device to Motor</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+Enter</span>
                          </button>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={handleResetDefaults}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 hover:text-amber-300 text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <RefreshCw size={14} className="text-amber-400" />
                              <span>Reset to Factory Defaults</span>
                            </span>
                          </button>
                          <button
                            onClick={handleClearTerminal}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Trash2 size={14} className="text-sf-muted" />
                              <span>Clear Terminal History</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+L</span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* VIEW MENU */}
                    {m === 'View' && (
                      <>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={() => handleNavigate('overview')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'overview'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <LayoutDashboard size={14} />
                              <span>Overview Dashboard</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+1</span>
                          </button>
                          <button
                            onClick={() => handleNavigate('configuration')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'configuration'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <Sliders size={14} />
                              <span>Motor Configuration</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+2</span>
                          </button>
                          <button
                            onClick={() => handleNavigate('telemetry')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'telemetry'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <Activity size={14} />
                              <span>Live Oscilloscope</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+3</span>
                          </button>
                          <button
                            onClick={() => handleNavigate('commissioning')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'commissioning'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <Wrench size={14} />
                              <span>Self-Commissioning</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+4</span>
                          </button>
                          <button
                            onClick={() => handleNavigate('diagnostics')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'diagnostics'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <AlertTriangle size={14} />
                              <span>Diagnostics & Faults</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+5</span>
                          </button>
                          <button
                            onClick={() => handleNavigate('firmware')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'firmware'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <Flame size={14} />
                              <span>Firmware Manager</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+6</span>
                          </button>
                          <button
                            onClick={() => handleNavigate('terminal')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'terminal'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <Terminal size={14} />
                              <span>Terminal Console</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+7</span>
                          </button>
                          <button
                            onClick={() => handleNavigate('settings')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                              currentView === 'settings'
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'hover:bg-blue-600/15 hover:text-white text-sf-text'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              <Settings size={14} />
                              <span>Preferences</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+,</span>
                          </button>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={handleToggleSidebar}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <PanelLeft size={14} className="text-sf-muted" />
                              <span>{isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+B</span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* TOOLS MENU */}
                    {m === 'Tools' && (
                      <>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={() => {
                              setActiveMenu(null);
                              setCommandPaletteOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Command size={14} className="text-blue-400" />
                              <span>Command Palette</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+K</span>
                          </button>
                          <button
                            onClick={handleEmergencyStop}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-600/25 text-rose-400 font-semibold transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Octagon size={14} className="fill-rose-500/20" />
                              <span>E-STOP (Emergency Stop)</span>
                            </span>
                            <span className="text-[10px] font-mono bg-rose-950/60 border border-rose-800/60 px-1 rounded text-rose-300">
                              Ctrl+Shift+X
                            </span>
                          </button>
                          <button
                            onClick={() => handleNavigate('diagnostics')}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-emerald-600/20 hover:text-white text-emerald-400 transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <CheckCircle size={14} />
                              <span>View Protection Events</span>
                            </span>
                          </button>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={handleScanPorts}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <RefreshCw size={14} className="text-sf-muted" />
                              <span>Rescan Serial Ports</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">F5</span>
                          </button>
                          <button
                            onClick={handleToggleConnection}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Power size={14} className={isConnected ? 'text-rose-400' : 'text-emerald-400'} />
                              <span>{isConnected ? 'Disconnect Device' : 'Connect Device'}</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+Shift+C</span>
                          </button>
                          <button
                            onClick={handleReboot}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 hover:text-amber-300 text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <RotateCcw size={14} className="text-amber-400" />
                              <span>Reboot Controller MCU</span>
                            </span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* HELP MENU */}
                    {m === 'Help' && (
                      <>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={() => {
                              setActiveMenu(null);
                              setProtocolModalOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <BookOpen size={14} className="text-blue-400" />
                              <span>SF-Motion Protocol Docs</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">F1</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenu(null);
                              setCommandPaletteOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <HelpCircle size={14} className="text-sf-muted" />
                              <span>Command Palette & Keys</span>
                            </span>
                            <span className="text-[10px] font-mono text-sf-subtle">Ctrl+K</span>
                          </button>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={() => {
                              setActiveMenu(null);
                              setAboutModalOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-white text-sf-text transition-colors"
                          >
                            <span className="flex items-center space-x-2">
                              <Info size={14} className="text-sf-muted" />
                              <span>About SF-Tools</span>
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Left Drag Spacer (Wide grab area for dragging window) */}
        <div data-tauri-drag-region className="flex-1 h-full min-w-[24px]" />

        {/* Center: Search / Command Palette Bar */}
        <div className="w-80 sm:w-96 flex-shrink-0" data-no-drag>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-borderHover hover:bg-surface-hover text-sf-subtle text-xs transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Search size={13} className="text-sf-muted" />
              <span className="truncate">Search parameters, actions, commands...</span>
            </div>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-background rounded border border-border text-sf-muted">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right Drag Spacer (Wide grab area for dragging window) */}
        <div data-tauri-drag-region className="flex-1 h-full min-w-[24px]" />

        {/* Right: Device indicator & Window Controls */}
        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center space-x-2 pr-2 border-r border-border">
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-surface border border-border text-[11px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse-subtle' : 'bg-zinc-500'
                }`}
              />
              <span className="text-sf-text font-medium">
                {isConnected ? deviceInfo?.name || 'SF Controller' : 'No Device'}
              </span>
              <span className="text-sf-subtle font-mono text-[10px]">({selectedPort})</span>
            </div>
          </div>

          {/* Window controls */}
          <div className="flex items-center">
            <button
              onClick={handleMinimize}
              className="w-8 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-sf-muted hover:text-white transition-colors"
              title="Minimize"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={handleMaximize}
              className="w-8 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-sf-muted hover:text-white transition-colors"
              title="Maximize"
            >
              <Square size={11} />
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-500/80 text-sf-muted hover:text-white transition-colors"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Modals */}
      <AboutModal isOpen={aboutModalOpen} onClose={() => setAboutModalOpen(false)} />
      <ProtocolModal isOpen={protocolModalOpen} onClose={() => setProtocolModalOpen(false)} />
    </>
  );
};
