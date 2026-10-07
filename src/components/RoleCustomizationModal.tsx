import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Edit3,
  Lock,
  Unlock,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
} from 'lucide-react';
import type { Role, User, SystemSettings } from '../types';
import { ROLE_DESCRIPTIONS, authService } from '../services/authService';
import { settingsService } from '../services/settingsService';
import { auditService } from '../services/auditService';

interface RoleCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  systemSettings?: SystemSettings | null;
  onSaved?: () => void;
}

const ALL_SYSTEM_ROLES: Role[] = [
  'SUPER_ADMIN',
  'IT_ADMIN',
  'IT_OFFICER',
  'HOSPITAL_MANAGEMENT',
  'DEPARTMENT_HEAD',
  'STAFF_USER',
  'PROCUREMENT_OFFICER',
  'AUDITOR',
];

export const RoleCustomizationModal: React.FC<RoleCustomizationModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  systemSettings,
  onSaved,
}) => {
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [frozenRoles, setFrozenRoles] = useState<Role[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const prevOpenRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const existingCustom = systemSettings?.customRoleTitles || {};
      const initialTitles: Record<string, string> = {};
      ALL_SYSTEM_ROLES.forEach((role) => {
        initialTitles[role] = existingCustom[role] || ROLE_DESCRIPTIONS[role]?.title || role;
      });
      setCustomTitles(initialTitles);
      setFrozenRoles(systemSettings?.frozenRoles || []);
      setSuccessMsg(null);
      setErrorMsg(null);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, systemSettings]);

  if (!isOpen) return null;

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const handleTitleChange = (role: Role, value: string) => {
    setCustomTitles((prev) => ({
      ...prev,
      [role]: value,
    }));
  };

  const handleToggleFreeze = (role: Role) => {
    if (role === 'SUPER_ADMIN') return; // Cannot freeze Super Admin
    setFrozenRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleResetRole = (role: Role) => {
    setCustomTitles((prev) => ({
      ...prev,
      [role]: ROLE_DESCRIPTIONS[role]?.title || role,
    }));
    setFrozenRoles((prev) => prev.filter((r) => r !== role));
  };

  const handleResetAllDefaults = () => {
    const defaults: Record<string, string> = {};
    ALL_SYSTEM_ROLES.forEach((role) => {
      defaults[role] = ROLE_DESCRIPTIONS[role]?.title || role;
    });
    setCustomTitles(defaults);
    setFrozenRoles([]);
  };

  const handleSave = async () => {
    if (!currentUser || !isSuperAdmin) {
      setErrorMsg('Access Denied: Only Super Administrator can modify and freeze user roles.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Build updated custom titles map (only keep titles that differ or are explicitly set)
      const updatedCustomTitles: Partial<Record<Role, string>> = {};
      ALL_SYSTEM_ROLES.forEach((role) => {
        const val = customTitles[role]?.trim();
        if (val) {
          updatedCustomTitles[role] = val;
        }
      });

      const updated = await settingsService.updateSettings(
        {
          customRoleTitles: updatedCustomTitles,
          frozenRoles,
        },
        currentUser
      );

      await auditService.logAction(
        'MODIFY_ROLE_SETTINGS',
        'RBAC Role Management',
        'system_roles',
        null,
        `Super Admin updated role display titles and frozen roles list (${frozenRoles.length} frozen).`
      );

      setSuccessMsg('Role display titles and frozen roles saved successfully!');

      if (onSaved) {
        onSaved();
      }

      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('[RoleCustomizationModal] Error saving role configurations:', err);
      setErrorMsg(err?.message || 'Failed to update role settings.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Super Admin Role Management & Customization</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rename front-end display titles and freeze user roles to control visibility for IT Admins.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Info Banner */}
          <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                Front-End Customization & Security Freezing:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 opacity-90 text-[11px]">
                <li>
                  <strong>Renaming:</strong> Updates display labels in the UI (e.g., <em>Procurement & Inventory Officer</em> &rarr; <em>PROCUMENT OFFICER</em>). Backend role keys remain intact in the database.
                </li>
                <li>
                  <strong>Freezing:</strong> Marks a role as frozen. Frozen roles will <strong>NOT appear</strong> in the role selection dropdown when IT Admins add or provision staff accounts.
                </li>
              </ul>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Role List */}
          <div className="space-y-3">
            {ALL_SYSTEM_ROLES.map((role) => {
              const isFrozen = frozenRoles.includes(role);
              const isSuper = role === 'SUPER_ADMIN';

              return (
                <div
                  key={role}
                  className={`p-4 rounded-xl border transition ${
                    isFrozen
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Role Information & Database Key */}
                    <div className="space-y-1 min-w-[200px] flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          DB Key: {role}
                        </span>

                        {isFrozen && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>FROZEN FOR IT ADMINS</span>
                          </span>
                        )}

                        {isSuper && (
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                            SYSTEM PROTECTED
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {ROLE_DESCRIPTIONS[role]?.description}
                      </p>
                    </div>

                    {/* Actions: Title Edit & Freeze Toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleResetRole(role)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Reset role title & unfreeze to default"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Freeze Button */}
                      <button
                        type="button"
                        disabled={isSuper}
                        onClick={() => handleToggleFreeze(role)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border ${
                          isSuper
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            : isFrozen
                            ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-700 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                        title={
                          isSuper
                            ? 'Super Admin role cannot be frozen'
                            : isFrozen
                            ? 'Click to Unfreeze role (Restore visibility for IT Admins)'
                            : 'Click to Freeze role (Hide from IT Admins when adding users)'
                        }
                      >
                        {isFrozen ? (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Unfreeze Role</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Freeze Role</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Input for Display Title */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Front-End Display Title:
                    </label>
                    <input
                      type="text"
                      value={customTitles[role] || ''}
                      onChange={(e) => handleTitleChange(role, e.target.value)}
                      placeholder={ROLE_DESCRIPTIONS[role]?.title}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetAllDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Configurations'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
