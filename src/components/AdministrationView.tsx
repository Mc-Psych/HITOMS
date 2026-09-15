import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Building2,
  Upload,
  Image as ImageIcon,
  Save,
  CheckCircle2,
  Lock,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Bed,
  Server,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  type User as UserType,
  type OfflineSecurityPolicy,
  type SystemSettings,
} from '../types';
import { authService } from '../services/authService';
import { settingsService, DEFAULT_SYSTEM_SETTINGS } from '../services/settingsService';

interface AdministrationViewProps {
  currentUser: UserType | null;
  allUsers: UserType[];
  onUserSwitch: (user: UserType) => void;
  onRefresh: () => void;
}

export const AdministrationView: React.FC<AdministrationViewProps> = ({
  currentUser,
  allUsers,
  onUserSwitch,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'FACILITY' | 'RBAC' | 'SECURITY_POLICIES'>('FACILITY');
  const [offlinePolicy, setOfflinePolicy] = useState<OfflineSecurityPolicy>(authService.getOfflinePolicy());
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveFacilitySuccess, setSaveFacilitySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const loadSettings = async () => {
      const data = await settingsService.getSettings();
      setSettings(data);
      if (data.hospitalLogo) {
        setLogoPreview(data.hospitalLogo);
      }
    };
    loadSettings();
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    // Limit to 2MB for storage performance in IndexedDB
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 2MB limit. Please choose a smaller logo.');
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setSettings((prev) => ({ ...prev, hospitalLogo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview('');
    setSettings((prev) => ({ ...prev, hospitalLogo: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMessage(null);

    try {
      await settingsService.updateSettings(settings, currentUser);
      setSaveFacilitySuccess(true);
      setTimeout(() => setSaveFacilitySuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save facility settings.');
    }
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    authService.setOfflinePolicy(offlinePolicy);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" />
            <span>Hospital Administration & System Settings</span>
          </h1>
          <p className="text-xs text-slate-500">
            Configure hospital facility details, upload facility logo, manage offline security policies, and inspect staff RBAC.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('FACILITY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'FACILITY'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Facility & Logo</span>
          </button>
          <button
            onClick={() => setActiveTab('RBAC')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'RBAC'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Staff & Roles</span>
          </button>
          <button
            onClick={() => setActiveTab('SECURITY_POLICIES')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'SECURITY_POLICIES'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Offline Policies</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: FACILITY & LOGO CONFIGURATION */}
      {activeTab === 'FACILITY' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-600" />
                  <span>Hospital Facility Information & Custom Logo</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update facility name, contact extensions, and upload the official hospital logo shown in headers and printable reports.
                </p>
              </div>

              {!isSuperAdmin && (
                <span className="text-[11px] bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg font-semibold">
                  Read-Only (Requires Super Admin Role)
                </span>
              )}
            </div>

            <form onSubmit={handleSaveFacility} className="space-y-6">
              {/* Logo Upload Section */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Hospital Official Logo
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  {/* Current Logo / Preview Box */}
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 flex flex-col items-center justify-center overflow-hidden shadow-inner p-2 relative group">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Hospital Logo Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-400 font-medium leading-tight">No logo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Upload a square or wide logo (PNG, JPG, SVG, WebP). Max size: 2MB. Stored directly in the offline-first IndexedDB storage.
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        disabled={!isSuperAdmin}
                        onChange={handleLogoFileChange}
                        className="hidden"
                        id="hospital-logo-upload"
                      />
                      <label
                        htmlFor="hospital-logo-upload"
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs ${
                          isSuperAdmin
                            ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        <span>{logoPreview ? 'Change Logo Image' : 'Upload Hospital Logo'}</span>
                      </label>

                      {logoPreview && isSuperAdmin && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Facility Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    Hospital Facility Name *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperAdmin}
                    value={settings.hospitalName}
                    onChange={(e) => setSettings({ ...settings, hospitalName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    District / Healthcare Region
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settings.regionOrDistrict || ''}
                    onChange={(e) => setSettings({ ...settings, regionOrDistrict: e.target.value })}
                    placeholder="e.g. Northern Health Zone"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    Bed Capacity
                  </label>
                  <input
                    type="number"
                    disabled={!isSuperAdmin}
                    value={settings.bedCapacity || 0}
                    onChange={(e) => setSettings({ ...settings, bedCapacity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    Facility Physical Address
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settings.address || ''}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    IT Support Email
                  </label>
                  <input
                    type="email"
                    disabled={!isSuperAdmin}
                    value={settings.contactEmail || ''}
                    onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    Emergency IT / Telecom Extension
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settings.emergencyExtension || ''}
                    onChange={(e) => setSettings({ ...settings, emergencyExtension: e.target.value })}
                    placeholder="e.g. Ext. 9911"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Form Actions */}
              {isSuperAdmin && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {saveFacilitySuccess ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Facility settings and logo saved successfully!</span>
                    </span>
                  ) : <span />}

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md cursor-pointer transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Facility Settings</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF PERSONA SWITCHER & USER DIRECTORY */}
      {activeTab === 'RBAC' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Switch Active Hospital Persona (Offline RBAC Simulation)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Select any hospital staff profile to test role boundaries, ticket resolution permissions, and offline actions.
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                Active: <strong className="text-sky-600">{currentUser?.fullName} ({currentUser?.role})</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {allUsers.map((u) => {
                const isActive = currentUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => onUserSwitch(u)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer text-xs flex items-center justify-between ${
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500">{u.department}</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-semibold text-sky-600">
                        {u.role}
                      </span>
                    </div>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staff Registry Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Hospital Staff Directory ({allUsers.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Switch Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {u.fullName}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        @{u.username}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {u.department}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onUserSwitch(u)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                        >
                          Assume Identity
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OFFLINE SECURITY POLICIES */}
      {activeTab === 'SECURITY_POLICIES' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-sky-600" />
            <span>Configurable Offline Security Policies</span>
          </h3>

          <form onSubmit={handleSavePolicy} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                Max Offline Working Window (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={offlinePolicy.maxOfflineHours}
                onChange={(e) =>
                  setOfflinePolicy({ ...offlinePolicy, maxOfflineHours: parseInt(e.target.value) || 72 })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">
                Clinical and IT staff can operate disconnected up to this threshold (default 72h).
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={offlinePolicy.allowOfflineLogin}
                  onChange={(e) =>
                    setOfflinePolicy({ ...offlinePolicy, allowOfflineLogin: e.target.checked })
                  }
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Allow Offline Hospital Staff Sign-In</span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={offlinePolicy.allowOfflineTicketCreation}
                  onChange={(e) =>
                    setOfflinePolicy({ ...offlinePolicy, allowOfflineTicketCreation: e.target.checked })
                  }
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Permit Ticket Logging During Starlink Outage</span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={offlinePolicy.allowOfflineAssetModification}
                  onChange={(e) =>
                    setOfflinePolicy({ ...offlinePolicy, allowOfflineAssetModification: e.target.checked })
                  }
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Permit Asset Location & Condition Updates Offline</span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={offlinePolicy.allowOfflineInventoryTx}
                  onChange={(e) =>
                    setOfflinePolicy({ ...offlinePolicy, allowOfflineInventoryTx: e.target.checked })
                  }
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Permit Consumables Stock Issuing to Hospital Wards Offline</span>
              </label>
            </div>

            <div className="col-span-full pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {saveSuccess ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Offline security policy saved to local storage!</span>
                </span>
              ) : <span />}

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Policy Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
