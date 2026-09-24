import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import {
  type User,
  type Role,
  type AccountStatus,
} from '../types';
import { authService, extractSurname } from '../services/authService';
import { syncService } from '../services/syncService';
import { seedSnapshotService } from '../services/seedSnapshotService';
import { StaffBulkUploadModal, downloadStaffTemplate } from './StaffBulkUploadModal';
import { UserEditModal } from './UserEditModal';

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

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
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
        return (
          fullName.includes(q) ||
          email.includes(q) ||
          username.includes(q) ||
          dept.includes(q) ||
          jobTitle.includes(q)
        );
      }
      return true;
    });
  }, [allUsers, roleFilter, statusFilter, searchQuery]);

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

  // 1. Force Cloud Sync & Reconcile Deletions
  const handleForceCloudSync = async () => {
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

  const activeCount = allUsers.filter((u) => u.status === 'Active').length;
  const suspendedCount = allUsers.filter((u) => u.status === 'Suspended').length;

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

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={handleForceCloudSync}
              disabled={isSyncing || isLoading}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
              title="Pull latest master users from Firestore and purge deleted local users"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-600' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Force Cloud Re-Sync'}</span>
            </button>

            {isSuperAdmin && (
              <>
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

        {/* Stats Metrics Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Total Registered Staff</div>
            <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
              {allUsers.length}
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
              <option value="ALL">All System Roles ({allUsers.length})</option>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ')} ({allUsers.filter((u) => u.role === r).length})
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
                  const isCourageKay =
                    user.role === 'SUPER_ADMIN' &&
                    (user.username?.toLowerCase() === 'kay' ||
                      user.fullName.toLowerCase().includes('courage kay'));
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
                              {isCourageKay && (
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
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {user.department || 'General Staff'}
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
                          {isItAdmin && !isSelf && !isCourageKay && (
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
      />
    </div>
  );
};
