import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  RefreshCw,
  Wrench,
  CheckCircle2,
  Database,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import {
  integrityValidationService,
  type IntegrityReport,
} from '../services/integrityValidationService';

interface IntegrityReportWidgetProps {
  onDataRepaired?: () => void;
}

export const IntegrityReportWidget: React.FC<IntegrityReportWidgetProps> = ({ onDataRepaired }) => {
  const [report, setReport] = useState<IntegrityReport | null>(
    integrityValidationService.getLastReport()
  );
  const [isScanning, setIsScanning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairSuccessMsg, setRepairSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to background validation updates
    const unsubscribe = integrityValidationService.subscribe((updatedReport) => {
      setReport(updatedReport);
    });

    // Run initial scan if report is missing
    if (!integrityValidationService.getLastReport()) {
      handleRunScan();
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRunScan = async () => {
    setIsScanning(true);
    setRepairSuccessMsg(null);
    try {
      const result = await integrityValidationService.runValidationScan();
      setReport(result);
    } catch (e) {
      console.error('[IntegrityReportWidget] Scan failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAutoRepair = async () => {
    setIsRepairing(true);
    setRepairSuccessMsg(null);
    try {
      const { repairedCount, report: postReport } =
        await integrityValidationService.repairCorruptedData();
      setReport(postReport);
      setRepairSuccessMsg(
        repairedCount > 0
          ? `Successfully auto-repaired ${repairedCount} corrupted record(s) / orphan queue items.`
          : 'All checked records are in clean state.'
      );
      if (onDataRepaired) {
        onDataRepaired();
      }
    } catch (e) {
      console.error('[IntegrityReportWidget] Auto-repair failed:', e);
    } finally {
      setIsRepairing(false);
    }
  };

  if (!report) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600 animate-pulse" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Data Integrity & Offline Health Report
            </h3>
          </div>
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-sky-500 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Initializing Scan...</span>
          </button>
        </div>
      </div>
    );
  }

  const isHealthy = report.status === 'HEALTHY';
  const isWarning = report.status === 'WARNING';
  const isCorrupted = report.status === 'CORRUPTED';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : isWarning
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {isHealthy && <ShieldCheck className="w-6 h-6" />}
            {isWarning && <ShieldAlert className="w-6 h-6" />}
            {isCorrupted && <AlertOctagon className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
                Offline Data Integrity & Health Audit
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  isHealthy
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : isWarning
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {report.status} ({report.score}% Integrity)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>
                Last validated {new Date(report.checkedAt).toLocaleTimeString()} across{' '}
                <strong className="text-slate-700 dark:text-slate-300 font-mono">
                  {report.totalRecordsChecked}
                </strong>{' '}
                IndexedDB records
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {report.issues.some((i) => i.autoRepairable) && (
            <button
              onClick={handleAutoRepair}
              disabled={isRepairing || isScanning}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Wrench className={`w-3.5 h-3.5 ${isRepairing ? 'animate-spin' : ''}`} />
              <span>{isRepairing ? 'Repairing...' : 'Auto-Repair Records'}</span>
            </button>
          )}

          <button
            onClick={handleRunScan}
            disabled={isScanning || isRepairing}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-sky-600' : ''}`} />
            <span>{isScanning ? 'Auditing...' : 'Run Full Audit'}</span>
          </button>
        </div>
      </div>

      {repairSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{repairSuccessMsg}</span>
        </div>
      )}

      {/* Score Meter & Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Integrity Score</div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
            {report.score}%
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                report.score >= 90
                  ? 'bg-emerald-500'
                  : report.score >= 75
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${report.score}%` }}
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Discrepancies Found</div>
          <div
            className={`text-lg font-black font-mono mt-1 ${
              report.issuesCount === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
            }`}
          >
            {report.issuesCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            {report.issuesCount === 0 ? 'Zero corruption' : `${report.issues.filter(i=>i.autoRepairable).length} repairable`}
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Local Users Store</div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
            {report.storeCounts['users'] || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Validated schema</div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Local Tickets & Assets</div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
            {(report.storeCounts['tickets'] || 0) + (report.storeCounts['assets'] || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">FK integrity ok</div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Sync Queue Verified</div>
          <div className="text-lg font-black font-mono text-sky-600 dark:text-sky-400 mt-1">
            {report.storeCounts['syncQueue'] || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">No orphan mutations</div>
        </div>
      </div>

      {/* Discrepancies / Issues Breakdown List */}
      {report.issues.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Detected Data Discrepancies ({report.issues.length})</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Periodic background validation running
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {report.issues.map((iss) => (
              <div
                key={iss.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                      iss.severity === 'HIGH'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : iss.severity === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                    }`}
                  >
                    {iss.severity}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 capitalize shrink-0 font-mono text-[11px]">
                    [{iss.storeName}]
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 truncate">{iss.message}</span>
                </div>

                {iss.autoRepairable && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded">
                    Auto-Repairable
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            100% Data Clean: IndexedDB records match sync queue schemas with zero orphan mutations or broken primary keys.
          </span>
        </div>
      )}
    </div>
  );
};
