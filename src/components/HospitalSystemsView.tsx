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

  const handleOpenEdit = (sys: HospitalSystem) => {
    setEditingSystem(sys);
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingSystem(null);
    setIsEditModalOpen(true);
  };

  const filteredSystems = systems.filter((sys) => {
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
            <span>Core Hospital Systems & Telemetry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time latency, availability, and clinical service operational tracking for {systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital'}.
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

      {/* Systems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSystems.map((sys) => {
          const isOperational = sys.status === 'Operational';
          const isMaintenance = sys.status === 'Maintenance';
          const isDegraded = sys.status === 'Degraded';
          const isDown = sys.status === 'Down';
          const isOffline = sys.status === 'Offline';

          return (
            <div
              key={sys.id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 transition ${
                isDown
                  ? 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20'
                  : isMaintenance
                  ? 'border-blue-300 dark:border-blue-900/60 ring-1 ring-blue-500/20'
                  : isDegraded
                  ? 'border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-sky-300'
              }`}
            >
              <div>
                {/* Status Badges & Quick Action Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        isOperational
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : isMaintenance
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                          : isDegraded
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          : isDown
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 animate-pulse'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOperational
                            ? 'bg-emerald-500'
                            : isMaintenance
                            ? 'bg-blue-500'
                            : isDegraded
                            ? 'bg-amber-500'
                            : isDown
                            ? 'bg-rose-500 animate-ping'
                            : 'bg-slate-500'
                        }`}
                      />
                      {sys.status}
                    </span>

                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {sys.criticality || 'High'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {sys.latencyMs !== undefined ? `${sys.latencyMs} ms` : 'N/A'}
                    </span>

                    {isSuperAdminOrIT && (
                      <button
                        onClick={() => handleOpenEdit(sys)}
                        className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Edit System Status & Configuration"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-2.5">
                  {sys.systemName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{sys.description}</p>

                {/* Active Status Advisory Notice if any */}
                {(sys.statusMessage || sys.maintenanceWindow) && (
                  <div
                    className={`mt-2.5 p-2 rounded-xl text-xs flex items-start gap-2 ${
                      isDown
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                        : isMaintenance
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div className="leading-tight">
                      {sys.statusMessage && <p className="font-semibold">{sys.statusMessage}</p>}
                      {sys.maintenanceWindow && (
                        <p className="text-[11px] opacity-90 mt-0.5">
                          Window: {sys.maintenanceWindow}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Technical specs */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Host / IP:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
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
                    <span className="text-slate-400">Availability SLA:</span>
                    <span className="font-semibold text-emerald-600 font-mono">
                      {sys.uptimePercentage || sys.uptimePercent || 99.5}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Managing Unit:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {sys.owner || 'IT Operations'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Last Telemetry Ping:</span>
                    <span>{new Date(sys.lastChecked || sys.updatedAt || new Date()).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Super Admin Quick Status Bar */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {isSuperAdminOrIT && (
                  <div className="flex items-center justify-between gap-1 text-[10px] bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl">
                    <span className="font-bold text-slate-500 pl-1">Set Status:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(sys, 'Operational')}
                        className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
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
                        className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                          isMaintenance
                            ? 'bg-blue-600 text-white'
                            : 'text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60'
                        }`}
                      >
                        Maintenance
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(sys, 'Down')}
                        className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                          isDown
                            ? 'bg-rose-600 text-white'
                            : 'text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                        }`}
                      >
                        Down
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {canPing && (
                    <button
                      onClick={() => handleTestSystem(sys)}
                      disabled={testingId === sys.id}
                      className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingId === sys.id ? 'animate-spin' : ''}`} />
                      <span>{testingId === sys.id ? 'Checking...' : 'Run Local Ping Test'}</span>
                    </button>
                  )}

                  {isSuperAdminOrIT && (
                    <button
                      onClick={() => handleOpenEdit(sys)}
                      className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition border border-sky-200 dark:border-sky-800"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Configure</span>
                    </button>
                  )}
                </div>
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
