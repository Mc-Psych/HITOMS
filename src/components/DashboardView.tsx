import React from 'react';
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
} from 'lucide-react';
import {
  type Ticket,
  type Asset,
  type MaintenanceRecord,
  type Incident,
  type HospitalSystem,
  type InventoryItem,
  type User,
} from '../types';

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
  onNavigate?: (viewId: string) => void;
  onOpenCreateTicket?: () => void;
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
  onNavigate = (_viewId: string) => {},
  onOpenCreateTicket = () => {},
}) => {
  const safeTickets = tickets || [];
  const safeMaintenance = (maintenance && maintenance.length > 0) ? maintenance : (maintenanceRecords || []);
  const safeIncidents = incidents || [];
  const safeSystems = (systems && systems.length > 0) ? systems : (hospitalSystems || []);
  const safeInventory = (inventory && inventory.length > 0) ? inventory : (inventoryItems || []);

  // Compute Key Metrics
  const openTickets = safeTickets.filter((t) => t.status !== 'Closed' && t.status !== 'Resolved');
  const criticalTickets = safeTickets.filter((t) => t.priority === 'Critical' && t.status !== 'Closed');
  const activeIncidents = safeIncidents.filter((i) => i.status === 'Active' || i.status === 'Investigating');
  const lowStockItems = safeInventory.filter((item) => item.quantity <= item.minimumStock);
  const dueMaintenance = safeMaintenance.filter((m) => m.status === 'Scheduled' || m.status === 'Due' || m.status === 'Overdue');
  const resolvedCount = safeTickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;

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
            Real-time local node telemetry for St. Jude Hospital. All services operating locally on LAN.
          </p>
        </div>
      </div>

      {/* Hospital System Status Cards (LHIMS, QuickBooks, Quixmo, Starlink, etc.) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Core Hospital Systems Telemetry
            </h2>
          </div>
          <button
            onClick={() => onNavigate('systems')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
          >
            View All ({safeSystems.length})
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {safeSystems.slice(0, 6).map((sys) => (
            <div
              key={sys.id}
              onClick={() => onNavigate('systems')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs hover:border-sky-300 transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{(sys.systemName || '').split('(')[0]}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    sys.status === 'Operational'
                      ? 'bg-emerald-500'
                      : sys.status === 'Degraded'
                      ? 'bg-amber-500'
                      : 'bg-rose-500 animate-pulse'
                  }`}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{sys.status}</span>
                <span className="font-mono text-slate-400">{sys.latencyMs}ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>

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

        {/* Low Stock Alerts */}
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
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Tickets</h3>
            <button
              onClick={() => onNavigate('tickets')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold cursor-pointer"
            >
              All Tickets
            </button>
          </div>

          <div className="space-y-3">
            {safeTickets.slice(0, 4).map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => onNavigate('tickets')}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-sky-200 dark:hover:border-sky-800 bg-slate-50/50 dark:bg-slate-800/40 transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-sky-600">{ticket.ticketNumber}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      ticket.priority === 'Critical'
                        ? 'bg-rose-100 text-rose-700'
                        : ticket.priority === 'High'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {ticket.priority}
                  </span>
                </div>
                <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                  {ticket.title}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{ticket.department}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{ticket.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
