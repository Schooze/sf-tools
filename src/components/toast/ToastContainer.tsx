import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />,
          error: <AlertCircle size={16} className="text-red-400 flex-shrink-0" />,
          warning: <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />,
          info: <Info size={16} className="text-blue-400 flex-shrink-0" />,
        };

        const borderStyles = {
          success: 'border-emerald-500/30',
          error: 'border-red-500/30',
          warning: 'border-amber-500/30',
          info: 'border-blue-500/30',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3 rounded-xl bg-surface/95 backdrop-blur-md border ${borderStyles[toast.type]} shadow-xl flex items-start justify-between space-x-3 text-xs animate-in slide-in-from-bottom-2 duration-150`}
          >
            <div className="flex items-start space-x-2.5">
              <div className="mt-0.5">{icons[toast.type]}</div>
              <div className="space-y-0.5">
                <div className="font-medium text-sf-text text-xs leading-tight">{toast.title}</div>
                {toast.message && (
                  <div className="text-[11px] text-sf-subtle leading-relaxed">{toast.message}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-sf-subtle hover:text-white transition-colors p-0.5"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
