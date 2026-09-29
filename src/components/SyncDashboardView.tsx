import React, { useState } from 'react';
import { IntegrityReportWidget } from './IntegrityReportWidget';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  Database,
  Shield,
  Activity,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  type SyncQueueItem,
  type SystemSettings,
} from '../types';
import { syncService, type ConflictResolutionStrategy } from '../services/syncService';

export interface SyncLog {
  id: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  count: number;
  message: string;
}

interface SyncDashboardViewProps {
  isOnline: boolean;
  isSyncing: boolean;
  syncQueue: SyncQueueItem[];
  syncLogs: SyncLog[];
  systemSettings?: SystemSettings | null;
  onTriggerSync: () => void;
  onRefresh: () => void;
}

export const SyncDashboardView: React.FC<SyncDashboardViewProps> = ({
  isOnline,
  isSyncing,
  syncQueue,
  syncLogs,
  systemSettings,
  onTriggerSync,
  onRefresh,
}) => {
  const [strategy, setStrategy] = useState<ConflictResolutionStrategy>(syncService.getConflictStrategy());
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleStrategyChange = (newStrategy: ConflictResolutionStrategy) => {
    setStrategy(newStrategy);
    syncService.setConflictStrategy(newStrategy);
  };

  const handleToggleSimulation = () => {
    const next = !simulatedOffline;
    setSimulatedOffline(next);
    syncService.toggleSimulatedOffline(next);
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      await syncService.retryFailedSync();
      onRefresh();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClearFailed = async () => {
    if (window.confirm('Clear all failed mutations from the queue?')) {
      await syncService.clearFailedQueue();
      onRefresh();
    }
  };

  const failedItems = syncQueue.filter((q) => q.status === 'FAILED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-sky-600" />
            <span>Cloud & Remote Synchronization Center</span>
          </h1>
          <p className="text-xs text-slate-500">
            Bidirectional delta synchronization manager, offline mutation queues, and conflict resolution policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {failedItems.length > 0 && (
            <>
              <button
                onClick={handleRetryFailed}
                disabled={isRetrying || isSyncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                title="Retry all failed mutations"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Retry Failed ({failedItems.length})</span>
              </button>
              <button
                onClick={handleClearFailed}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-900 transition cursor-pointer"
                title="Clear failed queue items"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Failed</span>
              </button>
            </>
          )}

          {/* Outage simulator toggle */}
          <button
            onClick={handleToggleSimulation}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
              simulatedOffline
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {simulatedOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4 text-emerald-500" />}
            <span>{simulatedOffline ? 'Resume Starlink Uplink' : 'Simulate Starlink Outage'}</span>
          </button>

          <button
            onClick={onTriggerSync}
            disabled={isSyncing || !isOnline}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Force Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Uplink Status</span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
            {isOnline ? 'Starlink Connected' : 'Offline (Local LAN)'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isOnline ? 'External cloud sync active' : 'Zero data loss — all operations local'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Mutations</span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black text-sky-600 mt-2 font-mono">
            {syncQueue.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Queued local commits awaiting uplink
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Conflict Policy</span>
            <Shield className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white mt-2">
            {strategy}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Deterministic deterministic merge
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Local Database Storage</span>
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
            IndexedDB
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {systemSettings?.systemName || 'HITOMS'}_Local_v1 (Persistent)
          </div>
        </div>
      </div>

      {/* Data Integrity & Offline Health Report Widget */}
      <IntegrityReportWidget onDataRepaired={onRefresh} />

      {/* Strategy Selector Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Data Conflict Resolution Configuration
            </h3>
            <p className="text-xs text-slate-500">
              Select how concurrent modifications between regional headquarters and local hospital server are handled.
            </p>
          </div>
          <Settings className="w-4 h-4 text-slate-400" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {(['LAST_WRITE_WINS', 'LOCAL_AUTHORITATIVE', 'SERVER_AUTHORITATIVE'] as ConflictResolutionStrategy[]).map((strat) => (
            <div
              key={strat}
              onClick={() => handleStrategyChange(strat)}
              className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                strategy === strat
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-900 dark:text-sky-200'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="font-bold">{strat.replace(/_/g, ' ')}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {strat === 'LAST_WRITE_WINS' && 'Latest ISO timestamp wins conflict automatically.'}
                {strat === 'LOCAL_AUTHORITATIVE' && 'Hospital local server edits override external cloud edits.'}
                {strat === 'SERVER_AUTHORITATIVE' && 'Cloud headquarters edits take precedence over hospital local edits.'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offline Sync Queue Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Pending Outbound Sync Queue
            </h3>
            <p className="text-xs text-slate-400">Chronologically queued operations that will replay when Starlink reconnects</p>
          </div>
          <span className="text-xs font-mono font-bold text-sky-600">
            {syncQueue.length} records in queue
          </span>
        </div>

        {syncQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Queue is clean. All local hospital operations are fully synchronized.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Entity Store</th>
                  <th className="px-4 py-3">Operation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3">Retries</th>
                  <th className="px-4 py-3">Payload Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {syncQueue.map((item) => (
                  <tr key={item.operationId || item.entityId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-sky-600">
                      {item.entityType || (item as any).storeName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.operation === 'CREATE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : item.operation === 'UPDATE'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {item.operation}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : item.status === 'RETRYING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                      {(item.entityId || 'ENTITY-ID').substring(0, 12)}...
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {item.retryCount}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate font-mono text-[11px]">
                      {JSON.stringify(item.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Execution History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Synchronization Audit & Batch History
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {syncLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="px-5 py-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {log.message || `Batch Sync completed successfully.`}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Status: {log.status} | Sync count: {log.count} records
                  </div>
                </div>
              </div>
              <span className="font-mono text-slate-500 text-[11px]">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
