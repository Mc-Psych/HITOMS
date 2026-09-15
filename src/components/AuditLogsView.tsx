import React, { useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Shield,
  Clock,
  User,
  Activity,
} from 'lucide-react';
import { type AuditLog } from '../types';
import { auditService } from '../services/auditService';

interface AuditLogsViewProps {
  auditLogs?: AuditLog[];
  onRefresh?: () => void;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ auditLogs = [], onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const safeLogs = auditLogs || [];
  const filtered = safeLogs.filter((log) => {
    const act = (log.action || '').toLowerCase();
    const ent = (log.entityName || log.module || '').toLowerCase();
    const usr = (log.userName || log.user || '').toLowerCase();
    const dev = (log.deviceId || log.ipOrDevice || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();

    const matchesSearch =
      act.includes(query) ||
      ent.includes(query) ||
      usr.includes(query) ||
      dev.includes(query);
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(safeLogs.map((l) => l.action).filter(Boolean)));

  const handleExportAuditCSV = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Timestamp,Action,Entity,Record ID,User Name,User Role,Device ID,Offline Action,Details\n';
    filtered.forEach((l) => {
      const entity = l.entityName || l.module || 'System';
      const user = l.userName || l.user || 'Hospital System';
      const dev = l.deviceId || l.ipOrDevice || 'LOCAL-DEVICE';
      const recId = l.entityId || l.recordId || '';
      const isOff = l.isOfflineAction ?? true;
      const details = JSON.stringify(l.newValues || l.newValue || {}).replace(/"/g, '""');
      csv += `"${l.timestamp}","${l.action}","${entity}","${recId}","${user}","${l.userRole || ''}","${dev}","${isOff}","${details}"\n`;
    });
    const encoded = encodeURI(csv);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = `hitoms-audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" />
            <span>Immutable Compliance Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500">
            Append-only clinical compliance log. All local creations, updates, inventory adjustments, and status changes are permanently recorded.
          </p>
        </div>

        <button
          onClick={handleExportAuditCSV}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Audit CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search action, technician, entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-sky-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
        >
          <option value="ALL">All Actions ({auditLogs.length})</option>
          {uniqueActions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Entity Store</th>
                <th className="px-4 py-3">Performed By</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Device ID</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Details / Mutation Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-bold text-sky-600">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {log.entityName || log.module || 'System'}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {log.userName || log.user || 'Hospital System'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono">
                      {log.userRole || 'STAFF'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-400">
                    {(log.deviceId || log.ipOrDevice || 'LOCAL-DEV').substring(0, 12)}...
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        (log.isOfflineAction ?? true)
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {(log.isOfflineAction ?? true) ? 'Offline LAN' : 'Online Sync'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                    {JSON.stringify(log.newValues || log.newValue || {})}
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
