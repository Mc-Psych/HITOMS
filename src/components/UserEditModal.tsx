import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Shield,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Key,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  ShieldAlert,
  Wrench,
  Tag,
  Plus,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  Star,
  Upload,
  FileText,
} from 'lucide-react';
import { type User as UserType, type Role, type AccountStatus } from '../types';
import {
  authService,
  extractSurname,
  getDefaultPasswordForSurname,
  ROLE_DESCRIPTIONS,
  STANDARD_SPECIALTIES,
} from '../services/authService';
import { departmentService, INITIAL_STANDARD_DEPARTMENTS } from '../services/departmentService';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: UserType | null; // null means creating a new user
  user?: UserType | null; // Alias support for user prop
  currentUser: UserType | null;
  onUserSaved?: () => void;
  onSave?: () => void; // Alias support for onSave prop
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

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  onClose,
  userToEdit,
  user,
  currentUser,
  onUserSaved,
  onSave,
  onUserDeleted,
}) => {
  const targetUser = userToEdit !== undefined ? userToEdit : (user ?? null);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isEditing = Boolean(targetUser);

  // Safe callback helper
  const notifyUserSaved = () => {
    if (typeof onUserSaved === 'function') onUserSaved();
    if (typeof onSave === 'function') onSave();
  };

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Department State with Checkboxes
  const [standardDepartments, setStandardDepartments] = useState<string[]>(INITIAL_STANDARD_DEPARTMENTS);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [primaryDepartment, setPrimaryDepartment] = useState<string>('OPD (Outpatient Department)');
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const [newCustomDeptInput, setNewCustomDeptInput] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);

  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<Role>('STAFF_USER');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyNotes, setSpecialtyNotes] = useState('');
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState('');
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

  const [signature, setSignature] = useState('');
  const [isSignPadOpen, setIsSignPadOpen] = useState(false);
  const [signMethod, setSignMethod] = useState<'DRAW' | 'UPLOAD' | 'TYPE'>('DRAW');
  const [cursiveText, setCursiveText] = useState('');
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load latest standard departments from service & database
  const loadStandardDepartments = async () => {
    try {
      const names = await departmentService.getStandardDepartmentNames();
      if (names && names.length > 0) {
        setStandardDepartments(names);
      }
    } catch (e) {
      console.warn('[UserEditModal] Error loading departments:', e);
    }
  };

  useEffect(() => {
    loadStandardDepartments();

    const handleDeptsUpdated = () => {
      loadStandardDepartments();
    };

    window.addEventListener('hitoms_departments_updated', handleDeptsUpdated);
    return () => {
      window.removeEventListener('hitoms_departments_updated', handleDeptsUpdated);
    };
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignature(dataUrl);
    setIsSignPadOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSignature(base64);
      setIsSignPadOpen(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (targetUser) {
      setFullName(targetUser.fullName || '');
      setUsername(targetUser.username || extractSurname(targetUser.fullName).toLowerCase());
      setEmail(targetUser.email || '');
      setPhone(targetUser.phone || '');

      // Initialize departments checkboxes
      const userDepts = targetUser.departments && targetUser.departments.length > 0
        ? targetUser.departments
        : (targetUser.department ? [targetUser.department] : []);
      
      setSelectedDepartments(userDepts);
      setPrimaryDepartment(targetUser.department || userDepts[0] || 'OPD (Outpatient Department)');

      setJobTitle(targetUser.jobTitle || '');
      setRole(targetUser.role || 'STAFF_USER');
      setSpecialties(targetUser.specialties || []);
      setSpecialtyNotes(targetUser.specialtyNotes || '');
      setStatus(targetUser.status || 'Active');
      setPassword('');
      setMustChangePassword(targetUser.mustChangePasswordOnFirstLogin ?? false);
      setOfflineAllowed(targetUser.offlineAccessAllowed ?? true);
      setSignature(targetUser.signature || '');
      if (targetUser.signature && !targetUser.signature.startsWith('data:image/')) {
        setCursiveText(targetUser.signature);
      } else {
        setCursiveText('');
      }
    } else {
      // New user defaults
      setFullName('');
      setUsername('');
      setEmail('');
      setPhone('+233 24 ');
      setSelectedDepartments(['OPD (Outpatient Department)']);
      setPrimaryDepartment('OPD (Outpatient Department)');
      setJobTitle('');
      setRole('STAFF_USER');
      setSpecialties([]);
      setSpecialtyNotes('');
      setStatus('Active');
      setPassword('');
      setMustChangePassword(true);
      setOfflineAllowed(true);
      setSignature('');
      setCursiveText('');
    }
    setError(null);
    setShowDeleteConfirm(false);
    setShowSuspendModal(false);
    setDeleteConfirmText('');
    setCustomSpecialtyInput('');
    setDeptSearchQuery('');
    setNewCustomDeptInput('');
  }, [targetUser, isOpen]);

  // Filtered standard departments based on search query
  const filteredDepartments = useMemo(() => {
    // Combine standard departments with any selected user departments that might not be in standard list yet
    const allNames = Array.from(new Set([...standardDepartments, ...selectedDepartments]));
    if (!deptSearchQuery.trim()) return allNames;
    const q = deptSearchQuery.toLowerCase();
    return allNames.filter((d) => d.toLowerCase().includes(q));
  }, [standardDepartments, selectedDepartments, deptSearchQuery]);

  // Toggle department checkbox
  const handleToggleDepartment = (deptName: string) => {
    setSelectedDepartments((prev) => {
      if (prev.includes(deptName)) {
        const next = prev.filter((d) => d !== deptName);
        // If unchecking the primary department, select another one as primary
        if (primaryDepartment === deptName) {
          setPrimaryDepartment(next[0] || '');
        }
        return next;
      } else {
        const next = [...prev, deptName];
        if (!primaryDepartment || prev.length === 0) {
          setPrimaryDepartment(deptName);
        }
        return next;
      }
    });
  };

  // Select All filtered departments
  const handleSelectAllFilteredDepts = () => {
    setSelectedDepartments((prev) => {
      const set = new Set([...prev, ...filteredDepartments]);
      const next = Array.from(set);
      if (!primaryDepartment && next.length > 0) {
        setPrimaryDepartment(next[0]);
      }
      return next;
    });
  };

  // Clear all selected departments
  const handleClearAllDepts = () => {
    setSelectedDepartments([]);
    setPrimaryDepartment('');
  };

  // Add a new department directly (which becomes a STANDARD_DEPARTMENT)
  const handleAddNewDepartment = async () => {
    const clean = newCustomDeptInput.trim();
    if (!clean) return;

    try {
      setIsAddingDept(true);
      setError(null);
      // Ensure the department is saved to the store and dispatched as a standard department
      await departmentService.ensureDepartmentExists(clean, currentUser);

      // Update standard departments in state
      setStandardDepartments((prev) => {
        if (prev.includes(clean)) return prev;
        return [...prev, clean].sort((a, b) => a.localeCompare(b));
      });

      // Automatically check the newly created department
      setSelectedDepartments((prev) => {
        if (prev.includes(clean)) return prev;
        return [...prev, clean];
      });

      // If no primary department set yet, set this one
      if (!primaryDepartment) {
        setPrimaryDepartment(clean);
      }

      setNewCustomDeptInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to add new department.');
    } finally {
      setIsAddingDept(false);
    }
  };

  if (!isOpen) return null;

  // IT unit must not see nor edit super admin account
  if (targetUser?.role === 'SUPER_ADMIN' && !isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h3 className="font-bold text-base">Restricted Account</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Super Administrator accounts cannot be viewed or edited by IT Unit officers. Please contact a Super Administrator.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  const handleToggleSpecialty = (specId: string) => {
    setSpecialties((prev) =>
      prev.includes(specId) ? prev.filter((s) => s !== specId) : [...prev, specId]
    );
  };

  const handleAddCustomSpecialty = () => {
    const trimmed = customSpecialtyInput.trim();
    if (!trimmed) return;
    if (!specialties.includes(trimmed)) {
      setSpecialties((prev) => [...prev, trimmed]);
    }
    setCustomSpecialtyInput('');
  };

  const handleRemoveSpecialty = (spec: string) => {
    setSpecialties((prev) => prev.filter((s) => s !== spec));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (targetUser?.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      setError('Access Denied: Only Super Admin can edit Super Admin accounts.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (!fullName.trim()) {
        throw new Error('Full Name is required.');
      }
      if (selectedDepartments.length === 0) {
        throw new Error('Please select at least one department using the checkboxes to tie this user.');
      }

      const effectivePrimaryDept = primaryDepartment || selectedDepartments[0];

      if (isEditing && targetUser) {
        const updates: Partial<UserType> = {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim(),
          phone: phone.trim(),
          department: effectivePrimaryDept,
          departments: selectedDepartments,
          jobTitle: jobTitle.trim(),
          role: role,
          specialties: specialties,
          specialtyNotes: specialtyNotes.trim(),
          status: status,
          offlineAccessAllowed: offlineAllowed,
          mustChangePasswordOnFirstLogin: mustChangePassword,
          signature: signature.trim() || undefined,
        };

        if (password.trim()) {
          updates.password = password.trim();
        }

        await authService.updateUser(targetUser.id, updates, currentUser);
      } else {
        await authService.createUser(
          {
            fullName: fullName.trim(),
            username: username.trim().toLowerCase(),
            email: email.trim(),
            phone: phone.trim(),
            department: effectivePrimaryDept,
            departments: selectedDepartments,
            jobTitle: jobTitle.trim(),
            role: role,
            specialties: specialties,
            specialtyNotes: specialtyNotes.trim(),
            status: status,
            password: password.trim() || undefined,
            offlineAccessAllowed: offlineAllowed,
            mustChangePasswordOnFirstLogin: mustChangePassword,
            signature: signature.trim() || undefined,
          },
          currentUser
        );
      }

      notifyUserSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save staff profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (newStatus: AccountStatus) => {
    if (!currentUser || !targetUser) return;
    setError(null);
    setLoading(true);
    try {
      await authService.setUserStatus(
        targetUser.id,
        newStatus,
        currentUser,
        suspensionReason.trim() || undefined
      );
      setStatus(newStatus);
      setShowSuspendModal(false);
      notifyUserSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to change account status.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!currentUser || !targetUser) return;
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setError('Please type "delete" to confirm removal of this staff account.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await authService.deleteUser(targetUser.id, currentUser);
      if (onUserDeleted) onUserDeleted();
      else notifyUserSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setLoading(false);
    }
  };

  const isSelf = currentUser?.id === targetUser?.id;
  const isProtectedAdmin =
    targetUser?.role === 'SUPER_ADMIN' &&
    (targetUser?.username?.toLowerCase() === 'kay' ||
      targetUser?.fullName.toLowerCase().includes('courage kay'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
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
                  ? `ID: ${userToEdit?.id} • Manage department assignments, role authorization, credentials, and account lifecycle.`
                  : 'Create a new staff member profile, tie them to hospital departments via checkboxes, and set credentials.'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Basic Identity */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Identity & Contact Details</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    placeholder="e.g. Senior Medical Officer"
                    className="w-full pl-8 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Department Assignment by Checkboxes */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Tie User to Hospital Departments (Checkboxes) *</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Check all departments and clinical units this staff member is tied to. Added departments automatically become standard hospital departments.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  {selectedDepartments.length} Checked
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllFilteredDepts}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleClearAllDepts}
                  className="text-[11px] text-slate-500 hover:text-rose-600 dark:text-slate-400 font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Department Search & Quick Add */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={deptSearchQuery}
                  onChange={(e) => setDeptSearchQuery(e.target.value)}
                  placeholder="Search department list..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Add Custom Department on-the-fly */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCustomDeptInput}
                  onChange={(e) => setNewCustomDeptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewDepartment();
                    }
                  }}
                  placeholder="New department name..."
                  className="w-44 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  disabled={!newCustomDeptInput.trim() || isAddingDept}
                  onClick={handleAddNewDepartment}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Dept</span>
                </button>
              </div>
            </div>

            {/* Departments Checkbox Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
              {filteredDepartments.map((deptName) => {
                const isChecked = selectedDepartments.includes(deptName);
                const isPrimary = primaryDepartment === deptName;

                return (
                  <div
                    key={deptName}
                    onClick={() => handleToggleDepartment(deptName)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-start justify-between gap-2 select-none ${
                      isChecked
                        ? 'border-sky-500 bg-white dark:bg-slate-900 text-sky-950 dark:text-sky-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0 text-sky-600">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold leading-tight">{deptName}</span>
                        {isChecked && (
                          <div className="mt-1 flex items-center gap-1.5">
                            {isPrimary ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 rounded">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                Primary
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPrimaryDepartment(deptName);
                                }}
                                className="text-[10px] text-slate-400 hover:text-sky-600 hover:underline cursor-pointer"
                              >
                                Set Primary
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Departments Summary */}
            {selectedDepartments.length > 0 && (
              <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 space-y-1.5">
                <div className="text-[11px] font-bold text-sky-900 dark:text-sky-200 flex items-center justify-between">
                  <span>Tied Departments Summary:</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                    Primary Department: <strong className="text-sky-700 dark:text-sky-300">{primaryDepartment || selectedDepartments[0]}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDepartments.map((d) => (
                    <span
                      key={d}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
                        d === primaryDepartment
                          ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {d === primaryDepartment && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                      <span>{d}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleDepartment(d)}
                        className="hover:text-rose-600 cursor-pointer ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Role & Security Authorization */}
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
                  {(isSuperAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'SUPER_ADMIN')).map((r) => (
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

          {/* Section 4: Technical / Clinical Specialties */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                <span>Specialties & Domain Expertise</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                {specialties.length} Selected
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Select key technical skills, clinical systems, or infrastructure domains assigned to this user profile. Enables smart ticket auto-triage and duty roster routing.
            </p>

            {/* Standard Specialties Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {STANDARD_SPECIALTIES.map((spec) => {
                const isSelected = specialties.includes(spec.id);
                return (
                  <button
                    type="button"
                    key={spec.id}
                    onClick={() => handleToggleSpecialty(spec.id)}
                    className={`p-2 rounded-xl text-left border text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="truncate pr-1">{spec.label}</span>
                    <span
                      className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center text-[10px] ${
                        isSelected
                          ? 'bg-sky-600 text-white font-bold'
                          : 'border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Specialties Input */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={customSpecialtyInput}
                    onChange={(e) => setCustomSpecialtyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSpecialty();
                      }
                    }}
                    placeholder="Add custom specialty tag (e.g. CCTV & Surveillance, Solar PV)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomSpecialty}
                  disabled={!customSpecialtyInput.trim()}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Selected Specialties Badges */}
              {specialties.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialty(s)}
                        className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Specialty Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Specialty Assignment Notes / Specific Coverage
                </label>
                <input
                  type="text"
                  value={specialtyNotes}
                  onChange={(e) => setSpecialtyNotes(e.target.value)}
                  placeholder="e.g. Primary technician on 2nd Floor ICU LHIMS terminals & Starlink gateway"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Official User Signature */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Official User Signature</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsSignPadOpen(true);
                  setTimeout(() => {
                    if (canvasRef.current) {
                      const canvas = canvasRef.current;
                      canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
                      canvas.height = 160;
                    }
                  }, 100);
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{signature ? 'Change / Re-Sign Signature' : 'Add Signature (Pad or Upload)'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Signatures uploaded or drawn here appear automatically at the signature section when authoring official hospital memorandums.
            </p>

            {signature ? (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="h-16 flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-w-[200px]">
                  {signature.startsWith('data:image/') ? (
                    <img src={signature} alt="User Signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="font-serif italic text-base text-blue-900 dark:text-blue-300 font-bold tracking-wider">
                      {signature}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSignature('')}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No official signature configured yet. Click "Add Signature" above to draw or upload one.
              </div>
            )}
          </div>

          {/* Section 6: Credentials & Login Security */}
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
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30 p-3.5 rounded-xl">
              <div className="flex items-center gap-2">
                {status === 'Active' ? (
                  <button
                    type="button"
                    onClick={() => setShowSuspendModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Suspend User</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus('Active')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
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
                  className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Delete User</span>
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
                    This will permanently remove their user credentials, role permissions, and offline profile from the database.
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
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
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
                    This staff member will immediately be locked out from logging in or modifying hospital tickets until reactivated.
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
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900 py-2">
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
              <span>{isEditing ? 'Save Staff Changes' : 'Provision Staff Account'}</span>
            </button>
          </div>
        </form>

        {/* Signature Pad / Upload Modal */}
        {isSignPadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>Configure Official Signature</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSignPadOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Method Tabs */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSignMethod('DRAW')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    signMethod === 'DRAW'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Draw on Pad
                </button>
                <button
                  type="button"
                  onClick={() => setSignMethod('UPLOAD')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    signMethod === 'UPLOAD'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => setSignMethod('TYPE')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    signMethod === 'TYPE'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Type Name
                </button>
              </div>

              {signMethod === 'DRAW' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-950 overflow-hidden relative touch-none">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-40 cursor-crosshair bg-white dark:bg-slate-950"
                    />
                    <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none">
                      Use mouse or touchscreen to sign
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      Clear Canvas
                    </button>
                    <button
                      type="button"
                      onClick={saveCanvasSignature}
                      className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 cursor-pointer shadow-md"
                    >
                      Save Drawn Signature
                    </button>
                  </div>
                </div>
              )}

              {signMethod === 'UPLOAD' && (
                <div className="space-y-4 py-4">
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-sky-300 dark:border-sky-800 rounded-2xl bg-slate-50 dark:bg-slate-950 cursor-pointer relative group">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-8 h-8 text-sky-600 mb-2" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Click to upload signature image (PNG, JPG, SVG)
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Maximum size 2MB</span>
                  </div>
                </div>
              )}

              {signMethod === 'TYPE' && (
                <div className="space-y-3 py-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Type Name (Cursive Font Style)
                  </label>
                  <input
                    type="text"
                    value={cursiveText}
                    onChange={(e) => setCursiveText(e.target.value)}
                    placeholder="e.g. Dr. Kwame Mensah"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-base font-serif italic text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 focus:outline-none"
                  />
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (cursiveText.trim()) {
                          setSignature(cursiveText.trim());
                          setIsSignPadOpen(false);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 cursor-pointer"
                    >
                      Save Typed Signature
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
