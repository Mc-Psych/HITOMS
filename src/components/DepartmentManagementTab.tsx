import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Phone,
  User,
  MapPin,
  Shield,
  Layers,
  Sparkles,
  Flame,
  X,
  Save,
  Upload,
} from 'lucide-react';
import { type Department, type User as UserType } from '../types';
import { departmentService } from '../services/departmentService';
import { authService } from '../services/authService';
import { DepartmentBulkUploadModal } from './DepartmentBulkUploadModal';

interface DepartmentManagementTabProps {
  currentUser: UserType | null;
  allUsers?: UserType[];
  onRefresh?: () => void;
}

export const DepartmentManagementTab: React.FC<DepartmentManagementTabProps> = ({
  currentUser,
  allUsers = [],
  onRefresh,
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const canManageDepartments =
    isSuperAdmin ||
    currentUser?.role === 'IT_ADMIN' ||
    currentUser?.role === 'IT_OFFICER' ||
    (currentUser?.department
      ? currentUser.department.toLowerCase().includes('it') ||
        currentUser.department.toLowerCase().includes('information technology')
      : false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadedUsers, setLoadedUsers] = useState<UserType[]>(allUsers || []);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'EMERGENCY' | 'STANDARD'>('ALL');

  // Bulk Upload Modal State
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [headOfDepartment, setHeadOfDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Delete Confirmation Modal State
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await departmentService.getDepartments();
      setDepartments(data);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to load hospital departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    authService
      .getAllUsers()
      .then((users) => {
        if (users && users.length > 0) {
          setLoadedUsers(users);
        } else if (allUsers && allUsers.length > 0) {
          setLoadedUsers(allUsers);
        }
      })
      .catch((err) => {
        console.error('Failed to load users for HOD dropdown:', err);
        if (allUsers && allUsers.length > 0) setLoadedUsers(allUsers);
      });
  }, [allUsers]);

  const openAddModal = () => {
    setEditingDept(null);
    setCode('');
    setName('');
    setBuilding('Block A (Main Clinical)');
    setFloor('Ground Floor');
    setHeadOfDepartment('');
    setPhone('Ext. ');
    setIsEmergency(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setCode(dept.code);
    setName(dept.name);
    setBuilding(dept.building);
    setFloor(dept.floor);
    setHeadOfDepartment(dept.headOfDepartment);
    setPhone(dept.phone);
    setIsEmergency(Boolean(dept.isEmergency));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageDepartments) {
      setFormError('Only Super Administrators and IT Unit can create or update hospital departments.');
      return;
    }
    if (!name.trim()) {
      setFormError('Department name is required.');
      return;
    }
    if (!code.trim()) {
      setFormError('Department code/abbreviation is required (e.g. ICU, OPD).');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      if (editingDept) {
        await departmentService.updateDepartment(
          editingDept.id,
          {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            building: building.trim(),
            floor: floor.trim(),
            headOfDepartment: headOfDepartment.trim(),
            phone: phone.trim(),
            isEmergency,
          },
          currentUser
        );
        showNotification('success', `Department "${name.trim()}" updated successfully.`);
      } else {
        await departmentService.createDepartment(
          {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            building: building.trim(),
            floor: floor.trim(),
            headOfDepartment: headOfDepartment.trim(),
            phone: phone.trim(),
            isEmergency,
          },
          currentUser
        );
        showNotification('success', `Department "${name.trim()}" created successfully.`);
      }

      setIsModalOpen(false);
      setEditingDept(null);
      await loadDepartments();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save department.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!isSuperAdmin || !deptToDelete) return;
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setDeleteError('Please type "delete" to confirm department removal.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await departmentService.deleteDepartment(deptToDelete.id, currentUser);
      showNotification('success', `Department "${deptToDelete.name}" was permanently removed.`);
      setDeptToDelete(null);
      setDeleteConfirmText('');
      await loadDepartments();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete department.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (filterType === 'EMERGENCY' && !d.isEmergency) return false;
      if (filterType === 'STANDARD' && d.isEmergency) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesCode = d.code.toLowerCase().includes(q);
        const matchesBldg = d.building.toLowerCase().includes(q);
        const matchesHead = d.headOfDepartment.toLowerCase().includes(q);
        const matchesPhone = d.phone.toLowerCase().includes(q);
        return matchesName || matchesCode || matchesBldg || matchesHead || matchesPhone;
      }
      return true;
    });
  }, [departments, searchQuery, filterType]);

  const emergencyCount = departments.filter((d) => d.isEmergency).length;
  const standardCount = departments.filter((d) => !d.isEmergency).length;

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold transition shadow-md animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-500 text-white dark:bg-emerald-950 dark:border dark:border-emerald-700/60 dark:text-emerald-100'
              : 'bg-rose-500 text-white dark:bg-rose-950 dark:border dark:border-rose-700/60 dark:text-rose-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:opacity-80 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Stats */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight">
                  Hospital Departments & Clinical Units
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure clinical units, wards, emergency classifications, extensions, and unit leadership.
                </p>
              </div>
            </div>
          </div>

          {canManageDepartments && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl transition cursor-pointer shadow-3xs"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Upload</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm hover:shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
              </button>
            </div>
          )}
        </div>

        {/* Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Hospital Departments</div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {departments.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active functional hospital units</div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              <span>Emergency / Critical Units</span>
            </div>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
              {emergencyCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Priority SLA response routing</div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>General Wards & Administrative</span>
            </div>
            <div className="text-xl font-black font-mono text-sky-600 dark:text-sky-400 mt-1">
              {standardCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Standard clinical & service units</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments by name, code (e.g. ICU), building, or head..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="ALL">All Units ({departments.length})</option>
              <option value="EMERGENCY">Emergency / Critical Only ({emergencyCount})</option>
              <option value="STANDARD">Standard Wards Only ({standardCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Departments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
            Loading departments directory...
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              No hospital departments found matching your criteria.
            </p>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                + Add First Department
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department & Ward</th>
                  <th className="py-3 px-4">Location & Floor</th>
                  <th className="py-3 px-4">Head of Department</th>
                  <th className="py-3 px-4">Internal Ext</th>
                  <th className="py-3 px-4">Priority Classification</th>
                  {isSuperAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDepartments.map((dept) => (
                  <tr
                    key={dept.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {dept.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {dept.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ID: {dept.id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{dept.building}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pl-5">
                        {dept.floor}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium">{dept.headOfDepartment || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{dept.phone || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {dept.isEmergency ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          <Flame className="w-3 h-3 text-rose-500 animate-pulse" />
                          <span>Emergency Ward</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <span>Standard Unit</span>
                        </span>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(dept)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          title="Update department details"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeptToDelete(dept);
                            setDeleteConfirmText('');
                            setDeleteError(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          title="Permanently delete department"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT DEPARTMENT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {editingDept ? 'Update Hospital Department' : 'Register New Hospital Department'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingDept ? `Modifying ${editingDept.name}` : 'Add a clinical ward, diagnostics, or administrative unit'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Code / Abbrev *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ICU"
                    maxLength={10}
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Intensive Care Unit (ICU)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Building / Wing
                  </label>
                  <input
                    type="text"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    placeholder="Block A (Mother & Child)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Floor / Level
                  </label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="Level 2, North Wing"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Head of Department (HOD)
                  </label>
                  <select
                    value={headOfDepartment}
                    onChange={(e) => setHeadOfDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Select Staff User as HOD --</option>
                    {loadedUsers.map((u) => (
                      <option key={u.id} value={u.fullName}>
                        {u.fullName} ({u.department || 'Clinical'} • {u.role.replace(/_/g, ' ')})
                      </option>
                    ))}
                    {headOfDepartment && !loadedUsers.some((u) => u.fullName === headOfDepartment) && (
                      <option value={headOfDepartment}>{headOfDepartment} (Custom)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / Internal Extension
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ext. 104"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Emergency Classification Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                  />
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-rose-500" />
                      <span>Classify as Emergency / Critical Clinical Ward</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tickets raised from this unit trigger high-priority alerts and shorter SLA targets.
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer shadow-sm hover:shadow disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{formSaving ? 'Saving...' : editingDept ? 'Update Department' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/50 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Delete Hospital Department
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <strong className="text-slate-900 dark:text-white">{deptToDelete.name} ({deptToDelete.code})</strong>?
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Type <span className="font-mono text-rose-600 font-bold">delete</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDepartment}
                disabled={isDeleting || deleteConfirmText.trim().toLowerCase() !== 'delete'}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition cursor-pointer disabled:opacity-40 shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK DEPARTMENT UPLOAD */}
      <DepartmentBulkUploadModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        currentUser={currentUser}
        existingDepartments={departments}
        allUsers={loadedUsers}
        onSuccess={async (created) => {
          showNotification('success', `Successfully registered ${created.length} new hospital departments.`);
          await loadDepartments();
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
