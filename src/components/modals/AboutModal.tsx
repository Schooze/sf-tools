import { APP_VERSION } from '../../lib/app-version';
import React from 'react';
import { X, Heart } from 'lucide-react';
import { SfLogo } from '../common/SfLogo';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-surface-raised border border-border/90 rounded-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-sidebar/50">
          <div className="flex items-center space-x-3">
            <SfLogo size={28} />
            <div>
              <h3 className="text-sm font-semibold text-white">About SF-Tools</h3>
              <p className="text-[11px] text-sf-muted">Motor Control & Robotics Telemetry Suite</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-sf-muted hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-sf-text">
          <div className="p-3.5 rounded-lg bg-surface border border-border space-y-2">
            <div className="flex justify-between items-center text-sf-subtle">
              <span>Application Version:</span>
              <span className="font-mono text-white bg-surface-raised px-2 py-0.5 rounded border border-border">
                v{APP_VERSION}
              </span>
            </div>
            <div className="flex justify-between items-center text-sf-subtle">
              <span>Framework Engine:</span>
              <span className="text-white font-medium">Tauri 2 (Rust Core + React 18)</span>
            </div>
            <div className="flex justify-between items-center text-sf-subtle">
              <span>Firmware Compatibility:</span>
              <span className="text-emerald-400 font-mono">SF-Motion 0.3.0</span>
            </div>
            <div className="flex justify-between items-center text-sf-subtle">
              <span>Design System:</span>
              <span className="text-sf-muted">Codex Dark Contrast</span>
            </div>
          </div>

          <div className="space-y-1.5 text-sf-muted text-[11px] leading-relaxed">
            <p>
              SF-Tools is a high-performance desktop suite designed for field-oriented control (FOC)
              motor configuration, 60 FPS live oscilloscope plotting, self-commissioning parameter
              estimation, and real-time hardware diagnostics.
            </p>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-sf-subtle">
            <span className="flex items-center space-x-1">
              <span>Built with</span>
              <Heart size={12} className="text-rose-500 fill-rose-500 inline" />
              <span>for SF-Motion</span>
            </span>
            <span className="text-sf-muted">Register protocol · 0xA5A5</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border bg-sidebar/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-hover text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
