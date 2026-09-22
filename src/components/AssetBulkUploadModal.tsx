import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Layers,
  HelpCircle,
  FileText,
  Printer,
  ChevronRight,
  ArrowRight,
  Database,
  Info,
} from 'lucide-react';
import { type Asset, type AssetCondition, type AssetStatus, type User } from '../types';
import { assetService } from '../services/assetService';

interface AssetBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess: (importedAssets: Asset[]) => void;
  onOpenQRBatchPrint?: (assets: Asset[]) => void;
  existingAssets: Asset[];
}

interface ParsedAssetRow {
  id: string;
  assetTag?: string;
  assetType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  location: string;
  assignedUser?: string;
  condition: AssetCondition;
  status: AssetStatus;
  purchaseDate?: string;
  purchasePrice?: number;
  supplier?: string;
  operatingSystem?: string;
  ipAddress?: string;
  macAddress?: string;
  specifications?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

const SAMPLE_CSV_CONTENT = `assetType,manufacturer,model,serialNumber,department,location,assignedUser,condition,status,operatingSystem,ipAddress,purchasePrice,supplier,notes
Desktop,Dell,OptiPlex 7090,CN-0K9821-7281,Pharmacy,Dispensing Counter 1,Dr. Kwesi,Good,Active,Windows 11 Pro,192.168.10.45,850,TechWorld Ghana,Primary dispensary terminal
Laptop,HP,EliteBook 840 G8,5CG12345XYZ,Emergency (A&E),Triage Desk,Nurse Joyce,Excellent,Active,Windows 11 Pro,192.168.10.88,1100,Universal IT,Triage intake unit
Printer,HP,LaserJet Pro MFP M428fdw,VNB3K98765,Radiology,Reception Desk,Shared,Good,Active,,192.168.10.150,420,OfficeTech Ltd,High-volume label printer
Switch,Cisco,Catalyst 2960X,FCW2145A098,IT Server Room,Rack 1 Unit 4,IT Unit Staff,Excellent,Active,,192.168.10.2,1450,Cisco Direct,MDF Core Switch
UPS,APC,Smart-UPS 1500VA,AS1834120984,ICU,Nurse Station 2,Shared,Good,Active,,,580,PowerSafe Systems,Battery replaced Jan 2026`;

export const AssetBulkUploadModal: React.FC<AssetBulkUploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
  onOpenQRBatchPrint,
  existingAssets,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAssetRow[]>([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: Asset[];
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download Sample CSV
  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'HITOMS_Asset_Bulk_Upload_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to parse CSV string into objects
  const parseCSVString = (csv: string): ParsedAssetRow[] => {
    const lines = csv.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Parse header line
    const headerLine = lines[0];
    const headers = headerLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((h) =>
      h.trim().replace(/^"|"$/g, '').toLowerCase()
    );

    const existingSerials = new Set(
      existingAssets.map((a) => (a.serialNumber || '').toLowerCase().trim()).filter(Boolean)
    );

    const results: ParsedAssetRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) =>
        v.trim().replace(/^"|"$/g, '').replace(/""/g, '"')
      );

      const rowObj: Record<string, string> = {};
      headers.forEach((h, index) => {
        rowObj[h] = values[index] !== undefined ? values[index] : '';
      });

      // Flexible column mappings
      const assetType =
        rowObj['assettype'] ||
        rowObj['type'] ||
        rowObj['equipmenttype'] ||
        rowObj['category'] ||
        'Desktop';

      const manufacturer =
        rowObj['manufacturer'] ||
        rowObj['make'] ||
        rowObj['brand'] ||
        rowObj['vendor'] ||
        '';

      const model = rowObj['model'] || rowObj['modelnumber'] || rowObj['specs'] || '';

      const serialNumber =
        rowObj['serialnumber'] ||
        rowObj['serial'] ||
        rowObj['sn'] ||
        rowObj['service_tag'] ||
        '';

      const department =
        rowObj['department'] ||
        rowObj['dept'] ||
        rowObj['ward'] ||
        rowObj['unit'] ||
        'General';

      const location =
        rowObj['location'] ||
        rowObj['room'] ||
        rowObj['roomnumber'] ||
        rowObj['desk'] ||
        'Office';

      const assignedUser =
        rowObj['assigneduser'] ||
        rowObj['custodian'] ||
        rowObj['user'] ||
        rowObj['staff'] ||
        '';

      const conditionRaw = (
        rowObj['condition'] || 'Good'
      ).toLowerCase();
      let condition: AssetCondition = 'Good';
      if (conditionRaw.includes('excel')) condition = 'Excellent';
      else if (conditionRaw.includes('fair')) condition = 'Fair';
      else if (conditionRaw.includes('poor')) condition = 'Poor';

      const statusRaw = (rowObj['status'] || '').toLowerCase();
      let status: AssetStatus = assignedUser.trim() ? 'Assigned' : 'Available';
      if (statusRaw.includes('repair')) status = 'In Repair';
      else if (statusRaw.includes('maint')) status = 'Under Maintenance';
      else if (statusRaw.includes('retir') || statusRaw.includes('decom')) status = 'Retired';
      else if (statusRaw.includes('lost')) status = 'Lost';
      else if (statusRaw.includes('damag')) status = 'Damaged';
      else if (statusRaw.includes('dispos')) status = 'Disposed';
      else if (statusRaw.includes('assign')) status = 'Assigned';
      else if (statusRaw.includes('avail') || statusRaw.includes('active')) status = assignedUser.trim() ? 'Assigned' : 'Available';

      const operatingSystem = rowObj['operatingsystem'] || rowObj['os'] || '';
      const ipAddress = rowObj['ipaddress'] || rowObj['ip'] || '';
      const macAddress = rowObj['macaddress'] || rowObj['mac'] || '';
      const specifications = rowObj['specifications'] || rowObj['specs'] || '';
      const notes = rowObj['notes'] || rowObj['comments'] || '';
      const purchasePrice = parseFloat(rowObj['purchaseprice'] || rowObj['price'] || '0') || 0;
      const supplier = rowObj['supplier'] || rowObj['vendor'] || '';
      const purchaseDate = rowObj['purchasedate'] || rowObj['date'] || '';
      const assetTag = rowObj['assettag'] || rowObj['tag'] || '';

      // Validation
      const errors: string[] = [];
      if (!manufacturer.trim()) errors.push('Manufacturer is required');
      if (!model.trim()) errors.push('Model is required');
      if (!department.trim()) errors.push('Department is required');
      if (serialNumber && existingSerials.has(serialNumber.toLowerCase().trim())) {
        errors.push(`Serial "${serialNumber}" already exists in registry`);
      }

      results.push({
        id: `row-${i}-${Date.now()}`,
        assetTag,
        assetType,
        manufacturer,
        model,
        serialNumber,
        department,
        location,
        assignedUser,
        condition,
        status,
        operatingSystem,
        ipAddress,
        macAddress,
        specifications,
        notes,
        purchasePrice,
        supplier,
        purchaseDate,
        isValid: errors.length === 0,
        errors,
      });
    }

    return results;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        if (selectedFile.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(content);
            const array = Array.isArray(parsed) ? parsed : [parsed];
            const rows: ParsedAssetRow[] = array.map((item, idx) => ({
              id: `json-${idx}-${Date.now()}`,
              assetTag: item.assetTag || '',
              assetType: item.assetType || 'Desktop',
              manufacturer: item.manufacturer || '',
              model: item.model || '',
              serialNumber: item.serialNumber || '',
              department: item.department || 'General',
              location: item.location || 'Office',
              assignedUser: item.assignedUser || '',
              condition: (item.condition as AssetCondition) || 'Good',
              status: (['Available', 'Assigned', 'In Repair', 'Under Maintenance', 'Retired', 'Lost', 'Damaged', 'Disposed'].includes(item.status)
                ? item.status
                : item.assignedUser ? 'Assigned' : 'Available') as AssetStatus,
              operatingSystem: item.operatingSystem || '',
              ipAddress: item.ipAddress || '',
              macAddress: item.macAddress || '',
              specifications: item.specifications || '',
              notes: item.notes || '',
              purchasePrice: Number(item.purchasePrice) || 0,
              supplier: item.supplier || '',
              purchaseDate: item.purchaseDate || '',
              isValid: Boolean(item.manufacturer && item.model && item.department),
              errors: [
                !item.manufacturer ? 'Missing manufacturer' : '',
                !item.model ? 'Missing model' : '',
                !item.department ? 'Missing department' : '',
              ].filter(Boolean),
            }));
            setParsedRows(rows);
          } catch (err) {
            console.error('JSON parsing failed', err);
          }
        } else {
          // Standard CSV / Tab delimited text
          const rows = parseCSVString(content);
          setParsedRows(rows);
        }
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    const rows = parseCSVString(pastedText);
    setParsedRows(rows);
    setPasteMode(false);
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof ParsedAssetRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        // revalidate
        const errors: string[] = [];
        if (!updated.manufacturer.trim()) errors.push('Manufacturer is required');
        if (!updated.model.trim()) errors.push('Model is required');
        if (!updated.department.trim()) errors.push('Department is required');
        return {
          ...updated,
          isValid: errors.length === 0,
          errors,
        };
      })
    );
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0 || !currentUser) return;

    setIsProcessing(true);
    try {
      const itemsToCreate = validRows.map((r) => ({
        customAssetTag: r.assetTag?.trim() || undefined,
        assetType: r.assetType,
        manufacturer: r.manufacturer.trim(),
        model: r.model.trim(),
        serialNumber: r.serialNumber.trim(),
        department: r.department.trim(),
        location: r.location.trim(),
        assignedUser: r.assignedUser?.trim() || '',
        condition: r.condition,
        status: r.status,
        purchaseDate: r.purchaseDate || new Date().toISOString().split('T')[0],
        purchasePrice: r.purchasePrice || 0,
        supplier: r.supplier?.trim() || 'Hospital IT Store',
        warrantyStart: new Date().toISOString().split('T')[0],
        warrantyEnd: '',
        operatingSystem: r.operatingSystem?.trim() || '',
        ipAddress: r.ipAddress?.trim() || '',
        macAddress: r.macAddress?.trim() || '',
        specifications: r.specifications?.trim() || `${r.manufacturer} ${r.model}`,
        notes: r.notes?.trim() || 'Bulk uploaded asset',
      }));

      const result = await assetService.bulkCreateAssets(itemsToCreate, currentUser);

      setImportResult({
        success: true,
        imported: result.created,
        message: `Successfully imported ${result.count} hardware assets into the offline registry.`,
      });

      onSuccess(result.created);
    } catch (err: any) {
      console.error('Bulk import error:', err);
      setImportResult({
        success: false,
        imported: [],
        message: err?.message || 'Failed to complete bulk upload. Please check database permissions.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bulk Upload IT Assets</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  CSV / Excel / JSON
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Batch import hospital equipment, generate scannable QR codes, and register local custodians.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              title="Download pre-formatted CSV template"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>Download CSV Template</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {importResult && importResult.success ? (
            /* Success State */
            <div className="p-8 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Bulk Import Successful!
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                  {importResult.message}
                </p>
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-left font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="font-bold text-sky-600 mb-1">Created Asset Tags:</div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {importResult.imported.map((a) => (
                      <span key={a.id} className="bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 rounded">
                        {a.assetTag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                {onOpenQRBatchPrint && importResult.imported.length > 0 && (
                  <button
                    onClick={() => {
                      const list = importResult.imported;
                      onClose();
                      onOpenQRBatchPrint(list);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print QR Labels for {importResult.imported.length} Assets</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  Done & Return to Assets
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload Drop Zone / Paste Area */}
              {parsedRows.length === 0 && !pasteMode && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                    dragActive
                      ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30'
                      : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 bg-slate-50/50 dark:bg-slate-800/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .txt, .json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Drag and drop your asset CSV/JSON file here, or{' '}
                      <span className="text-sky-600 hover:underline">browse files</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports comma-separated values (.csv), tab-delimited text, or structured JSON.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPasteMode(true);
                      }}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-sky-600 font-semibold underline underline-offset-2"
                    >
                      Or paste raw CSV text directly
                    </button>
                  </div>
                </div>
              )}

              {/* Paste Raw Text Mode */}
              {pasteMode && parsedRows.length === 0 && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span>Paste CSV / TSV Rows</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPasteMode(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Back to file drop
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    placeholder="assetType,manufacturer,model,serialNumber,department,location,assignedUser,condition,status&#10;Desktop,Dell,OptiPlex 7090,CN-0123,Pharmacy,Dispensing 1,Dr. Kwesi,Good,Active"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPastedText(SAMPLE_CSV_CONTENT)}
                      className="px-3 py-1.5 text-xs text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg font-semibold"
                    >
                      Load Sample Data
                    </button>
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      disabled={!pastedText.trim()}
                      className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs"
                    >
                      Parse Rows
                    </button>
                  </div>
                </div>
              )}

              {/* Parsed Rows Preview & Validation Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {parsedRows.length} Assets Parsed:
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {validCount} Ready to Import
                      </span>
                      {invalidCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px] bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="w-3 h-3" />
                          {invalidCount} Needs Attention
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setParsedRows([]);
                          setFile(null);
                          setPastedText('');
                        }}
                        className="text-slate-500 hover:text-rose-600 text-xs font-semibold px-2 py-1"
                      >
                        Reset / Choose Another File
                      </button>
                    </div>
                  </div>

                  {/* Editable Preview Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 w-8">#</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Manufacturer *</th>
                          <th className="px-3 py-2">Model *</th>
                          <th className="px-3 py-2">Serial Number</th>
                          <th className="px-3 py-2">Department *</th>
                          <th className="px-3 py-2">Location</th>
                          <th className="px-3 py-2">Custodian</th>
                          <th className="px-3 py-2">Condition</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {parsedRows.map((row, index) => (
                          <tr
                            key={row.id}
                            className={
                              !row.isValid
                                ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }
                          >
                            <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Valid</span>
                                </span>
                              ) : (
                                <span
                                  title={row.errors.join(', ')}
                                  className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold cursor-help"
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Error</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={row.assetType}
                                onChange={(e) => handleUpdateRow(row.id, 'assetType', e.target.value)}
                                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white"
                              >
                                <option value="Desktop">Desktop</option>
                                <option value="Laptop">Laptop</option>
                                <option value="Server">Server</option>
                                <option value="Switch">Switch</option>
                                <option value="Router">Router</option>
                                <option value="Access Point">Access Point</option>
                                <option value="Printer">Printer</option>
                                <option value="UPS">UPS</option>
                                <option value="Scanner">Scanner</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.manufacturer}
                                onChange={(e) => handleUpdateRow(row.id, 'manufacturer', e.target.value)}
                                placeholder="e.g. Dell"
                                className={`bg-transparent border rounded px-1.5 py-0.5 text-xs w-24 text-slate-900 dark:text-white ${
                                  !row.manufacturer.trim() ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 dark:border-slate-700'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.model}
                                onChange={(e) => handleUpdateRow(row.id, 'model', e.target.value)}
                                placeholder="e.g. OptiPlex"
                                className={`bg-transparent border rounded px-1.5 py-0.5 text-xs w-28 text-slate-900 dark:text-white ${
                                  !row.model.trim() ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 dark:border-slate-700'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2 font-mono">
                              <input
                                type="text"
                                value={row.serialNumber}
                                onChange={(e) => handleUpdateRow(row.id, 'serialNumber', e.target.value)}
                                placeholder="Serial #"
                                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs w-28 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.department}
                                onChange={(e) => handleUpdateRow(row.id, 'department', e.target.value)}
                                placeholder="Dept"
                                className={`bg-transparent border rounded px-1.5 py-0.5 text-xs w-24 text-slate-900 dark:text-white ${
                                  !row.department.trim() ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 dark:border-slate-700'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.location}
                                onChange={(e) => handleUpdateRow(row.id, 'location', e.target.value)}
                                placeholder="Room"
                                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs w-24 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.assignedUser || ''}
                                onChange={(e) => handleUpdateRow(row.id, 'assignedUser', e.target.value)}
                                placeholder="Staff Custodian"
                                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs w-28 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={row.condition}
                                onChange={(e) => handleUpdateRow(row.id, 'condition', e.target.value)}
                                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[11px] text-slate-900 dark:text-white"
                              >
                                <option value="Excellent">Excellent</option>
                                <option value="Good">Good</option>
                                <option value="Fair">Fair</option>
                                <option value="Poor">Poor</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(row.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px]">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        Rows with missing Manufacturer, Model, or Department will be skipped unless corrected above.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!importResult && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div className="text-[11px] text-slate-500">
              {parsedRows.length > 0
                ? `${validCount} of ${parsedRows.length} rows ready for immediate registration.`
                : 'Download template or select file to begin.'}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={validCount === 0 || isProcessing}
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold shadow-md transition cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>
                  {isProcessing
                    ? 'Importing Assets...'
                    : `Import ${validCount} Assets into Registry`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
