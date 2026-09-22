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
  Users,
  Key,
  FileUp,
  FileSpreadsheet,
  Download,
  RotateCcw,
  Sliders,
  ShieldCheck,
  CheckSquare,
  Square,
  X,
  Plus,
  HelpCircle,
} from 'lucide-react';
import {
  type User as UserType,
  type OfflineSecurityPolicy,
  type SystemSettings,
  type Role,
} from '../types';
import {
  authService,
  type Permission,
  type PermissionDefinition,
  PERMISSION_DEFINITIONS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
} from '../services/authService';
import { settingsService, DEFAULT_SYSTEM_SETTINGS } from '../services/settingsService';
import { StaffBulkUploadModal, downloadStaffTemplate } from './StaffBulkUploadModal';

interface AdministrationViewProps {
  currentUser: UserType | null;
  allUsers: UserType[];
  onUserSwitch: (user: UserType) => void;
  onRefresh: () => void;
}

const ALL_ROLES: Role[] = [
  'SUPER_ADMIN',
  'IT_ADMIN',
  'IT_OFFICER',
  'HOSPITAL_MANAGEMENT',
  'DEPARTMENT_HEAD',
  'STAFF_USER',
  'PROCUREMENT_OFFICER',
  'AUDITOR',
];

export const AdministrationView: React.FC<AdministrationViewProps> = ({
  currentUser,
  allUsers,
  onUserSwitch,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'FACILITY' | 'RBAC' | 'SECURITY_POLICIES'>('FACILITY');
  const [rbacSubTab, setRbacSubTab] = useState<'STAFF_DIRECTORY' | 'ROLE_MATRIX' | 'USER_OVERRIDES'>('STAFF_DIRECTORY');
  
  const [offlinePolicy, setOfflinePolicy] = useState<OfflineSecurityPolicy>(authService.getOfflinePolicy());
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveFacilitySuccess, setSaveFacilitySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Permission Matrix states
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<Role>('IT_OFFICER');
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
  const [matrixSaveSuccess, setMatrixSaveSuccess] = useState(false);

  // Individual User Override states
  const [selectedUserForOverride, setSelectedUserForOverride] = useState<UserType | null>(null);
  const [userGrantedPerms, setUserGrantedPerms] = useState<Permission[]>([]);
  const [userRevokedPerms, setUserRevokedPerms] = useState<Permission[]>([]);
  const [userOverrideSaveSuccess, setUserOverrideSaveSuccess] = useState(false);

  // Bulk Staff Upload modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
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

  // Load permissions for selected role
  useEffect(() => {
    const perms = authService.getRolePermissions(selectedRoleForMatrix);
    setRolePermissions(perms);
    setMatrixSaveSuccess(false);
  }, [selectedRoleForMatrix]);

  // Load overrides when selected user changes
  useEffect(() => {
    if (selectedUserForOverride) {
      const overrides = authService.getUserPermissionOverrides(selectedUserForOverride.id);
      setUserGrantedPerms(overrides.granted || []);
      setUserRevokedPerms(overrides.revoked || []);
      setUserOverrideSaveSuccess(false);
    }
  }, [selectedUserForOverride]);

  // Global ESC key to close open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isBulkModalOpen) setIsBulkModalOpen(false);
        if (selectedUserForOverride) setSelectedUserForOverride(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBulkModalOpen, selectedUserForOverride]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

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
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Toggle role permission
  const handleToggleRolePermission = (permKey: Permission) => {
    if (!isSuperAdmin) return;
    setRolePermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  // Save role permissions
  const handleSaveRolePermissions = async () => {
    if (!currentUser || !isSuperAdmin) return;
    try {
      await authService.updateRolePermissions(selectedRoleForMatrix, rolePermissions, currentUser);
      setMatrixSaveSuccess(true);
      setTimeout(() => setMatrixSaveSuccess(false), 3000);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Reset all role permissions
  const handleResetRolePermissions = async () => {
    if (!currentUser || !isSuperAdmin) return;
    if (!window.confirm('Reset all role permissions to system defaults?')) return;
    await authService.resetPermissionsToDefault(currentUser);
    setRolePermissions(authService.getRolePermissions(selectedRoleForMatrix));
    setMatrixSaveSuccess(true);
    setTimeout(() => setMatrixSaveSuccess(false), 3000);
    onRefresh();
  };

  // User override toggles
  const handleToggleUserOverride = (permKey: Permission, defaultRoleHas: boolean) => {
    if (defaultRoleHas) {
      // If role already has it by default, toggling off adds it to revoked
      if (userRevokedPerms.includes(permKey)) {
        setUserRevokedPerms(userRevokedPerms.filter((p) => p !== permKey));
      } else {
        setUserRevokedPerms([...userRevokedPerms, permKey]);
      }
    } else {
      // If role does not have it by default, toggling on adds it to granted
      if (userGrantedPerms.includes(permKey)) {
        setUserGrantedPerms(userGrantedPerms.filter((p) => p !== permKey));
      } else {
        setUserGrantedPerms([...userGrantedPerms, permKey]);
      }
    }
  };

  // Save user overrides
  const handleSaveUserOverrides = async () => {
    if (!selectedUserForOverride || !currentUser || !isSuperAdmin) return;
    try {
      await authService.updateUserPermissionOverrides(
        selectedUserForOverride.id,
        { granted: userGrantedPerms, revoked: userRevokedPerms },
        currentUser
      );
      setUserOverrideSaveSuccess(true);
      setTimeout(() => setUserOverrideSaveSuccess(false), 3000);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Group permission definitions by category
  const permissionsByCategory = PERMISSION_DEFINITIONS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, PermissionDefinition[]>);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" />
            <span>Hospital Administration & Governance</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline-first hospital facility configuration, RBAC permissions matrix, and compliance rules.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('FACILITY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'FACILITY'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Facility & Branding</span>
          </button>

          <button
            onClick={() => setActiveTab('RBAC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'RBAC'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff & Permission Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('SECURITY_POLICIES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SECURITY_POLICIES'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Offline Policies</span>
          </button>
        </div>
      </div>

      {/* TAB 1: FACILITY PROFILE & EMBLEM */}
      {activeTab === 'FACILITY' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <span>Hospital Facility Profile & Emblem</span>
              </h3>
              <p className="text-xs text-slate-500">
                Configure your hospital identity, emblem, contact channels, and offline LHIMS server URLs.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveFacility} className="space-y-5">
              {/* Logo Upload Section */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Hospital Official Logo
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
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

      {/* TAB 2: STAFF DIRECTORY & PERMISSION MATRIX */}
      {activeTab === 'RBAC' && (
        <div className="space-y-6">
          {/* Sub-tabs for RBAC */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRbacSubTab('STAFF_DIRECTORY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  rbacSubTab === 'STAFF_DIRECTORY'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff Directory & Bulk Upload</span>
              </button>

              <button
                onClick={() => setRbacSubTab('ROLE_MATRIX')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  rbacSubTab === 'ROLE_MATRIX'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Role Permission Matrix</span>
              </button>
            </div>

            {isSuperAdmin && rbacSubTab === 'STAFF_DIRECTORY' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadStaffTemplate(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                  title="Download CSV staff template with sample entries"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download Template (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Upload Staff with Template</span>
                </button>
              </div>
            )}
          </div>

          {/* SUB-VIEW 1: STAFF DIRECTORY */}
          {rbacSubTab === 'STAFF_DIRECTORY' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Hospital Staff Directory ({allUsers.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Username convention: Surname in lowercase. Default initial password: last 4 letters of surname.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Full Name</th>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">Assigned Role</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Password Change Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allUsers.map((u) => {
                      const overrides = authService.getUserPermissionOverrides(u.id);
                      const hasOverrides = overrides.granted.length > 0 || overrides.revoked.length > 0;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            <div>{u.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-sky-600 font-bold">
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
                            {u.mustChangePasswordOnFirstLogin ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                Mandatory on 1st Login
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Verified Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            {isSuperAdmin && (
                              <button
                                onClick={() => setSelectedUserForOverride(u)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                  hasOverrides
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                                }`}
                                title="Customize permissions for this individual user"
                              >
                                {hasOverrides ? 'Custom Permissions*' : 'Permissions'}
                              </button>
                            )}

                            <button
                              onClick={() => onUserSwitch(u)}
                              className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-semibold cursor-pointer"
                            >
                              Assume
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: ROLE PERMISSION MATRIX */}
          {rbacSubTab === 'ROLE_MATRIX' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    <span>Role-Based Access Control (RBAC) Permission Matrix</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Super Admin authority: Define and customize operational capabilities for each hospital user role.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedRoleForMatrix}
                    onChange={(e) => setSelectedRoleForMatrix(e.target.value as Role)}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_DESCRIPTIONS[r].title} ({r})
                      </option>
                    ))}
                  </select>

                  {isSuperAdmin && (
                    <button
                      onClick={handleResetRolePermissions}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                      title="Reset all roles to defaults"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Defaults</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Role Summary Banner */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {ROLE_DESCRIPTIONS[selectedRoleForMatrix].title}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    Active Permissions: {rolePermissions.length} / {PERMISSION_DEFINITIONS.length}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {ROLE_DESCRIPTIONS[selectedRoleForMatrix].description}
                </p>
              </div>

              {/* Permission Categories Grid */}
              <div className="space-y-4">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div
                    key={category}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {category} ({perms.filter((p) => rolePermissions.includes(p.key)).length}/{perms.length})
                      </span>
                    </div>

                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {perms.map((p) => {
                        const isGranted = rolePermissions.includes(p.key);
                        return (
                          <div
                            key={p.key}
                            onClick={() => handleToggleRolePermission(p.key)}
                            className={`p-2.5 rounded-lg border transition flex items-start gap-2.5 ${
                              isSuperAdmin ? 'cursor-pointer hover:border-slate-300' : 'cursor-default'
                            } ${
                              isGranted
                                ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800'
                                : 'border-slate-200 dark:border-slate-800/80 opacity-60'
                            }`}
                          >
                            <div className="mt-0.5">
                              {isGranted ? (
                                <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{p.label}</span>
                                <span className="font-mono text-[10px] text-slate-400 font-normal">({p.key})</span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug">{p.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Role Permissions Footer */}
              {isSuperAdmin && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {matrixSaveSuccess ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Role permissions updated successfully!</span>
                    </span>
                  ) : <span />}

                  <button
                    type="button"
                    onClick={handleSaveRolePermissions}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md cursor-pointer transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save {ROLE_DESCRIPTIONS[selectedRoleForMatrix].title} Permissions</span>
                  </button>
                </div>
              )}
            </div>
          )}
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

      {/* MODAL 1: INDIVIDUAL USER PERMISSIONS OVERRIDE (Click outside to close) */}
      {selectedUserForOverride && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedUserForOverride(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-600" />
                  <span>Customize Permissions: {selectedUserForOverride.fullName}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Role: <strong>{selectedUserForOverride.role}</strong> ({selectedUserForOverride.department}) | Username: @{selectedUserForOverride.username}
                </p>
              </div>
              <button
                onClick={() => setSelectedUserForOverride(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-200">
                You can grant extra capabilities beyond this user&apos;s base role, or revoke specific permissions that their role typically allows.
              </div>

              {Object.entries(permissionsByCategory).map(([category, perms]) => {
                const baseRolePerms = authService.getRolePermissions(selectedUserForOverride.role);

                return (
                  <div key={category} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
                      {category}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((p) => {
                        const defaultInRole = baseRolePerms.includes(p.key);
                        const isRevoked = userRevokedPerms.includes(p.key);
                        const isExplicitlyGranted = userGrantedPerms.includes(p.key);
                        const effectiveHas = (defaultInRole && !isRevoked) || isExplicitlyGranted;

                        return (
                          <div
                            key={p.key}
                            onClick={() => handleToggleUserOverride(p.key, defaultInRole)}
                            className={`p-2 rounded-lg border flex items-start gap-2 cursor-pointer transition ${
                              effectiveHas
                                ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800'
                                : 'border-slate-200 dark:border-slate-800 opacity-60'
                            }`}
                          >
                            <div className="mt-0.5">
                              {effectiveHas ? (
                                <CheckSquare className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                <span>{p.label}</span>
                                {isExplicitlyGranted && (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded">
                                    +Granted
                                  </span>
                                )}
                                {isRevoked && (
                                  <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1 rounded">
                                    -Revoked
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500">{p.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
              {userOverrideSaveSuccess ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Custom user permissions saved!</span>
                </span>
              ) : <span />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForOverride(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveUserOverrides}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Save Overrides
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK UPLOAD STAFF WITH TEMPLATE */}
      <StaffBulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        currentUser={currentUser}
        onSuccess={onRefresh}
      />
    </div>
  );
};
