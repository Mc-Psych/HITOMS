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
  UserX,
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
  Calendar,
  Bell,
  Volume2,
  VolumeX,
  Sparkles,
  UserPlus,
  Edit3,
  Search,
  Filter,
  Trash2,
  Wrench,
  Tag,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import {
  type User as UserType,
  type OfflineSecurityPolicy,
  type SystemSettings,
  type Role,
  type OfficerMonthlySpecialty,
  type TicketCategory,
  type AccountStatus,
} from '../types';
import {
  authService,
  extractSurname,
  type Permission,
  type PermissionDefinition,
  PERMISSION_DEFINITIONS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  STANDARD_SPECIALTIES,
} from '../services/authService';
import { settingsService, DEFAULT_SYSTEM_SETTINGS } from '../services/settingsService';
import {
  officerSpecialtyService,
  ALL_SPECIALTY_CATEGORIES,
  getCurrentMonthKey,
  formatMonthName,
} from '../services/officerSpecialtyService';
import { systemNotificationRingService } from '../services/ticketSoundService';
import { StaffBulkUploadModal, downloadStaffTemplate } from './StaffBulkUploadModal';
import { UserEditModal } from './UserEditModal';
import { LetterheadUploadModal } from './LetterheadUploadModal';

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
  const [activeTab, setActiveTab] = useState<'FACILITY' | 'RBAC' | 'SECURITY_POLICIES' | 'OFFICER_SPECIALTIES'>('FACILITY');
  const [rbacSubTab, setRbacSubTab] = useState<'STAFF_DIRECTORY' | 'ROLE_MATRIX' | 'USER_OVERRIDES'>('STAFF_DIRECTORY');
  
  const [offlinePolicy, setOfflinePolicy] = useState<OfflineSecurityPolicy>(authService.getOfflinePolicy());
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveFacilitySuccess, setSaveFacilitySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Officer Monthly Specialties states
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [monthlySpecialties, setMonthlySpecialties] = useState<OfficerMonthlySpecialty[]>([]);
  const [specialtySaveSuccess, setSpecialtySaveSuccess] = useState(false);
  const [simulatedCategory, setSimulatedCategory] = useState<TicketCategory>('Network');
  const [simulationResult, setSimulationResult] = useState<string>('');
  const [selectedOfficerForAdd, setSelectedOfficerForAdd] = useState<string>('');

  // System Notification Ring states
  const [ringTestSuccess, setRingTestSuccess] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(systemNotificationRingService.isMuted());

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

  // User Profile Edit & Provisioning Modal state
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserType | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [staffSpecialtyFilter, setStaffSpecialtyFilter] = useState<string | 'ALL'>('ALL');
  const [staffStatusFilter, setStaffStatusFilter] = useState<AccountStatus | 'ALL'>('ALL');

  // Direct table actions state
  const [userToSuspend, setUserToSuspend] = useState<UserType | null>(null);
  const [tableSuspensionReason, setTableSuspensionReason] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [tableDeleteConfirmText, setTableDeleteConfirmText] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [userActionMessage, setUserActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Letterhead modal state
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);
  
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const handleDirectSuspend = async () => {
    if (!currentUser || !userToSuspend) return;
    setIsActionLoading(true);
    try {
      await authService.setUserStatus(
        userToSuspend.id,
        'Suspended',
        currentUser,
        tableSuspensionReason.trim() || undefined
      );
      setUserActionMessage({
        type: 'success',
        text: `User ${userToSuspend.fullName} (@${userToSuspend.username || extractSurname(userToSuspend.fullName).toLowerCase()}) has been suspended.`,
      });
      setUserToSuspend(null);
      setTableSuspensionReason('');
      onRefresh();
      setTimeout(() => setUserActionMessage(null), 4000);
    } catch (err: any) {
      setUserActionMessage({
        type: 'error',
        text: err.message || 'Failed to suspend user.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDirectReactivate = async (targetUser: UserType) => {
    if (!currentUser) return;
    setIsActionLoading(true);
    try {
      await authService.setUserStatus(targetUser.id, 'Active', currentUser);
      setUserActionMessage({
        type: 'success',
        text: `User ${targetUser.fullName} reactivated successfully. Full access restored.`,
      });
      onRefresh();
      setTimeout(() => setUserActionMessage(null), 4000);
    } catch (err: any) {
      setUserActionMessage({
        type: 'error',
        text: err.message || 'Failed to reactivate user.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDirectDelete = async () => {
    if (!currentUser || !userToDelete) return;
    if (tableDeleteConfirmText.trim().toLowerCase() !== 'delete') {
      setUserActionMessage({
        type: 'error',
        text: 'Please type "delete" to confirm removal of this staff account.',
      });
      return;
    }
    setIsActionLoading(true);
    try {
      await authService.deleteUser(userToDelete.id, currentUser);
      setUserActionMessage({
        type: 'success',
        text: `Staff profile for ${userToDelete.fullName} has been permanently deleted.`,
      });
      setUserToDelete(null);
      setTableDeleteConfirmText('');
      onRefresh();
      setTimeout(() => setUserActionMessage(null), 4000);
    } catch (err: any) {
      setUserActionMessage({
        type: 'error',
        text: err.message || 'Failed to delete user profile.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

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

  // Load monthly specialties for selected month
  useEffect(() => {
    const loadMonthlyRoster = async () => {
      const items = await officerSpecialtyService.getSpecialtiesForMonth(selectedMonth);
      setMonthlySpecialties(items);
    };
    loadMonthlyRoster();
  }, [selectedMonth]);

  // Calculate ticket auto-assignment simulation
  useEffect(() => {
    const assigned = monthlySpecialties.find((s) => s.isActive && s.specialties.includes(simulatedCategory));
    if (assigned) {
      setSimulationResult(`Will auto-assign to: ${assigned.userName} (${assigned.notes || 'Monthly Specialty Match'})`);
    } else {
      setSimulationResult(`No monthly specialist assigned for [${simulatedCategory}]. Will route to default Senior IT Admin.`);
    }
  }, [simulatedCategory, monthlySpecialties]);

  const handleToggleSpecialtyCategory = (officerId: string, category: TicketCategory) => {
    setMonthlySpecialties((prev) =>
      prev.map((s) => {
        if (s.userId === officerId) {
          const hasCat = s.specialties.includes(category);
          return {
            ...s,
            specialties: hasCat
              ? s.specialties.filter((c) => c !== category)
              : [...s.specialties, category],
          };
        }
        return s;
      })
    );
  };

  const handleToggleOfficerActive = (officerId: string) => {
    setMonthlySpecialties((prev) =>
      prev.map((s) => {
        if (s.userId === officerId) {
          return { ...s, isActive: !s.isActive };
        }
        return s;
      })
    );
  };

  const handleUpdateOfficerNotes = (officerId: string, notes: string) => {
    setMonthlySpecialties((prev) =>
      prev.map((s) => {
        if (s.userId === officerId) {
          return { ...s, notes };
        }
        return s;
      })
    );
  };

  const handleAddOfficerToMonth = () => {
    if (!selectedOfficerForAdd) return;
    const targetUser = allUsers.find((u) => u.id === selectedOfficerForAdd);
    if (!targetUser) return;

    if (monthlySpecialties.some((s) => s.userId === targetUser.id)) {
      setSelectedOfficerForAdd('');
      return;
    }

    const newEntry: OfficerMonthlySpecialty = {
      id: `spec-${selectedMonth}-${targetUser.id}`,
      userId: targetUser.id,
      userName: targetUser.fullName,
      month: selectedMonth,
      specialties: ['Other'],
      notes: `${targetUser.jobTitle || 'IT Officer'} Specialty Assignment`,
      isActive: true,
    };

    setMonthlySpecialties((prev) => [...prev, newEntry]);
    setSelectedOfficerForAdd('');
  };

  const handleSaveMonthlySpecialties = async () => {
    if (!currentUser) return;
    try {
      await officerSpecialtyService.saveMonthlySpecialties(monthlySpecialties, currentUser);
      setSpecialtySaveSuccess(true);
      setTimeout(() => setSpecialtySaveSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save monthly specialties');
    }
  };

  const handleToggleDemoLogin = async () => {
    if (!isSuperAdmin || !currentUser) return;
    try {
      const currentVal = Boolean(settings.disableDemoLogin);
      const updated = await settingsService.updateSettings(
        { disableDemoLogin: !currentVal },
        currentUser
      );
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to toggle demo login setting');
    }
  };

  const handleTestSystemRing = async () => {
    await systemNotificationRingService.testSystemNotificationRing();
    setRingTestSuccess(true);
    setTimeout(() => setRingTestSuccess(false), 3500);
  };

  const handleToggleAudioMute = () => {
    const newMuted = !isAudioMuted;
    systemNotificationRingService.setMuted(newMuted);
    setIsAudioMuted(newMuted);
  };

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

          <button
            onClick={() => setActiveTab('OFFICER_SPECIALTIES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'OFFICER_SPECIALTIES'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Monthly Officer Specialties</span>
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

              {/* Official Hospital Letterhead & Top Banner Section */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                        Official Hospital Letterhead & Memorandum Banner
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Top banner graphic and formal typography applied to official memos, circulars, and printed reports.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLetterheadModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{settings.hospitalLetterheadImage ? 'Change / Configure Letterhead' : 'Upload Letterhead'}</span>
                    </button>
                  </div>
                </div>

                {/* Letterhead Preview Box */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4 overflow-hidden">
                  {settings.hospitalLetterheadImage ? (
                    <div className="space-y-3">
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 shadow-xs">
                        <img
                          src={settings.hospitalLetterheadImage}
                          alt="Hospital Letterhead Banner Preview"
                          className="w-full max-h-36 object-contain sm:object-cover mx-auto"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                            Custom Banner Active
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Mode: {settings.letterheadMode || 'HEADER_AND_BANNER'}
                          </span>
                        </div>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setSettings((prev) => ({ ...prev, hospitalLetterheadImage: '' }));
                              settingsService.updateSettings({ hospitalLetterheadImage: '' }, currentUser!);
                            }}
                            className="text-rose-600 dark:text-rose-400 hover:underline text-[11px] font-semibold cursor-pointer"
                          >
                            Remove Letterhead Graphic
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Standard Dynamic Header Active
                        </h5>
                        <p className="text-[11px] text-slate-500 max-w-md mt-0.5">
                          Upload an 8.5" graphic header banner (or choose from built-in presets) to render on all official hospital memos, directorate notices, and printed records.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsLetterheadModalOpen(true)}
                        className="mt-2 text-xs font-bold text-sky-600 hover:text-sky-500 underline cursor-pointer"
                      >
                        Launch Letterhead Studio & Presets →
                      </button>
                    </div>
                  )}
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserToEdit(null);
                    setIsUserEditModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Staff Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadStaffTemplate(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                  title="Download CSV staff template with sample entries"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Template (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Bulk Upload</span>
                </button>
              </div>
            )}
          </div>

          {/* SUB-VIEW 1: STAFF DIRECTORY */}
          {rbacSubTab === 'STAFF_DIRECTORY' && (
            <div className="space-y-4">
              {/* Directory Stats Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Staff</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">{allUsers.length}</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Users</div>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {allUsers.filter((u) => u.status === 'Active' || !u.status).length}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suspended</div>
                    <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {allUsers.filter((u) => u.status === 'Suspended' || u.status === 'Disabled').length}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">IT & Specialists</div>
                    <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {allUsers.filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'IT_ADMIN' || u.role === 'IT_OFFICER' || (u.specialties && u.specialties.length > 0)).length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Message Banner */}
              {userActionMessage && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in ${
                    userActionMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {userActionMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{userActionMessage.text}</span>
                  </div>
                  <button
                    onClick={() => setUserActionMessage(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Directory Filter & Search Header */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-600" />
                      <span>Hospital Staff Directory ({allUsers.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Full Super Admin CRUD: Edit user profiles, assign roles & specialties, reset passwords, suspend, or delete accounts.
                    </p>
                  </div>

                  <div className="w-full lg:w-auto flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:w-44">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        placeholder="Search name, handle, dept, specialty..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <select
                      value={staffRoleFilter}
                      onChange={(e) => setStaffRoleFilter(e.target.value as Role | 'ALL')}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Roles</option>
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_DESCRIPTIONS[r]?.title || r}
                        </option>
                      ))}
                    </select>

                    <select
                      value={staffSpecialtyFilter}
                      onChange={(e) => setStaffSpecialtyFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Specialties</option>
                      {STANDARD_SPECIALTIES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={staffStatusFilter}
                      onChange={(e) => setStaffStatusFilter(e.target.value as AccountStatus | 'ALL')}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Disabled">Disabled</option>
                    </select>

                    {(staffSearchQuery || staffRoleFilter !== 'ALL' || staffSpecialtyFilter !== 'ALL' || staffStatusFilter !== 'ALL') && (
                      <button
                        onClick={() => {
                          setStaffSearchQuery('');
                          setStaffRoleFilter('ALL');
                          setStaffSpecialtyFilter('ALL');
                          setStaffStatusFilter('ALL');
                        }}
                        className="px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Staff Profile</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Specialties & Domains</th>
                        <th className="px-4 py-3">Department & Designation</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Super Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {allUsers
                        .filter((u) => {
                          const query = staffSearchQuery.trim().toLowerCase();
                          if (query) {
                            const matchesName = (u.fullName || '').toLowerCase().includes(query);
                            const matchesUsername = (u.username || '').toLowerCase().includes(query);
                            const matchesEmail = (u.email || '').toLowerCase().includes(query);
                            const matchesDept = (u.department || '').toLowerCase().includes(query);
                            const matchesJob = (u.jobTitle || '').toLowerCase().includes(query);
                            const matchesSpec = (u.specialties || []).some((s) => s.toLowerCase().includes(query));
                            if (!matchesName && !matchesUsername && !matchesEmail && !matchesDept && !matchesJob && !matchesSpec) {
                              return false;
                            }
                          }
                          if (staffRoleFilter !== 'ALL' && u.role !== staffRoleFilter) return false;
                          if (staffSpecialtyFilter !== 'ALL') {
                            if (!u.specialties || !u.specialties.includes(staffSpecialtyFilter)) return false;
                          }
                          if (staffStatusFilter !== 'ALL' && u.status !== staffStatusFilter) return false;
                          return true;
                        })
                        .map((u) => {
                          const overrides = authService.getUserPermissionOverrides(u.id);
                          const hasOverrides = overrides.granted.length > 0 || overrides.revoked.length > 0;
                          const isSuspended = u.status === 'Suspended' || u.status === 'Disabled';
                          const isSelf = currentUser?.id === u.id;
                          const isProtectedAdmin =
                            u.role === 'SUPER_ADMIN' &&
                            (u.username?.toLowerCase() === 'kay' || u.fullName.toLowerCase().includes('courage kay'));

                          return (
                            <tr
                              key={u.id}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                                isSuspended ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                              }`}
                            >
                              {/* Staff Profile */}
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 ${
                                      isSuspended
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                        : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                    }`}
                                  >
                                    {u.fullName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold">{u.fullName}</span>
                                      {isSelf && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                          You
                                        </span>
                                      )}
                                      {isProtectedAdmin && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                          Root Admin
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-normal flex items-center gap-2">
                                      <span>{u.email}</span>
                                      {u.phone && <span>• {u.phone}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Username */}
                              <td className="px-4 py-3 font-mono text-sky-600 dark:text-sky-400 font-bold">
                                @{u.username || extractSurname(u.fullName).toLowerCase()}
                              </td>

                              {/* Role */}
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-block ${
                                    u.role === 'SUPER_ADMIN'
                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200'
                                      : u.role === 'IT_ADMIN'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200'
                                      : u.role === 'IT_OFFICER'
                                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200'
                                      : u.role === 'HOSPITAL_MANAGEMENT' || u.role === 'DEPARTMENT_HEAD'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                  }`}
                                  title={ROLE_DESCRIPTIONS[u.role]?.description}
                                >
                                  {u.role}
                                </span>
                              </td>

                              {/* Specialties & Domains */}
                              <td className="px-4 py-3">
                                {u.specialties && u.specialties.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {u.specialties.slice(0, 3).map((spec) => {
                                      const specDef = STANDARD_SPECIALTIES.find((s) => s.id === spec);
                                      return (
                                        <span
                                          key={spec}
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                            specDef?.color || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                                          }`}
                                          title={u.specialtyNotes ? `Notes: ${u.specialtyNotes}` : undefined}
                                        >
                                          {spec}
                                        </span>
                                      );
                                    })}
                                    {u.specialties.length > 3 && (
                                      <span
                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                        title={u.specialties.slice(3).join(', ')}
                                      >
                                        +{u.specialties.length - 3}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">General Operations</span>
                                )}
                              </td>

                              {/* Department & Title */}
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                <div className="font-medium text-slate-800 dark:text-slate-200">{u.department}</div>
                                <div className="text-[10px] text-slate-400">{u.jobTitle || 'Hospital Staff'}</div>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1 items-start">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                                      u.status === 'Active'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        u.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                      }`}
                                    />
                                    <span>{u.status || 'Active'}</span>
                                  </span>

                                  {u.mustChangePasswordOnFirstLogin && (
                                    <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                      Must Change Pass
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Super Admin Actions */}
                              <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                {/* Edit Profile Button */}
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => {
                                      setUserToEdit(u);
                                      setIsUserEditModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                    title="Edit user profile, role, specialties, and password"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                )}

                                {/* Quick Suspend / Reactivate Action */}
                                {isSuperAdmin && !isSelf && (
                                  u.status === 'Active' ? (
                                    <button
                                      onClick={() => {
                                        setUserToSuspend(u);
                                        setTableSuspensionReason('');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                      title="Suspend this user account"
                                    >
                                      <UserX className="w-3 h-3" />
                                      <span>Suspend</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleDirectReactivate(u)}
                                      disabled={isActionLoading}
                                      className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                      title="Reactivate this suspended account"
                                    >
                                      <UserCheck className="w-3 h-3" />
                                      <span>Reactivate</span>
                                    </button>
                                  )
                                )}

                                {/* Quick Delete Action */}
                                {isSuperAdmin && !isSelf && !isProtectedAdmin && (
                                  <button
                                    onClick={() => {
                                      setUserToDelete(u);
                                      setTableDeleteConfirmText('');
                                    }}
                                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                    title="Permanently delete user profile"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                )}

                                {/* Permissions Override Matrix */}
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => setSelectedUserForOverride(u)}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                      hasOverrides
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200'
                                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                                    }`}
                                    title="Customize individual permission overrides"
                                  >
                                    {hasOverrides ? 'Perms*' : 'Perms'}
                                  </button>
                                )}

                                {/* Session Switch */}
                                <button
                                  onClick={() => onUserSwitch(u)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer text-[11px]"
                                  title="Switch session to this user"
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
        <div className="space-y-6">
          {/* SUPER ADMIN TERMINAL CONTROLS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Super Administrator Terminal Controls</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Authority reserved for Super Administrator Courage Kay. Manage terminal access security and demo profiles.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Super Admin: Courage Kay
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Quick Terminal Profiles (Demo Login Section)
                  </span>
                  {settings.disableDemoLogin ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      DISABLED / HIDDEN
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      ACTIVE / VISIBLE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  Courage Kay can disable the quick demo login profile buttons on the login modal to prevent unauthorized one-click terminal entry during live hospital production.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleDemoLogin}
                disabled={!isSuperAdmin}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  !isSuperAdmin
                    ? 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500'
                    : settings.disableDemoLogin
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                }`}
              >
                {settings.disableDemoLogin ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Re-enable Quick Demo Login</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Disable Quick Demo Login</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SYSTEM NOTIFICATION RING ENGINE */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-600" />
                  <span>System Notification Ring Engine (Alerts & Tickets)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Notification ring for alerts and tickets even if the app or browser tab is closed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAudioMute}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                    isAudioMuted
                      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isAudioMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-amber-600" />
                      <span>Audio Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Audio Active</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTestSystemRing}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Test Notification Ring</span>
                </button>
              </div>
            </div>

            {ringTestSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Ring tone sounded and OS system notification dispatched! Works even when the app is minimized or closed.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white mb-1">Background Delivery</div>
                <p className="text-slate-500 text-[11px]">
                  Registered with Service Worker so critical hospital IT alerts ring through OS notification center.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white mb-1">30-Min Recurring Bell</div>
                <p className="text-slate-500 text-[11px]">
                  Unresolved tickets past 30 minutes trigger recurring reminder rings until acknowledged.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white mb-1">Emergency Hospital Siren</div>
                <p className="text-slate-500 text-[11px]">
                  Immediate siren alert for Code Blue IT or Code Red Starlink system failures across all hospital terminals.
                </p>
              </div>
            </div>
          </div>

          {/* OFFLINE POLICIES FORM */}
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
        </div>
      )}

      {/* TAB 4: MONTHLY OFFICER SPECIALTIES & AUTO-ASSIGNMENT ROSTER */}
      {activeTab === 'OFFICER_SPECIALTIES' && (
        <div className="space-y-6">
          {/* Header & Month Selector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Monthly Officer Specialties & Ticket Auto-Assignment</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Automatically assign tickets to IT officers according to their monthly specialties (e.g. Officer 1 specialty is Networking → any networking issue is automatically assigned to him).
                </p>
              </div>

              {/* Month Selector Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Roster Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                >
                  <option value="2026-09">September 2026 (Current)</option>
                  <option value="2026-10">October 2026</option>
                  <option value="2026-11">November 2026</option>
                  <option value="2026-12">December 2026</option>
                  <option value="2027-01">January 2027</option>
                </select>
              </div>
            </div>

            {/* Interactive Simulation & Verification Card */}
            <div className="p-4 rounded-xl border border-sky-100 dark:border-sky-900/60 bg-sky-50/60 dark:bg-sky-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-xs text-sky-900 dark:text-sky-200">
                    Live Auto-Assignment Simulation for {formatMonthName(selectedMonth)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                  {simulationResult}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Test Category:</span>
                <select
                  value={simulatedCategory}
                  onChange={(e) => setSimulatedCategory(e.target.value as TicketCategory)}
                  className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 rounded-xl focus:outline-none text-sky-800 dark:text-sky-300"
                >
                  {ALL_SPECIALTY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} Issue
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Officers Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  IT Officers Rotation Roster — {formatMonthName(selectedMonth)}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Click category tags to assign or unassign specialties to each officer.
                </p>
              </div>

              {/* Add Officer Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedOfficerForAdd}
                  onChange={(e) => setSelectedOfficerForAdd(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Add Officer to Roster --</option>
                  {allUsers
                    .filter((u) => !monthlySpecialties.some((s) => s.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.jobTitle || u.role})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddOfficerToMonth}
                  disabled={!selectedOfficerForAdd}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {monthlySpecialties.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No officer specialties configured for this month. Click &quot;Add Officer to Roster&quot; above to begin.
              </div>
            ) : (
              <div className="space-y-3">
                {monthlySpecialties.map((officer) => (
                  <div
                    key={officer.userId}
                    className={`p-4 rounded-xl border transition ${
                      officer.isActive
                        ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center justify-center">
                          {officer.userName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{officer.userName}</span>
                            {officer.userName.toLowerCase().includes('courage') && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Super Admin
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={officer.notes || ''}
                            onChange={(e) => handleUpdateOfficerNotes(officer.userId, e.target.value)}
                            placeholder="Add duty notes (e.g. Lead Network Technician)"
                            className="text-[11px] text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-sky-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleOfficerActive(officer.userId)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                            officer.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {officer.isActive ? 'Active on Rotation' : 'Off-Duty / Leave'}
                        </button>
                      </div>
                    </div>

                    {/* Category Specialties Selector */}
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Assigned Ticket Specialties for {formatMonthName(selectedMonth)}:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_SPECIALTY_CATEGORIES.map((cat) => {
                          const isAssigned = officer.specialties.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => handleToggleSpecialtyCategory(officer.userId, cat)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                                isAssigned
                                  ? 'bg-sky-600 text-white shadow-2xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {isAssigned && <CheckCircle2 className="w-3 h-3 text-sky-200" />}
                              <span>{cat}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {specialtySaveSuccess ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Monthly specialties roster saved and active for auto-assignment!</span>
                </span>
              ) : <span />}

              <button
                type="button"
                onClick={handleSaveMonthlySpecialties}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Monthly Specialties Roster</span>
              </button>
            </div>
          </div>
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

      {/* MODAL 3: USER PROFILE EDIT, PROVISIONING, SUSPENSION & DELETION */}
      <UserEditModal
        isOpen={isUserEditModalOpen}
        onClose={() => setIsUserEditModalOpen(false)}
        userToEdit={userToEdit}
        currentUser={currentUser}
        onUserSaved={onRefresh}
        onUserDeleted={onRefresh}
      />

      {/* MODAL 4: LETTERHEAD UPLOAD & CUSTOMIZATION */}
      <LetterheadUploadModal
        isOpen={isLetterheadModalOpen}
        onClose={() => setIsLetterheadModalOpen(false)}
        systemSettings={settings}
        currentUser={currentUser}
        onSettingsSaved={(newSettings) => {
          setSettings(newSettings);
          onRefresh();
        }}
      />

      {/* MODAL 5: DIRECT QUICK SUSPEND USER MODAL */}
      {userToSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-800 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Suspend User: {userToSuspend.fullName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  @{userToSuspend.username || extractSurname(userToSuspend.fullName).toLowerCase()} • {userToSuspend.role}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will immediately lock the user account, blocking them from logging in, updating tickets, or syncing offline records until reactivated by a Super Administrator.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for suspension (recorded in audit logs):
              </label>
              <input
                type="text"
                value={tableSuspensionReason}
                onChange={(e) => setTableSuspensionReason(e.target.value)}
                placeholder="e.g. Leave of absence / Security review / Disciplinary"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserToSuspend(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleDirectSuspend}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                Confirm Account Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: DIRECT QUICK DELETE USER MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-300 dark:border-rose-800 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Permanently Delete Profile: {userToDelete.fullName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  @{userToDelete.username || extractSurname(userToDelete.fullName).toLowerCase()} • {userToDelete.role}
                </p>
              </div>
            </div>

            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900 leading-relaxed">
              <strong>Warning:</strong> This will permanently delete the user's login account, password credentials, and permission overrides from the local and synced databases.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type <span className="font-mono bg-rose-100 dark:bg-rose-950 px-1 py-0.5 rounded text-rose-800 dark:text-rose-300">delete</span> to confirm permanent removal:
              </label>
              <input
                type="text"
                value={tableDeleteConfirmText}
                onChange={(e) => setTableDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={tableDeleteConfirmText.trim().toLowerCase() !== 'delete' || isActionLoading}
                onClick={handleDirectDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                Permanently Delete User Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
