import {
  type User,
  type Role,
  type AccountStatus,
  type OfflineSecurityPolicy,
  type SystemSettings,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  deleteFromStore,
  generateUUID,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { syncLatestStaffAccounts } from './seedData';
import { departmentService } from './departmentService';
import { settingsService } from './settingsService';

// Extract surname from full name (e.g. "Dr. Sarah Mensah" -> "Mensah")
export function extractSurname(fullName: string): string {
  if (!fullName) return 'User';
  const cleaned = fullName.replace(/^(Dr\.|Sister|Mr\.|Mrs\.|Ms\.|Prof\.|Rev\.)\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'User';
  return parts[parts.length - 1];
}

// Last 4 alphabets of surname as initial password
export function getDefaultPasswordForSurname(surname: string): string {
  if (!surname) return 'pass';
  const lettersOnly = surname.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (lettersOnly.length >= 4) {
    return lettersOnly.slice(-4);
  }
  return (lettersOnly + '1234').slice(0, 4);
}

// Extract initials (e.g. "John Doe" -> "JD", "Dr. Sarah Mensah" -> "SM")
export function getUserInitials(fullName: string): string {
  if (!fullName) return 'U';
  const cleaned = fullName.replace(/^(Dr\.|Sister|Mr\.|Mrs\.|Ms\.|Prof\.|Rev\.)\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface SpecialtyDefinition {
  id: string;
  label: string;
  category: 'Infrastructure' | 'Hardware' | 'Software' | 'Clinical' | 'Security' | 'Operations';
  color: string;
}

export const STANDARD_SPECIALTIES: SpecialtyDefinition[] = [
  { id: 'Network & Starlink', label: 'Network & Starlink WAN', category: 'Infrastructure', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200' },
  { id: 'Hardware & Workstations', label: 'Hardware & Workstations', category: 'Hardware', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200' },
  { id: 'LHIMS / Hospital EHR', label: 'LHIMS / Hospital EHR Systems', category: 'Software', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200' },
  { id: 'Printers & Barcodes', label: 'Printers & Barcode Scanners', category: 'Hardware', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200' },
  { id: 'Servers & Virtualization', label: 'Datacenter Servers & Virtualization', category: 'Infrastructure', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300' },
  { id: 'Database & SQL', label: 'Database & Data Replication', category: 'Software', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200' },
  { id: 'Power, UPS & Inverters', label: 'Datacenter Power & UPS Inverters', category: 'Infrastructure', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200' },
  { id: 'Biomedical & Diagnostic Devices', label: 'Biomedical & Diagnostic Consoles', category: 'Clinical', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200' },
  { id: 'Telephony & Intercoms', label: 'IP PBX Telephony & Ward Intercoms', category: 'Infrastructure', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200' },
  { id: 'Cybersecurity & Endpoint Security', label: 'Cybersecurity & Endpoint Antivirus', category: 'Security', color: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-violet-200' },
  { id: 'Clinical Informatics & Triage', label: 'Clinical Informatics & Ward Triage', category: 'Clinical', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200' },
  { id: 'Procurement & Inventory', label: 'IT Procurement & Spare Inventory', category: 'Operations', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200' },
];

export type Permission =
  | 'users.view'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'departments.view'
  | 'departments.create'
  | 'departments.update'
  | 'departments.delete'
  | 'departments.delete_all'
  | 'tickets.view'
  | 'tickets.create'
  | 'tickets.comment'
  | 'tickets.status_change'
  | 'tickets.assign'
  | 'tickets.resolve'
  | 'tickets.close'
  | 'tickets.delete'
  | 'assets.view'
  | 'assets.create'
  | 'assets.update'
  | 'assets.delete'
  | 'assets.bulk_upload'
  | 'assets.register_export'
  | 'assets.config_manage'
  | 'users.bulk_upload'
  | 'departments.bulk_upload'
  | 'maintenance.view'
  | 'maintenance.create'
  | 'maintenance.update'
  | 'maintenance.complete'
  | 'incidents.view'
  | 'incidents.create'
  | 'incidents.update'
  | 'incidents.close'
  | 'inventory.view'
  | 'inventory.create'
  | 'inventory.update'
  | 'inventory.adjust'
  | 'procurement.manage'
  | 'network.view'
  | 'network.create'
  | 'network.update'
  | 'network.delete'
  | 'network.manage'
  | 'systems.ping'
  | 'reports.view'
  | 'reports.export'
  | 'audit.view'
  | 'audit.export'
  | 'facility.manage'
  | 'settings.manage';

export interface PermissionDefinition {
  key: Permission;
  label: string;
  category: 'Tickets' | 'Topology & Network' | 'Assets & Maintenance' | 'Incidents' | 'Inventory & Procurement' | 'Compliance & Audit' | 'Facility & Admin';
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Tickets
  { key: 'tickets.view', label: 'View Tickets', category: 'Tickets', description: 'View assigned, departmental, or hospital-wide tickets' },
  { key: 'tickets.create', label: 'Create Tickets', category: 'Tickets', description: 'Submit new hardware, software, or network issue reports' },
  { key: 'tickets.comment', label: 'Post Comments', category: 'Tickets', description: 'Add progress updates, diagnostic notes, and attachment logs' },
  { key: 'tickets.status_change', label: 'Change Ticket Status', category: 'Tickets', description: 'Transition tickets between New, In Progress, Pending Vendor, etc.' },
  { key: 'tickets.assign', label: 'Assign Technicians', category: 'Tickets', description: 'Delegate tickets to specific IT officers or biomedical engineers' },
  { key: 'tickets.resolve', label: 'Resolve Tickets', category: 'Tickets', description: 'Submit official resolution report and root-cause fix' },
  { key: 'tickets.close', label: 'Close & Archive Tickets', category: 'Tickets', description: 'Verify resolution with clinical staff and close ticket' },
  { key: 'tickets.delete', label: 'Delete Tickets', category: 'Tickets', description: 'Permanently purge invalid or test tickets' },

  // Network & Topology
  { key: 'network.view', label: 'View Network Topology', category: 'Topology & Network', description: 'Inspect multi-tier hospital network diagram and device status (IT & Super Admin only)' },
  { key: 'network.create', label: 'Add Topology Nodes', category: 'Topology & Network', description: 'Register new core switches, routers, servers, endpoints, and APs' },
  { key: 'network.update', label: 'Edit Topology Devices', category: 'Topology & Network', description: 'Modify IP addresses, VLANs, rack positions, and switch ports' },
  { key: 'network.delete', label: 'Delete Topology Nodes', category: 'Topology & Network', description: 'Remove decommissioned or replaced network equipment from topology' },
  { key: 'network.manage', label: 'Full Network Administration', category: 'Topology & Network', description: 'Access firmware configs, Starlink failover logs, and wiring topology editor' },
  { key: 'systems.ping', label: 'Run Local Ping Test & Telemetry Checks', category: 'Topology & Network', description: 'Send active ping & port telemetry tests to hospital systems and switches (IT & Super Admin only)' },

  // Assets & Maintenance
  { key: 'assets.view', label: 'View Asset Registry', category: 'Assets & Maintenance', description: 'Browse clinical and IT asset inventory with QR barcoding' },
  { key: 'assets.create', label: 'Register Assets', category: 'Assets & Maintenance', description: 'Enroll new PCs, biometric terminals, and medical equipment' },
  { key: 'assets.update', label: 'Update Asset Records', category: 'Assets & Maintenance', description: 'Edit asset location, custodian, and maintenance status' },
  { key: 'assets.delete', label: 'Decommission / Delete Assets', category: 'Assets & Maintenance', description: 'Retire obsolete or written-off hardware assets' },
  { key: 'assets.bulk_upload', label: 'Bulk Import Assets (CSV/Excel)', category: 'Assets & Maintenance', description: 'Bulk upload hardware assets via CSV/Excel template' },
  { key: 'assets.register_export', label: 'Generate Asset Register (PDF/Excel)', category: 'Assets & Maintenance', description: 'Generate official hospital asset registers in PDF and Excel formats' },
  { key: 'assets.config_manage', label: 'Manage Asset Config (Types/Conditions/Statuses)', category: 'Assets & Maintenance', description: 'Configure custom asset types, conditions, and operational statuses' },
  { key: 'maintenance.view', label: 'View Maintenance Schedules', category: 'Assets & Maintenance', description: 'Inspect preventive maintenance checklists and calibration calendars' },
  { key: 'maintenance.create', label: 'Schedule Maintenance', category: 'Assets & Maintenance', description: 'Plan recurring switch cleaning, UPS battery tests, and server checks' },
  { key: 'maintenance.update', label: 'Edit Maintenance Plans', category: 'Assets & Maintenance', description: 'Reschedule or modify planned maintenance tasks' },
  { key: 'maintenance.complete', label: 'Perform / Sign Off Maintenance Logs', category: 'Assets & Maintenance', description: 'Log completed checklist work and certify equipment operation' },

  // Incidents
  { key: 'incidents.view', label: 'View Major Incidents', category: 'Incidents', description: 'Track hospital-wide critical system outages and LHIMS downtime' },
  { key: 'incidents.create', label: 'Declare Major Incident', category: 'Incidents', description: 'Initiate critical incident war room and broadcast notifications' },
  { key: 'incidents.update', label: 'Post Incident Timeline Updates', category: 'Incidents', description: 'Broadcast live technician progress across hospital departments' },
  { key: 'incidents.close', label: 'Publish Root Cause Analysis', category: 'Incidents', description: 'Finalize RCA report and mark incident resolved' },

  // Inventory & Procurement
  { key: 'inventory.view', label: 'View Stock & Consumables', category: 'Inventory & Procurement', description: 'Check toner, patch cords, RAM, and spare parts stock levels' },
  { key: 'inventory.create', label: 'Add Stock Items', category: 'Inventory & Procurement', description: 'Catalog new consumable items and min/max reorder thresholds' },
  { key: 'inventory.update', label: 'Edit Stock Catalog', category: 'Inventory & Procurement', description: 'Update supplier details, unit costs, and storage bins' },
  { key: 'inventory.adjust', label: 'Issue / Adjust Stock', category: 'Inventory & Procurement', description: 'Issue consumable parts to wards and record restock transactions' },
  { key: 'procurement.manage', label: 'Manage IT Procurement & Requisitions', category: 'Inventory & Procurement', description: 'Approve, place orders, and update procurement requisitions' },

  // Compliance & Audit
  { key: 'reports.view', label: 'View Operational Reports', category: 'Compliance & Audit', description: 'Access SLA compliance, uptime statistics, and MTTR charts' },
  { key: 'reports.export', label: 'Export Reports (CSV/PDF)', category: 'Compliance & Audit', description: 'Download executive reports and asset audit listings' },
  { key: 'audit.view', label: 'View Compliance Audit Trail', category: 'Compliance & Audit', description: 'Inspect immutable logs of all hospital user actions' },
  { key: 'audit.export', label: 'Export Audit Trail', category: 'Compliance & Audit', description: 'Download cryptographically verifiable CSV audit trails' },

  // Facility & Administration
  { key: 'users.view', label: 'View User Directory', category: 'Facility & Admin', description: 'View staff directory, roles, and assigned departments' },
  { key: 'users.create', label: 'Provision Staff Accounts', category: 'Facility & Admin', description: 'Create new user profiles and set roles' },
  { key: 'users.update', label: 'Edit Staff Accounts', category: 'Facility & Admin', description: 'Modify staff permissions, status, and department assignments' },
  { key: 'users.delete', label: 'Deactivate / Remove Users', category: 'Facility & Admin', description: 'Suspend or disable staff login credentials' },
  { key: 'users.bulk_upload', label: 'Bulk Provision Staff Accounts (CSV/Excel)', category: 'Facility & Admin', description: 'Bulk upload multiple user accounts via CSV or Excel template' },
  { key: 'departments.view', label: 'View Department Directory', category: 'Facility & Admin', description: 'Browse clinical units, wards, emergency classifications, extensions, and unit leadership' },
  { key: 'departments.create', label: 'Create Hospital Department', category: 'Facility & Admin', description: 'Register new wards and clinical departments' },
  { key: 'departments.update', label: 'Edit Department Details', category: 'Facility & Admin', description: 'Modify department leadership, extension numbers, building locations, and emergency flags' },
  { key: 'departments.delete', label: 'Delete Department', category: 'Facility & Admin', description: 'Permanently remove individual hospital departments' },
  { key: 'departments.delete_all', label: 'Delete All Departments (Super Admin Only)', category: 'Facility & Admin', description: 'Purge all registered hospital departments at once (restricted to Super Administrator)' },
  { key: 'departments.bulk_upload', label: 'Bulk Import Departments (CSV/Excel)', category: 'Facility & Admin', description: 'Bulk upload hospital departments and wards via CSV or Excel template' },
  { key: 'facility.manage', label: 'Edit Facility Details & Logo', category: 'Facility & Admin', description: 'Upload hospital emblem, configure LAN URLs, address, and contacts' },
  { key: 'settings.manage', label: 'Manage System Settings & Offline Policy', category: 'Facility & Admin', description: 'Configure sync intervals, offline thresholds, and global security rules' },
];

export const ROLE_DESCRIPTIONS: Record<Role, { title: string; description: string; badgeColor: string }> = {
  SUPER_ADMIN: {
    title: 'Super Administrator',
    description: 'Supreme hospital system authority. Configures facility profile, uploads hospital logo, manages network topology nodes (add/edit/delete), provisions staff RBAC, and oversees system security.',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300',
  },
  IT_ADMIN: {
    title: 'IT Administrator',
    description: 'Senior IT management. Directs technical operations, manages network topology devices, assigns tickets, declares major incidents, and oversees hospital infrastructure maintenance.',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300',
  },
  IT_OFFICER: {
    title: 'IT Support Officer / Biomedical Tech',
    description: 'Frontline technical specialist. Triages tickets, updates ticket status, executes repairs, submits resolution reports, tests network nodes, and performs scheduled hardware maintenance.',
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300',
  },
  HOSPITAL_MANAGEMENT: {
    title: 'Hospital Management / Medical Director',
    description: 'Executive clinical oversight. Views hospital system availability and performance status as a read-only viewer (just like frontline staff), monitors SLA performance, accesses executive summaries, and inspects incident root cause reports. Cannot modify system configurations or operational status.',
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300',
  },
  DEPARTMENT_HEAD: {
    title: 'Department Head (e.g., OPD, Pharmacy, Maternity)',
    description: 'Departmental clinical supervisor. Submits tickets for departmental equipment, reviews department ticket progress, adds updates, and monitors assigned ward assets.',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300',
  },
  STAFF_USER: {
    title: 'Clinical & General Staff (Nurses, Doctors, Clerks)',
    description: 'End-user clinical personnel. Views hospital system availability, submits issue tickets, views basic & troubleshooting guides, and adds progress comments on own tickets. Cannot alter ticket status or modify system configurations.',
    badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
  },
  PROCUREMENT_OFFICER: {
    title: 'Procurement & Inventory Officer',
    description: 'Supply chain specialist. Manages spare parts inventory, tracks hardware warranties, receives consumable stock, and oversees supplier replenishment.',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300',
  },
  AUDITOR: {
    title: 'Compliance & Quality Assurance Auditor',
    description: 'Independent compliance inspector. Inspects immutable audit trails, evaluates SLA adherence, verifies equipment maintenance histories, and exports compliance reports.',
    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300',
  },
};

// Role-to-Permissions Mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'users.view', 'users.create', 'users.update', 'users.delete', 'users.bulk_upload',
    'departments.view', 'departments.create', 'departments.update', 'departments.delete', 'departments.delete_all', 'departments.bulk_upload',
    'tickets.view', 'tickets.create', 'tickets.comment', 'tickets.status_change', 'tickets.assign', 'tickets.resolve', 'tickets.close', 'tickets.delete',
    'assets.view', 'assets.create', 'assets.update', 'assets.delete', 'assets.bulk_upload', 'assets.register_export', 'assets.config_manage',
    'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.complete',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.close',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
    'procurement.manage',
    'network.view', 'network.create', 'network.update', 'network.delete', 'network.manage',
    'systems.ping',
    'reports.view', 'reports.export',
    'audit.view', 'audit.export',
    'facility.manage', 'settings.manage',
  ],
  IT_ADMIN: [
    'users.view', 'users.create', 'users.update', 'users.bulk_upload',
    'departments.view', 'departments.create', 'departments.update', 'departments.delete', 'departments.bulk_upload',
    'tickets.view', 'tickets.create', 'tickets.comment', 'tickets.status_change', 'tickets.assign', 'tickets.resolve', 'tickets.close',
    'assets.view', 'assets.create', 'assets.update', 'assets.bulk_upload', 'assets.register_export',
    'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.complete',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.close',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
    'procurement.manage',
    'network.view', 'network.create', 'network.update', 'network.delete', 'network.manage',
    'systems.ping',
    'reports.view', 'reports.export',
    'audit.view', 'audit.export',
    'facility.manage',
  ],
  IT_OFFICER: [
    'departments.view', 'departments.create', 'departments.update', 'departments.bulk_upload',
    'tickets.view', 'tickets.create', 'tickets.comment', 'tickets.status_change', 'tickets.assign', 'tickets.resolve', 'tickets.close',
    'assets.view', 'assets.create', 'assets.update', 'assets.bulk_upload', 'assets.register_export',
    'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.complete',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.close',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
    'procurement.manage',
    'network.view', 'network.create', 'network.update', 'network.delete', 'network.manage',
    'systems.ping',
    'reports.view',
  ],
  HOSPITAL_MANAGEMENT: [
    'departments.view',
    'tickets.view',
    'assets.view',
    'maintenance.view',
    'incidents.view',
    'inventory.view',
    'reports.view', 'reports.export',
  ],
  DEPARTMENT_HEAD: [
    'departments.view',
    'tickets.view', 'tickets.create', 'tickets.comment',
    'assets.view',
    'reports.view',
  ],
  STAFF_USER: [
    'departments.view',
    'tickets.view', 'tickets.create', 'tickets.comment',
  ],
  PROCUREMENT_OFFICER: [
    'departments.view',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
    'procurement.manage',
    'assets.view',
    'reports.view', 'reports.export',
  ],
  AUDITOR: [
    'departments.view',
    'tickets.view',
    'assets.view',
    'maintenance.view',
    'incidents.view',
    'inventory.view',
    'reports.view', 'reports.export',
    'audit.view', 'audit.export',
  ],
};

const SESSION_KEY = 'hitoms_current_user_id';
const SESSION_TIMESTAMP_KEY = 'hitoms_session_timestamp';
const ROLE_PERMS_KEY = 'hitoms_role_permissions_overrides';
const USER_PERMS_KEY = 'hitoms_user_permissions_overrides';

class AuthService {
  private currentUser: User | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();

  public async init(): Promise<User | null> {
    const savedUserId = localStorage.getItem(SESSION_KEY);
    const sessionTime = localStorage.getItem(SESSION_TIMESTAMP_KEY);

    if (savedUserId && sessionTime) {
      // Check session expiry (72 hours default offline policy)
      const elapsedHours = (Date.now() - parseInt(sessionTime, 10)) / (1000 * 60 * 60);
      if (elapsedHours > 72) {
        this.logout();
        return null;
      }

      const user = await getFromStore<User>('users', savedUserId);
      if (user && user.status === 'Active') {
        this.currentUser = user;
        this.notify();
        return user;
      }
    }

    // Default to null so the Login Screen is always presented as the default page on app launch
    this.currentUser = null;
    this.notify();
    return null;
  }

  public subscribe(listener: (user: User | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) {
      l(this.currentUser);
    }
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  // --- PERMISSION MATRIX (Role & Individual User Overrides) ---

  public getRolePermissions(role: Role): Permission[] {
    try {
      const stored = localStorage.getItem(ROLE_PERMS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[role] && Array.isArray(parsed[role])) {
          return parsed[role];
        }
      }
    } catch (e) {
      console.warn('Error reading role permissions overrides', e);
    }
    return ROLE_PERMISSIONS[role] || [];
  }

  public async updateRolePermissions(role: Role, permissions: Permission[], actor?: User): Promise<void> {
    let currentMap: Record<string, Permission[]> = {};
    try {
      const stored = localStorage.getItem(ROLE_PERMS_KEY);
      if (stored) currentMap = JSON.parse(stored);
    } catch {}

    currentMap[role] = permissions;
    localStorage.setItem(ROLE_PERMS_KEY, JSON.stringify(currentMap));

    if (actor) {
      await auditService.logAction(
        'UPDATE_ROLE_PERMISSIONS',
        'Administration',
        role,
        { role },
        { permissionsCount: permissions.length, permissions }
      );
    }

    this.notify();
  }

  public getUserPermissionOverrides(userId: string): { granted: Permission[]; revoked: Permission[] } {
    try {
      const stored = localStorage.getItem(USER_PERMS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[userId]) {
          return {
            granted: parsed[userId].granted || [],
            revoked: parsed[userId].revoked || [],
          };
        }
      }
    } catch {}
    return { granted: [], revoked: [] };
  }

  public async updateUserPermissionOverrides(
    userId: string,
    overrides: { granted: Permission[]; revoked: Permission[] },
    actor?: User
  ): Promise<void> {
    let currentMap: Record<string, { granted: Permission[]; revoked: Permission[] }> = {};
    try {
      const stored = localStorage.getItem(USER_PERMS_KEY);
      if (stored) currentMap = JSON.parse(stored);
    } catch {}

    currentMap[userId] = overrides;
    localStorage.setItem(USER_PERMS_KEY, JSON.stringify(currentMap));

    if (actor) {
      await auditService.logAction(
        'UPDATE_USER_PERMISSION_OVERRIDES',
        'Administration',
        userId,
        { userId },
        overrides
      );
    }

    this.notify();
  }

  public async resetPermissionsToDefault(actor?: User): Promise<void> {
    localStorage.removeItem(ROLE_PERMS_KEY);
    localStorage.removeItem(USER_PERMS_KEY);
    if (actor) {
      await auditService.logAction(
        'RESET_PERMISSIONS_MATRIX',
        'Administration',
        'SYSTEM',
        null,
        { reset: true }
      );
    }
    this.notify();
  }

  public getEffectivePermissions(user?: User | null): Permission[] {
    const target = user || this.currentUser;
    if (!target) return [];

    const basePerms = this.getRolePermissions(target.role);
    const overrides = this.getUserPermissionOverrides(target.id);

    const permSet = new Set<Permission>(basePerms);
    for (const g of overrides.granted) {
      permSet.add(g);
    }
    for (const r of overrides.revoked) {
      permSet.delete(r);
    }

    return Array.from(permSet);
  }

  public hasPermission(permission: Permission, user?: User): boolean {
    const target = user || this.currentUser;
    if (!target) return false;

    // Super Admin retains supreme access unless explicitly revoked
    const overrides = this.getUserPermissionOverrides(target.id);
    if (overrides.revoked.includes(permission)) return false;
    if (target.role === 'SUPER_ADMIN' && overrides.revoked.length === 0) return true;

    const effective = this.getEffectivePermissions(target);
    return effective.includes(permission);
  }

  public getRoleTitle(role: Role, settings?: SystemSettings | null): string {
    const currentSettings = settings || settingsService.getSettingsSync();
    const custom = currentSettings?.customRoleTitles?.[role];
    if (custom && custom.trim()) {
      return custom.trim();
    }
    return ROLE_DESCRIPTIONS[role]?.title || role;
  }

  public isRoleFrozen(role: Role, settings?: SystemSettings | null): boolean {
    const currentSettings = settings || settingsService.getSettingsSync();
    const frozenList = currentSettings?.frozenRoles || [];
    return frozenList.includes(role);
  }

  public getSelectableRoles(
    actor?: User | null,
    settings?: SystemSettings | null,
    includeRoleIfSelected?: Role
  ): Role[] {
    const targetActor = actor || this.currentUser;
    const isSuperAdmin = targetActor?.role === 'SUPER_ADMIN';
    const currentSettings = settings || settingsService.getSettingsSync();

    const allRolesList: Role[] = [
      'SUPER_ADMIN',
      'IT_ADMIN',
      'IT_OFFICER',
      'HOSPITAL_MANAGEMENT',
      'DEPARTMENT_HEAD',
      'STAFF_USER',
      'PROCUREMENT_OFFICER',
      'AUDITOR',
    ];

    return allRolesList.filter((r) => {
      // Non-Super Admins cannot grant SUPER_ADMIN role
      if (!isSuperAdmin && r === 'SUPER_ADMIN') return false;

      // Check if role is frozen by Super Admin
      const frozen = this.isRoleFrozen(r, currentSettings);
      if (frozen) {
        // If editing a user who ALREADY has this role, keep it in the dropdown
        if (includeRoleIfSelected === r) return true;
        // Non-Super Admins (e.g. IT Admins adding users) will NOT see frozen roles
        if (!isSuperAdmin) return false;
      }

      return true;
    });
  }

  public isSuperAdminOrIT(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    // Hospital management, clinical staff, auditors, dept heads, and procurement are NOT IT system administrators
    if (
      target.role === 'HOSPITAL_MANAGEMENT' ||
      target.role === 'STAFF_USER' ||
      target.role === 'AUDITOR' ||
      target.role === 'DEPARTMENT_HEAD' ||
      target.role === 'PROCUREMENT_OFFICER'
    ) {
      return false;
    }
    return (
      target.role === 'SUPER_ADMIN' ||
      target.role === 'IT_ADMIN' ||
      target.role === 'IT_OFFICER'
    );
  }

  public isReadOnlyAuditorOrManagement(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    return target.role === 'AUDITOR' || target.role === 'HOSPITAL_MANAGEMENT';
  }

  public canRunPingTest(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    // Strictly Super Admin and IT unit staff
    return this.isSuperAdminOrIT(target) && this.hasPermission('systems.ping', target);
  }

  public canAccessNetwork(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    // Strictly Super Admin and IT unit staff
    return this.isSuperAdminOrIT(target) && this.hasPermission('network.view', target);
  }

  public canManageMaintenance(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    if (this.isReadOnlyAuditorOrManagement(target)) return false;
    return this.isSuperAdminOrIT(target) && this.hasPermission('maintenance.create', target);
  }

  public canManageIncidents(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    if (this.isReadOnlyAuditorOrManagement(target)) return false;
    return this.isSuperAdminOrIT(target) && this.hasPermission('incidents.create', target);
  }

  public canManageInventory(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    if (this.isReadOnlyAuditorOrManagement(target)) return false;
    return this.isSuperAdminOrIT(target) || target.role === 'PROCUREMENT_OFFICER';
  }

  public canManageAssets(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    if (this.isReadOnlyAuditorOrManagement(target)) return false;
    return this.isSuperAdminOrIT(target);
  }

  public canManageProcurement(user?: User | null): boolean {
    const target = user || this.currentUser;
    if (!target) return false;
    if (this.isReadOnlyAuditorOrManagement(target)) return false;
    return this.isSuperAdminOrIT(target) || target.role === 'PROCUREMENT_OFFICER' || target.role === 'DEPARTMENT_HEAD';
  }

  // --- LOGIN & AUTHENTICATION WITH CREDENTIALS ---

  public async loginWithCredentials(
    usernameOrEmail: string,
    passwordAttempt: string
  ): Promise<{ user: User; mustChangePassword: boolean }> {
    const trimmedInput = usernameOrEmail.trim().toLowerCase();
    const cleanPassword = passwordAttempt.trim();

    let users = await getAllFromStore<User>('users');
    let user = users.find((u) => {
      const uEmail = (u.email || '').toLowerCase();
      const uUsername = (u.username || '').toLowerCase();
      const uFullName = (u.fullName || '').toLowerCase();
      const uSurname = extractSurname(u.fullName).toLowerCase();
      return (
        uEmail === trimmedInput ||
        uUsername === trimmedInput ||
        uSurname === trimmedInput ||
        uFullName === trimmedInput ||
        (trimmedInput.length >= 3 && uFullName.includes(trimmedInput))
      );
    });

    // If not found locally (e.g. mobile device with older cache), auto-sync latest staff profiles
    if (!user) {
      users = await syncLatestStaffAccounts();
      user = users.find((u) => {
        const uEmail = (u.email || '').toLowerCase();
        const uUsername = (u.username || '').toLowerCase();
        const uFullName = (u.fullName || '').toLowerCase();
        const uSurname = extractSurname(u.fullName).toLowerCase();
        return (
          uEmail === trimmedInput ||
          uUsername === trimmedInput ||
          uSurname === trimmedInput ||
          uFullName === trimmedInput ||
          (trimmedInput.length >= 3 && uFullName.includes(trimmedInput))
        );
      });
    }

    if (!user) {
      throw new Error('No hospital staff profile found with this Surname, Username, or Email.');
    }

    if (user.status !== 'Active') {
      throw new Error(`Account status is ${user.status}. Please contact the Super Administrator.`);
    }

    // Determine expected default password based on Surname's last 4 alphabets
    const surname = extractSurname(user.fullName);
    const defaultPassword = getDefaultPasswordForSurname(surname);

    const hasChangedPassword = !!user.lastPasswordChangeAt;

    const isMatch = hasChangedPassword
      ? (user.password && user.password === cleanPassword)
      : (user.password && user.password === cleanPassword) ||
        cleanPassword.toLowerCase() === defaultPassword.toLowerCase() ||
        (user.role === 'SUPER_ADMIN' && cleanPassword.toLowerCase() === 'admin');

    if (!isMatch) {
      throw new Error('Incorrect password. For new accounts, initial password is the last 4 letters of your Surname.');
    }

    // Check if mandatory change password applies
    const settings = await getFromStore<SystemSettings>('settings', 'main');
    const isMandatoryByAdmin = Boolean(settings?.mandatoryPasswordChangeOnFirstLogin);
    const mustChange = Boolean(user.mustChangePasswordOnFirstLogin || (isMandatoryByAdmin && !user.lastPasswordChangeAt));

    user.lastLoginAt = new Date().toISOString();
    await putToStore('users', user);

    this.currentUser = user;
    localStorage.setItem(SESSION_KEY, user.id);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    this.notify();

    return { user, mustChangePassword: mustChange };
  }

  public async changePassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const user = await getFromStore<User>('users', userId);
    if (!user) throw new Error('User not found.');

    user.password = newPassword;
    user.mustChangePasswordOnFirstLogin = false;
    user.lastPasswordChangeAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    await putToStore('users', user);

    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = user;
      this.notify();
    }

    await auditService.logAction(
      'CHANGE_PASSWORD',
      'Administration',
      userId,
      null,
      { timestamp: user.lastPasswordChangeAt }
    );
  }

  public async bulkCreateStaff(
    staffList: Array<{
      fullName: string;
      department: string;
      role: Role;
      phone?: string;
      email?: string;
      jobTitle?: string;
    }>,
    mandatoryPasswordChange: boolean,
    actor: User
  ): Promise<{ created: number; skipped: number; accounts: Array<{ fullName: string; username: string; defaultPassword: string; role: Role; department: string }> }> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error('Access Denied: Only Super Administrators can bulk provision staff accounts.');
    }

    const existingUsers = await getAllFromStore<User>('users');
    const existingEmails = new Set(existingUsers.map((u) => (u.email || '').toLowerCase().trim()));
    const existingUsernames = new Set(existingUsers.map((u) => (u.username || '').toLowerCase().trim()));
    const existingFullNames = new Set(existingUsers.map((u) => (u.fullName || '').toLowerCase().trim()));
    const now = new Date().toISOString();
    const deviceId = getDeviceId();

    let createdCount = 0;
    let skippedCount = 0;
    const generatedAccounts: Array<{ fullName: string; username: string; defaultPassword: string; role: Role; department: string }> = [];

    for (const item of staffList) {
      if (!item.fullName || !String(item.fullName).trim()) {
        skippedCount++;
        continue;
      }

      const fullName = String(item.fullName).trim();
      const normalizedFullName = fullName.toLowerCase();

      // Check for exact full name duplicate
      if (existingFullNames.has(normalizedFullName)) {
        skippedCount++;
        continue;
      }

      const surname = extractSurname(fullName);
      let baseUsername = ((item as any).username || surname || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!baseUsername) baseUsername = 'user';
      let username = baseUsername;
      let counter = 1;
      while (existingUsernames.has(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      const defaultPassword = getDefaultPasswordForSurname(surname);
      let email = (item.email ? String(item.email).trim() : '') || `${username}@hospital.local`;
      if (existingEmails.has(email.toLowerCase())) {
        email = `${username}@hospital.local`;
      }

      const dept = (item.department ? String(item.department).trim() : '');

      const newUser: User = {
        id: 'usr-' + generateUUID().substring(0, 8),
        fullName,
        username,
        email,
        phone: (item.phone ? String(item.phone).trim() : '') || '+233 24 000 0000',
        department: dept,
        departments: dept ? [dept] : [],
        jobTitle: (item.jobTitle ? String(item.jobTitle).trim() : '') || 'Hospital Staff',
        role: item.role || 'STAFF_USER',
        status: 'Active',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        offlineAccessAllowed: true,
        password: defaultPassword,
        mustChangePasswordOnFirstLogin: mandatoryPasswordChange,
        _syncStatus: 'LOCAL_ONLY',
        _syncVersion: 1,
        _lastSyncedAt: null,
        _deviceId: deviceId,
      };

      await putToStore('users', newUser);
      
      try {
        const { syncService } = await import('./syncService');
        await syncService.enqueueOperation('users', newUser.id, 'CREATE', newUser);
      } catch (e) {
        console.warn('[authService] Error enqueuing bulk created user to syncService:', e);
      }

      existingFullNames.add(normalizedFullName);
      existingUsernames.add(username);
      existingEmails.add(email.toLowerCase());
      createdCount++;

      generatedAccounts.push({
        fullName,
        username,
        defaultPassword,
        role: newUser.role,
        department: newUser.department,
      });
    }

    await auditService.logAction(
      'BULK_CREATE_STAFF',
      'Administration',
      'STAFF_DIRECTORY',
      null,
      { createdCount, skippedCount, mandatoryPasswordChange }
    );

    return { created: createdCount, skipped: skippedCount, accounts: generatedAccounts };
  }

  public async loginWithEmail(email: string): Promise<User> {
    const users = await getAllFromStore<User>('users');
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      throw new Error('User not found with this hospital email address.');
    }
    if (user.status !== 'Active') {
      throw new Error(`Account is currently ${user.status}. Please contact the Super Admin.`);
    }

    user.lastLoginAt = new Date().toISOString();
    await putToStore('users', user);

    this.currentUser = user;
    localStorage.setItem(SESSION_KEY, user.id);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    this.notify();
    return user;
  }

  public async loginAs(userId: string): Promise<User | null> {
    const user = await getFromStore<User>('users', userId);
    if (!user) return null;
    if (user.status !== 'Active') {
      throw new Error(`User account is ${user.status}`);
    }

    user.lastLoginAt = new Date().toISOString();
    await putToStore('users', user);

    this.currentUser = user;
    localStorage.setItem(SESSION_KEY, user.id);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    this.notify();
    return user;
  }

  public async getAllUsers(): Promise<User[]> {
    return await getAllFromStore<User>('users');
  }

  public async getUserById(userId: string): Promise<User | null> {
    return await getFromStore<User>('users', userId);
  }

  public async createUser(
    userData: Partial<User>,
    actor: User
  ): Promise<User> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error('Access Denied: Only Super Administrators can provision staff accounts.');
    }

    if (!userData.fullName || !userData.fullName.trim()) {
      throw new Error('Full Name is required.');
    }

    const fullName = (userData.fullName || '').trim();
    const surname = extractSurname(fullName);
    const username = (userData.username || '').trim().toLowerCase() || surname.toLowerCase();
    const defaultPassword = userData.password || getDefaultPasswordForSurname(surname);
    const email = (userData.email || '').trim() || `${username}@hospital.local`;
    const now = new Date().toISOString();
    const deviceId = getDeviceId();

    const existingUsers = await getAllFromStore<User>('users');
    const duplicate = existingUsers.find(
      (u) => (u.email || '').toLowerCase() === email.toLowerCase() || (u.username && u.username.toLowerCase() === username)
    );

    if (duplicate) {
      throw new Error(`A user with email "${email}" or username "@${username}" already exists.`);
    }

    // Process departments (tied by checkboxes)
    const rawDepts = userData.departments && userData.departments.length > 0
      ? userData.departments
      : (userData.department ? [userData.department] : []);
    const cleanDepts = Array.from(new Set(rawDepts.map((d) => (d || '').trim()).filter(Boolean)));
    const primaryDept = (userData.department || '').trim() || cleanDepts[0] || '';

    const newUser: User = {
      id: userData.id || 'usr-' + generateUUID().substring(0, 8),
      fullName,
      username,
      email,
      phone: userData.phone?.trim() || '+233 24 000 0000',
      photoURL: userData.photoURL || '',
      department: primaryDept,
      departments: cleanDepts,
      jobTitle: userData.jobTitle?.trim() || 'Hospital Staff',
      role: userData.role || 'STAFF_USER',
      specialties: userData.specialties || [],
      specialtyNotes: userData.specialtyNotes?.trim() || '',
      status: userData.status || 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: userData.offlineAccessAllowed ?? true,
      signature: userData.signature || ((userData.role === 'SUPER_ADMIN' || userData.role === 'IT_ADMIN') ? fullName : ''),
      password: defaultPassword,
      mustChangePasswordOnFirstLogin: userData.mustChangePasswordOnFirstLogin ?? true,
      _syncStatus: 'LOCAL_ONLY',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: deviceId,
    };

    await putToStore('users', newUser);

    try {
      const { syncService } = await import('./syncService');
      await syncService.enqueueOperation('users', newUser.id, 'CREATE', newUser);
    } catch (e) {
      console.warn('[authService] Error enqueuing created user to syncService:', e);
    }

    await auditService.logAction(
      'CREATE_USER',
      'Administration',
      newUser.id,
      null,
      `${newUser.fullName} (@${newUser.username}, Role: ${newUser.role}, Dept: ${newUser.department})`
    );

    return newUser;
  }

  public async updateUser(
    userId: string,
    updates: Partial<User>,
    actor: User
  ): Promise<User> {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isSelf = actor.id === userId;

    if (!isSuperAdmin && !isSelf) {
      throw new Error('Access Denied: You can only edit your own profile, or you must be a Super Administrator.');
    }

    const user = await getFromStore<User>('users', userId);
    if (!user) {
      throw new Error('User profile not found in local database.');
    }

    const oldSnapshot = `${user.fullName} (${user.role}, ${user.department}, ${user.status})`;
    const now = new Date().toISOString();

    if (updates.departments && updates.departments.length > 0) {
      user.departments = Array.from(new Set(updates.departments.map((d) => (d || '').trim()).filter(Boolean)));
      if (updates.department === undefined) {
        user.department = user.departments[0] || user.department;
      }
    }

    // Field updates
    if (updates.fullName !== undefined) user.fullName = (updates.fullName || '').trim();
    if (updates.username !== undefined) user.username = (updates.username || '').trim().toLowerCase();
    if (updates.email !== undefined) user.email = (updates.email || '').trim();
    if (updates.phone !== undefined) user.phone = (updates.phone || '').trim();
    if (updates.department !== undefined) {
      const cleanDept = (updates.department || '').trim();
      user.department = cleanDept;
      if (cleanDept && (!user.departments || !user.departments.includes(cleanDept))) {
        user.departments = Array.from(new Set([...(user.departments || []), cleanDept]));
      }
    }
    if (updates.jobTitle !== undefined) user.jobTitle = (updates.jobTitle || '').trim();
    if (updates.specialties !== undefined) user.specialties = updates.specialties;
    if (updates.specialtyNotes !== undefined) user.specialtyNotes = (updates.specialtyNotes || '').trim();
    if (updates.photoURL !== undefined) user.photoURL = updates.photoURL;
    if (updates.signature !== undefined) user.signature = updates.signature;
    if (updates.offlineAccessAllowed !== undefined) user.offlineAccessAllowed = updates.offlineAccessAllowed;

    // Password reset / update by admin
    if (updates.password && updates.password.trim()) {
      user.password = updates.password.trim();
      user.lastPasswordChangeAt = now;
      if (updates.mustChangePasswordOnFirstLogin !== undefined) {
        user.mustChangePasswordOnFirstLogin = updates.mustChangePasswordOnFirstLogin;
      }
    } else if (updates.mustChangePasswordOnFirstLogin !== undefined) {
      user.mustChangePasswordOnFirstLogin = updates.mustChangePasswordOnFirstLogin;
    }

    // Role and status changes only allowed by Super Admin
    if (isSuperAdmin) {
      if (updates.role !== undefined) user.role = updates.role;
      if (updates.status !== undefined) user.status = updates.status;
    }

    user.updatedAt = now;

    await putToStore('users', user);

    try {
      const { syncService } = await import('./syncService');
      await syncService.enqueueOperation('users', user.id, 'UPDATE', user);
    } catch (e) {
      console.warn('[authService] Error enqueuing updated user to syncService:', e);
    }

    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = { ...user };
      this.notify();
    }

    await auditService.logAction(
      'UPDATE_USER_PROFILE',
      'Administration',
      user.id,
      oldSnapshot,
      `${user.fullName} (${user.role}, ${user.department}, ${user.status})`
    );

    return user;
  }

  public async setUserStatus(
    userId: string,
    status: AccountStatus,
    actor: User,
    reason?: string
  ): Promise<User> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error('Access Denied: Only Super Administrators can suspend or modify user account status.');
    }

    const user = await getFromStore<User>('users', userId);
    if (!user) {
      throw new Error('User not found.');
    }

    if (userId === actor.id && status !== 'Active') {
      throw new Error('Safety Lock: You cannot suspend or disable your own active Super Administrator account.');
    }

    const oldStatus = user.status;
    user.status = status;
    user.updatedAt = new Date().toISOString();

    await putToStore('users', user);

    await auditService.logAction(
      'SET_USER_STATUS',
      'Administration',
      user.id,
      oldStatus,
      `Status changed to ${status}${reason ? ` (Reason: ${reason})` : ''}`
    );

    if (this.currentUser && this.currentUser.id === userId) {
      if (status !== 'Active') {
        this.logout();
      } else {
        this.currentUser = { ...user };
        this.notify();
      }
    }

    return user;
  }

  public async deleteUser(
    userId: string,
    actor: User
  ): Promise<void> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error('Access Denied: Only Super Administrators can delete user profiles.');
    }

    if (userId === actor.id) {
      throw new Error('Safety Lock: You cannot delete your own active Super Administrator account.');
    }

    const user = await getFromStore<User>('users', userId);
    if (!user) {
      throw new Error('User not found.');
    }

    // Safety guard for primary root admin
    if (user.role === 'SUPER_ADMIN' && (user.username?.toLowerCase() === 'admin' || user.id === 'usr-admin-001')) {
      throw new Error('Protected Account: The primary Super Administrator profile (admin) cannot be deleted.');
    }

    await deleteFromStore('users', userId);

    try {
      const { syncService } = await import('./syncService');
      await syncService.enqueueOperation('users', userId, 'DELETE', user);
    } catch (e) {
      console.warn('[authService] Error enqueuing deleted user to syncService:', e);
    }

    // Clean up any permission overrides
    try {
      const stored = localStorage.getItem(USER_PERMS_KEY);
      if (stored) {
        const allOverrides = JSON.parse(stored);
        if (allOverrides[userId]) {
          delete allOverrides[userId];
          localStorage.setItem(USER_PERMS_KEY, JSON.stringify(allOverrides));
        }
      }
    } catch (e) {
      console.warn('Failed to clean up user permission overrides:', e);
    }

    await auditService.logAction(
      'DELETE_USER',
      'Administration',
      userId,
      `${user.fullName} (@${user.username || ''}, ${user.role}, ${user.department})`,
      null
    );
  }

  /**
   * Bulk Deletes selected user accounts from IndexedDB and logs action
   */
  public async bulkDeleteUsers(
    userIds: string[],
    actor: User
  ): Promise<{ deletedCount: number; skippedCount: number }> {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'IT_ADMIN') {
      throw new Error('Access Denied: Only Administrators can bulk-delete user profiles.');
    }

    let deletedCount = 0;
    let skippedCount = 0;

    for (const id of userIds) {
      if (id === actor.id) {
        skippedCount++;
        continue;
      }
      const user = await getFromStore<User>('users', id);
      if (!user) continue;

      if (
        user.role === 'SUPER_ADMIN' &&
        (user.username?.toLowerCase() === 'kay' || user.fullName.toLowerCase().includes('courage kay'))
      ) {
        skippedCount++;
        continue;
      }

      await deleteFromStore('users', id);

      try {
        const { syncService } = await import('./syncService');
        await syncService.enqueueOperation('users', id, 'DELETE', user);
      } catch (e) {
        console.warn('[authService] Error enqueuing bulk deleted user to syncService:', e);
      }

      deletedCount++;
    }

    await auditService.logAction(
      'BULK_DELETE_USERS',
      'Administration',
      actor.id,
      null,
      `Bulk deleted ${deletedCount} staff accounts (Skipped ${skippedCount} protected/self accounts)`
    );

    return { deletedCount, skippedCount };
  }

  /**
   * Bulk update account status (Active, Suspended, Disabled) for multiple users
   */
  public async bulkSetUserStatus(
    userIds: string[],
    status: AccountStatus,
    actor: User
  ): Promise<number> {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'IT_ADMIN') {
      throw new Error('Access Denied: Only Administrators can bulk-update user status.');
    }

    let updatedCount = 0;
    for (const id of userIds) {
      if (id === actor.id && status !== 'Active') continue;
      const user = await getFromStore<User>('users', id);
      if (!user) continue;

      user.status = status;
      user.updatedAt = new Date().toISOString();
      await putToStore('users', user);
      updatedCount++;
    }

    await auditService.logAction(
      'BULK_SET_USER_STATUS',
      'Administration',
      actor.id,
      null,
      `Bulk updated status to ${status} for ${updatedCount} accounts`
    );

    return updatedCount;
  }

  /**
   * Force pull & reconcile users directly from Firestore into local IndexedDB
   */
  public async forceResyncUsersFromCloud(actor: User): Promise<{ totalPulled: number; purgedStale: number }> {
    const { syncService } = await import('./syncService');
    await syncService.runAutomaticSync();
    
    const users = await getAllFromStore<User>('users');
    return {
      totalPulled: users.length,
      purgedStale: 0,
    };
  }

  /**
   * Purges orphaned user overrides, stale cache, and ensures integrity of user references
   */
  public async purgeOrphanedUserData(): Promise<{ purgedOverrides: number; purgedStaleSession: boolean }> {
    const validUsers = await getAllFromStore<User>('users');
    const validUserIds = new Set(validUsers.map((u) => u.id));
    let purgedOverrides = 0;
    let purgedStaleSession = false;

    try {
      const stored = localStorage.getItem(USER_PERMS_KEY);
      if (stored) {
        const allOverrides = JSON.parse(stored);
        let modified = false;
        for (const userId of Object.keys(allOverrides)) {
          if (!validUserIds.has(userId)) {
            delete allOverrides[userId];
            purgedOverrides++;
            modified = true;
          }
        }
        if (modified) {
          localStorage.setItem(USER_PERMS_KEY, JSON.stringify(allOverrides));
        }
      }
    } catch (e) {
      console.warn('Error purging orphaned user overrides:', e);
    }

    const currentSessionId = localStorage.getItem(SESSION_KEY);
    if (currentSessionId && !validUserIds.has(currentSessionId)) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_TIMESTAMP_KEY);
      this.currentUser = null;
      purgedStaleSession = true;
    }

    return { purgedOverrides, purgedStaleSession };
  }

  public logout(): void {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    this.notify();
  }

  public getOfflinePolicy(): OfflineSecurityPolicy {
    const raw = localStorage.getItem('hitoms_offline_policy');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        // fallback
      }
    }
    return {
      allowOfflineLogin: true,
      maxOfflineHours: 72,
      allowOfflineTicketCreation: true,
      allowOfflineAssetModification: true,
      allowOfflineInventoryTx: true,
      allowOfflineAdmin: true,
    };
  }

  public setOfflinePolicy(policy: OfflineSecurityPolicy): void {
    localStorage.setItem('hitoms_offline_policy', JSON.stringify(policy));
  }
}

export const authService = new AuthService();
