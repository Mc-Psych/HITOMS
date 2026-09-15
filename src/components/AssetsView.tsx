import React, { useState } from 'react';
import {
  HardDrive,
  Plus,
  Search,
  QrCode,
  ArrowRightLeft,
  History,
  ShieldCheck,
  CheckCircle2,
  X,
  Building,
  MapPin,
  Laptop,
  Server,
  Printer,
  ChevronRight,
  User,
} from 'lucide-react';
import {
  type Asset,
  type AssetStatus,
  type AssetCondition,
  type AssetHistoryEntry,
  type User as UserType,
} from '../types';
import { assetService } from '../services/assetService';

interface AssetsViewProps {
  assets: Asset[];
  allUsers: UserType[];
  currentUser: UserType | null;
  onRefresh: () => void;
}

export const AssetsView: React.FC<AssetsViewProps> = ({
  assets,
  allUsers,
  currentUser,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Transfer / Reassign state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAssignedUser, setNewAssignedUser] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Create Asset Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newAssetType, setNewAssetType] = useState<string>('Desktop');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [department, setDepartment] = useState('Pharmacy');
  const [location, setLocation] = useState('Dispensing Counter 1');
  const [assignedUser, setAssignedUser] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('Good');
  const [ipAddress, setIpAddress] = useState('192.168.10.');
  const [os, setOs] = useState('Windows 11 Pro');

  // QR Scanner modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [scannedTagInput, setScannedTagInput] = useState('');

  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.assignedUser && a.assignedUser.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || a.assetType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesDept = deptFilter === 'ALL' || a.department === deptFilter;

    return matchesSearch && matchesType && matchesStatus && matchesDept;
  });

  const handleSelectAsset = async (asset: Asset) => {
    setSelectedAsset(asset);
    setLoadingHistory(true);
    try {
      const history = await assetService.getAssetHistory(asset.id);
      setAssetHistory(history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manufacturer.trim() || !model.trim() || !currentUser) return;

    try {
      await assetService.createAsset(
        {
          assetType: newAssetType,
          manufacturer: manufacturer.trim(),
          model: model.trim(),
          serialNumber: serialNumber.trim(),
          department,
          location,
          assignedUser: assignedUser.trim() || undefined,
          purchaseDate: new Date().toISOString().split('T')[0],
          purchasePrice: 1250,
          supplier: 'Hospital Authorized Vendor',
          warrantyStart: new Date().toISOString().split('T')[0],
          warrantyEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 3).toISOString().split('T')[0],
          condition,
          status: assignedUser.trim() ? 'Assigned' : 'Available',
          operatingSystem: os,
          ipAddress: ipAddress.trim() || undefined,
          specifications: `${manufacturer.trim()} ${model.trim()} - Standard Clinical Build`,
        },
        currentUser
      );

      setCreateModalOpen(false);
      setManufacturer('');
      setModel('');
      setSerialNumber('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !currentUser) return;

    try {
      const updated = await assetService.updateAsset(
        selectedAsset.id,
        {
          department: newDepartment || selectedAsset.department,
          location: newLocation || selectedAsset.location,
          assignedUser: newAssignedUser || selectedAsset.assignedUser,
        },
        currentUser,
        transferReason
      );
      setSelectedAsset(updated);
      setTransferModalOpen(false);
      const history = await assetService.getAssetHistory(updated.id);
      setAssetHistory(history);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanTag = async () => {
    if (!scannedTagInput.trim()) return;
    const found = await assetService.getAssetByTag(scannedTagInput.trim());
    if (found) {
      handleSelectAsset(found);
      setQrModalOpen(false);
      setScannedTagInput('');
    } else {
      alert(`Asset with tag "${scannedTagInput}" not found in local database.`);
    }
  };

  const departments = Array.from(new Set(assets.map((a) => a.department)));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-sky-600" />
            <span>IT Asset Management & Registry</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline hardware & software inventory with immutable transfer history and QR code tagging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="scan-qr-btn"
            onClick={() => setQrModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-sky-400" />
            <span>Scan QR Tag</span>
          </button>

          <button
            id="register-asset-btn"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Asset</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="asset-search-input"
              type="text"
              placeholder="Search tag, serial, model, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
            />
          </div>

          <select
            id="asset-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Asset Types</option>
            <option value="Desktop">Desktop</option>
            <option value="Laptop">Laptop</option>
            <option value="Server">Server</option>
            <option value="Switch">Switch</option>
            <option value="Router">Router</option>
            <option value="Access Point">Access Point</option>
            <option value="Printer">Printer</option>
            <option value="UPS">UPS</option>
          </select>

          <select
            id="asset-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Repair">Under Repair</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>

          <select
            id="asset-dept-filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Asset Tag</th>
                <th className="px-4 py-3">Equipment / Specs</th>
                <th className="px-4 py-3">Serial Number</th>
                <th className="px-4 py-3">Department & Room</th>
                <th className="px-4 py-3">Assigned User</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No assets found in local registry.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => handleSelectAsset(asset)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-sky-600">
                      {asset.assetTag}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {asset.manufacturer} {asset.model}
                      </div>
                      <div className="text-[10px] text-slate-400">{asset.assetType} - {asset.operatingSystem || 'Hardware'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {asset.serialNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="font-medium">{asset.department}</div>
                      <div className="text-[10px] text-slate-400">{asset.location}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {asset.assignedUser || <span className="text-slate-400 italic">Department shared</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          asset.condition === 'Excellent' || asset.condition === 'Good'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}
                      >
                        {asset.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          asset.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAsset(asset);
                        }}
                        className="text-sky-600 hover:text-sky-700 font-semibold text-xs flex items-center justify-end gap-1 ml-auto"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Details & Immutable History Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sky-600 text-sm">{selectedAsset.assetTag}</span>
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  {selectedAsset.manufacturer} {selectedAsset.model}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {selectedAsset.status}
                </span>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Asset QR Tag & Quick Barcode Preview */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-slate-900 text-white gap-4">
                <div className="flex items-center gap-4">
                  {/* Simulated High-Res QR code box */}
                  <div className="w-20 h-20 bg-white p-2 rounded-xl flex items-center justify-center text-slate-950 shadow-inner">
                    <QrCode className="w-16 h-16 text-slate-900" />
                  </div>
                  <div>
                    <div className="font-mono text-base font-black text-sky-400">{selectedAsset.assetTag}</div>
                    <div className="text-xs text-slate-300">Hospital Equipment ID: {selectedAsset.qrCodeData}</div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">MAC: {selectedAsset.macAddress || 'N/A'} | IP: {selectedAsset.ipAddress || 'DHCP'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setNewDepartment(selectedAsset.department);
                      setNewLocation(selectedAsset.location);
                      setNewAssignedUser(selectedAsset.assignedUser || '');
                      setTransferModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer / Reassign</span>
                  </button>
                </div>
              </div>

              {/* Specifications & Location Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <span className="text-slate-400">Department</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.department}</div>
                </div>
                <div>
                  <span className="text-slate-400">Room / Bed Area</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.location}</div>
                </div>
                <div>
                  <span className="text-slate-400">Assigned User</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.assignedUser || 'Shared'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Condition</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.condition}</div>
                </div>
                <div>
                  <span className="text-slate-400">Serial Number</span>
                  <div className="font-mono text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.serialNumber}</div>
                </div>
                <div>
                  <span className="text-slate-400">Operating System</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.operatingSystem || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Purchase Date</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.purchaseDate || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Supplier</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.supplier || 'Hospital Procurement'}</div>
                </div>
              </div>

              {/* Immutable History Timeline (Section 13) */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-sky-600" />
                  <span>Immutable Asset Lifecycle History ({assetHistory.length})</span>
                </h4>

                <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800 pl-4 ml-2">
                  {loadingHistory ? (
                    <p className="text-slate-400">Loading audit history...</p>
                  ) : assetHistory.length === 0 ? (
                    <p className="text-slate-400 italic">No history records found.</p>
                  ) : (
                    assetHistory.map((h) => (
                      <div key={h.id} className="relative pb-3">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-sky-600 border-2 border-white dark:border-slate-900" />
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {h.action}
                          </span>
                          <span className="text-slate-400">{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{h.details}</p>
                        <div className="text-[10px] text-sky-600 mt-0.5">Performed by: {h.performedBy}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Asset Modal */}
      {transferModalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-sky-600" />
              <span>Transfer Asset {selectedAsset.assetTag}</span>
            </h3>

            <form onSubmit={handleTransferAsset} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Target Department *</label>
                <input
                  type="text"
                  required
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Target Room / Location *</label>
                <input
                  type="text"
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Assigned Custodian (Staff Name)</label>
                <input
                  type="text"
                  value={newAssignedUser}
                  onChange={(e) => setNewAssignedUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Transfer Reason / Authorization Note</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Relocated to maternity ward to support new triage desk"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Tag Scanner / Lookup Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-sky-600" />
                <span>Scan / Lookup QR Tag</span>
              </h3>
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-500">
              Enter or scan the hospital asset barcode (e.g. <strong>HIT-AST-000101</strong>) to retrieve instant offline records.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="HIT-AST-XXXXXX"
                value={scannedTagInput}
                onChange={(e) => setScannedTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanTag()}
                className="w-full px-3 py-2 text-center text-sm font-mono font-bold uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
              />

              <div className="flex flex-wrap gap-1 justify-center pt-2">
                <span className="text-[10px] text-slate-400">Quick Samples:</span>
                {assets.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setScannedTagInput(a.assetTag)}
                    className="text-[10px] font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded cursor-pointer hover:bg-sky-100"
                  >
                    {a.assetTag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleScanTag}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
            >
              Search Asset Record
            </button>
          </div>
        </div>
      )}

      {/* Register Asset Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <span>Register New IT Asset</span>
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Asset Type *</label>
                  <select
                    value={newAssetType}
                    onChange={(e) => setNewAssetType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Desktop">Desktop Workstation</option>
                    <option value="Laptop">Clinical Laptop</option>
                    <option value="Server">Local Server</option>
                    <option value="Switch">Network Switch</option>
                    <option value="Router">Core Router</option>
                    <option value="Access Point">Wi-Fi Access Point</option>
                    <option value="Printer">Printer / Scanner</option>
                    <option value="UPS">Power Backup UPS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Condition *</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as AssetCondition)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="New">Brand New</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good (Operational)</option>
                    <option value="Fair">Fair (Needs attention)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dell, HP, Cisco, Lenovo"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Model Name / Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OptiPlex 7090, ProBook 450"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Serial Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CN-0K9821-7281"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Operating System</label>
                  <input
                    type="text"
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Room / Exact Location *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Assigned Custodian (Staff)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Kwesi, Nurse Joyce"
                    value={assignedUser}
                    onChange={(e) => setAssignedUser(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Static IP (if applicable)</label>
                  <input
                    type="text"
                    placeholder="192.168.10.X"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Save to Local Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
