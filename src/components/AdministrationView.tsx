import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Shield,
  Building2,
  Upload,
  Image as ImageIcon,
  Save,
  CheckCircle2,
  Lock,
  UserCheck,
  AlertTriangle,
  FileText,
  Calendar,
  Bell,
  Volume2,
  VolumeX,
  Sparkles,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import {
  type User as UserType,
  type OfflineSecurityPolicy,
  type SystemSettings,
  type Role,
  type OfficerMonthlySpecialty,
  type TicketCategory,
} from '../types';
import {
  authService,
} from '../services/authService';
import { settingsService, DEFAULT_SYSTEM_SETTINGS } from '../services/settingsService';
import {
  officerSpecialtyService,
  ALL_SPECIALTY_CATEGORIES,
  getCurrentMonthKey,
  formatMonthName,
} from '../services/officerSpecialtyService';
import { systemNotificationRingService } from '../services/ticketSoundService';
import { LetterheadUploadModal } from './LetterheadUploadModal';
import { AccountManagementTab } from './AccountManagementTab';
import { DepartmentManagementTab } from './DepartmentManagementTab';

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
  const [activeTab, setActiveTab] = useState<'ACCOUNT_MANAGEMENT' | 'FACILITY' | 'DEPARTMENTS' | 'SECURITY_POLICIES' | 'OFFICER_SPECIALTIES'>('ACCOUNT_MANAGEMENT');
  
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // IT unit must not see nor edit super admin account under their administration module but super admin can see and edit all users
  const visibleUsers = useMemo(() => {
    if (isSuperAdmin) return allUsers;
    return allUsers.filter((u) => u.role !== 'SUPER_ADMIN');
  }, [allUsers, isSuperAdmin]);
  
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
  const [notificationSaveSuccess, setNotificationSaveSuccess] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(systemNotificationRingService.isMuted());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Letterhead modal state
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);

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
    const duration = settings.ringToneDurationSeconds || 5;
    await systemNotificationRingService.testSystemNotificationRing(duration);
    setRingTestSuccess(true);
    setTimeout(() => setRingTestSuccess(false), 3500);
  };

  const handleSaveNotificationSettings = async () => {
    if (!currentUser) return;
    try {
      const updated = await settingsService.updateSettings(
        {
          reNotificationIntervalMinutes: settings.reNotificationIntervalMinutes ?? 30,
          ringToneDurationSeconds: settings.ringToneDurationSeconds ?? 5,
          emergencyReNotificationMinutes: settings.emergencyReNotificationMinutes ?? 15,
        },
        currentUser
      );
      setSettings(updated);
      setNotificationSaveSuccess(true);
      setTimeout(() => setNotificationSaveSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save notification settings');
    }
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
            onClick={() => setActiveTab('ACCOUNT_MANAGEMENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ACCOUNT_MANAGEMENT'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Staff Accounts & RBAC</span>
          </button>

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
            onClick={() => setActiveTab('DEPARTMENTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'DEPARTMENTS'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Departments & Wards</span>
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

      {/* TAB 0: ACCOUNT MANAGEMENT */}
      {activeTab === 'ACCOUNT_MANAGEMENT' && (
        <AccountManagementTab
          currentUser={currentUser}
          allUsers={visibleUsers}
          onUserSwitch={onUserSwitch}
          onRefresh={onRefresh}
        />
      )}

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

      {/* TAB 2: HOSPITAL DEPARTMENTS & WARDS */}
      {activeTab === 'DEPARTMENTS' && (
        <DepartmentManagementTab
          currentUser={currentUser}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 3: OFFLINE SECURITY POLICIES */}
      {activeTab === 'SECURITY_POLICIES' && (
        <div className="space-y-6">
          {/* SUPER ADMIN TERMINAL CONTROLS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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

          {/* SYSTEM NOTIFICATION RING ENGINE & TIMING CONTROLS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-600" />
                  <span>IT Helpdesk Bell, Recurring Alerts & Alarm Timing Controls</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin authority: Configure how often unresolved tickets re-alert IT officers and how long the audible chime or siren rings.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
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
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition shadow-2xs"
                  title="Test chime playback with currently selected ring duration"
                >
                  <Bell className="w-3.5 h-3.5 text-sky-600" />
                  <span>Test Ring ({settings.ringToneDurationSeconds || 5}s)</span>
                </button>

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveNotificationSettings}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Timing Settings</span>
                  </button>
                )}
              </div>
            </div>

            {ringTestSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Ringtone sounded for {settings.ringToneDurationSeconds || 5}s and OS system notification dispatched! Works even when the app is minimized or closed.</span>
              </div>
            )}

            {notificationSaveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Notification timing rules updated successfully across all hospital devices!</span>
              </div>
            )}

            {/* Timing Configuration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Field 1: Re-Notification Time Duration */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-sky-600" />
                    <span>Re-Notification Time Duration (Interval)</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-sky-600 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                    {settings.reNotificationIntervalMinutes || 30} mins
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Controls how frequently the Helpdesk bell and background notifications re-ring for IT officers & admins while tickets remain unclosed and unresolved.
                </p>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {[5, 10, 15, 30, 45, 60, 120].map((mins) => {
                    const isSelected = (settings.reNotificationIntervalMinutes || 30) === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSettings((prev) => ({ ...prev, reNotificationIntervalMinutes: mins }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {mins < 60 ? `${mins}m` : `${mins / 60}h`} {mins === 30 ? '(Default)' : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Custom input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">Custom minutes:</span>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={settings.reNotificationIntervalMinutes || 30}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      setSettings((prev) => ({ ...prev, reNotificationIntervalMinutes: Math.max(1, Math.min(1440, val)) }));
                    }}
                    className="w-24 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-400">minutes</span>
                </div>
              </div>

              {/* Field 2: How Long It Should Ring (Ring Duration) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ringtone Duration (How Long It Rings)</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {settings.ringToneDurationSeconds || 5} seconds
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Controls how many seconds the audible bell chime or emergency siren continuously plays during an alert event before silencing automatically.
                </p>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {[3, 5, 10, 15, 30, 60].map((sec) => {
                    const isSelected = (settings.ringToneDurationSeconds || 5) === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSettings((prev) => ({ ...prev, ringToneDurationSeconds: sec }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {sec}s {sec === 5 ? '(Default)' : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Custom input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">Custom seconds:</span>
                  <input
                    type="number"
                    min="2"
                    max="120"
                    value={settings.ringToneDurationSeconds || 5}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 2;
                      setSettings((prev) => ({ ...prev, ringToneDurationSeconds: Math.max(2, Math.min(120, val)) }));
                    }}
                    className="w-24 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-400">seconds (2 - 120s)</span>
                </div>
              </div>
            </div>

            {/* Architecture Explanatory Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Background Delivery</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Registered with Service Worker so critical hospital IT alerts ring through OS notification center even when minimized or closed.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span>Configured Re-Alerts</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Unresolved tickets past {settings.reNotificationIntervalMinutes || 30} minutes trigger recurring reminder rings until attended to.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Emergency Hospital Siren</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Immediate siren alert for Code Blue IT or Starlink outages, sounding for {settings.ringToneDurationSeconds || 5} seconds per broadcast.
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
                  Designated IT Specialists Roster ({monthlySpecialties.length} Officers)
                </h4>
                <p className="text-xs text-slate-500">
                  Select ticket categories for each officer. Issues logged with that category will be routed to that officer automatically.
                </p>
              </div>

              {/* Add officer dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedOfficerForAdd}
                  onChange={(e) => setSelectedOfficerForAdd(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="">Select Officer to Add...</option>
                  {allUsers
                    .filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'IT_ADMIN' || u.role === 'IT_OFFICER')
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
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {monthlySpecialties.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs">
                No monthly specialties configured for {formatMonthName(selectedMonth)}. Add IT officers to activate category-based auto-routing.
              </div>
            ) : (
              <div className="space-y-4">
                {monthlySpecialties.map((officer) => (
                  <div
                    key={officer.userId}
                    className={`p-4 rounded-2xl border transition-all ${
                      officer.isActive
                        ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/40 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs">
                          {officer.userName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {officer.userName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                officer.isActive
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {officer.isActive ? 'Active on Duty' : 'On Leave / Inactive'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Roster Month: {formatMonthName(officer.month)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full lg:w-auto">
                        <input
                          type="text"
                          placeholder="Assignment notes (e.g. Lead Network Tech)..."
                          value={officer.notes || ''}
                          onChange={(e) => handleUpdateOfficerNotes(officer.userId, e.target.value)}
                          className="px-3 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex-1 lg:w-64 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleOfficerActive(officer.userId)}
                          className="px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {officer.isActive ? 'Mark Inactive' : 'Activate'}
                        </button>
                      </div>
                    </div>

                    {/* Category Selection Tags */}
                    <div className="pt-3">
                      <div className="text-[11px] font-semibold text-slate-500 mb-2">
                        Assigned Ticket Categories:
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

      {/* MODAL: LETTERHEAD UPLOAD & CUSTOMIZATION */}
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
    </div>
  );
};
