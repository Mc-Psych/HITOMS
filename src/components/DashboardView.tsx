import React, { useState } from 'react';
import { IntegrityReportWidget } from './IntegrityReportWidget';
import {
  LifeBuoy,
  HardDrive,
  CalendarCheck,
  Package,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  PlusCircle,
  Wifi,
  Server,
  TrendingUp,
  Wrench,
  Timer,
  BarChart2,
  Check,
  Eye,
  ChevronUp,
  ChevronDown,
  Settings,
  X,
  Users,
} from 'lucide-react';
import {
  type Ticket,
  type Asset,
  type MaintenanceRecord,
  type Incident,
  type HospitalSystem,
  type InventoryItem,
  type User,
  type SystemSettings,
  type Role,
} from '../types';
import { authService } from '../services/authService';
import { formatResolutionInterval } from '../utils/ticketPriorityAnalyzer';
import { putToStore } from '../services/localDatabaseService';
import { auditService } from '../services/auditService';

interface DashboardViewProps {
  tickets?: Ticket[];
  assets?: Asset[];
  maintenance?: MaintenanceRecord[];
  maintenanceRecords?: MaintenanceRecord[];
  incidents?: Incident[];
  systems?: HospitalSystem[];
  hospitalSystems?: HospitalSystem[];
  inventory?: InventoryItem[];
  inventoryItems?: InventoryItem[];
  networkDevices?: any[];
  auditLogs?: any[];
  syncQueue?: any[];
  currentUser?: User | null;
  systemSettings?: SystemSettings | null;
  onNavigate?: (viewId: string) => void;
  onOpenCreateTicket?: () => void;
  onRefresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tickets = [],
  assets = [],
  maintenance = [],
  maintenanceRecords = [],
  incidents = [],
  systems = [],
  hospitalSystems = [],
  inventory = [],
  inventoryItems = [],
  currentUser,
  systemSettings,
  onNavigate = (_viewId: string) => {},
  onOpenCreateTicket = () => {},
  onRefresh = () => {},
}) => {
  const [showResolutionMetricsToAll, setShowResolutionMetricsToAll] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedIntervalRoles, setSelectedIntervalRoles] = useState<Role[]>(
    systemSettings?.intervalVisibleRoles || ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER']
  );

  const safeTickets = tickets || [];
  const safeMaintenance = (maintenance && maintenance.length > 0) ? maintenance : (maintenanceRecords || []);
  const safeIncidents = incidents || [];
  const safeSystemsRaw = (systems && systems.length > 0) ? systems : (hospitalSystems || []);
  const safeSystems = [...safeSystemsRaw].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const safeInventory = (inventory && inventory.length > 0) ? inventory : (inventoryItems || []);

  // Super Admin, IT Unit & Procurement Access Check
  const isSuperAdminOrIT = authService.isSuperAdminOrIT(currentUser);

  // Check if current user is permitted to see turnaround intervals on individual tickets
  const permittedRoles = systemSettings?.intervalVisibleRoles || ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
  const canSeeTurnaroundIntervals =
    isSuperAdminOrIT ||
    showResolutionMetricsToAll ||
    (currentUser?.role && permittedRoles.includes(currentUser.role as Role));

  const handleMoveDashboardSystemOrder = async (sys: HospitalSystem, direction: 'UP' | 'DOWN', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSuperAdminOrIT) return;
    const sorted = [...safeSystemsRaw].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const currentIndex = sorted.findIndex((s) => s.id === sys.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap positions
    const temp = sorted[currentIndex];
    sorted[currentIndex] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    const now = new Date().toISOString();
    for (let i = 0; i < sorted.length; i++) {
      const itemToSave = {
        ...sorted[i],
        displayOrder: i,
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
      };
      await putToStore('hospitalSystems', itemToSave);
    }

    await auditService.logAction(
      'REARRANGE_CORE_SERVICES',
      'Dashboard',
      sys.id,
      null,
      `Rearranged ${sys.systemName} position (${direction})`
    );

    onRefresh();
  };

  const handleToggleRolePermission = (role: Role) => {
    if (selectedIntervalRoles.includes(role)) {
      setSelectedIntervalRoles(selectedIntervalRoles.filter((r) => r !== role));
    } else {
      setSelectedIntervalRoles([...selectedIntervalRoles, role]);
    }
  };

  const handleSaveIntervalRoles = async () => {
    try {
      const updatedSettings: SystemSettings = {
        ...(systemSettings || { hospitalName: 'St. Mary Theresa Catholic Hospital', hospitalLanUrl: '10.10.16.50', cloudSyncEnabled: true, autoSyncIntervalSec: 30, offlinePolicy: { allowOfflineQueue: true, requirePinForOfflineAccess: false, syncPriority: 'MEDIUM' }, slaRules: {} as any, lastSuccessfulSync: null }),
        id: 'main',
        intervalVisibleRoles: selectedIntervalRoles,
      };

      await putToStore('settings', updatedSettings);
      await putToStore('settings', { ...updatedSettings, id: 'app_settings' });

      await auditService.logAction(
        'UPDATE_INTERVAL_ROLE_VISIBILITY',
        'SystemSettings',
        'main',
        null,
        `Updated turnaround interval visible roles to: ${selectedIntervalRoles.join(', ')}`
      );

      setIsRoleModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to save interval visible roles:', err);
    }
  };
  const isStaffOrClinical =
    !currentUser ||
    currentUser.role === 'STAFF_USER' ||
    currentUser.role === 'DEPARTMENT_HEAD' ||
    (!isSuperAdminOrIT && currentUser.role !== 'PROCUREMENT_OFFICER');

  // Staff and clinical members must not see Low Stock Consumables on dashboard
  const canViewInventory = !isStaffOrClinical && authService.hasPermission('inventory.view', currentUser);

  // Compute Key Metrics
  const openTickets = safeTickets.filter((t) => t.status !== 'Closed' && t.status !== 'Resolved');
  const criticalTickets = safeTickets.filter((t) => t.priority === 'Critical' && t.status !== 'Closed');
  const activeIncidents = safeIncidents.filter((i) => i.status === 'Active' || i.status === 'Investigating');
  const lowStockItems = safeInventory.filter((item) => item.quantity <= item.minimumStock);
  const dueMaintenance = safeMaintenance.filter((m) => m.status === 'Scheduled' || m.status === 'Due' || m.status === 'Overdue');
  const resolvedCount = safeTickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;

  // Ticket Resolution Time Interval Analytics
  const resolvedTickets = safeTickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed');
  const resolutionTimesMinutes = resolvedTickets.map((t) => {
    if (t.resolutionTimeMinutes && t.resolutionTimeMinutes > 0) return t.resolutionTimeMinutes;
    if (t.resolvedAt && t.createdAt) {
      const diffMs = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
      return Math.max(1, Math.round(diffMs / 60000));
    }
    if (t.createdAt && t.updatedAt) {
      const diffMs = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
      return Math.max(1, Math.round(diffMs / 60000));
    }
    return 35; // default fallback for older resolved seed tickets
  });

  const avgResolutionMins = resolutionTimesMinutes.length > 0
    ? Math.round(resolutionTimesMinutes.reduce((a, b) => a + b, 0) / resolutionTimesMinutes.length)
    : 0;

  const minResolutionMins = resolutionTimesMinutes.length > 0
    ? Math.min(...resolutionTimesMinutes)
    : 0;

  const slaMetCount = resolvedTickets.filter((t) => !t.sla?.isBreached).length;
  const slaMetPercent = resolvedTickets.length > 0
    ? Math.round((slaMetCount / resolvedTickets.length) * 100)
    : 100;

  // Department-specific tickets for Staff User
  const staffDeptTickets = safeTickets.filter(
    (t) =>
      (currentUser?.department && t.department?.toLowerCase() === currentUser.department.toLowerCase()) ||
      (currentUser?.fullName && t.createdBy?.toLowerCase().includes(currentUser.fullName.toLowerCase()))
  );
  const staffDeptResolved = staffDeptTickets.filter((t) => t.status === 'Closed' || t.status === 'Resolved');
  const staffDeptOpen = staffDeptTickets.filter((t) => t.status !== 'Closed' && t.status !== 'Resolved');

  // Compute departmental distribution
  const deptMap: Record<string, number> = {};
  for (const t of safeTickets) {
    deptMap[t.department] = (deptMap[t.department] || 0) + 1;
  }
  const topDepts = Object.entries(deptMap).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Hospital IT Operations Center</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Real-time local node telemetry for {systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital'}. All services operating locally on LAN.
          </p>
        </div>
      </div>

      {/* Offline Data Integrity & Health Report Widget - Strictly Super Admin & IT Unit Only */}
      {isSuperAdminOrIT && <IntegrityReportWidget />}

      {/* Hospital System Status Cards (LHIMS, Claim IT, QuickBooks, Quixmo, Starlink, etc.) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Core Hospital Systems Telemetry
            </h2>
            {isSuperAdminOrIT && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                IT Managed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdminOrIT && (
              <button
                onClick={() => onNavigate('systems')}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-sky-600 flex items-center gap-1 cursor-pointer bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg transition"
              >
                <Wrench className="w-3 h-3" />
                <span>Manage & Edit Status</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('systems')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer ml-1"
            >
              View All ({safeSystems.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {safeSystems.slice(0, 6).map((sys) => {
            const isOperational = sys.status === 'Operational';
            const isMaintenance = sys.status === 'Maintenance';
            const isDegraded = sys.status === 'Degraded';
            const isDown = sys.status === 'Down';

            return (
              <div
                key={sys.id}
                onClick={() => onNavigate('systems')}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-3 shadow-2xs hover:border-sky-300 transition cursor-pointer flex flex-col justify-between ${
                  isDown
                    ? 'border-rose-300 dark:border-rose-900 ring-1 ring-rose-500/20'
                    : isMaintenance
                    ? 'border-blue-300 dark:border-blue-900 ring-1 ring-blue-500/20'
                    : isDegraded
                    ? 'border-amber-300 dark:border-amber-900'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
                title={isSuperAdminOrIT ? `Click to edit ${sys.systemName} status` : sys.systemName}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {(sys.systemName || '').split('(')[0]}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSuperAdminOrIT && (
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded p-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleMoveDashboardSystemOrder(sys, 'UP', e)}
                          className="p-0.5 text-slate-400 hover:text-sky-500 rounded cursor-pointer"
                          title="Move Order Up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleMoveDashboardSystemOrder(sys, 'DOWN', e)}
                          className="p-0.5 text-slate-400 hover:text-sky-500 rounded cursor-pointer"
                          title="Move Order Down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOperational
                          ? 'bg-emerald-500'
                          : isMaintenance
                          ? 'bg-blue-500 animate-pulse'
                          : isDegraded
                          ? 'bg-amber-500'
                          : 'bg-rose-500 animate-ping'
                      }`}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span
                    className={`font-semibold ${
                      isOperational
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isMaintenance
                        ? 'text-blue-600 dark:text-blue-400'
                        : isDegraded
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {sys.status}
                  </span>
                  <span className="font-mono text-slate-400">{sys.latencyMs || 0}ms</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ticket Resolution Time Interval Analytics Widget */}
      {(isSuperAdminOrIT || showResolutionMetricsToAll) && (
        <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-900/80 border border-sky-700 text-sky-400">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-wide uppercase text-slate-100 flex items-center gap-2">
                  <span>Ticket Log-to-Resolution Time Interval Analytics</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Calculated turnaround metrics for IT Helpdesk ticket lifecycles
                </p>
              </div>
            </div>

            {isSuperAdminOrIT && (
              <button
                onClick={() => setShowResolutionMetricsToAll(!showResolutionMetricsToAll)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  showResolutionMetricsToAll
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle visibility of resolution time interval analytics for non-admin clinical staff"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showResolutionMetricsToAll ? 'Visible to All Users' : 'Visible Only to IT / Admins'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">Avg. Resolution Interval</span>
              <p className="text-lg font-black text-sky-400 font-mono">
                {formatResolutionInterval(avgResolutionMins)}
              </p>
              <span className="text-[10px] text-slate-500 block">Across {resolvedTickets.length} resolved tickets</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">Fastest Turnaround</span>
              <p className="text-lg font-black text-emerald-400 font-mono">
                {formatResolutionInterval(minResolutionMins)}
              </p>
              <span className="text-[10px] text-slate-500 block">Minimum log-to-solve time</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">SLA On-Time Rate</span>
              <p className="text-lg font-black text-amber-400 font-mono">
                {slaMetPercent}%
              </p>
              <span className="text-[10px] text-slate-500 block">{slaMetCount} / {resolvedTickets.length} within SLA target</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">Resolved Ticket Volume</span>
              <p className="text-lg font-black text-purple-400 font-mono">
                {resolvedTickets.length}
              </p>
              <span className="text-[10px] text-slate-500 block">Completed support requests</span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Tickets */}
        <div
          onClick={() => onNavigate('tickets')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Open Tickets</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
              <LifeBuoy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{openTickets.length}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="text-amber-600 font-semibold">{criticalTickets.length} critical</span>
            <span>| {resolvedCount} resolved</span>
          </div>
        </div>

        {/* Active Incidents */}
        <div
          onClick={() => onNavigate('incidents')}
          className={`border rounded-2xl p-4.5 shadow-2xs transition cursor-pointer ${
            activeIncidents.length > 0
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Incidents</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{activeIncidents.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {activeIncidents.length > 0 ? (
              <span className="text-rose-600 font-bold">Investigation in progress</span>
            ) : (
              <span className="text-emerald-600 font-medium">All services stable</span>
            )}
          </div>
        </div>

        {/* Maintenance Due */}
        <div
          onClick={() => onNavigate('maintenance')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Maintenance Due</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{dueMaintenance.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Scheduled checks & servicing</div>
        </div>

        {/* Low Stock Alerts for Authorized Roles / Department Issues for Clinical & General Staff */}
        {canViewInventory ? (
          <div
            onClick={() => onNavigate('inventory')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Low Stock Consumables</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{lowStockItems.length}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              {lowStockItems.length > 0 ? (
                <span className="text-amber-600 font-medium">Requires reorder</span>
              ) : (
                <span className="text-emerald-600 font-medium">Adequate stock</span>
              )}
            </div>
          </div>
        ) : (
          <div
            onClick={() => onNavigate('tickets')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {currentUser?.department ? `${currentUser.department} Issues` : 'My Department Issues'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{staffDeptResolved.length}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="text-emerald-600 font-semibold">{staffDeptResolved.length} resolved</span>
              <span>| {staffDeptOpen.length} pending</span>
            </div>
          </div>
        )}
      </div>

      {/* Operational Breakdown & Department Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tickets by Department + Priority */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tickets by Hospital Department</h3>
              <p className="text-xs text-slate-500">Workload distribution across clinical and administrative units</p>
            </div>
            <span className="text-xs font-mono font-bold text-sky-600">{safeTickets.length} total</span>
          </div>

          <div className="space-y-3">
            {topDepts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No tickets recorded</p>
            ) : (
              topDepts.map(([dept, count]) => {
                const pct = Math.min(100, Math.round((count / Math.max(1, safeTickets.length)) * 100));
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-200">{dept}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-sky-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Ticket Priority Distribution Badges */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority Breakdown</div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2 rounded-xl">
                <div className="font-extrabold text-rose-700 dark:text-rose-400">
                  {safeTickets.filter((t) => t.priority === 'Critical').length}
                </div>
                <div className="text-[10px] text-rose-600">Critical</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-2 rounded-xl">
                <div className="font-extrabold text-amber-700 dark:text-amber-400">
                  {safeTickets.filter((t) => t.priority === 'High').length}
                </div>
                <div className="text-[10px] text-amber-600">High</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 p-2 rounded-xl">
                <div className="font-extrabold text-blue-700 dark:text-blue-400">
                  {safeTickets.filter((t) => t.priority === 'Medium').length}
                </div>
                <div className="text-[10px] text-blue-600">Medium</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl">
                <div className="font-extrabold text-slate-700 dark:text-slate-300">
                  {safeTickets.filter((t) => t.priority === 'Low').length}
                </div>
                <div className="text-[10px] text-slate-500">Low</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Recent Helpdesk Tickets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Tickets</h3>
              {isSuperAdminOrIT && (
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(true)}
                  className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 hover:bg-sky-200 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border border-sky-300/40"
                  title="Configure which user roles can view ticket turnaround intervals"
                >
                  <Settings className="w-3 h-3" />
                  <span>Interval Access</span>
                </button>
              )}
            </div>
            <button
              onClick={() => onNavigate('tickets')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold cursor-pointer"
            >
              All Tickets
            </button>
          </div>

          <div className="space-y-3">
            {safeTickets.slice(0, 4).map((ticket) => {
              // Calculate exact turnaround interval for this individual ticket
              const logMs = new Date(ticket.createdAt).getTime();
              const resTimeStr = ticket.resolution?.resolvedAt || (ticket.status === 'Closed' ? ticket.closedAt : null);
              const endMs = resTimeStr ? new Date(resTimeStr).getTime() : Date.now();
              const calculatedDiffMins = Math.max(1, Math.round((endMs - logMs) / 60000));
              const intervalFormatted = formatResolutionInterval(calculatedDiffMins);
              const isResolved = Boolean(resTimeStr || ticket.status === 'Closed' || ticket.status === 'Resolved');

              return (
                <div
                  key={ticket.id}
                  onClick={() => onNavigate('tickets')}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 bg-slate-50/50 dark:bg-slate-800/40 transition cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{ticket.ticketNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ticket.priority === 'Critical'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : ticket.priority === 'High'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {ticket.priority}
                    </span>
                  </div>

                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 line-clamp-1">
                    {ticket.title}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{ticket.department}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{ticket.status}</span>
                  </div>

                  {/* Calculated Turnaround Interval Badge for Every Individual Ticket */}
                  {canSeeTurnaroundIntervals && (
                    <div
                      className={`p-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                        isResolved
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {isResolved ? (
                          <Timer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span>
                          {isResolved ? 'Turnaround Interval:' : 'Duration Elapsed:'}{' '}
                          <span className="font-mono text-xs font-black">{intervalFormatted}</span>
                        </span>
                      </div>
                      <span className="text-[10px] font-mono opacity-80 shrink-0">
                        {isResolved ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                  )}

                  {/* Ticket Logged Time & Resolution Time Stamps */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3 text-sky-500 shrink-0" />
                      <span>
                        Logged:{' '}
                        <strong className="text-slate-700 dark:text-slate-200 font-semibold">
                          {new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </strong>
                      </span>
                    </div>

                    <div>
                      {isResolved ? (
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>
                            Resolved:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {new Date(resTimeStr!).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                              {new Date(resTimeStr!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </strong>
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>Pending Resolution</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Turnaround Interval Role Permissions Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">Turnaround Interval Role Permissions</h3>
                  <p className="text-xs text-slate-500">Enable ticket turnaround interval display for specific roles</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs max-h-[50vh] overflow-y-auto">
              <p className="text-slate-500 text-[11px] mb-2">
                Check user roles permitted to view log-to-resolution time intervals on ticket cards across the dashboard and queue:
              </p>

              {[
                { role: 'SUPER_ADMIN', label: 'Super Admin (Courage Kay)' },
                { role: 'IT_ADMIN', label: 'IT Systems Administrator' },
                { role: 'IT_OFFICER', label: 'IT Support Officer / Field Technician' },
                { role: 'CLINICAL_STAFF', label: 'Clinical Ward Staff / General Staff' },
                { role: 'DEPARTMENT_HEAD', label: 'Department Head / Unit Supervisor' },
                { role: 'MANAGEMENT_AUDITOR', label: 'Hospital Management & Auditor' },
                { role: 'PROCUREMENT_OFFICER', label: 'Procurement Officer' },
              ].map((item) => {
                const isChecked = selectedIntervalRoles.includes(item.role as Role);
                return (
                  <label
                    key={item.role}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-slate-800 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleRolePermission(item.role as Role)}
                      className="w-4 h-4 rounded text-sky-600 accent-sky-600 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveIntervalRoles}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Save Role Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
