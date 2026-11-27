import { SFBridge } from '../../lib/tauri-bridge';
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Home, 
  Sliders, 
  Activity, 
  Wrench, 
  ShieldAlert, 
  Cpu, 
  Terminal, 
  Settings, 
  Cable, 
  Power, 
  RotateCcw, 
  Save, 
  Download, 
  Upload,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { AppView } from '../../types';

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setCurrentView, addToast } = useAppStore();
  const { isConnected, connect, disconnect } = useConnectionStore();
  const { writeToDevice, readFromDevice, restoreDefaults, exportProfile } = useConfigStore();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global keybinding for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      } else if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const actions = [
    { id: 'nav_motion', title: 'Navigate to Motion Control', category: 'Navigation', icon: Activity, run: () => setCurrentView('motion') },
    {
      id: 'nav_overview',
      title: 'Navigate to Overview',
      category: 'Navigation',
      icon: Home,
      run: () => setCurrentView('overview'),
    },
    {
      id: 'nav_config',
      title: 'Navigate to Motor Configuration',
      category: 'Navigation',
      icon: Sliders,
      run: () => setCurrentView('configuration'),
    },
    {
      id: 'nav_telemetry',
      title: 'Navigate to Realtime Telemetry',
      category: 'Navigation',
      icon: Activity,
      run: () => setCurrentView('telemetry'),
    },
    {
      id: 'nav_commissioning',
      title: 'Navigate to Self Commissioning',
      category: 'Navigation',
      icon: Wrench,
      run: () => setCurrentView('commissioning'),
    },
    {
      id: 'nav_diagnostics',
      title: 'Navigate to Diagnostics & Faults',
      category: 'Navigation',
      icon: ShieldAlert,
      run: () => setCurrentView('diagnostics'),
    },
    {
      id: 'nav_firmware',
      title: 'Navigate to Firmware Manager',
      category: 'Navigation',
      icon: Cpu,
      run: () => setCurrentView('firmware'),
    },
    {
      id: 'nav_terminal',
      title: 'Navigate to Terminal Console',
      category: 'Navigation',
      icon: Terminal,
      run: () => setCurrentView('terminal'),
    },
    {
      id: 'nav_settings',
      title: 'Navigate to Settings',
      category: 'Navigation',
      icon: Settings,
      run: () => setCurrentView('settings'),
    },
    {
      id: 'toggle_conn',
      title: isConnected ? 'Disconnect Hardware Device' : 'Connect to Selected Device',
      category: 'Device',
      icon: isConnected ? Power : Cable,
      run: () => {
        if (isConnected) disconnect();
        else connect();
      },
    },
    {
      id: 'write_config',
      title: 'Write Configuration to Device',
      category: 'Configuration',
      icon: Save,
      run: () => writeToDevice(),
    },
    {
      id: 'read_config',
      title: 'Read Configuration from Device',
      category: 'Configuration',
      icon: RotateCcw,
      run: () => readFromDevice(),
    },
    {
      id: 'export_cfg',
      title: 'Export Configuration Profile (.sfconfig)',
      category: 'Profile',
      icon: Download,
      run: () => exportProfile(),
    },
    {
      id: 'restore_def',
      title: 'Restore Default Configuration',
      category: 'Configuration',
      icon: RotateCcw,
      run: () => restoreDefaults(),
    },
    {
      id: 'estop',
      title: 'Emergency Stop (Disable Active Node)',
      category: 'Safety',
      icon: AlertOctagon,
      run: async () => { try { await SFBridge.emergencyStop(); addToast('warning', 'E-STOP acknowledged', 'Motor disable and PVT stop acknowledged'); } catch (e) { addToast('error', 'E-STOP not confirmed', String(e)); } },
    },
  ];

  const filtered = actions.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (action: typeof actions[0]) => {
    action.run();
    setCommandPaletteOpen(false);
    setSearch('');
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24 px-4 select-none"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div 
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-sidebar/50">
          <Search size={16} className="text-sf-muted mr-3" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-sf-text placeholder-sf-subtle focus:outline-none font-sans"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-background rounded border border-border text-sf-subtle">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-sf-subtle">
              No matching commands found
            </div>
          ) : (
            filtered.map((action, idx) => {
              const Icon = action.icon;
              const isHighlighted = idx === selectedIndex;
              return (
                <button
                  key={action.id}
                  onClick={() => handleSelect(action)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isHighlighted ? 'bg-surface-hover text-white' : 'text-sf-muted hover:text-sf-text'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-1.5 rounded-lg ${isHighlighted ? 'bg-blue-600/20 text-blue-400' : 'bg-surface text-sf-subtle'}`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-sf-text">{action.title}</div>
                      <div className="text-[10px] text-sf-subtle">{action.category}</div>
                    </div>
                  </div>
                  {isHighlighted && <ArrowRight size={13} className="text-sf-subtle" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
