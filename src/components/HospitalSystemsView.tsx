import React, { useState } from 'react';
import {
  Activity,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileText,
  Mail,
  DollarSign,
  Shield,
  Clock,
  Wifi,
  Plus,
  Edit3,
  Wrench,
  AlertOctagon,
  Power,
  ChevronUp,
  ChevronDown,
  Info,
  Phone,
  HelpCircle,
} from 'lucide-react';
import {
  type HospitalSystem,
  type SystemOperationalStatus,
  type User,
  type SystemSettings,
} from '../types';
import { putToStore } from '../services/localDatabaseService';
import { authService } from '../services/authService';
import { auditService } from '../services/auditService';
import { syncService } from '../services/syncService';
import { SystemEditModal } from './SystemEditModal';

interface HospitalSystemsViewProps {
  systems: HospitalSystem[];
  currentUser?: User | null;
  systemSettings?: SystemSettings | null;
  onRefresh: () => void;
}

export const HospitalSystemsView: React.FC<HospitalSystemsViewProps> = ({
  systems = [],
  currentUser,
  systemSettings,
  onRefresh,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingSystem, setEditingSystem] = useState<HospitalSystem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Super Admin and IT unit staff have full edit and ping authority
  const isSuperAdminOrIT = authService.isSuperAdminOrIT(currentUser);
  const canPing = authService.canRunPingTest(currentUser);

  // Listen for instant emergency system status changes (e.g. Quick Emergency Trigger set to Down)
  React.useEffect(() => {
    const handleSystemsUpdated = () => {
      onRefresh();
    };
    window.addEventListener('hitoms_systems_updated', handleSystemsUpdated);
    return () => {
      window.removeEventListener('hitoms_systems_updated', handleSystemsUpdated);
    };
  }, [onRefresh]);

  const handleTestSystem = async (sys: HospitalSystem) => {
    if (!canPing) return;
    setTestingId(sys.id);
    await new Promise((r) => setTimeout(r, 450));

    // Simulate realistic jitter
    const randomLatency = Math.floor(Math.random() * 15) + 3;
    const updated: HospitalSystem = {
      ...sys,
      latencyMs: randomLatency,
      lastChecked: new Date().toISOString(),
    };

    await putToStore('hospitalSystems', updated);
    setTestingId(null);
    onRefresh();
  };

  const handleQuickStatusChange = async (sys: HospitalSystem, newStatus: SystemOperationalStatus) => {
    if (!isSuperAdminOrIT) return;
    try {
      const now = new Date().toISOString();
      const updated: HospitalSystem = {
        ...sys,
        status: newStatus,
        lastChecked: now,
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
      };

      await putToStore('hospitalSystems', updated);

      await auditService.logAction(
        'QUICK_STATUS_CHANGE',
        'Hospital Systems',
        sys.id,
        sys.status,
        `${sys.systemName} status toggled to ${newStatus}`
      );

      onRefresh();
    } catch (e) {
      console.error('Quick status change error:', e);
    }
  };

  const handleTestAll = async () => {
    if (!canPing) return;
    for (const sys of systems) {
      await handleTestSystem(sys);
    }
  };

  const handleMoveSystemOrder = async (sys: HospitalSystem, direction: 'UP' | 'DOWN') => {
    if (!isSuperAdminOrIT) return;
    const sorted = [...systems].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const currentIndex = sorted.findIndex((s) => s.id === sys.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap positions
    const temp = sorted[currentIndex];
    sorted[currentIndex] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    // Assign explicit sequential displayOrder indices (0, 1, 2, 3...)
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
      'Hospital Systems',
      sys.id,
      null,
      `Rearranged ${sys.systemName} position (${direction})`
    );

    onRefresh();
  };

  const handleOpenEdit = (sys: HospitalSystem) => {
    setEditingSystem(sys);
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingSystem(null);
    setIsEditModalOpen(true);
  };

  const sortedSystems = [...systems].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const filteredSystems = sortedSystems.filter((sys) => {
    if (filterStatus === 'ALL') return true;
    return sys.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-600" />
            <span>
              {isSuperAdminOrIT
                ? 'Core Hospital Systems & Telemetry'
                : 'Hospital Systems Directory & Availability'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSuperAdminOrIT
              ? `Real-time latency, availability, and clinical service operational tracking for ${systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital'}.`
              : 'Overview of all active hospital platforms, what each system is used for, and its current set status.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdminOrIT && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add System</span>
            </button>
          )}

          {canPing && (
            <button
              id="ping-all-endpoints-btn"
              onClick={handleTestAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ping All Endpoints</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {['ALL', 'Operational', 'Maintenance', 'Degraded', 'Down', 'Offline'].map((statusKey) => {
          const count =
            statusKey === 'ALL'
              ? systems.length
              : systems.filter((s) => s.status === statusKey).length;
          return (
            <button
              key={statusKey}
              onClick={() => setFilterStatus(statusKey)}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatus === statusKey
                  ? 'bg-slate-900 dark:bg-sky-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              <span>{statusKey === 'ALL' ? 'All Systems' : statusKey}</span>
              <span className="ml-1.5 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Systems Grid - Compact, responsive layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {filteredSystems.map((sys) => {
          const isOperational = sys.status === 'Operational';
          const isMaintenance = sys.status === 'Maintenance';
          const isDegraded = sys.status === 'Degraded';
          const isDown = sys.status === 'Down';
          const isOffline = sys.status === 'Offline';

          return (
            <div
              key={sys.id}
              className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-2.5 transition ${
                isDown
                  ? 'border-rose-400 dark:border-rose-900/70 ring-1 ring-rose-500/20'
                  : isMaintenance
                  ? 'border-blue-400 dark:border-blue-900/70 ring-1 ring-blue-500/20'
                  : isDegraded
                  ? 'border-amber-400 dark:border-amber-900/70 ring-1 ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-sky-300'
              }`}
            >
              <div className="space-y-2.5">
                {/* 1. Header: System Name and Role Controls */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {sys.vendor && (
                        <span className="text-[9px] uppercase font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-900 px-1.5 py-0.2 rounded truncate max-w-[150px]">
                          {sys.vendor}
                        </span>
                      )}
                      <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                        {sys.criticality || 'Standard'}
                      </span>
                    </div>

                    {/* NAME OF THE SYSTEM */}
                    <h3
                      className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-1"
                      title={sys.systemName}
                    >
                      {sys.systemName}
                    </h3>
                  </div>

                  {/* IT Administrative Controls if Super Admin/IT */}
                  {isSuperAdminOrIT && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => handleMoveSystemOrder(sys, 'UP')}
                          className="p-0.5 text-slate-400 hover:text-sky-500 rounded cursor-pointer"
                          title="Move Service Order Up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveSystemOrder(sys, 'DOWN')}
                          className="p-0.5 text-slate-400 hover:text-sky-500 rounded cursor-pointer"
                          title="Move Service Order Down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleOpenEdit(sys)}
                        className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Edit System Status & Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. WHAT IT IS USED FOR */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                    <Info className="w-3 h-3 text-sky-500 shrink-0" />
                    <span>What It's Used For</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug line-clamp-2 font-medium">
                    {sys.description || 'Clinical hospital operational workflow and patient care management.'}
                  </p>
                </div>

                {/* 3. SET STATUS DISPLAYED */}
                <div
                  className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                    isOperational
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                      : isMaintenance
                      ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50'
                      : isDegraded
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                      : isDown
                      ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Set Status
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isOperational
                            ? 'bg-emerald-600 text-white'
                            : isMaintenance
                            ? 'bg-blue-600 text-white'
                            : isDegraded
                            ? 'bg-amber-600 text-white'
                            : isDown
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-slate-600 text-white'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isDown ? 'bg-white animate-ping' : 'bg-white'
                          }`}
                        />
                        {sys.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block font-medium">Department Unit</span>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[110px]">
                      {sys.owner || 'Clinical Operations'}
                    </span>
                  </div>
                </div>

                {/* Active Advisory Notice if any */}
                {(sys.statusMessage || sys.maintenanceWindow) && (
                  <div
                    className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${
                      isDown
                        ? 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                        : isMaintenance
                        ? 'bg-blue-100/70 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                        : 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-current" />
                    <div className="leading-tight">
                      {sys.statusMessage && <p className="font-bold">{sys.statusMessage}</p>}
                      {sys.maintenanceWindow && (
                        <p className="text-[10px] opacity-90 mt-0.5 font-medium">
                          Window: {sys.maintenanceWindow}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Technical specs (Shown for IT Unit & Super Admins) */}
                {isSuperAdminOrIT && (
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Host / IP:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[130px]">
                        {sys.ipOrHost || sys.server || 'LAN Gateway'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Target Port:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {sys.port || '80 / HTTP'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Latency:</span>
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                        {sys.latencyMs !== undefined ? `${sys.latencyMs} ms` : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Quick Actions (Set Status toolbar for IT) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                {isSuperAdminOrIT ? (
                  <>
                    <div className="flex items-center justify-between gap-1 text-[9px] bg-slate-50 dark:bg-slate-800/60 p-1 rounded-lg">
                      <span className="font-bold text-slate-500 pl-0.5">Quick Set:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(sys, 'Operational')}
                          className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            isOperational
                              ? 'bg-emerald-600 text-white'
                              : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                          }`}
                        >
                          Operational
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(sys, 'Maintenance')}
                          className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            isMaintenance
                              ? 'bg-blue-600 text-white'
                              : 'text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60'
                          }`}
                        >
                          Maint
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(sys, 'Down')}
                          className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            isDown
                              ? 'bg-rose-600 text-white'
                              : 'text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                          }`}
                        >
                          Down
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {canPing && (
                        <button
                          onClick={() => handleTestSystem(sys)}
                          disabled={testingId === sys.id}
                          className="flex-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <RefreshCw className={`w-3 h-3 ${testingId === sys.id ? 'animate-spin' : ''}`} />
                          <span>{testingId === sys.id ? 'Pinging...' : 'Ping'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(sys)}
                        className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition border border-sky-200 dark:border-sky-800"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Config</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* Staff User bottom info */
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Verified:</span>
                      <strong className="text-slate-700 dark:text-slate-300 font-mono">
                        {new Date(sys.lastChecked || sys.updatedAt || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </span>

                    {sys.vendorSupportHotline && (
                      <span className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        <span>{sys.vendorSupportHotline}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit & Add System Modal */}
      <SystemEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        systemToEdit={editingSystem}
        currentUser={currentUser || null}
        systemSettings={systemSettings}
        onSaved={onRefresh}
      />
    </div>
  );
};
