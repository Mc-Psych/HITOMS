import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  Clock,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { type BackupRecord, type User as UserType } from '../types';
import { backupService } from '../services/backupService';

interface BackupsViewProps {
  currentUser: UserType | null;
  onRefresh?: () => void;
  onRestoreSuccess?: () => void;
}

export const BackupsView: React.FC<BackupsViewProps> = ({ currentUser, onRefresh, onRestoreSuccess }) => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const notifyRefresh = () => {
    onRefresh?.();
    onRestoreSuccess?.();
  };

  const loadBackups = async () => {
    const list = await backupService.getBackupRecords();
    setBackups(list);
  };

  React.useEffect(() => {
    loadBackups();
  }, []);

  const handleManualBackup = async () => {
    if (!currentUser) return;
    setIsCreating(true);
    try {
      await backupService.createManualBackup(currentUser);
      await loadBackups();
      notifyRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsRestoring(true);
    setRestoreMessage('Reading backup archive and validating integrity...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonString = event.target?.result as string;
        const result = await backupService.restoreFromJSON(jsonString, currentUser);
        setRestoreMessage(result.message);
        await loadBackups();
        notifyRefresh();
      } catch (err: any) {
        setRestoreMessage(`Restore Error: ${err.message}`);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-600" />
            <span>Database Backup & Disaster Recovery</span>
          </h1>
          <p className="text-xs text-slate-500">
            Local server snapshot engine. Protects patient tickets, assets, audit trails, and inventory ledger without Internet.
          </p>
        </div>

        <button
          onClick={handleManualBackup}
          disabled={isCreating}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
        >
          <Download className={`w-4 h-4 ${isCreating ? 'animate-bounce' : ''}`} />
          <span>{isCreating ? 'Generating Snapshot...' : 'Run Immediate Backup'}</span>
        </button>
      </div>

      {/* Backup Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-sky-600">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Scheduled Auto-Backup</span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white mt-2">
            Daily at 02:00 GMT
          </div>
          <p className="text-xs text-slate-500 mt-1">Automatic cron task writes full snapshot to local SSD mirror</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Snapshot Encryption</span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white mt-2">
            AES-256 Checksummed
          </div>
          <p className="text-xs text-slate-500 mt-1">SHA-256 verified integrity hash per snapshot</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-purple-600">
            <HardDrive className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Disaster Recovery</span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white mt-2">
            RTO &lt; 3 mins | RPO &lt; 24h
          </div>
          <p className="text-xs text-slate-500 mt-1">Local instant restore into browser or server container</p>
        </div>
      </div>

      {/* Restore Area */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center mx-auto">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Restore Database from Snapshot File
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Upload a valid HITOMS backup file (`.json`) to overwrite or rebuild local hospital operational state.
          </p>
        </div>

        <div className="pt-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-md cursor-pointer hover:opacity-90">
            <FileCode className="w-4 h-4" />
            <span>Select Backup File (.json)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {restoreMessage && (
          <div className="mt-3 p-3 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 text-xs font-medium max-w-lg mx-auto">
            {restoreMessage}
          </div>
        )}
      </div>

      {/* Backup History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Local Backup Catalog & Archive
          </h3>
          <span className="text-xs text-slate-500">{backups.length} snapshots recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Filename</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">File Size</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Checksum</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {new Date(b.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {b.filename}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                      {b.backupType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                    {(b.sizeBytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {b.createdBy}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {(b.checksumSha256 || 'SHA256-PENDING').substring(0, 16)}...
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{b.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
