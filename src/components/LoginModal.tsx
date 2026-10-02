import React, { useState, useEffect } from 'react';
import { LogIn, Lock, User, AlertCircle, CheckCircle2, X, Building2, Server, Shield, RefreshCw } from 'lucide-react';
import { type User as UserType, type SystemSettings } from '../types';
import { authService, extractSurname, getDefaultPasswordForSurname } from '../services/authService';
import { settingsService } from '../services/settingsService';
import { syncLatestStaffAccounts } from '../services/seedData';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserType, mustChangePassword: boolean) => void;
  allUsers: UserType[];
  systemSettings?: SystemSettings | null;
  allowClose?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  allUsers,
  systemSettings,
  allowClose = true,
}) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingStaff, setIsRefreshingStaff] = useState(false);
  const [selectedStaffPreset, setSelectedStaffPreset] = useState<UserType | null>(null);

  // Auto-sync staff accounts when login modal opens disabled to prevent Firestore daily write/read quota exhaustion and warnings on login page
  useEffect(() => {
    // Background staff sync is disabled to preserve Firestore daily free tier limit
  }, [isOpen]);

  const handleManualSyncStaff = async () => {
    // Background manual sync disabled
  };

  // Dynamically sync facility settings so Login Page ALWAYS matches the facility details
  const [activeSettings, setActiveSettings] = useState<SystemSettings>(() => {
    return systemSettings || settingsService.getSettingsSync();
  });

  useEffect(() => {
    if (systemSettings) {
      setActiveSettings(systemSettings);
    } else {
      settingsService.getSettings().then((s) => {
        if (s) setActiveSettings(s);
      });
    }
  }, [systemSettings]);

  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SystemSettings>;
      if (customEvent.detail) {
        setActiveSettings(customEvent.detail);
      }
    };
    window.addEventListener('hitoms_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('hitoms_settings_updated', handleSettingsUpdated);
  }, []);

  const facilityName = activeSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital';
  const facilityLogo = activeSettings?.hospitalLogo;
  const facilityRegion = activeSettings?.regionOrDistrict;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowClose) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Auto-sync on startup has been removed to avoid Firestore free-quota exhaustion and console warnings
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allowClose, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { user, mustChangePassword } = await authService.loginWithCredentials(
        usernameOrEmail,
        password
      );
      onLoginSuccess(user, mustChangePassword);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (u: UserType) => {
    setSelectedStaffPreset(u);
    const surname = extractSurname(u.fullName);
    setUsernameOrEmail(u.username || surname.toLowerCase());
    setPassword(getDefaultPasswordForSurname(surname));
    setError(null);
  };

  return (
    <div
      id="login-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={() => {
        if (allowClose) onClose();
      }}
    >
      <div
        id="login-modal-card"
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-xs text-slate-800 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-sky-700 to-indigo-800 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {facilityLogo ? (
              <img
                src={facilityLogo}
                alt="Hospital Logo"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg backdrop-blur-xs border border-white/20">
                {(systemSettings?.systemName || 'HITOMS')[0]}
              </div>
            )}
            <div>
              <h2 className="font-extrabold text-base tracking-tight">
                {facilityName}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-sky-200 mt-0.5">
                <Server className="w-3 h-3 text-emerald-300" />
                <span className="font-mono">Local {systemSettings?.systemName || 'HITOMS'} Terminal Login</span>
                <span>•</span>
                <span>{facilityRegion ? `${facilityRegion} LAN` : 'Offline LAN Mode'}</span>
              </div>
            </div>
          </div>
          {allowClose && (
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Surname / Username or Hospital Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Mensah, Owusu, or admin@hospital.local"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>
             
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="Initial password: last 4 letters of your surname"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>
              
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Authenticating Local Terminal...' : 'Sign In to Hospital Terminal'}</span>
              </button>
            </div>
          </form>

          {/* Quick Staff Selection Tray for Instant Testing & Verification */}
          {!activeSettings?.disableDemoLogin ? (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  Quick Terminal Profiles (Click to prefill & sign in)
                </span>
                {selectedStaffPreset && (
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold animate-pulse">
                    Selected: Click "Sign In" below
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {[...allUsers]
                  .sort((a, b) => {
                    if (a.role === 'SUPER_ADMIN') return -1;
                    if (b.role === 'SUPER_ADMIN') return 1;
                    if (a.role === 'IT_ADMIN') return -1;
                    if (b.role === 'IT_ADMIN') return 1;
                    return 0;
                  })
                  .slice(0, 9)
                  .map((u) => {
                    const surname = extractSurname(u.fullName);
                    const defaultPass = getDefaultPasswordForSurname(surname);
                    const isSuper = u.role === 'SUPER_ADMIN';
                    const isIT = u.role === 'IT_ADMIN' || u.role === 'IT_OFFICER';
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectPreset(u)}
                        className={`p-2.5 text-left rounded-xl border transition cursor-pointer relative ${
                          selectedStaffPreset?.id === u.id
                            ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                            : isSuper
                            ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 hover:border-indigo-400'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-bold text-slate-900 dark:text-white truncate">{u.fullName}</div>
                          {isSuper && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-500 text-white shrink-0">
                              Full Access
                            </span>
                          )}
                          {isIT && !isSuper && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-sky-500 text-white shrink-0">
                              IT Unit
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {isSuper ? 'Can Add Depts, Users & Assets' : u.role.replace('_', ' ')}
                        </div>
                        <div className="text-[9px] font-mono text-sky-600 dark:text-sky-400 mt-1 flex items-center justify-between">
                          <span>User: {u.username || surname.toLowerCase()}</span>
                          <span>Pass: {defaultPass}</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Quick demo login disabled by Super Administrator</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">Security Active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
