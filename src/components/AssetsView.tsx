import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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
  Key,
  CheckSquare,
  Square,
  FileText,
  Tag,
  Camera,
  Upload,
  Download,
  Image as ImageIcon,
} from 'lucide-react';
import {
  type Asset,
  type AssetStatus,
  type AssetCondition,
  type AssetHistoryEntry,
  type User as UserType,
} from '../types';
import { assetService } from '../services/assetService';
import { authService } from '../services/authService';
import {
  generateAssetQrMetadataPayload,
  downloadAssetQrJpeg,
} from '../utils/qrLabelGenerator';
import { SoftwareSubscriptionsTab } from './SoftwareSubscriptionsTab';
import { AssetQRLabelModal } from './AssetQRLabelModal';
import { AssetBulkUploadModal } from './AssetBulkUploadModal';

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
  const [activeTab, setActiveTab] = useState<'HARDWARE' | 'SUBSCRIPTIONS'>('HARDWARE');
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

  // Permission check: strictly Super Admin and IT unit staff can edit/add assets. Auditor and Management are read-only.
  const canManageAssets = authService.canManageAssets(currentUser);
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
  const [scannedAssetFound, setScannedAssetFound] = useState<Asset | null>(null);

  // Bulk Upload Modal state
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);

  // QR Label Print Modal states
  const [qrLabelAsset, setQrLabelAsset] = useState<Asset | null>(null);
  const [batchQRModalOpen, setBatchQRModalOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [detailQrCodeDataUrl, setDetailQrCodeDataUrl] = useState<string>('');

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

  // Generate rich QR code data URL whenever selectedAsset changes (encodes Name, Serial, Dept, etc.)
  useEffect(() => {
    if (!selectedAsset) {
      setDetailQrCodeDataUrl('');
      return;
    }
    const payload = generateAssetQrMetadataPayload(selectedAsset);
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setDetailQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate detail QR:', err));
  }, [selectedAsset]);

  // Selection toggle helpers
  const toggleSelectAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (selectedAssetIds.size === filteredAssets.length && filteredAssets.length > 0) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

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

  const handleScanTag = async (overrideValue?: string) => {
    const raw = (overrideValue !== undefined ? overrideValue : scannedTagInput).trim();
    if (!raw) return;

    // Check if input is a rich formatted QR string (e.g. from mobile camera or barcode scanner)
    const tagMatch = raw.match(/TAG[:\s]+([A-Za-z0-9-_]+)/i);
    const snMatch = raw.match(/S\/N[:\s]+([A-Za-z0-9-_]+)/i);
    let searchTerm = raw;

    if (tagMatch && tagMatch[1]) {
      searchTerm = tagMatch[1];
    } else if (raw.startsWith('HITOMS-ASSET:')) {
      searchTerm = raw.replace('HITOMS-ASSET:', '');
    } else if (snMatch && snMatch[1]) {
      searchTerm = snMatch[1];
    }

    let found = await assetService.getAssetByTag(searchTerm);
    if (!found) {
      // Check if matches serial number or id directly
      found = assets.find(
        (a) =>
          a.serialNumber.toLowerCase() === searchTerm.toLowerCase() ||
          a.assetTag.toLowerCase() === searchTerm.toLowerCase() ||
          a.id === searchTerm
      ) || null;
    }

    if (found) {
      setScannedAssetFound(found);
      handleSelectAsset(found);
    } else {
      alert(`Asset matching "${searchTerm}" not found in local database.`);
    }
  };

  const departments = Array.from(new Set(assets.map((a) => a.department)));

  return (
    <div className="space-y-6">
      {/* Top Asset Module Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('HARDWARE')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition cursor-pointer ${
            activeTab === 'HARDWARE'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Hardware Registry ({assets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SUBSCRIPTIONS')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition cursor-pointer ${
            activeTab === 'SUBSCRIPTIONS'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Software Licenses & Subscriptions</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-bold">
            M365 / Antivirus / LHIMS
          </span>
        </button>
      </div>

      {activeTab === 'SUBSCRIPTIONS' ? (
        <SoftwareSubscriptionsTab
          currentUser={currentUser}
          onRefreshParent={onRefresh}
        />
      ) : (
        <>
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <span>IT Hardware Asset Registry</span>
              </h1>
              <p className="text-xs text-slate-500">
                Offline clinical hardware inventory with immutable transfer history, custodian tracking, and QR code tagging.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="scan-qr-btn"
                onClick={() => {
                  setScannedAssetFound(null);
                  setScannedTagInput('');
                  setQrModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                title="Scan or lookup QR code data / hardware serial number"
              >
                <QrCode className="w-4 h-4 text-sky-400" />
                <span>Scan / Lookup QR</span>
              </button>

              <button
                id="batch-print-qr-btn"
                onClick={() => setBatchQRModalOpen(true)}
                title="Print batch QR code labels for physical equipment tracking"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 font-semibold text-xs border border-indigo-700/80 transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                <span>
                  {selectedAssetIds.size > 0
                    ? `Print ${selectedAssetIds.size} Selected QR Labels`
                    : `Print QR Labels (${filteredAssets.length})`}
                </span>
              </button>

              {canManageAssets && (
                <button
                  id="bulk-upload-assets-btn"
                  onClick={() => setBulkUploadModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  title="Bulk upload multiple IT assets via CSV / Excel template"
                >
                  <Upload className="w-4 h-4 text-emerald-200" />
                  <span>Bulk Upload (CSV)</span>
                </button>
              )}

              {canManageAssets ? (
                <button
                  id="register-asset-btn"
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Asset</span>
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700">
                  Audit / Management View Only
                </span>
              )}
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

        {/* Multi-Select Floating Notification / Action Strip */}
        {selectedAssetIds.size > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-900 dark:text-indigo-200">
                {selectedAssetIds.size} of {filteredAssets.length} assets selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBatchQRModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print {selectedAssetIds.size} Labels</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAssetIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium px-2 py-1"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asset Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllFiltered}
                    className="text-slate-500 hover:text-sky-600 transition"
                    title={selectedAssetIds.size === filteredAssets.length ? 'Deselect All' : 'Select All Filtered'}
                  >
                    {filteredAssets.length > 0 && selectedAssetIds.size === filteredAssets.length ? (
                      <CheckSquare className="w-4 h-4 text-sky-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Asset Tag</th>
                <th className="px-4 py-3">Equipment / Specs</th>
                <th className="px-4 py-3">Serial Number</th>
                <th className="px-4 py-3">Department & Room</th>
                <th className="px-4 py-3">Assigned User</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    No assets found in local registry.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const isSelected = selectedAssetIds.has(asset.id);
                  return (
                    <tr
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-3 py-3 text-center" onClick={(e) => toggleSelectAsset(asset.id, e)}>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-sky-600 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Download scannable QR Code as JPEG image with Name, Serial Number, and Department details rendered below"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await downloadAssetQrJpeg(asset);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>QR JPEG</span>
                          </button>

                          <button
                            type="button"
                            title="Generate & Print Physical QR Code Tag Label"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrLabelAsset(asset);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 font-semibold transition cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>Print Label</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAsset(asset);
                            }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                  {/* Generated Scannable High-Res QR code box */}
                  <div className="w-20 h-20 bg-white p-1 rounded-xl flex items-center justify-center text-slate-950 shadow-inner overflow-hidden">
                    {detailQrCodeDataUrl ? (
                      <img
                        src={detailQrCodeDataUrl}
                        alt={`QR Code for ${selectedAsset.assetTag}`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <QrCode className="w-14 h-14 text-slate-900 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="font-mono text-base font-black text-sky-400">{selectedAsset.assetTag}</div>
                    <div className="text-xs text-slate-300">Hospital Equipment ID: {selectedAsset.qrCodeData}</div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">MAC: {selectedAsset.macAddress || 'N/A'} | IP: {selectedAsset.ipAddress || 'DHCP'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedAsset) await downloadAssetQrJpeg(selectedAsset);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-sm transition"
                    title="Download QR code as JPEG image with Name, Serial Number, and Assigned Department rendered below the QR code image"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR (JPEG)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQrLabelAsset(selectedAsset)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-sm transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print QR Label</span>
                  </button>

                  {canManageAssets && (
                    <button
                      onClick={() => {
                        setNewDepartment(selectedAsset.department);
                        setNewLocation(selectedAsset.location);
                        setNewAssignedUser(selectedAsset.assignedUser || '');
                        setTransferModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer transition"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Transfer / Reassign</span>
                    </button>
                  )}
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
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
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
              Paste or scan barcode/QR code data (or enter an Asset Tag / Serial Number like <strong>HIT-AST-000101</strong>) to retrieve instant offline hardware specifications.
            </p>

            <div className="space-y-2">
              <textarea
                rows={3}
                placeholder="Scan or paste QR code content or Asset Tag..."
                value={scannedTagInput}
                onChange={(e) => setScannedTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleScanTag();
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
              />

              <div className="flex flex-wrap gap-1 justify-center pt-1">
                <span className="text-[10px] text-slate-400">Quick Samples:</span>
                {assets.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setScannedTagInput(a.assetTag);
                      handleScanTag(a.assetTag);
                    }}
                    className="text-[10px] font-mono bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800 px-1.5 py-0.5 rounded cursor-pointer hover:bg-sky-100"
                  >
                    {a.assetTag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleScanTag()}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer shadow-sm transition"
            >
              Search Asset Record
            </button>

            {scannedAssetFound && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Hardware Record Verified</span>
                  </div>
                  <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                    {scannedAssetFound.assetTag}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Model:</span>
                    <span className="font-semibold">{scannedAssetFound.manufacturer} {scannedAssetFound.model}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Serial (S/N):</span>
                    <span className="font-mono">{scannedAssetFound.serialNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Location:</span>
                    <span>{scannedAssetFound.department} ({scannedAssetFound.location})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Custodian:</span>
                    <span>{scannedAssetFound.assignedUser || 'Shared Ward Device'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      setQrLabelAsset(scannedAssetFound);
                      setQrModalOpen(false);
                    }}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print QR Label / Download JPEG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectAsset(scannedAssetFound);
                      setQrModalOpen(false);
                    }}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              </div>
            )}
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

      {/* QR Code Physical Label Modal (Single Asset) */}
      {qrLabelAsset && (
        <AssetQRLabelModal
          isOpen={true}
          onClose={() => setQrLabelAsset(null)}
          asset={qrLabelAsset}
          hospitalName="REGIONAL HOSPITAL IT UNIT"
        />
      )}

      {/* QR Code Physical Labels Batch Modal (Multi-Asset) */}
      {batchQRModalOpen && (
        <AssetQRLabelModal
          isOpen={true}
          onClose={() => setBatchQRModalOpen(false)}
          asset={null}
          selectedAssets={
            selectedAssetIds.size > 0
              ? assets.filter((a) => selectedAssetIds.has(a.id))
              : filteredAssets
          }
          hospitalName="REGIONAL HOSPITAL IT UNIT"
        />
      )}

      {/* Bulk Upload IT Assets Modal (CSV / Excel template) */}
      <AssetBulkUploadModal
        isOpen={bulkUploadModalOpen}
        onClose={() => setBulkUploadModalOpen(false)}
        currentUser={currentUser}
        existingAssets={assets}
        onSuccess={(created) => {
          onRefresh();
        }}
        onOpenQRBatchPrint={(created) => {
          setSelectedAssetIds(new Set(created.map((a) => a.id)));
          setBatchQRModalOpen(true);
        }}
      />
        </>
      )}
    </div>
  );
};
