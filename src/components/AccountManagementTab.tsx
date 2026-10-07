import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  UserCheck,
  UserX,
  Database,
  CloudLightning,
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
  Info,
  Layers,
  ArrowRightLeft,
  Sliders,
  RotateCcw,
  Save,
  LayoutGrid,
  ListFilter,
  Copy,
  Check,
} from 'lucide-react';
import {
  type User,
  type Role,
  type AccountStatus,
} from '../types';
import {
  authService,
  extractSurname,
  type Permission,
  type PermissionDefinition,
  PERMISSION_DEFINITIONS,
  ROLE_DESCRIPTIONS,
} from '../services/authService';
import { syncService } from '../services/syncService';
import { seedSnapshotService } from '../services/seedSnapshotService';
import { settingsService } from '../services/settingsService';
import { StaffBulkUploadModal, downloadStaffTemplate } from './StaffBulkUploadModal';
import { UserEditModal } from './UserEditModal';
import { RoleCustomizationModal } from './RoleCustomizationModal';

interface AccountManagementTabProps {
  currentUser: User | null;
  allUsers: User[];
  onUserSwitch: (user: User) => void;
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

export const AccountManagementTab: React.FC<AccountManagementTabProps> = ({
  currentUser,
  allUsers,
  onUserSwitch,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'ALL'>('ALL');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Modals & Action States
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Single Action Modals
  const [userToSuspend, setUserToSuspend] = useState<User | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Bulk Delete Confirmation Modal
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');

  // Local Cache Flush Modal
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');

  // Loading & Notification state
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isItAdmin = currentUser?.role === 'IT_ADMIN' || isSuperAdmin;

  // IT unit must not see nor edit super admin account under their administration & RBAC module but super admin can see and edit all users
  const visibleUsers = useMemo(() => {
    if (isSuperAdmin) return allUsers;
    return allUsers.filter((u) => u.role !== 'SUPER_ADMIN');
  }, [allUsers, isSuperAdmin]);

  const availableRoles = useMemo(() => {
    return isSuperAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'SUPER_ADMIN');
  }, [isSuperAdmin]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return visibleUsers.filter((u) => {
      // Role filter
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = (u.fullName || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const dept = (u.department || '').toLowerCase();
        const jobTitle = (u.jobTitle || '').toLowerCase();
        const matchesTiedDepts = u.departments?.some((d) => d.toLowerCase().includes(q)) ?? false;
        return (
          fullName.includes(q) ||
          email.includes(q) ||
          username.includes(q) ||
          dept.includes(q) ||
          matchesTiedDepts ||
          jobTitle.includes(q)
        );
      }
      return true;
    });
  }, [visibleUsers, roleFilter, statusFilter, searchQuery]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Toggle single user select
  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle select all filtered
  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  // Sub-tab: Staff Directory vs Role Permission Matrix
  const [accountSubTab, setAccountSubTab] = useState<'DIRECTORY' | 'PERMISSION_MATRIX'>('DIRECTORY');
  const [isRoleCustomizationModalOpen, setIsRoleCustomizationModalOpen] = useState(false);

  // Role Permission Matrix State
  const [matrixViewMode, setMatrixViewMode] = useState<'GRID' | 'INSPECTOR'>('GRID');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>('ALL');
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<Role>('IT_ADMIN');
  const [rolePermissions, setRolePermissions] = useState<Permission[]>(
    authService.getRolePermissions('IT_ADMIN')
  );
  const [matrixSaveSuccess, setMatrixSaveSuccess] = useState(false);

  useEffect(() => {
    setRolePermissions(authService.getRolePermissions(selectedRoleForMatrix));
  }, [selectedRoleForMatrix]);

  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    PERMISSION_DEFINITIONS.forEach((p) => cats.add(p.category));
    return Array.from(cats);
  }, []);

  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, PermissionDefinition[]> = {};
    PERMISSION_DEFINITIONS.forEach((p) => {
      // Filter by search
      if (matrixSearchQuery.trim()) {
        const q = matrixSearchQuery.toLowerCase();
        const match =
          p.label.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q);
        if (!match) return;
      }
      // Filter by category
      if (matrixCategoryFilter !== 'ALL' && p.category !== matrixCategoryFilter) return;

      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    return grouped;
  }, [matrixSearchQuery, matrixCategoryFilter]);

  const handleToggleRolePermission = (permKey: Permission) => {
    if (!isSuperAdmin) return;
    setRolePermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const handleToggleCellGrid = async (role: Role, permKey: Permission) => {
    if (!isSuperAdmin) return;
    const currentPerms = authService.getRolePermissions(role);
    const updated = currentPerms.includes(permKey)
      ? currentPerms.filter((p) => p !== permKey)
      : [...currentPerms, permKey];

    await authService.updateRolePermissions(role, updated, currentUser || undefined);
    if (role === selectedRoleForMatrix) {
      setRolePermissions(updated);
    }
    onRefresh();
  };

  const handleGrantCategory = (categoryName: string) => {
    if (!isSuperAdmin) return;
    const catPerms = PERMISSION_DEFINITIONS.filter((p) => p.category === categoryName).map((p) => p.key);
    setRolePermissions((prev) => Array.from(new Set([...prev, ...catPerms])));
  };

  const handleRevokeCategory = (categoryName: string) => {
    if (!isSuperAdmin) return;
    const catPermKeys = new Set(PERMISSION_DEFINITIONS.filter((p) => p.category === categoryName).map((p) => p.key));
    setRolePermissions((prev) => prev.filter((p) => !catPermKeys.has(p)));
  };

  const handleCopyPermissionsFromRole = (sourceRole: Role) => {
    if (!isSuperAdmin) return;
    const sourcePerms = authService.getRolePermissions(sourceRole);
    setRolePermissions([...sourcePerms]);
    showNotification('info', `Copied permissions from ${ROLE_DESCRIPTIONS[sourceRole].title}. Click Save to persist.`);
  };

  const handleSaveRolePermissions = async () => {
    if (!currentUser || !isSuperAdmin) return;
    try {
      await authService.updateRolePermissions(selectedRoleForMatrix, rolePermissions, currentUser);
      setMatrixSaveSuccess(true);
      setTimeout(() => setMatrixSaveSuccess(false), 3000);
      onRefresh();
      showNotification('success', `Role permissions for ${ROLE_DESCRIPTIONS[selectedRoleForMatrix].title} updated successfully.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update role permissions.');
    }
  };

  const handleResetRolePermissions = async () => {
    if (!currentUser || !isSuperAdmin) return;
    await authService.resetPermissionsToDefault(currentUser);
    setRolePermissions(authService.getRolePermissions(selectedRoleForMatrix));
    setMatrixSaveSuccess(true);
    setTimeout(() => setMatrixSaveSuccess(false), 3000);
    onRefresh();
    showNotification('success', 'All role permissions reset to system defaults.');
  };

  // 1. Force Cloud Sync & Reconcile Deletions
  const handleForceCloudSync = async () => {
    if (!isSuperAdmin) {
      showNotification('error', 'Only Super Administrator has authority to force cloud re-sync.');
      return;
    }
    setIsSyncing(true);
    try {
      await syncService.runAutomaticSync();
      onRefresh();
      showNotification('success', 'Force cloud sync completed. Local cache synchronized with Firestore master list.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to complete cloud synchronization.');
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Bulk Delete Selected Users
  const handleBulkDeleteConfirm = async () => {
    if (!currentUser || selectedUserIds.size === 0) return;
    if (bulkDeleteConfirmText.trim().toLowerCase() !== 'delete') {
      showNotification('error', 'Please type "delete" to confirm bulk removal.');
      return;
    }

    setIsLoading(true);
    try {
      const idsToDelete = Array.from(selectedUserIds) as string[];
      const { deletedCount, skippedCount } = await authService.bulkDeleteUsers(idsToDelete, currentUser);
      
      setSelectedUserIds(new Set());
      setIsBulkDeleteModalOpen(false);
      setBulkDeleteConfirmText('');
      onRefresh();

      showNotification(
        'success',
        `Bulk deleted ${deletedCount} staff account(s). ${
          skippedCount > 0 ? `(${skippedCount} protected/self accounts were skipped)` : ''
        }`
      );
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to bulk-delete users.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Bulk Update Status
  const handleBulkSetStatus = async (status: AccountStatus) => {
    if (!currentUser || selectedUserIds.size === 0) return;
    setIsLoading(true);
    try {
      const ids = Array.from(selectedUserIds) as string[];
      const updatedCount = await authService.bulkSetUserStatus(ids, status, currentUser);
      setSelectedUserIds(new Set());
      onRefresh();
      showNotification('success', `Bulk updated ${updatedCount} account(s) to status '${status}'.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to bulk update user status.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Single User Delete
  const handleSingleDelete = async () => {
    if (!currentUser || !userToDelete) return;
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      showNotification('error', 'Please type "delete" to confirm deletion.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.deleteUser(userToDelete.id, currentUser);
      setUserToDelete(null);
      setDeleteConfirmText('');
      onRefresh();
      showNotification('success', `Staff account for ${userToDelete.fullName} permanently deleted.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete user.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Single User Suspend / Reactivate
  const handleSingleSuspend = async () => {
    if (!currentUser || !userToSuspend) return;
    setIsLoading(true);
    try {
      await authService.setUserStatus(
        userToSuspend.id,
        'Suspended',
        currentUser,
        suspensionReason.trim() || undefined
      );
      setUserToSuspend(null);
      setSuspensionReason('');
      onRefresh();
      showNotification('success', `User ${userToSuspend.fullName} has been suspended.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to suspend user.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleReactivate = async (targetUser: User) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      await authService.setUserStatus(targetUser.id, 'Active', currentUser);
      onRefresh();
      showNotification('success', `User ${targetUser.fullName} reactivated successfully.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to reactivate user.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Purge Stale Local Cache & Pull Cloud Seed
  const handlePurgeAndResync = async () => {
    if (!currentUser) return;
    if (purgeConfirmText.trim().toLowerCase() !== 'purge') {
      showNotification('error', 'Please type "purge" to confirm cache reset.');
      return;
    }

    setIsLoading(true);
    try {
      // Force sync with cloud reconciliation
      await syncService.runAutomaticSync();
      setIsPurgeModalOpen(false);
      setPurgeConfirmText('');
      onRefresh();
      showNotification('success', 'Local user cache purged & reconciled with latest cloud records.');
    } catch (err: any) {
      showNotification('error', err.message || 'Cache purge failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Save Current State as Repository Git Default Seed
  const handleSaveAsGitSeed = async () => {
    setIsLoading(true);
    try {
      const res = await seedSnapshotService.snapshotCurrentStateAsDefaultSeed();
      if (res.success) {
        showNotification(
          'success',
          `Current live preview state successfully saved as Git default seed (${res.stats.users || 0} users, ${res.stats.tickets || 0} tickets, ${res.stats.assets || 0} assets saved into defaultSeedData.json).`
        );
      } else {
        showNotification('info', 'Live preview data snapshot captured.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save seed snapshot.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeCount = visibleUsers.filter((u) => u.status === 'Active').length;
  const suspendedCount = visibleUsers.filter((u) => u.status === 'Suspended').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight">
                  Hospital Staff Account Management & Cache Control
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage all hospital user accounts, enforce offline RBAC credentials, or purge stale locally-cached staff records.
                </p>
              </div>
            </div>
          </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setAccountSubTab('DIRECTORY')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              accountSubTab === 'DIRECTORY'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Accounts Directory ({visibleUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAccountSubTab('PERMISSION_MATRIX')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              accountSubTab === 'PERMISSION_MATRIX'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Role-Based Permission Matrix</span>
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          {isSuperAdmin && (
            <>
              <button
                onClick={handleForceCloudSync}
                disabled={isSyncing || isLoading}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                title="Pull latest master users from Firestore and purge deleted local users"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-600' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Force Cloud Re-Sync'}</span>
              </button>

              <button
                onClick={handleSaveAsGitSeed}
                disabled={isLoading}
                className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-purple-200 dark:border-purple-900 disabled:opacity-50"
                title="Persist live app preview data as default seed snapshot for GitHub commits"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Set As Git Default Seed</span>
              </button>

              <button
                onClick={() => seedSnapshotService.downloadCurrentSeedBackup()}
                disabled={isLoading}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                title="Download complete JSON snapshot backup of all local stores"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Seed JSON</span>
              </button>

              <button
                onClick={() => setIsPurgeModalOpen(true)}
                disabled={isLoading}
                className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-rose-200 dark:border-rose-900 disabled:opacity-50"
                title="Wipe stale cached accounts and pull clean state"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Reset Cache</span>
              </button>

              <button
                onClick={() => setIsRoleCustomizationModalOpen(true)}
                disabled={isLoading}
                className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-indigo-200 dark:border-indigo-900 disabled:opacity-50"
                title="Rename role display titles (front-end) and freeze roles for IT Admins"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Manage & Freeze Roles</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsBulkUploadModalOpen(true)}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk CSV Import</span>
          </button>

          <button
            onClick={() => {
              setEditingUser(null);
              setIsUserEditModalOpen(true);
            }}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Staff User</span>
          </button>
        </div>
        </div>

        {/* Status Notification Toast */}
        {notification && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2.5 transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                : notification.type === 'error'
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300'
                : 'bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Subtab conditional rendering */}
      </div>

      {accountSubTab === 'PERMISSION_MATRIX' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5">
          {/* Permission Matrix Header & Control Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Role-Based Access Control (RBAC) Permission Matrix</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit and configure operational capability maps across all hospital roles.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Switcher: Cross-Role Grid vs Single Role Inspector */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('GRID')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    matrixViewMode === 'GRID'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>2D Cross-Role Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('INSPECTOR')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    matrixViewMode === 'INSPECTOR'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Role Inspector</span>
                </button>
              </div>

              {/* Reset to Defaults (Super Admin Only) */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleResetRolePermissions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition"
                  title="Reset all role permissions to system defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={matrixSearchQuery}
                onChange={(e) => setMatrixSearchQuery(e.target.value)}
                placeholder="Search permission capability, key, or category..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-hidden text-slate-900 dark:text-white"
              />
            </div>

            {/* Category Filter Badges */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setMatrixCategoryFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap cursor-pointer transition ${
                  matrixCategoryFilter === 'ALL'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                All ({PERMISSION_DEFINITIONS.length})
              </button>
              {categoriesList.map((cat) => {
                const count = PERMISSION_DEFINITIONS.filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setMatrixCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap cursor-pointer transition ${
                      matrixCategoryFilter === cat
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODE 1: 2D CROSS-ROLE MATRIX GRID VIEW */}
          {matrixViewMode === 'GRID' && (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <th className="p-3 font-bold sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 min-w-[260px] max-w-[320px] shadow-xs">
                        Permission Capability & Key
                      </th>
                      {availableRoles.map((role) => {
                        const count = authService.getRolePermissions(role).length;
                        const pct = Math.round((count / PERMISSION_DEFINITIONS.length) * 100);
                        return (
                          <th key={role} className="p-2.5 font-bold text-center min-w-[110px] max-w-[130px] border-l border-slate-200 dark:border-slate-800">
                            <div className="space-y-1">
                              <div className="truncate font-black text-[11px] text-slate-900 dark:text-white" title={authService.getRoleTitle(role)}>
                                {authService.getRoleTitle(role)}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-medium">
                                {count} / {PERMISSION_DEFINITIONS.length} ({pct}%)
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {Object.keys(permissionsByCategory).length === 0 ? (
                      <tr>
                        <td colSpan={availableRoles.length + 1} className="p-8 text-center text-slate-400">
                          No permissions match search query or category filter.
                        </td>
                      </tr>
                    ) : (
                      (Object.entries(permissionsByCategory) as [string, PermissionDefinition[]][]).map(([category, perms]) => (
                        <React.Fragment key={category}>
                          {/* Category Subheader Row */}
                          <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            <td colSpan={availableRoles.length + 1} className="px-3 py-2 border-y border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5 text-sky-600" />
                                <span>{category} ({perms.length} capabilities)</span>
                              </div>
                            </td>
                          </tr>

                          {/* Permission Rows */}
                          {perms.map((p) => (
                            <tr key={p.key} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition">
                              <td className="p-3 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>{p.label}</span>
                                    <span className="font-mono text-[10px] text-slate-400 font-normal">({p.key})</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-snug">{p.description}</p>
                                </div>
                              </td>

                              {availableRoles.map((role) => {
                                const isGranted = authService.getRolePermissions(role).includes(p.key);
                                return (
                                  <td
                                    key={role}
                                    onClick={() => handleToggleCellGrid(role, p.key)}
                                    className={`p-2.5 text-center border-l border-slate-200 dark:border-slate-800 select-none ${
                                      isSuperAdmin ? 'cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30' : 'cursor-default'
                                    }`}
                                    title={
                                      isSuperAdmin
                                        ? `Click to ${isGranted ? 'revoke' : 'grant'} ${p.label} for ${role}`
                                        : `${p.label} is ${isGranted ? 'ENABLED' : 'DISABLED'} for ${role}`
                                    }
                                  >
                                    <div className="flex justify-center items-center">
                                      {isGranted ? (
                                        <span className="inline-flex items-center justify-center p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center justify-center p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
                                          <Square className="w-3.5 h-3.5" />
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODE 2: SINGLE ROLE INSPECTOR VIEW */}
          {matrixViewMode === 'INSPECTOR' && (
            <div className="space-y-5">
              {/* Role Selection & Batch Copy Bar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      {authService.getRoleTitle(selectedRoleForMatrix)}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                      {rolePermissions.length} / {PERMISSION_DEFINITIONS.length} Active ({Math.round((rolePermissions.length / PERMISSION_DEFINITIONS.length) * 100)}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {ROLE_DESCRIPTIONS[selectedRoleForMatrix].description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto shrink-0">
                  <select
                    value={selectedRoleForMatrix}
                    onChange={(e) => setSelectedRoleForMatrix(e.target.value as Role)}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden text-slate-900 dark:text-white"
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>
                        Inspect Role: {authService.getRoleTitle(r)} ({r})
                      </option>
                    ))}
                  </select>

                  {/* Copy Permissions Dropdown */}
                  {isSuperAdmin && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handleCopyPermissionsFromRole(e.target.value as Role);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden text-slate-700 dark:text-slate-300"
                    >
                      <option value="">Clone Permissions From Role...</option>
                      {availableRoles
                        .filter((r) => r !== selectedRoleForMatrix)
                        .map((r) => (
                          <option key={r} value={r}>
                            Copy from {authService.getRoleTitle(r)}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Permission Categories Accordion Cards */}
              <div className="space-y-4">
                {(Object.entries(permissionsByCategory) as [string, PermissionDefinition[]][]).map(([category, perms]) => {
                  const activeInCat = perms.filter((p) => rolePermissions.includes(p.key)).length;
                  const allActive = activeInCat === perms.length;

                  return (
                    <div
                      key={category}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs"
                    >
                      <div className="px-4 py-2.5 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-sky-600" />
                          <span>{category} ({activeInCat}/{perms.length})</span>
                        </span>

                        {isSuperAdmin && (
                          <div className="flex items-center gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleGrantCategory(category)}
                              className="text-sky-600 dark:text-sky-400 hover:underline font-bold cursor-pointer"
                            >
                              Grant All in Category
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleRevokeCategory(category)}
                              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                            >
                              Revoke Category
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {perms.map((p) => {
                          const isGranted = rolePermissions.includes(p.key);
                          return (
                            <div
                              key={p.key}
                              onClick={() => handleToggleRolePermission(p.key)}
                              className={`p-2.5 rounded-lg border transition flex items-start gap-2.5 ${
                                isSuperAdmin ? 'cursor-pointer hover:border-sky-400' : 'cursor-default'
                              } ${
                                isGranted
                                  ? 'bg-sky-50/60 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800'
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
                  );
                })}
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
      ) : (
        <>
          {/* Stats Metrics Counters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Total Registered Staff</div>
            <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
              {visibleUsers.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">IndexedDB local records</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Active Accounts</div>
            <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {activeCount}
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">Full offline login access</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Suspended / Inactive</div>
            <div className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
              {suspendedCount}
            </div>
            <div className="text-[10px] text-amber-500/80 mt-0.5">Login access blocked</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Selected for Bulk Action</div>
            <div className="text-lg font-black font-mono text-sky-600 dark:text-sky-400 mt-1">
              {selectedUserIds.size}
            </div>
            <div className="text-[10px] text-sky-500/80 mt-0.5">
              {selectedUserIds.size > 0 ? 'Action toolbar active below' : 'Check rows to bulk edit'}
            </div>
          </div>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedUserIds.size > 0 && (
        <div className="bg-sky-950 border border-sky-800 text-white rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
            <span className="font-bold text-xs sm:text-sm">
              {selectedUserIds.size} user account(s) selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkSetStatus('Active')}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Bulk Activate</span>
            </button>

            <button
              onClick={() => handleBulkSetStatus('Suspended')}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Bulk Suspend</span>
            </button>

            {isItAdmin && (
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bulk Delete Selected</span>
              </button>
            )}

            <button
              onClick={() => setSelectedUserIds(new Set())}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, @username, or department..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All System Roles ({visibleUsers.length})</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ')} ({visibleUsers.filter((u) => u.role === r).length})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AccountStatus | 'ALL')}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="Active">Active ({activeCount})</option>
              <option value="Suspended">Suspended ({suspendedCount})</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="cursor-pointer text-slate-500 hover:text-sky-600"
                    title={selectedUserIds.size === filteredUsers.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedUserIds.size > 0 && selectedUserIds.size === filteredUsers.length ? (
                      <CheckSquare className="w-4 h-4 text-sky-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Staff Member & Handle</th>
                <th className="py-3 px-4">System Role</th>
                <th className="py-3 px-4">Department & Title</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Sync State</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No hospital staff accounts found matching your query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.has(user.id);
                  const isRootAdmin =
                    user.role === 'SUPER_ADMIN' &&
                    (user.username?.toLowerCase() === 'admin' ||
                      user.id === 'usr-admin-001');
                  const isSelf = currentUser?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition ${
                        isSelected ? 'bg-sky-500/5 dark:bg-sky-500/10' : ''
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleSelectUser(user.id)}
                          className="cursor-pointer text-slate-400 hover:text-sky-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Staff Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {(user.fullName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                              <span>{user.fullName}</span>
                              {isRootAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">
                                  Root Admin
                                </span>
                              )}
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[9px] font-black uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate">
                              <span>@{user.username || extractSurname(user.fullName).toLowerCase()}</span>
                              <span>•</span>
                              <span>{user.email || 'No email registered'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            user.role === 'SUPER_ADMIN'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : user.role === 'IT_ADMIN'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                              : user.role === 'IT_OFFICER'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : user.role === 'HOSPITAL_MANAGEMENT'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : user.role === 'DEPARTMENT_HEAD'
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                              : user.role === 'PROCUREMENT_OFFICER'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                              : user.role === 'AUDITOR'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Department & Title */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-medium ${user.department ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}`}>
                            {user.department || 'Unassigned'}
                          </span>
                          {user.departments && user.departments.length > 1 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                              title={`Tied departments (${user.departments.length}): ${user.departments.join(', ')}`}
                            >
                              +{user.departments.length - 1} more
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {user.jobTitle || 'Hospital Officer'}
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            user.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : user.status === 'Suspended'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {user.status || 'Active'}
                        </span>
                      </td>

                      {/* Sync State */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              user._syncStatus === 'PENDING'
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">
                            {user._syncStatus === 'PENDING' ? 'Pending Push' : 'Synced'}
                          </span>
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick Switch (QA / Testing) */}
                          <button
                            onClick={() => onUserSwitch(user)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Switch active session to this user (Multi-role QA)"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Profile */}
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setIsUserEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Edit user profile"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Reactivate */}
                          {isSuperAdmin && !isSelf && (
                            user.status === 'Active' ? (
                              <button
                                onClick={() => setUserToSuspend(user)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer"
                                title="Suspend staff account"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSingleReactivate(user)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition cursor-pointer"
                                title="Reactivate staff account"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}

                          {/* Delete Account */}
                          {isItAdmin && !isSelf && !isRootAdmin && (
                            <button
                              onClick={() => setUserToDelete(user)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                              title="Delete account permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* MODAL: Bulk Delete Confirmation */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Confirm Bulk Account Deletion
                </h4>
                <p className="text-xs text-slate-500">
                  You are about to permanently delete <strong>{selectedUserIds.size}</strong> staff account(s).
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Irreversible Operation</span>
              </div>
              <p>
                Deleted records will be removed from local IndexedDB and queued for removal from Firestore cloud. Protected root admin accounts will be skipped.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type <strong className="text-rose-600 font-mono">delete</strong> to confirm:
              </label>
              <input
                type="text"
                value={bulkDeleteConfirmText}
                onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setIsBulkDeleteModalOpen(false);
                  setBulkDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                disabled={bulkDeleteConfirmText.trim().toLowerCase() !== 'delete' || isLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
              >
                {isLoading ? 'Deleting...' : `Delete ${selectedUserIds.size} User(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Single User Delete Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Delete Staff Account
                </h4>
                <p className="text-xs text-slate-500">
                  Permanently delete account for <strong>{userToDelete.fullName}</strong>.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type <strong className="text-rose-600 font-mono">delete</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setUserToDelete(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSingleDelete}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || isLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
              >
                {isLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Single User Suspend */}
      {userToSuspend && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Suspend Staff Account
                </h4>
                <p className="text-xs text-slate-500">
                  Suspend login access for <strong>{userToSuspend.fullName}</strong>.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Suspension (Optional):
              </label>
              <input
                type="text"
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="e.g. Leave of absence, security audit, transferred..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setUserToSuspend(null);
                  setSuspensionReason('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSingleSuspend}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer"
              >
                {isLoading ? 'Suspending...' : 'Suspend Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Purge Local Cache Confirmation */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Reset & Reconcile Local Cache
                </h4>
                <p className="text-xs text-slate-500">
                  Clears locally orphaned/obsolete records and pulls fresh master state from Firestore.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p>
                This resolves data staleness on client browsers without affecting the remote cloud database.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type <strong className="text-rose-600 font-mono">purge</strong> to confirm:
              </label>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="purge"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setIsPurgeModalOpen(false);
                  setPurgeConfirmText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeAndResync}
                disabled={purgeConfirmText.trim().toLowerCase() !== 'purge' || isLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
              >
                {isLoading ? 'Resetting...' : 'Reset & Re-sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bulk CSV Upload */}
      <StaffBulkUploadModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        currentUser={currentUser}
        existingUsers={allUsers}
        onUploadComplete={() => {
          setIsBulkUploadModalOpen(false);
          onRefresh();
          showNotification('success', 'Staff roster successfully imported from CSV.');
        }}
      />

      {/* MODAL: User Profile Edit / Add */}
      <UserEditModal
        isOpen={isUserEditModalOpen}
        user={editingUser}
        userToEdit={editingUser}
        currentUser={currentUser}
        onClose={() => {
          setIsUserEditModalOpen(false);
          setEditingUser(null);
        }}
        onSave={() => {
          setIsUserEditModalOpen(false);
          setEditingUser(null);
          onRefresh();
          showNotification('success', 'Staff profile updated successfully.');
        }}
        onUserSaved={() => {
          setIsUserEditModalOpen(false);
          setEditingUser(null);
          onRefresh();
          showNotification('success', 'Staff profile updated successfully.');
        }}
      />

      {/* MODAL: Super Admin Role Management & Customization */}
      <RoleCustomizationModal
        isOpen={isRoleCustomizationModalOpen}
        onClose={() => setIsRoleCustomizationModalOpen(false)}
        currentUser={currentUser}
        systemSettings={settingsService.getSettingsSync()}
        onSaved={() => {
          onRefresh();
          showNotification('success', 'Role display titles and frozen roles list updated successfully.');
        }}
      />
    </div>
  );
};
