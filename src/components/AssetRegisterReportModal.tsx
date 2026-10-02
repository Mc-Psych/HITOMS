import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Printer,
  X,
  Filter,
  Layers,
  Building,
  CheckSquare,
  Square,
  DollarSign,
  Calendar,
  ShieldCheck,
  Tag,
  CheckCircle2,
  HardDrive,
  Eye,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import {
  type Asset,
  type AssetStatus,
  type AssetCondition,
  type SystemSettings,
  type User as UserType,
  type Department,
} from '../types';
import { downloadBlob, downloadTextFile } from '../utils/fileDownloader';

interface AssetRegisterReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  departments: Department[];
  allUsers: UserType[];
  currentUser: UserType | null;
  systemSettings?: SystemSettings | null;
}

export type PresentationGrouping =
  | 'DEPARTMENT'
  | 'TYPE'
  | 'CONDITION'
  | 'STATUS'
  | 'FLAT';

export const AssetRegisterReportModal: React.FC<AssetRegisterReportModalProps> = ({
  isOpen,
  onClose,
  assets,
  departments,
  allUsers,
  currentUser,
  systemSettings,
}) => {
  const [grouping, setGrouping] = useState<PresentationGrouping>('DEPARTMENT');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeFinancials, setIncludeFinancials] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [previewTab, setPreviewTab] = useState<'PREVIEW' | 'SETTINGS'>('PREVIEW');
  const [isExporting, setIsExporting] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const hospitalName =
    systemSettings?.facilityName ||
    systemSettings?.hospitalName ||
    'St. Mary Theresa Catholic Hospital';
  const hospitalPhone =
    systemSettings?.contactPhone ||
    systemSettings?.telephone ||
    'Tel: 055 272 2289';
  const hospitalEmail =
    systemSettings?.contactEmail ||
    systemSettings?.email ||
    'send2smthit@gmail.com';
  const hospitalAddress =
    systemSettings?.facilityAddress ||
    systemSettings?.address ||
    'P.O. Box 45, Catholic Diocese Health Service, Dodi-Papase, Oti Region, Ghana';

  // Distinct types, conditions, statuses in dataset
  const distinctTypes = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.type) set.add(a.type);
    });
    return Array.from(set).sort();
  }, [assets]);

  const distinctConditions = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.condition) set.add(a.condition);
    });
    return Array.from(set).sort();
  }, [assets]);

  const distinctStatuses = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.status) set.add(a.status);
    });
    return Array.from(set).sort();
  }, [assets]);

  const distinctDepts = useMemo(() => {
    const fromDepts = departments.map((d) => d.name);
    const fromAssets = assets.map((a) => a.department).filter(Boolean);
    const combined = Array.from(new Set([...fromDepts, ...fromAssets]));
    return combined.sort();
  }, [departments, assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (selectedDept !== 'ALL' && asset.department !== selectedDept) return false;
      if (selectedType !== 'ALL' && asset.type !== selectedType) return false;
      if (selectedCondition !== 'ALL' && asset.condition !== selectedCondition) return false;
      if (selectedStatus !== 'ALL' && asset.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTag = (asset.assetTag || '').toLowerCase().includes(q);
        const matchName = (asset.name || '').toLowerCase().includes(q);
        const matchModel = (asset.model || '').toLowerCase().includes(q);
        const matchMfg = (asset.manufacturer || '').toLowerCase().includes(q);
        const matchSerial = (asset.serialNumber || '').toLowerCase().includes(q);
        const matchCustodian = (asset.assignedTo || '').toLowerCase().includes(q);
        const matchRoom = (asset.location || '').toLowerCase().includes(q);
        if (!matchTag && !matchName && !matchModel && !matchMfg && !matchSerial && !matchCustodian && !matchRoom) {
          return false;
        }
      }
      return true;
    });
  }, [assets, selectedDept, selectedType, selectedCondition, selectedStatus, searchQuery]);

  // Grouped Assets Structure
  const groupedData = useMemo(() => {
    const groups: { [key: string]: Asset[] } = {};

    filteredAssets.forEach((asset) => {
      let key = 'General';
      if (grouping === 'DEPARTMENT') {
        key = asset.department || 'Unassigned Department';
      } else if (grouping === 'TYPE') {
        key = asset.type || 'Other Equipment';
      } else if (grouping === 'CONDITION') {
        key = asset.condition || 'Unspecified Condition';
      } else if (grouping === 'STATUS') {
        key = asset.status || 'Active / In Service';
      } else {
        key = 'All Hospital Assets';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    });

    // Sort group keys
    const sortedKeys = Object.keys(groups).sort();
    return sortedKeys.map((key) => ({
      groupName: key,
      assets: groups[key].sort((a, b) => (a.assetTag || '').localeCompare(b.assetTag || '')),
      totalValue: groups[key].reduce((sum, a) => sum + (Number(a.purchasePrice) || 0), 0),
      count: groups[key].length,
    }));
  }, [filteredAssets, grouping]);

  const grandTotalCount = filteredAssets.length;
  const grandTotalValue = filteredAssets.reduce(
    (sum, a) => sum + (Number(a.purchasePrice) || 0),
    0
  );

  if (!isOpen) return null;

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      const wb = XLSX.utils.book_new();

      // Master Register Sheet
      const rows: any[] = [];
      rows.push([`${hospitalName.toUpperCase()} - ASSET REGISTER REPORT`]);
      rows.push([`Generated On: ${new Date().toLocaleString()} | Facility Contact: ${hospitalPhone} | ${hospitalEmail}`]);
      rows.push([`Presentation View: Categorized by ${grouping} | Total Assets: ${grandTotalCount} | Total Valuation: GH₵ ${grandTotalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      rows.push([]); // blank row

      groupedData.forEach((group) => {
        if (grouping !== 'FLAT') {
          rows.push([`>> SECTION: ${group.groupName.toUpperCase()} (${group.count} Assets, Valuation: GH₵ ${group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })})`]);
        }

        // Table Header
        rows.push([
          'Asset Tag',
          'Asset / Equipment Name',
          'Type / Category',
          'Manufacturer',
          'Model',
          'Serial Number',
          'Department',
          'Room / Location',
          'Assigned Custodian',
          'Condition',
          'Status',
          'Purchase Date',
          'Purchase Value (GH₵)',
          'Supplier / Vendor',
        ]);

        group.assets.forEach((a) => {
          rows.push([
            a.assetTag || '',
            a.name || `${a.manufacturer} ${a.model}`,
            a.type || '',
            a.manufacturer || '',
            a.model || '',
            a.serialNumber || 'N/A',
            a.department || '',
            a.location || '',
            a.assignedTo || 'Department Shared',
            a.condition || '',
            a.status || 'In Use',
            a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : 'N/A',
            Number(a.purchasePrice) || 0,
            a.supplier || 'Hospital Procurement',
          ]);
        });

        rows.push([]); // blank separator
      });

      // Summary table at the bottom
      rows.push(['=== ASSET REGISTER SUMMARY BREAKDOWN ===']);
      rows.push(['Category / Group', 'Asset Count', 'Total Valuation (GH₵)', '% of Inventory']);
      groupedData.forEach((g) => {
        const pct = grandTotalCount > 0 ? ((g.count / grandTotalCount) * 100).toFixed(1) : '0.0';
        rows.push([g.groupName, g.count, g.totalValue, `${pct}%`]);
      });
      rows.push(['GRAND TOTAL', grandTotalCount, grandTotalValue, '100%']);

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 16 }, // Tag
        { wch: 32 }, // Name
        { wch: 18 }, // Type
        { wch: 18 }, // Manufacturer
        { wch: 22 }, // Model
        { wch: 20 }, // Serial
        { wch: 26 }, // Department
        { wch: 20 }, // Room
        { wch: 22 }, // Custodian
        { wch: 14 }, // Condition
        { wch: 16 }, // Status
        { wch: 14 }, // Date
        { wch: 20 }, // Price
        { wch: 24 }, // Supplier
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Asset_Register');

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Asset_Register_${grouping}_${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('[AssetRegisterReport] Failed to export Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Print / Save to PDF
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[94vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200 print:max-w-none print:border-none print:shadow-none print:max-h-none print:rounded-none print:overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header (Hidden on Print) */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Hospital Asset Register Generator</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  PDF & Excel Reports
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Generate official asset inventories formatted by department, category, condition, or status with verification sign-offs.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || grandTotalCount === 0}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition disabled:opacity-50"
              title="Download structured Excel file"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              onClick={handlePrintPdf}
              disabled={grandTotalCount === 0}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition disabled:opacity-50"
              title="Print or Save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Presentation & Filter Controls Bar (Hidden on Print) */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Grouping / Presentation options */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>Presentation:</span>
              </span>
              <div className="inline-flex p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setGrouping('DEPARTMENT')}
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                    grouping === 'DEPARTMENT'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  By Department
                </button>
                <button
                  type="button"
                  onClick={() => setGrouping('TYPE')}
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                    grouping === 'TYPE'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  By Asset Type
                </button>
                <button
                  type="button"
                  onClick={() => setGrouping('CONDITION')}
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                    grouping === 'CONDITION'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  By Condition
                </button>
                <button
                  type="button"
                  onClick={() => setGrouping('STATUS')}
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                    grouping === 'STATUS'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  By Status
                </button>
                <button
                  type="button"
                  onClick={() => setGrouping('FLAT')}
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                    grouping === 'FLAT'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Master Flat List
                </button>
              </div>
            </div>

            {/* Financial and Signature Toggles */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 dark:text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={includeFinancials}
                  onChange={(e) => setIncludeFinancials(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>Include Financial Valuation</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 dark:text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>Include Sign-Off Section</span>
              </label>
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Department Filter</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="ALL">All Departments ({assets.length})</option>
                {distinctDepts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Asset Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="ALL">All Asset Types</option>
                {distinctTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Condition</label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="ALL">All Conditions</option>
                {distinctConditions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="ALL">All Statuses</option>
                {distinctStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Search Keywords</label>
              <input
                type="text"
                placeholder="Tag, Model, Serial, Room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>

        {/* Live Document Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950/60 print:p-0 print:bg-white">
          <div
            ref={printAreaRef}
            className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 print:max-w-none print:text-black"
          >
            {/* Executive Letterhead Header */}
            <div className="border-b-2 border-slate-900 dark:border-white pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase print:text-black">
                    {hospitalName}
                  </h1>
                  <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 print:text-black uppercase tracking-wider">
                    Information Technology Unit & Clinical Asset Management Division
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-gray-600 mt-0.5">
                    {hospitalAddress}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-gray-600">
                    <span className="font-semibold">{hospitalPhone}</span> • <span className="font-semibold">E-mail: {hospitalEmail}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded font-mono font-bold text-xs print:border print:border-black print:text-black print:bg-white">
                    OFFICIAL ASSET REGISTER
                  </div>
                  <p className="text-[10px] text-slate-500 print:text-gray-600 mt-1">
                    Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-slate-500 print:text-gray-600">
                    Doc Ref: HITOMS-REG-{new Date().getFullYear()}-{grouping.substring(0, 3)}
                  </p>
                </div>
              </div>
            </div>

            {/* Document Meta KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 print:border print:border-gray-300">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Equipment</span>
                <span className="text-lg font-black text-slate-900 dark:text-white print:text-black">{grandTotalCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 print:border print:border-gray-300">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Sections / Groups</span>
                <span className="text-lg font-black text-slate-900 dark:text-white print:text-black">{groupedData.length}</span>
              </div>
              {includeFinancials ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 print:border print:border-gray-300">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Asset Valuation</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 print:text-black">
                    GH₵ {grandTotalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 print:border print:border-gray-300">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Report Scope</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">{selectedDept === 'ALL' ? 'Hospital-Wide' : selectedDept}</span>
                </div>
              )}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 print:border print:border-gray-300">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Classification</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black capitalize">
                  By {grouping.toLowerCase()}
                </span>
              </div>
            </div>

            {/* Empty dataset warning */}
            {filteredAssets.length === 0 && (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <HardDrive className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-700 dark:text-slate-300">No assets match the selected filters</p>
                <p className="text-xs text-slate-400">Try resetting the department, type, or search queries.</p>
              </div>
            )}

            {/* Render Grouped Tables */}
            {groupedData.map((group, gIdx) => (
              <div key={group.groupName} className="space-y-2.5 print:break-inside-avoid">
                {/* Group Header */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-300 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 print:hidden" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase print:text-black">
                      {group.groupName}
                    </h2>
                    <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 print:border-none">
                      {group.count} {group.count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {includeFinancials && (
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 print:text-black">
                      Subtotal: GH₵ {group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl print:border print:border-gray-400">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="py-2 px-2.5 w-24">Asset Tag</th>
                        <th className="py-2 px-2.5">Equipment / Description</th>
                        <th className="py-2 px-2.5 w-24">Type</th>
                        <th className="py-2 px-2.5 w-28">Serial Number</th>
                        {grouping !== 'DEPARTMENT' && <th className="py-2 px-2.5 w-32">Department</th>}
                        <th className="py-2 px-2.5 w-28">Room / Location</th>
                        <th className="py-2 px-2.5 w-28">Custodian</th>
                        <th className="py-2 px-2.5 w-20">Condition</th>
                        <th className="py-2 px-2.5 w-20">Status</th>
                        {includeFinancials && <th className="py-2 px-2.5 w-24 text-right">Value (GH₵)</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-gray-300">
                      {group.assets.map((a, aIdx) => (
                        <tr
                          key={a.id}
                          className={aIdx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/50 print:bg-gray-50' : ''}
                        >
                          <td className="py-1.5 px-2.5 font-mono font-bold text-sky-700 dark:text-sky-400 print:text-black">
                            {a.assetTag}
                          </td>
                          <td className="py-1.5 px-2.5">
                            <div className="font-semibold text-slate-900 dark:text-white print:text-black">
                              {a.name || `${a.manufacturer} ${a.model}`}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 print:text-gray-500">
                              {a.manufacturer} • {a.model}
                            </div>
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 print:text-black">
                            {a.type}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-600 dark:text-slate-400 print:text-black">
                            {a.serialNumber || '—'}
                          </td>
                          {grouping !== 'DEPARTMENT' && (
                            <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 print:text-black">
                              {a.department}
                            </td>
                          )}
                          <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 print:text-black">
                            {a.location}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 print:text-black">
                            {a.assignedTo || 'Shared'}
                          </td>
                          <td className="py-1.5 px-2.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                              {a.condition || 'Good'}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                              {a.status || 'In Use'}
                            </span>
                          </td>
                          {includeFinancials && (
                            <td className="py-1.5 px-2.5 font-mono text-right font-semibold text-slate-900 dark:text-white print:text-black">
                              {(Number(a.purchasePrice) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Executive Sign-Off & Verification Section */}
            {includeSignatures && filteredAssets.length > 0 && (
              <div className="pt-6 border-t-2 border-slate-900 dark:border-white print:border-black mt-8 print:break-inside-avoid">
                <div className="text-center mb-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white print:text-black">
                    Official Verification & Executive Sign-Off
                  </p>
                  <p className="text-[10px] text-slate-500 print:text-gray-600">
                    This document certifies that the physical asset audit and digital inventory reconciliation have been duly executed.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-6 pt-4 text-center">
                  <div className="border-t border-slate-400 dark:border-slate-600 print:border-black pt-2">
                    <p className="font-bold text-slate-900 dark:text-white print:text-black text-[11px]">
                      {currentUser?.fullName || 'Courage Kekesi'}
                    </p>
                    <p className="text-[10px] text-slate-500 print:text-gray-600">
                      Prepared By: IT Support Officer
                    </p>
                    <p className="text-[9px] text-slate-400 print:text-gray-500 mt-1">Date: ____________________</p>
                  </div>

                  <div className="border-t border-slate-400 dark:border-slate-600 print:border-black pt-2">
                    <p className="font-bold text-slate-900 dark:text-white print:text-black text-[11px]">
                      Head of IT & Telecommunications
                    </p>
                    <p className="text-[10px] text-slate-500 print:text-gray-600">
                      Verified & Certified
                    </p>
                    <p className="text-[9px] text-slate-400 print:text-gray-500 mt-1">Date: ____________________</p>
                  </div>

                  <div className="border-t border-slate-400 dark:border-slate-600 print:border-black pt-2">
                    <p className="font-bold text-slate-900 dark:text-white print:text-black text-[11px]">
                      Hospital Administrator / Medical Director
                    </p>
                    <p className="text-[10px] text-slate-500 print:text-gray-600">
                      Approved by Management
                    </p>
                    <p className="text-[9px] text-slate-400 print:text-gray-500 mt-1">Date: ____________________</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer (Hidden on Print) */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 text-xs print:hidden">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Authorized for Super Administrator and IT Unit Personnel</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || grandTotalCount === 0}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={grandTotalCount === 0}
              className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
