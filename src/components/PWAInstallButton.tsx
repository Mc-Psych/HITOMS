import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { settingsService } from '../services/settingsService';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const cachedSettings = settingsService.getSettingsSync();
  const logo = cachedSettings?.hospitalLogo;

  // If already running as standalone PWA app
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-[11px] font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>PWA App Installed</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          id="pwa-install-sidebar-btn"
          onClick={handleInstallClick}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          title="Install HITOMS App for Offline Access"
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-white" />
            <span>Install App</span>
          </div>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md font-mono">Offline</span>
        </button>
      ) : (
        <button
          id="pwa-install-btn"
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm hover:shadow transition cursor-pointer"
          title="Install HITOMS as Desktop or Mobile App for Offline Access"
        >
          <Download className="w-3.5 h-3.5 text-white" />
          <span>Install App</span>
        </button>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-xs text-slate-800 dark:text-slate-200">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                {logo ? (
                  <img
                    src={logo}
                    alt="App Logo"
                    className="w-10 h-10 object-contain rounded-xl bg-white p-1 shadow-sm border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold">Install HITOMS App</h3>
                  <p className="text-[11px] text-slate-400">PWA Offline Asset & Ticket Management System</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Direct Tab Action (Best for iframe environments) */}
              <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2">
                <div className="flex items-center justify-between font-bold text-sky-900 dark:text-sky-200 text-xs">
                  <span>Option 1: Open in Dedicated Window</span>
                  <ExternalLink className="w-4 h-4 text-sky-500" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  PWAs install best directly from the browser address bar. Open HITOMS in a new browser tab to trigger the native browser <strong>Install</strong> prompt.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.open(window.location.href, '_blank');
                  }}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Full Browser Window to Install</span>
                </button>
              </div>

              {/* Browser Instructions */}
              <div className="space-y-3 pt-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  Option 2: Manual Browser Install Instructions
                </h4>

                {/* Chrome / Edge / Android */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    Chrome & Edge (Desktop & Android)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-3.5 leading-relaxed">
                    Look for the <strong>Install</strong> icon in the address bar (top right) or click the <strong>3-dots menu</strong> &rarr; select <strong>Save & Share / Install HITOMS</strong>.
                  </p>
                </div>

                {/* iOS Safari */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-sky-500" />
                    Safari (iPhone & iPad)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-3.5 leading-relaxed">
                    Tap the <strong>Share</strong> button (box with arrow) at bottom of screen &rarr; scroll down & select <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  Once installed, HITOMS operates fully standalone offline with local offline storage, auto-syncing, and background updates.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
