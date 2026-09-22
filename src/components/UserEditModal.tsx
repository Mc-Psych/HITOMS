import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Key,
  Lock,
  Unlock,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  ShieldAlert,
} from 'lucide-react';
import { type User as UserType, type Role, type AccountStatus } from '../types';
import {
  authService,
  extractSurname,
  getDefaultPasswordForSurname,
  ROLE_DESCRIPTIONS,
} from '../services/authService';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: UserType | null; // null means creating a new user
  currentUser: UserType | null;
  onUserSaved: () => void;
  onUserDeleted?: () => void;
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

const STANDARD_DEPARTMENTS = [
  'IT & Systems Administration',
  'Accident & Emergency (A&E)',
  'OPD (Outpatient Department)',
  'Intensive Care Unit (ICU)',
  'Main Surgical Theatre',
  'Maternity & Labor Ward',
  'Pediatrics Ward',
  'Male Medical Ward',
  'Female Medical Ward',
  'Biomedical Engineering',
  'Main Pharmacy & Dispensary',
  'Clinical Diagnostic Laboratory',
  'Radiology & Ultrasound',
  'Hospital Administration & HR',
  'Procurement & Stores',
  'Finance & Billing',
  'Quality Assurance & Audit',
  'Health Information Management (LHIMS / Records)',
];

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  onClose,
  userToEdit,
  currentUser,
  onUserSaved,
  onUserDeleted,
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isEditing = Boolean(userToEdit);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('IT & Systems Administration');
  const [customDepartment, setCustomDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<Role>('STAFF_USER');
  const [status, setStatus] = useState<AccountStatus>('Active');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [offlineAllowed, setOfflineAllowed] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setFullName(userToEdit.fullName || '');
      setUsername(userToEdit.username || extractSurname(userToEdit.fullName).toLowerCase());
      setEmail(userToEdit.email || '');
      setPhone(userToEdit.phone || '');
      if (STANDARD_DEPARTMENTS.includes(userToEdit.department)) {
        setDepartment(userToEdit.department);
        setCustomDepartment('');
      } else {
        setDepartment('OTHER');
        setCustomDepartment(userToEdit.department || '');
      }
      setJobTitle(userToEdit.jobTitle || '');
      setRole(userToEdit.role || 'STAFF_USER');
      setStatus(userToEdit.status || 'Active');
      setPassword('');
      setMustChangePassword(userToEdit.mustChangePasswordOnFirstLogin ?? false);
      setOfflineAllowed(userToEdit.offlineAccessAllowed ?? true);
    } else {
      // New user defaults
      setFullName('');
      setUsername('');
      setEmail('');
      setPhone('+233 24 ');
      setDepartment('OPD (Outpatient Department)');
      setCustomDepartment('');
      setJobTitle('');
      setRole('STAFF_USER');
      setStatus('Active');
      setPassword('');
      setMustChangePassword(true);
      setOfflineAllowed(true);
    }
    setError(null);
    setShowDeleteConfirm(false);
    setShowSuspendModal(false);
    setDeleteConfirmText('');
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    if (!isEditing && (!username || username === extractSurname(fullName).toLowerCase())) {
      const surname = extractSurname(val);
      const generatedUsername = surname.toLowerCase();
      setUsername(generatedUsername);
      if (!email || email.endsWith('@hospital.local')) {
        setEmail(`${generatedUsername}@hospital.local`);
      }
      if (!password) {
        setPassword(getDefaultPasswordForSurname(surname));
      }
    }
  };

  const handleGenerateDefaultPassword = () => {
    const surname = extractSurname(fullName || 'user');
    setPassword(getDefaultPasswordForSurname(surname));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);
    setLoading(true);

    try {
      const effectiveDepartment = department === 'OTHER' ? customDepartment.trim() : department;
      if (!fullName.trim()) {
        throw new Error('Full Name is required.');
      }
      if (!effectiveDepartment) {
        throw new Error('Please select or specify a hospital department.');
      }

      if (isEditing && userToEdit) {
        const updates: Partial<UserType> = {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim(),
          phone: phone.trim(),
          department: effectiveDepartment,
          jobTitle: jobTitle.trim(),
          role: role,
          status: status,
          offlineAccessAllowed: offlineAllowed,
          mustChangePasswordOnFirstLogin: mustChangePassword,
        };

        if (password.trim()) {
          updates.password = password.trim();
        }

        await authService.updateUser(userToEdit.id, updates, currentUser);
      } else {
        await authService.createUser(
          {
            fullName: fullName.trim(),
            username: username.trim().toLowerCase(),
            email: email.trim(),
            phone: phone.trim(),
            department: effectiveDepartment,
            jobTitle: jobTitle.trim(),
            role: role,
            status: status,
            password: password.trim() || undefined,
            offlineAccessAllowed: offlineAllowed,
            mustChangePasswordOnFirstLogin: mustChangePassword,
          },
          currentUser
        );
      }

      onUserSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save staff profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (newStatus: AccountStatus) => {
    if (!currentUser || !userToEdit) return;
    setError(null);
    setLoading(true);
    try {
      await authService.setUserStatus(
        userToEdit.id,
        newStatus,
        currentUser,
        suspensionReason.trim() || undefined
      );
      setStatus(newStatus);
      setShowSuspendModal(false);
      onUserSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to change account status.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!currentUser || !userToEdit) return;
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setError('Please type "delete" to confirm removal of this staff account.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await authService.deleteUser(userToEdit.id, currentUser);
      if (onUserDeleted) onUserDeleted();
      else onUserSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setLoading(false);
    }
  };

  const isSelf = currentUser?.id === userToEdit?.id;
  const isProtectedAdmin =
    userToEdit?.role === 'SUPER_ADMIN' &&
    (userToEdit?.username?.toLowerCase() === 'kay' ||
      userToEdit?.fullName.toLowerCase().includes('courage kay'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner ${
                status === 'Suspended'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
              }`}
            >
              {isEditing ? <User className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isEditing ? `Edit Staff Profile: ${userToEdit?.fullName}` : 'Provision New Staff Account'}</span>
                {isEditing && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      status === 'Active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {status}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? `ID: ${userToEdit?.id} • Manage role authorization, credentials, and access status.`
                  : 'Create a new staff member profile with offline-first login credentials.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section 1: Basic Identity */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Identity & Department</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (Title, First & Surname) *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  placeholder="e.g. Dr. Kwame Mensah"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username (Handle) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-xs font-mono font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="mensah"
                    className="w-full pl-7 pr-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hospital Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mensah@hospital.local"
                    className="w-full pl-8 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone / Extension
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 24 123 4567"
                    className="w-full pl-8 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {STANDARD_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                  <option value="OTHER">Custom / Other Department...</option>
                </select>

                {department === 'OTHER' && (
                  <input
                    type="text"
                    required
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="Type department name..."
                    className="mt-2 w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Designation / Title
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Medical Officer / Systems Engineer"
                    className="w-full pl-8 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Role & Security Authorization */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>RBAC Role & System Permissions</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned System Role *
                </label>
                <select
                  disabled={!isSuperAdmin}
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-75"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_DESCRIPTIONS[r].title} ({r})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                  {ROLE_DESCRIPTIONS[role]?.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Status *
                </label>
                <select
                  disabled={!isSuperAdmin || isSelf}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AccountStatus)}
                  className={`w-full px-3.5 py-2 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    status === 'Active'
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300'
                  } disabled:opacity-75`}
                >
                  <option value="Active">Active (Full Access)</option>
                  <option value="Suspended">Suspended (Temporarily Blocked)</option>
                  <option value="Disabled">Disabled (Deactivated)</option>
                </select>

                {isSelf && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    You cannot change your own account status.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Credentials & Login Security */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                <span>Password & Authentication</span>
              </h3>

              <button
                type="button"
                onClick={handleGenerateDefaultPassword}
                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset to Surname Default (last 4 chars)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isEditing ? 'New Password (leave blank to keep current)' : 'Initial Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEditing ? '••••••••' : 'Default password'}
                    className="w-full pl-3.5 pr-10 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span>Mandatory Password Change on Next Login</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offlineAllowed}
                    onChange={(e) => setOfflineAllowed(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span>Allow Offline Local Database Access</span>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Actions for Super Admin (Suspend / Activate / Delete) */}
          {isEditing && isSuperAdmin && !isSelf && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl">
              <div className="flex items-center gap-2">
                {status === 'Active' ? (
                  <button
                    type="button"
                    onClick={() => setShowSuspendModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Suspend User</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus('Active')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Reactivate User</span>
                  </button>
                )}
              </div>

              {!isProtectedAdmin && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete User Profile</span>
                </button>
              )}
            </div>
          )}

          {/* Delete Confirmation Box */}
          {showDeleteConfirm && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    Are you sure you want to permanently delete {userToEdit?.fullName}?
                  </h4>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-snug">
                    This will remove their login profile and credentials from the offline IndexedDB database. Their historical audit logs and ticket records will remain for compliance.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-rose-800 dark:text-rose-300 mb-1">
                  Type <span className="font-mono bg-rose-200 dark:bg-rose-900 px-1 py-0.5 rounded">delete</span> to confirm:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="delete"
                    className="px-3 py-1.5 text-xs font-mono rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-950 text-rose-900 dark:text-rose-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || loading}
                    onClick={handleDeleteUser}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Confirm Permanent Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Suspend Confirmation Box */}
          {showSuspendModal && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Suspend User Account: {userToEdit?.fullName}
                  </h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                    This staff member will immediately be locked out from logging in or modifying tickets until reactivated.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                  Reason for Suspension (recorded in Audit Trail):
                </label>
                <input
                  type="text"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="e.g. Leave of absence / Security review"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none mb-2"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleToggleStatus('Suspended')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Confirm Suspension
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSuspendModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Provision Staff Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
