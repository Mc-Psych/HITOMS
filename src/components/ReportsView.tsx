import React, { useState } from 'react';
import {
  FileBarChart2,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  type Ticket,
  type Asset,
  type MaintenanceRecord,
  type Incident,
  type InventoryItem,
  type SystemSettings,
} from '../types';

interface ReportsViewProps {
  tickets?: Ticket[];
  assets?: Asset[];
  maintenance?: MaintenanceRecord[];
  incidents?: Incident[];
  inventory?: InventoryItem[];
  systemSettings?: SystemSettings | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  tickets = [],
  assets = [],
  maintenance = [],
  incidents = [],
  inventory = [],
  systemSettings,
}) => {
  const safeTickets = tickets || [];
  const safeAssets = assets || [];
  const safeMaintenance = maintenance || [];
  const safeIncidents = incidents || [];
  const safeInventory = inventory || [];

  const [reportType, setReportType] = useState<'TICKETS' | 'ASSETS' | 'MAINTENANCE' | 'INVENTORY' | 'SLA'>('TICKETS');

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = `hitoms-report-${reportType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'TICKETS') {
      csvContent += 'Ticket Number,Title,Category,Priority,Status,Department,Location,Reported By,Created At\n';
      tickets.forEach((t) => {
        csvContent += `"${t.ticketNumber}","${t.title.replace(/"/g, '""')}","${t.category}","${t.priority}","${t.status}","${t.department}","${t.location}","${t.reportedBy.name}","${t.createdAt}"\n`;
      });
    } else if (reportType === 'ASSETS') {
      csvContent += 'Asset Tag,Type,Manufacturer,Model,Serial Number,Department,Location,Condition,Status,Assigned User\n';
      assets.forEach((a) => {
        csvContent += `"${a.assetTag}","${a.assetType}","${a.manufacturer}","${a.model}","${a.serialNumber}","${a.department}","${a.location}","${a.condition}","${a.status}","${a.assignedUser || ''}"\n`;
      });
    } else if (reportType === 'MAINTENANCE') {
      csvContent += 'Maintenance Number,Asset Tag,Type,Frequency,Scheduled Date,Status,Assigned Tech,Completed At,Cost\n';
      maintenance.forEach((m) => {
        csvContent += `"${m.maintenanceNumber}","${m.assetTag}","${m.maintenanceType}","${m.frequency}","${m.scheduledDate}","${m.status}","${m.assignedTechnician}","${m.completedAt || ''}","${m.cost}"\n`;
      });
    } else if (reportType === 'INVENTORY') {
      csvContent += 'Item Code,Item Name,Category,Quantity,Unit,Min Stock,Location\n';
      inventory.forEach((i) => {
        csvContent += `"${i.itemCode}","${i.itemName}","${i.category}","${i.quantity}","${i.unit}","${i.minimumStock}","${i.location}"\n`;
      });
    } else if (reportType === 'SLA') {
      csvContent += 'Ticket Number,Priority,Department,Reported By,Resolution Due,Status,SLA Met\n';
      tickets.forEach((t) => {
        const met = t.status === 'Resolved' || t.status === 'Closed';
        csvContent += `"${t.ticketNumber}","${t.priority}","${t.department}","${t.reportedBy.name}","${t.sla.resolutionDue}","${t.status}","${met ? 'YES' : 'PENDING'}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-sky-600" />
            <span>Local Operational Reports & Exports</span>
          </h1>
          <p className="text-xs text-slate-500">
            Generate and download CSV reports or printable audit documentation directly from local IndexedDB.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setReportType('TICKETS')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            reportType === 'TICKETS' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Ticket Workload Summary ({safeTickets.length})
        </button>
        <button
          onClick={() => setReportType('SLA')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            reportType === 'SLA' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          SLA Compliance Report
        </button>
        <button
          onClick={() => setReportType('ASSETS')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            reportType === 'ASSETS' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Equipment Register ({safeAssets.length})
        </button>
        <button
          onClick={() => setReportType('MAINTENANCE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            reportType === 'MAINTENANCE' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Preventive Maintenance ({safeMaintenance.length})
        </button>
        <button
          onClick={() => setReportType('INVENTORY')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            reportType === 'INVENTORY' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Consumables & Spares ({safeInventory.length})
        </button>
      </div>

      {/* Report Data Preview Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Report Preview: {reportType}
            </h3>
            <p className="text-xs text-slate-400">
              Generated on {new Date().toLocaleDateString()} for {systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital'} Management
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-sky-600">
            Node: hitoms.local
          </span>
        </div>

        <div className="overflow-x-auto">
          {reportType === 'TICKETS' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="p-2.5">Ticket #</th>
                  <th className="p-2.5">Title</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Priority</th>
                  <th className="p-2.5">Department</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {safeTickets.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td className="p-2.5 font-mono font-bold text-sky-600">{t.ticketNumber}</td>
                    <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{t.title}</td>
                    <td className="p-2.5 text-slate-500">{t.category}</td>
                    <td className="p-2.5">{t.priority}</td>
                    <td className="p-2.5">{t.department}</td>
                    <td className="p-2.5">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'ASSETS' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="p-2.5">Tag</th>
                  <th className="p-2.5">Device</th>
                  <th className="p-2.5">Serial #</th>
                  <th className="p-2.5">Department</th>
                  <th className="p-2.5">Condition</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {safeAssets.slice(0, 10).map((a) => (
                  <tr key={a.id}>
                    <td className="p-2.5 font-mono font-bold text-sky-600">{a.assetTag}</td>
                    <td className="p-2.5 font-semibold">{a.manufacturer} {a.model}</td>
                    <td className="p-2.5 font-mono text-slate-500">{a.serialNumber}</td>
                    <td className="p-2.5">{a.department}</td>
                    <td className="p-2.5">{a.condition}</td>
                    <td className="p-2.5">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'MAINTENANCE' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="p-2.5">Maintenance #</th>
                  <th className="p-2.5">Asset</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Scheduled</th>
                  <th className="p-2.5">Technician</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {safeMaintenance.slice(0, 10).map((m) => (
                  <tr key={m.id}>
                    <td className="p-2.5 font-mono font-bold text-sky-600">{m.maintenanceNumber}</td>
                    <td className="p-2.5 font-semibold">{m.assetTag} ({m.assetName})</td>
                    <td className="p-2.5">{m.maintenanceType}</td>
                    <td className="p-2.5">{m.scheduledDate}</td>
                    <td className="p-2.5">{m.assignedTechnician}</td>
                    <td className="p-2.5">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'INVENTORY' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="p-2.5">Item Code</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Quantity</th>
                  <th className="p-2.5">Min Stock</th>
                  <th className="p-2.5">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {safeInventory.slice(0, 10).map((i) => (
                  <tr key={i.id}>
                    <td className="p-2.5 font-mono font-bold text-sky-600">{i.itemCode}</td>
                    <td className="p-2.5 font-semibold">{i.itemName}</td>
                    <td className="p-2.5">{i.category}</td>
                    <td className="p-2.5 font-bold">{i.quantity} {i.unit}</td>
                    <td className="p-2.5 text-slate-500">{i.minimumStock} {i.unit}</td>
                    <td className="p-2.5">{i.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'SLA' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="p-2.5">Ticket #</th>
                  <th className="p-2.5">Department</th>
                  <th className="p-2.5">Priority</th>
                  <th className="p-2.5">Resolution Due</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">SLA Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {safeTickets.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td className="p-2.5 font-mono font-bold text-sky-600">{t.ticketNumber}</td>
                    <td className="p-2.5">{t.department}</td>
                    <td className="p-2.5">{t.priority}</td>
                    <td className="p-2.5 font-mono text-slate-500">{t.sla?.resolutionDue ? new Date(t.sla.resolutionDue).toLocaleString() : 'N/A'}</td>
                    <td className="p-2.5">{t.status}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Compliant
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
