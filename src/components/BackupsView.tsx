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
  Check,
} from 'lucide-react';
import { type BackupRecord, type User as UserType, type SystemSettings } from '../types';
import { backupService } from '../services/backupService';

interface BackupsViewProps {
  currentUser: UserType | null;
  systemSettings?: SystemSettings | null;
  onRefresh?: () => void;
  onRestoreSuccess?: () => void;
}

export const BackupsView: React.FC<BackupsViewProps> = ({ currentUser, systemSettings, onRefresh, onRestoreSuccess }) => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  const systemName = systemSettings?.systemName || 'HITOMS';

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
    setDownloadSuccessMessage(null);
    try {
      const res = await backupService.createManualBackup(currentUser, true);
      await loadBackups();
      notifyRefresh();
      setDownloadSuccessMessage(`Backup generated and downloaded to your computer: ${res.filename} (${res.record.size})`);
      setTimeout(() => setDownloadSuccessMessage(null), 8000);
    } catch (err: any) {
      console.error(err);
      setRestoreMessage(`Backup Error: ${err.message || 'Failed to generate backup'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadLiveSnapshot = async () => {
    setIsDownloading(true);
    try {
      const res = await backupService.downloadFullDatabaseSnapshot(currentUser || undefined);
      if (res.success) {
        setDownloadSuccessMessage(`Full database snapshot downloaded: ${res.filename}`);
        setTimeout(() => setDownloadSuccessMessage(null), 8000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsDownloading(false);
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

  const getBackupFilename = (b: BackupRecord) => {
    const match = b.notes?.match(/\((.*?\.json)\)/);
    if (match?.[1]) return match[1];
    const dateStr = (b.lastBackup || b.createdAt || new Date().toISOString()).slice(0, 10);
    return `${systemName.toLowerCase()}-backup-${dateStr}-${b.id.slice(0, 6)}.json`;
  };

  return (
    <div className="space-y-6">
      {/* Download / Status Notification */}
      {downloadSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{downloadSuccessMessage}</span>
          </div>
          <button
            onClick={() => setDownloadSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadLiveSnapshot}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Download uncompressed JSON export of all database tables"
          >
            <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
            <span>{isDownloading ? 'Exporting...' : 'Export JSON'}</span>
          </button>

          <button
            onClick={handleManualBackup}
            disabled={isCreating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isCreating ? 'animate-bounce' : ''}`} />
            <span>{isCreating ? 'Generating & Downloading...' : 'Run Backup & Download'}</span>
          </button>
        </div>
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
          <p className="text-xs text-slate-500 mt-1">Automatic cron task writes full snapshot to local storage</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Snapshot Encryption</span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white mt-2">
            AES-256 Checksummed
          </div>
          <p className="text-xs text-slate-500 mt-1">Integrity verified per JSON snapshot archive</p>
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
            Upload a valid {systemName} backup file (`.json`) to overwrite or rebuild local hospital operational state.
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
          <div className="mt-3 p-3 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 text-xs font-medium max-w-lg mx-auto flex items-center justify-between">
            <span>{restoreMessage}</span>
            <button onClick={() => setRestoreMessage(null)} className="text-sky-800 font-bold ml-2">✕</button>
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No backup records created yet. Click "Run Backup & Download" to create your first snapshot.
                  </td>
                </tr>
              ) : (
                backups.map((b) => {
                  const filename = getBackupFilename(b);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {new Date(b.lastBackup || b.createdAt || Date.now()).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white font-mono text-[11px]">
                        {filename}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                          {b.backupType || 'Full Database'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                        {b.size || 'Auto'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {b.performedBy || 'System Admin'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{b.status || 'Successful'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={handleDownloadLiveSnapshot}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold text-[11px] border border-sky-200 dark:border-sky-800 transition cursor-pointer"
                          title="Download database snapshot file"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
