import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Save,
  Shield,
  Trash2,
  Radio,
  Wifi,
  Wrench,
  AlertOctagon,
} from 'lucide-react';
import {
  type HospitalSystem,
  type SystemOperationalStatus,
  type User,
  type SystemSettings,
  type Department,
} from '../types';
import { putToStore, deleteFromStore, getAllFromStore, generateUUID, getDeviceId } from '../services/localDatabaseService';
import { auditService } from '../services/auditService';
import { syncService } from '../services/syncService';
import { emergencyService } from '../services/emergencyService';

interface SystemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemToEdit?: HospitalSystem | null;
  currentUser: User | null;
  systemSettings?: SystemSettings | null;
  onSaved: () => void;
}

const STATUS_OPTIONS: {
  value: SystemOperationalStatus;
  label: string;
  description: string;
  badgeClass: string;
  borderClass: string;
  dotClass: string;
}[] = [
  {
    value: 'Operational',
    label: 'Operational',
    description: 'System running normally with optimal latency and zero clinical disruption.',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
    borderClass: 'border-emerald-500 ring-emerald-500/20',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'Maintenance',
    label: 'Scheduled Maintenance',
    description: 'System undergoing planned patch, indexing, or hardware servicing.',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300',
    borderClass: 'border-blue-500 ring-blue-500/20',
    dotClass: 'bg-blue-500 animate-pulse',
  },
  {
    value: 'Degraded',
    label: 'Degraded Performance',
    description: 'System is online but exhibiting high latency, packet loss, or slow queries.',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
    borderClass: 'border-amber-500 ring-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'Down',
    label: 'Outage / System Down',
    description: 'Complete outage. Service is unresponsive or database daemon unreachable.',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
    borderClass: 'border-rose-500 ring-rose-500/20',
    dotClass: 'bg-rose-500 animate-ping',
  },
  {
    value: 'Offline',
    label: 'Offline / Decommissioned',
    description: 'System shut down or temporarily disabled by IT administration.',
    badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    borderClass: 'border-slate-500 ring-slate-500/20',
    dotClass: 'bg-slate-500',
  },
];

export const SystemEditModal: React.FC<SystemEditModalProps> = ({
  isOpen,
  onClose,
  systemToEdit,
  currentUser,
  systemSettings,
  onSaved,
}) => {
  const isNew = !systemToEdit;

  const [systemName, setSystemName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('IT Infrastructure');
  const [owner, setOwner] = useState('IT Operations');
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([
    'IT Infrastructure',
    'Clinical Systems',
    'Health Information & Records',
    'Pharmacy',
    'Finance & Accounts',
    'Laboratory',
    'Accident & Emergency',
    'Administration',
    'Radiology & PACS',
  ]);
  const [vendor, setVendor] = useState('');
  const [status, setStatus] = useState<SystemOperationalStatus>('Operational');
  const [criticality, setCriticality] = useState<HospitalSystem['criticality']>('High');
  const [url, setUrl] = useState('');
  const [server, setServer] = useState('');
  const [database, setDatabase] = useState('');
  const [ipOrHost, setIpOrHost] = useState('');
  const [port, setPort] = useState<number | string>(80);
  const [latencyMs, setLatencyMs] = useState<number>(12);
  const [uptimePercentage, setUptimePercentage] = useState<number>(99.5);
  const [maintenanceWindow, setMaintenanceWindow] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [leadAdmin, setLeadAdmin] = useState(currentUser?.fullName || '');
  const [vendorSupportHotline, setVendorSupportHotline] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load dynamic hospital departments from IndexedDB
    getAllFromStore<Department>('departments').then((depts) => {
      if (depts && depts.length > 0) {
        const names = Array.from(new Set(depts.map((d) => d.name).filter(Boolean)));
        setAvailableDepartments(names);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (systemToEdit) {
      setSystemName(systemToEdit.systemName || '');
      setDescription(systemToEdit.description || '');
      setDepartment(systemToEdit.department || systemToEdit.owner || 'IT Infrastructure');
      setOwner(systemToEdit.owner || 'IT Operations');
      setVendor(systemToEdit.vendor || '');
      setStatus(systemToEdit.status || 'Operational');
      setCriticality(systemToEdit.criticality || 'High');
      setUrl(systemToEdit.url || '');
      setServer(systemToEdit.server || '');
      setDatabase(systemToEdit.database || '');
      setIpOrHost(systemToEdit.ipOrHost || (systemToEdit.server?.includes('(') ? systemToEdit.server.match(/\((.*?)\)/)?.[1] || '' : ''));
      setPort(systemToEdit.port || 80);
      setLatencyMs(systemToEdit.latencyMs !== undefined ? systemToEdit.latencyMs : 12);
      setUptimePercentage(systemToEdit.uptimePercentage || systemToEdit.uptimePercent || 99.5);
      setMaintenanceWindow(systemToEdit.maintenanceWindow || '');
      setStatusMessage(systemToEdit.statusMessage || '');
      setLeadAdmin(systemToEdit.leadAdmin || currentUser?.fullName || '');
      setVendorSupportHotline(systemToEdit.vendorSupportHotline || '');
      setNotes(systemToEdit.notes || '');
    } else {
      setSystemName('');
      setDescription('');
      setDepartment('IT Infrastructure');
      setOwner('IT Operations');
      setVendor('');
      setStatus('Operational');
      setCriticality('High');
      setUrl('http://');
      setServer('App Server 01');
      setDatabase('PostgreSQL / SQLite');
      setIpOrHost('192.168.1.100');
      setPort(80);
      setLatencyMs(12);
      setUptimePercentage(99.8);
      setMaintenanceWindow('');
      setStatusMessage('');
      setLeadAdmin(currentUser?.fullName || '');
      setVendorSupportHotline('');
      setNotes('');
    }
    setError(null);
  }, [systemToEdit, isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemName.trim()) {
      setError('System Name is required (e.g., "Claim IT", "LHIMS EHR").');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const deviceId = getDeviceId();
      const systemId = systemToEdit?.id || `sys-${generateUUID().slice(0, 8)}`;

      // 1. If changing or saving as Operational, resolve any active emergency broadcasts first
      if (currentUser && status === 'Operational') {
        const activeBroadcasts = await emergencyService.getActiveBroadcasts();
        const tiedAlerts = activeBroadcasts.filter(
          (b) => b.targetSystemId === systemId || b.title.includes(systemName.toUpperCase())
        );
        for (const alert of tiedAlerts) {
          await emergencyService.resolveBroadcast(alert.id, currentUser);
        }
      }

      const updatedSystem: HospitalSystem = {
        id: systemId,
        systemName: systemName.trim(),
        description: description.trim(),
        department: department.trim() || 'IT Infrastructure',
        owner: department.trim() || owner.trim() || 'IT & Systems Administration',
        vendor: vendor.trim() || 'Internal / Hospital Hosted',
        status,
        criticality,
        url: url.trim(),
        server: server.trim() || ipOrHost.trim(),
        database: database.trim(),
        ipOrHost: ipOrHost.trim() || server.trim(),
        port: port || 80,
        latencyMs: Number(latencyMs) || 0,
        uptimePercentage: Number(uptimePercentage) || 99.5,
        uptimePercent: Number(uptimePercentage) || 99.5,
        maintenanceWindow: maintenanceWindow.trim() || undefined,
        statusMessage: status === 'Operational' ? undefined : (statusMessage.trim() || undefined),
        leadAdmin: leadAdmin.trim() || undefined,
        vendorSupportHotline: vendorSupportHotline.trim() || undefined,
        notes: notes.trim() || undefined,
        lastChecked: now,
        createdAt: systemToEdit?.createdAt || now,
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
        _syncVersion: (systemToEdit?._syncVersion || 0) + 1,
        _lastSyncedAt: now,
        _deviceId: deviceId,
      };

      await putToStore('hospitalSystems', updatedSystem);
      await syncService.enqueueOperation('hospitalSystems', updatedSystem.id, isNew ? 'CREATE' : 'UPDATE', updatedSystem);

      // Audit log entry
      await auditService.logAction(
        isNew ? 'CREATE_HOSPITAL_SYSTEM' : 'UPDATE_SYSTEM_STATUS',
        'Hospital Systems',
        systemId,
        systemToEdit ? `${systemToEdit.systemName} (${systemToEdit.status})` : null,
        `${updatedSystem.systemName} set to status [${status}]. Dept: ${updatedSystem.department}. ${statusMessage ? `Notice: ${statusMessage}` : ''}`
      );

      // Automatic Emergency Trigger Integration if setting to Down or Maintenance
      if (currentUser && (status === 'Down' || status === 'Maintenance')) {
        let codeType: 'CODE_BLUE_IT' | 'CODE_RED_NETWORK' | 'EHR_DOWNTIME' | 'CYBER_LOCKDOWN' | 'GENERAL_EMERGENCY' = 'GENERAL_EMERGENCY';
        const lowerName = updatedSystem.systemName.toLowerCase();
        if (lowerName.includes('lhims') || lowerName.includes('health') || lowerName.includes('ehr')) {
          codeType = 'EHR_DOWNTIME';
        } else if (lowerName.includes('starlink') || lowerName.includes('network') || lowerName.includes('gateway')) {
          codeType = 'CODE_RED_NETWORK';
        } else if (lowerName.includes('quickbooks') || lowerName.includes('finance') || lowerName.includes('security')) {
          codeType = 'CYBER_LOCKDOWN';
        } else if (lowerName.includes('quixmo') || lowerName.includes('telemetry') || lowerName.includes('pharmacy')) {
          codeType = 'CODE_BLUE_IT';
        }

        const statusHeadline = `🚨 ${updatedSystem.systemName.toUpperCase()} STATUS: ${status.toUpperCase()}`;
        const msg = `${updatedSystem.systemName} is currently ${status.toUpperCase()}. Clinical and administrative operations please observe hospital contingency protocols.`;

        await emergencyService.createBroadcast(
          {
            codeType,
            title: statusHeadline,
            message: msg,
            severity: status === 'Down' ? 'CRITICAL' : 'HIGH',
            targetSystemId: updatedSystem.id,
            targetSystemName: updatedSystem.systemName,
            autoSetSystemStatus: status,
          },
          currentUser
        );
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('[SystemEditModal] Failed to save hospital system:', err);
      setError(err?.message || 'Failed to save system status changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!systemToEdit) return;
    if (!window.confirm(`Are you sure you want to remove "${systemToEdit.systemName}" from hospital systems telemetry?`)) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteFromStore('hospitalSystems', systemToEdit.id);
      await auditService.logAction(
        'DELETE_HOSPITAL_SYSTEM',
        'Hospital Systems',
        systemToEdit.id,
        systemToEdit.systemName,
        'System removed from active telemetry'
      );
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete system.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {isNew ? 'Add Core Hospital System' : `Edit Status: ${systemToEdit.systemName}`}
              </h2>
              <p className="text-xs text-slate-300">
                Super Admin & IT Unit operational status and telemetry management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Status Selector Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Operational Status State <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = status === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? `bg-sky-50/70 dark:bg-sky-950/40 ${opt.borderClass} border-2 shadow-xs`
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${opt.dotClass}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{opt.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Advisory / Maintenance Note */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Live Status Notice / Incident Note (Shown to clinical staff)
              </label>
              <input
                type="text"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="e.g. Scheduled DB re-indexing in progress by NHIA technical team until 16:00 GMT"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            {(status === 'Maintenance' || status === 'Degraded' || status === 'Down') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance / Downtime Window
                </label>
                <input
                  type="text"
                  value={maintenanceWindow}
                  onChange={(e) => setMaintenanceWindow(e.target.value)}
                  placeholder="e.g. Today 14:00 - 16:30 GMT (Expected duration: 2.5 hrs)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            )}
          </div>

          {/* System Identity & Technical Spec */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                System Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder="e.g. Claim IT (NHIS Claims Submission)"
                required
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Responsible Department</span>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">Super Admin / IT</span>
              </label>
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer"
                >
                  {availableDepartments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  {!availableDepartments.includes(department) && (
                    <option value={department}>{department}</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Clinical Criticality Level
              </label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="Critical">Critical (Immediate Patient Care / ER Impact)</option>
                <option value="High">High (Core Billing / Dispensary / Records)</option>
                <option value="Medium">Medium (Administrative / Reporting)</option>
                <option value="Low">Low (Ancillary Service)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Host / IP Address / Domain
              </label>
              <input
                type="text"
                value={ipOrHost}
                onChange={(e) => setIpOrHost(e.target.value)}
                placeholder="e.g. 192.168.1.104 or claimit.hospital.local"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Port
              </label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="e.g. 80, 443, 8080, 5432"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reported Ping Latency (ms)
              </label>
              <input
                type="number"
                value={latencyMs}
                onChange={(e) => setLatencyMs(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Availability SLA Uptime (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={uptimePercentage}
                onChange={(e) => setUptimePercentage(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Managing IT Lead / In-Charge
              </label>
              <input
                type="text"
                value={leadAdmin}
                onChange={(e) => setLeadAdmin(e.target.value)}
                placeholder="e.g. Emmanuel Boateng (Lead Systems Admin)"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vendor & Escalation Contact
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. NHIA Ghana Technical Support (+233 30 200 0000)"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Clinical Scope
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. National Health Insurance claims bundling and tariff processing platform."
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            {!isNew && currentUser?.role === 'SUPER_ADMIN' ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-rose-200 dark:border-rose-900/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove System</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving Changes...' : 'Save & Publish Telemetry'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
