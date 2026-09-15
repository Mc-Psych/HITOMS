import React, { useState } from 'react';
import {
  CalendarCheck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  X,
  Wrench,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import {
  type MaintenanceRecord,
  type MaintenanceFrequency,
  type ChecklistItem,
  type PartUsed,
  type Asset,
  type User as UserType,
} from '../types';
import { maintenanceService } from '../services/maintenanceService';

interface MaintenanceViewProps {
  maintenance?: MaintenanceRecord[];
  maintenanceRecords?: MaintenanceRecord[];
  assets?: Asset[];
  allUsers?: UserType[];
  currentUser: UserType | null;
  onRefresh: () => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenance = [],
  maintenanceRecords = [],
  assets = [],
  allUsers = [],
  currentUser,
  onRefresh,
}) => {
  const safeMaintenance = (maintenance && maintenance.length > 0 ? maintenance : maintenanceRecords) || [];
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'COMPLETED' | 'ALL'>('UPCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);

  // Completion modal state
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [findings, setFindings] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [checklistState, setChecklistState] = useState<ChecklistItem[]>([]);
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>([]);
  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartUnitCost, setNewPartUnitCost] = useState(0);

  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id || '');
  const [maintenanceType, setMaintenanceType] = useState('Hardware Cleaning & Diagnostics');
  const [frequency, setFrequency] = useState<MaintenanceFrequency>('Monthly');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [technicianName, setTechnicianName] = useState(currentUser?.fullName || 'Emmanuel Asante');

  const filteredRecords = safeMaintenance.filter((m) => {
    const matchesSearch =
      m.maintenanceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.assetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.assignedTechnician.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'UPCOMING') {
      return matchesSearch && m.status !== 'Completed';
    }
    if (activeTab === 'COMPLETED') {
      return matchesSearch && m.status === 'Completed';
    }
    return matchesSearch;
  });

  const handleOpenCompleteModal = (record: MaintenanceRecord) => {
    setSelectedRecord(record);
    setChecklistState([...record.checklist]);
    setFindings('');
    setActionsTaken('');
    setPartsUsed([]);
    setCompleteModalOpen(true);
  };

  const handleAddPart = () => {
    if (!newPartName.trim() || newPartQty <= 0) return;
    const part: PartUsed = {
      itemName: newPartName.trim(),
      quantity: newPartQty,
      unitCost: newPartUnitCost,
      totalCost: newPartQty * newPartUnitCost,
    };
    setPartsUsed([...partsUsed, part]);
    setNewPartName('');
    setNewPartQty(1);
    setNewPartUnitCost(0);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    if (!asset) return;

    try {
      await maintenanceService.scheduleMaintenance(
        {
          assetId: asset.id,
          assetTag: asset.assetTag,
          assetName: `${asset.manufacturer} ${asset.model}`,
          department: asset.department,
          maintenanceType,
          frequency,
          scheduledDate,
          assignedTechnician: technicianName,
          checklist: [
            { id: 'chk-1', item: 'Inspect power supply and physical cables', completed: false },
            { id: 'chk-2', item: 'Internal dust extraction and fan diagnostics', completed: false },
            { id: 'chk-3', item: 'Operating system integrity and storage disk health', completed: false },
            { id: 'chk-4', item: 'Antivirus signature updates and network verification', completed: false },
          ],
        },
        currentUser
      );

      setScheduleModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !currentUser) return;

    try {
      await maintenanceService.completeMaintenance(
        selectedRecord.id,
        {
          findings: findings.trim() || 'All diagnostic tests passed within normal clinical tolerances.',
          actionsTaken: actionsTaken.trim() || 'Serviced, cleaned, and verified operational state.',
          partsUsed,
          checklist: checklistState,
        },
        currentUser
      );

      setCompleteModalOpen(false);
      setSelectedRecord(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-sky-600" />
            <span>Preventive Maintenance & Servicing</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline scheduled servicing for hospital workstations, backup UPS units, and server hardware.
          </p>
        </div>

        <button
          id="schedule-maintenance-btn"
          onClick={() => setScheduleModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Maintenance</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'UPCOMING'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Upcoming & Scheduled ({safeMaintenance.filter((m) => m.status !== 'Completed').length})
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'COMPLETED'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Completed History ({safeMaintenance.filter((m) => m.status === 'Completed').length})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            All Records ({maintenance.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search maintenance..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Maintenance Records List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecords.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            No maintenance records found in this view.
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div
              key={rec.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-sky-600">{rec.maintenanceNumber}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      rec.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : rec.status === 'Overdue'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">
                  {rec.maintenanceType}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Target: <strong className="text-slate-700 dark:text-slate-300">{rec.assetTag}</strong> ({rec.assetName})
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400">Scheduled Date</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{rec.scheduledDate}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Frequency</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{rec.frequency}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Department</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{rec.department}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Assigned Tech</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{rec.assignedTechnician}</div>
                  </div>
                </div>

                {rec.status === 'Completed' && rec.findings && (
                  <div className="mt-3 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-[11px] text-emerald-800 dark:text-emerald-300">
                    <strong>Findings:</strong> {rec.findings}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {rec.status !== 'Completed' ? (
                  <button
                    onClick={() => handleOpenCompleteModal(rec)}
                    className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Perform / Complete Servicing</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between w-full">
                    <span>Serviced by {rec.completedBy}</span>
                    {rec.nextMaintenanceDate && <span>Next: {rec.nextMaintenanceDate}</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Perform / Complete Servicing Modal */}
      {completeModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <span>Complete Servicing: {selectedRecord.maintenanceNumber}</span>
              </h3>
              <button onClick={() => setCompleteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              {/* Checklist verification */}
              <div>
                <label className="block text-slate-500 font-semibold mb-2">Checklist Verification</label>
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {checklistState.map((chk, idx) => (
                    <label key={idx} className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={chk.completed}
                        onChange={(e) => {
                          const updated = [...checklistState];
                          updated[idx].completed = e.target.checked;
                          setChecklistState(updated);
                        }}
                        className="w-4 h-4 text-sky-600 rounded"
                      />
                      <span>{chk.item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Diagnostic Findings *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Record hardware status, thermal metrics, disk health..."
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Actions Taken *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe cleaning, thermal paste replacement, software patching..."
                  value={actionsTaken}
                  onChange={(e) => setActionsTaken(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Parts Used Section */}
              <div className="space-y-2">
                <label className="block text-slate-500 font-semibold">Spare Parts Consumed</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Part Name (e.g. CR2032 CMOS battery)"
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newPartQty}
                    onChange={(e) => setNewPartQty(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={handleAddPart}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {partsUsed.length > 0 && (
                  <div className="space-y-1">
                    {partsUsed.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                        <span>{p.itemName} x{p.quantity}</span>
                        <span className="font-mono text-slate-500">${p.totalCost}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Verify & Sign Off Servicing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Maintenance Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-sky-600" />
                <span>Schedule Preventive Maintenance</span>
              </h3>
              <button onClick={() => setScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Target Hospital Asset *</label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} - {a.manufacturer} {a.model} ({a.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Maintenance Type *</label>
                <input
                  type="text"
                  required
                  value={maintenanceType}
                  onChange={(e) => setMaintenanceType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Frequency *</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as MaintenanceFrequency)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Bi-Annual">Bi-Annual</option>
                    <option value="Annual">Annual</option>
                    <option value="One-off">One-off Inspection</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                  </input>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Assigned IT Technician *</label>
                <input
                  type="text"
                  required
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Schedule Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
