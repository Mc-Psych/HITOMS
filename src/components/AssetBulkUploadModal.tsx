import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
  AlertTriangle,
  Check,
} from 'lucide-react';
import { type Asset, type AssetCondition, type AssetStatus, type User } from '../types';
import { assetService } from '../services/assetService';
import { departmentService, INITIAL_STANDARD_DEPARTMENTS } from '../services/departmentService';
import { settingsService } from '../services/settingsService';
import { downloadTextFile } from '../utils/fileDownloader';
import { matchOptionWithFallback } from '../utils/fuzzyMatcher';

const DEFAULT_VALID_ASSET_TYPES = [
  'Desktop',
  'Laptop',
  'Workstation',
  'Server',
  'Switch',
  'Router',
  'Firewall',
  'Access Point',
  'Printer',
  'UPS',
  'Barcode Scanner',
  'Scanner',
  'Tablet',
  'Network Cable',
  'Mouse',
  'Keyboard',
  'Wi-Fi Adapter',
  'Bluetooth Adapter',
];

const VALID_CONDITIONS: AssetCondition[] = [
  'New',
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'Defective',
];

const VALID_STATUSES: AssetStatus[] = [
  'Active',
  'In Use',
  'In Storage',
  'Assigned',
  'Available',
  'Under Repair',
  'Maintenance',
  'Retired',
  'Decommissioned',
  'Disposed',
  'Reserved',
];

interface AssetBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess: (importedAssets: Asset[]) => void;
  onOpenQRBatchPrint?: (assets: Asset[]) => void;
  existingAssets: Asset[];
}

export interface ParsedAssetRow {
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
  upsCapacity?: string;
  printerOutputType?: string;
  accessPointEnvironment?: string;
  cableEnvironment?: string;
  mouseConnectivity?: string;
  keyboardConnectivity?: string;
  wifiAdapterType?: string;
  bluetoothAdapterType?: string;
  isValid: boolean;
  errors: string[];
  flaggedIssues: string[];
  fieldIssues: {
    department?: string;
    assetType?: string;
    condition?: string;
    status?: string;
  };
}

export function generateAssetCsvTemplate(existingAssets: Asset[] = []): string {
  const headers = 'assetType,manufacturer,model,serialNumber,department,location,assignedUser,condition,status';

  if (!existingAssets || existingAssets.length === 0) {
    return `${headers}\n`;
  }

  const escape = (val?: string) => {
    const clean = val || '';
    return clean.includes(',') ? `"${clean}"` : clean;
  };

  const rows = existingAssets.map((a) => {
    const assetType = escape(a.assetType || 'Desktop');
    const mfr = escape(a.manufacturer || '');
    const model = escape(a.model || '');
    const sn = escape(a.serialNumber || '');
    const dept = escape(a.department || 'General');
    const loc = escape(a.location || 'Office');
    const user = escape(a.assignedUser || '');
    const cond = escape(a.condition || 'Good');
    const stat = escape(a.status || 'Available');

    return `${assetType},${mfr},${model},${sn},${dept},${loc},${user},${cond},${stat}`;
  });

  return `${headers}\n${rows.join('\n')}`;
}

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
  const [systemDepartments, setSystemDepartments] = useState<string[]>([]);
  const [customAssetTypes, setCustomAssetTypes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hitoms_custom_asset_types');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [hasAcceptedFlaggedMappings, setHasAcceptedFlaggedMappings] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: Asset[];
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load registered hospital departments and custom asset types
  useEffect(() => {
    if (isOpen) {
      setHasAcceptedFlaggedMappings(false);
      departmentService.getStandardDepartmentNames().then((depts) => {
        if (depts && depts.length > 0) {
          setSystemDepartments(depts);
        }
      });
      try {
        const saved = localStorage.getItem('hitoms_custom_asset_types');
        if (saved) setCustomAssetTypes(JSON.parse(saved));
      } catch (e) {
        console.warn(e);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleTypesUpdated = (e: any) => {
      const updated = e.detail;
      if (Array.isArray(updated) && updated.length > 0) {
        setCustomAssetTypes(updated);
      }
    };
    window.addEventListener('hitoms_custom_asset_types_updated', handleTypesUpdated);
    return () => {
      window.removeEventListener('hitoms_custom_asset_types_updated', handleTypesUpdated);
    };
  }, []);

  // Dynamic deduplicated valid asset types
  const validAssetTypes = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_VALID_ASSET_TYPES.forEach((t) => set.add(t.trim()));
    customAssetTypes.forEach((t) => set.add(t.trim()));
    return Array.from(set);
  }, [customAssetTypes]);

  // Deduplicated and sorted valid hospital departments
  const validDepartments = useMemo(() => {
    const set = new Set<string>();
    INITIAL_STANDARD_DEPARTMENTS.forEach((d) => set.add(d.trim()));
    systemDepartments.forEach((d) => set.add(d.trim()));
    existingAssets.forEach((a) => {
      if (a.department && a.department.trim()) set.add(a.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [systemDepartments, existingAssets]);

  if (!isOpen) return null;

  // Download Sample CSV
  const handleDownloadSample = () => {
    const content = generateAssetCsvTemplate(existingAssets);
    downloadTextFile('HITOMS_Asset_Bulk_Upload_Template.csv', content, {
      mimeType: 'text/csv;charset=utf-8',
    });
  };

  // Helper to parse CSV string into objects
  const parseCSVString = (csv: string): ParsedAssetRow[] => {
    const lines = csv.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    setHasAcceptedFlaggedMappings(false);

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

      // Flexible column mappings & pre-populated value fuzzy validation
      const rawAssetType =
        rowObj['assettype'] ||
        rowObj['type'] ||
        rowObj['equipmenttype'] ||
        rowObj['category'] ||
        'Desktop';
      const typeMatch = matchOptionWithFallback(rawAssetType, validAssetTypes, 'Desktop', 'Asset Type');

      const manufacturer = (
        rowObj['manufacturer'] ||
        rowObj['make'] ||
        rowObj['brand'] ||
        rowObj['vendor'] ||
        'Unspecified Manufacturer'
      ).trim();

      const model = (rowObj['model'] || rowObj['modelnumber'] || rowObj['specs'] || 'Standard Equipment').trim();

      const serialNumber = (
        rowObj['serialnumber'] ||
        rowObj['serial'] ||
        rowObj['sn'] ||
        rowObj['service_tag'] ||
        ''
      ).trim();

      const rawDepartment = (
        rowObj['department'] ||
        rowObj['dept'] ||
        rowObj['ward'] ||
        rowObj['unit'] ||
        validDepartments[0] ||
        'OPD (Outpatient Department)'
      ).trim();
      const deptMatch = matchOptionWithFallback(
        rawDepartment,
        validDepartments,
        validDepartments[0] || 'OPD (Outpatient Department)',
        'Department'
      );

      const location = (
        rowObj['location'] ||
        rowObj['room'] ||
        rowObj['roomnumber'] ||
        rowObj['desk'] ||
        'Main Facility'
      ).trim();

      const assignedUser =
        rowObj['assigneduser'] ||
        rowObj['custodian'] ||
        rowObj['user'] ||
        rowObj['staff'] ||
        '';

      const rawCondition = rowObj['condition'] || 'Good';
      const condMatch = matchOptionWithFallback(rawCondition, VALID_CONDITIONS, 'Good', 'Condition');

      const rawStatus = rowObj['status'] || (assignedUser.trim() ? 'Assigned' : 'Available');
      const statusMatch = matchOptionWithFallback(
        rawStatus,
        VALID_STATUSES,
        (assignedUser.trim() ? 'Assigned' : 'Available') as AssetStatus,
        'Status'
      );

      const operatingSystem = rowObj['operatingsystem'] || rowObj['os'] || '';
      const ipAddress = rowObj['ipaddress'] || rowObj['ip'] || '';
      const macAddress = rowObj['macaddress'] || rowObj['mac'] || '';
      const specifications = rowObj['specifications'] || rowObj['specs'] || '';
      const notes = rowObj['notes'] || rowObj['comments'] || '';
      const purchasePrice = parseFloat(rowObj['purchaseprice'] || rowObj['price'] || '0') || 0;
      const supplier = rowObj['supplier'] || rowObj['vendor'] || '';
      const purchaseDate = rowObj['purchasedate'] || rowObj['date'] || '';
      const assetTag = rowObj['assettag'] || rowObj['tag'] || '';

      // Type-specific specification fields from CSV / template headers
      const upsCapacity = (rowObj['upscapacity'] || rowObj['capacity'] || rowObj['va'] || '').trim();
      const printerOutputType = (rowObj['printeroutputtype'] || rowObj['outputmode'] || rowObj['printmode'] || rowObj['colormode'] || '').trim();
      const accessPointEnvironment = (rowObj['accesspointenvironment'] || rowObj['environment'] || rowObj['deployment'] || '').trim();
      const cableEnvironment = (rowObj['cableenvironment'] || rowObj['environment'] || '').trim();
      const mouseConnectivity = (rowObj['mouseconnectivity'] || rowObj['connectivity'] || '').trim();
      const keyboardConnectivity = (rowObj['keyboardconnectivity'] || rowObj['connectivity'] || '').trim();
      const wifiAdapterType = (rowObj['wifiadaptertype'] || rowObj['adaptertype'] || '').trim();
      const bluetoothAdapterType = (rowObj['bluetoothadaptertype'] || rowObj['adaptertype'] || '').trim();

      const flaggedIssues: string[] = [];
      const fieldIssues: ParsedAssetRow['fieldIssues'] = {};

      if (!typeMatch.isExactMatch && rawAssetType.trim()) {
        flaggedIssues.push(typeMatch.issueDescription!);
        fieldIssues.assetType = typeMatch.issueDescription!;
      }
      if (!deptMatch.isExactMatch && rawDepartment.trim()) {
        flaggedIssues.push(deptMatch.issueDescription!);
        fieldIssues.department = deptMatch.issueDescription!;
      }
      if (!condMatch.isExactMatch && rawCondition.trim()) {
        flaggedIssues.push(condMatch.issueDescription!);
        fieldIssues.condition = condMatch.issueDescription!;
      }
      if (!statusMatch.isExactMatch && rawStatus.trim()) {
        flaggedIssues.push(statusMatch.issueDescription!);
        fieldIssues.status = statusMatch.issueDescription!;
      }

      // Validation
      const errors: string[] = [];
      if (serialNumber && existingSerials.has(serialNumber.toLowerCase().trim())) {
        errors.push(`Serial "${serialNumber}" already exists in registry`);
      }
      if (!manufacturer) errors.push('Manufacturer is required');
      if (!model) errors.push('Model is required');
      if (!deptMatch.matchedValue) errors.push('Department is required');

      results.push({
        id: `row-${i}-${Date.now()}`,
        assetTag,
        assetType: typeMatch.matchedValue,
        manufacturer,
        model,
        serialNumber,
        department: deptMatch.matchedValue,
        location,
        assignedUser,
        condition: condMatch.matchedValue as AssetCondition,
        status: statusMatch.matchedValue as AssetStatus,
        operatingSystem,
        ipAddress,
        macAddress,
        specifications,
        notes,
        purchasePrice,
        supplier,
        purchaseDate,
        upsCapacity,
        printerOutputType,
        accessPointEnvironment,
        cableEnvironment,
        mouseConnectivity,
        keyboardConnectivity,
        wifiAdapterType,
        bluetoothAdapterType,
        isValid: errors.length === 0,
        errors,
        flaggedIssues,
        fieldIssues,
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
    setHasAcceptedFlaggedMappings(false);

    const fileName = selectedFile.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvContent = XLSX.utils.sheet_to_csv(worksheet);
          const rows = parseCSVString(csvContent);
          setParsedRows(rows);
        } catch (err) {
          console.error('Excel parsing failed', err);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          if (fileName.endsWith('.json')) {
            try {
              const parsed = JSON.parse(content);
              const array = Array.isArray(parsed) ? parsed : [parsed];

              const rows: ParsedAssetRow[] = array.map((item, idx) => {
                const typeMatch = matchOptionWithFallback(item.assetType, validAssetTypes, 'Desktop', 'Asset Type');
                const deptMatch = matchOptionWithFallback(
                  item.department,
                  validDepartments,
                  validDepartments[0] || 'OPD (Outpatient Department)',
                  'Department'
                );
                const condMatch = matchOptionWithFallback(item.condition, VALID_CONDITIONS, 'Good', 'Condition');
                const statusMatch = matchOptionWithFallback(
                  item.status,
                  VALID_STATUSES,
                  (item.assignedUser ? 'Assigned' : 'Available') as AssetStatus,
                  'Status'
                );

                const flaggedIssues: string[] = [];
                const fieldIssues: ParsedAssetRow['fieldIssues'] = {};

                if (!typeMatch.isExactMatch && (item.assetType || '').trim()) {
                  flaggedIssues.push(typeMatch.issueDescription!);
                  fieldIssues.assetType = typeMatch.issueDescription!;
                }
                if (!deptMatch.isExactMatch && (item.department || '').trim()) {
                  flaggedIssues.push(deptMatch.issueDescription!);
                  fieldIssues.department = deptMatch.issueDescription!;
                }
                if (!condMatch.isExactMatch && (item.condition || '').trim()) {
                  flaggedIssues.push(condMatch.issueDescription!);
                  fieldIssues.condition = condMatch.issueDescription!;
                }
                if (!statusMatch.isExactMatch && (item.status || '').trim()) {
                  flaggedIssues.push(statusMatch.issueDescription!);
                  fieldIssues.status = statusMatch.issueDescription!;
                }

                return {
                  id: `json-${idx}-${Date.now()}`,
                  assetTag: item.assetTag || '',
                  assetType: typeMatch.matchedValue,
                  manufacturer: item.manufacturer || '',
                  model: item.model || '',
                  serialNumber: item.serialNumber || '',
                  department: deptMatch.matchedValue,
                  location: item.location || 'Office',
                  assignedUser: item.assignedUser || '',
                  condition: condMatch.matchedValue as AssetCondition,
                  status: statusMatch.matchedValue as AssetStatus,
                  operatingSystem: item.operatingSystem || '',
                  ipAddress: item.ipAddress || '',
                  macAddress: item.macAddress || '',
                  specifications: item.specifications || '',
                  notes: item.notes || '',
                  purchasePrice: Number(item.purchasePrice) || 0,
                  supplier: item.supplier || '',
                  purchaseDate: item.purchaseDate || '',
                  isValid: Boolean(item.manufacturer && item.model && deptMatch.matchedValue),
                  errors: [
                    !item.manufacturer ? 'Missing manufacturer' : '',
                    !item.model ? 'Missing model' : '',
                    !deptMatch.matchedValue ? 'Missing department' : '',
                  ].filter(Boolean),
                  flaggedIssues,
                  fieldIssues,
                };
              });
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
    }
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

        // Clean field issue when user explicitly updates it
        const updatedFieldIssues = { ...row.fieldIssues };
        if (field === 'department') delete updatedFieldIssues.department;
        if (field === 'assetType') delete updatedFieldIssues.assetType;
        if (field === 'condition') delete updatedFieldIssues.condition;
        if (field === 'status') delete updatedFieldIssues.status;

        const updatedFlaggedIssues = Object.values(updatedFieldIssues).filter(Boolean) as string[];

        // Revalidate errors
        const errors: string[] = [];
        if (!updated.manufacturer.trim()) errors.push('Manufacturer is required');
        if (!updated.model.trim()) errors.push('Model is required');
        if (!updated.department.trim()) errors.push('Department is required');

        return {
          ...updated,
          fieldIssues: updatedFieldIssues,
          flaggedIssues: updatedFlaggedIssues,
          isValid: errors.length === 0,
          errors,
        };
      })
    );
  };

  // Accept all suggested fuzzy mappings
  const handleAcceptAllMappings = () => {
    setHasAcceptedFlaggedMappings(true);
    setParsedRows((prev) =>
      prev.map((r) => ({
        ...r,
        flaggedIssues: [],
        fieldIssues: {},
      }))
    );
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0 || !currentUser) return;

    setIsProcessing(true);
    try {
      // 1. Ensure all departments present in preview/valid rows exist in system database & Firestore
      const uniqueDepts: string[] = Array.from(new Set(validRows.map((r) => r.department.trim()).filter(Boolean)));
      if (uniqueDepts.length > 0) {
        await departmentService.ensureDepartmentsExist(uniqueDepts, currentUser);
      }

      // 2. Register/update new asset types in system custom asset types list & Firestore settings
      const uniqueTypes: string[] = Array.from(new Set(validRows.map((r) => r.assetType.trim()).filter(Boolean)));
      if (uniqueTypes.length > 0) {
        const mergedTypes = Array.from(new Set([...validAssetTypes, ...uniqueTypes]));
        try {
          localStorage.setItem('hitoms_custom_asset_types', JSON.stringify(mergedTypes));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hitoms_custom_asset_types_updated', { detail: mergedTypes }));
          }
          await settingsService.updateSettings({ customAssetTypes: mergedTypes }, currentUser);
        } catch (settingsErr) {
          console.warn('[AssetBulkUploadModal] Failed to sync custom asset types to settings:', settingsErr);
        }
      }

      // 3. Prepare asset creation items
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
        upsCapacity: r.upsCapacity || (r.assetType.toUpperCase().includes('UPS') ? '1000VA (1 kVA)' : undefined),
        printerOutputType: r.printerOutputType || (r.assetType.toUpperCase().includes('PRINTER') ? 'Monochrome (Black & White)' : undefined),
        accessPointEnvironment: r.accessPointEnvironment || ((r.assetType.toUpperCase().includes('ACCESS POINT') || r.assetType.toUpperCase().includes('AP')) ? 'Indoor' : undefined),
        cableEnvironment: r.cableEnvironment || ((r.assetType.toUpperCase().includes('CABLE') || r.assetType.toUpperCase().includes('PATCH')) ? 'Indoor' : undefined),
        mouseConnectivity: r.mouseConnectivity || (r.assetType.toUpperCase().includes('MOUSE') ? 'Wired' : undefined),
        keyboardConnectivity: r.keyboardConnectivity || (r.assetType.toUpperCase().includes('KEYBOARD') ? 'Wired' : undefined),
        wifiAdapterType: r.wifiAdapterType || ((r.assetType.toUpperCase().includes('WI-FI') || r.assetType.toUpperCase().includes('WIFI')) ? 'Dongle (USB)' : undefined),
        bluetoothAdapterType: r.bluetoothAdapterType || (r.assetType.toUpperCase().includes('BLUETOOTH') ? 'Dongle (USB)' : undefined),
        specifications: r.specifications?.trim() || `${r.manufacturer} ${r.model}`,
        notes: r.notes?.trim() || 'Bulk uploaded asset',
      }));

      // 4. Save assets to local database and queue for cloud sync
      const result = await assetService.bulkCreateAssets(itemsToCreate, currentUser);

      // 5. Trigger cloud sync to update Firestore database instantly
      try {
        const { syncService } = await import('../services/syncService');
        await syncService.runAutomaticSync();
      } catch (syncErr) {
        console.warn('[AssetBulkUploadModal] Firestore automatic sync notification:', syncErr);
      }

      setImportResult({
        success: true,
        imported: result.created,
        message: `Successfully imported ${result.count} hardware assets into system registry & Firestore database.`,
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

  const totalFlaggedCount = parsedRows.reduce((acc, r) => acc + (r.flaggedIssues?.length || 0), 0);
  const rowsWithFlagsCount = parsedRows.filter((r) => r.flaggedIssues && r.flaggedIssues.length > 0).length;
  const hasUnacceptedFlags = !hasAcceptedFlaggedMappings && rowsWithFlagsCount > 0;

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const isImportDisabled = validCount === 0 || isProcessing || hasUnacceptedFlags;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200">
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
                Batch import hospital equipment, generate scannable QR codes, and sort-map departments safely.
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
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg cursor-pointer"
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
                    accept=".csv, .xlsx, .xls, .txt, .json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Drag and drop your Excel (.xlsx, .xls), CSV, or JSON file here, or{' '}
                      <span className="text-sky-600 hover:underline">browse files</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports Excel workbooks (.xlsx, .xls), comma-separated values (.csv), tab-delimited text, or structured JSON.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPasteMode(true);
                      }}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-sky-600 font-semibold underline underline-offset-2 cursor-pointer"
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
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
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
                      onClick={() => setPastedText(generateAssetCsvTemplate(existingAssets))}
                      className="px-3 py-1.5 text-xs text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg font-semibold cursor-pointer"
                    >
                      Load Sample Data
                    </button>
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      disabled={!pastedText.trim()}
                      className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs cursor-pointer"
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
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {parsedRows.length} Assets Parsed:
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {validCount} Ready
                      </span>
                      {rowsWithFlagsCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold text-[11px] bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          {rowsWithFlagsCount} Flagged Issues
                        </span>
                      )}
                      {invalidCount > 0 && (
                        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-[11px] bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                          <AlertCircle className="w-3 h-3" />
                          {invalidCount} Errors
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
                          setHasAcceptedFlaggedMappings(false);
                        }}
                        className="text-slate-500 hover:text-rose-600 text-xs font-semibold px-2 py-1 cursor-pointer"
                      >
                        Reset / Choose Another File
                      </button>
                    </div>
                  </div>

                  {/* Flagged Values & Mappings Banner */}
                  {hasUnacceptedFlags && (
                    <div className="p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="font-black text-sm block text-amber-950 dark:text-amber-100">
                            Non-matching Template Values Flagged ({totalFlaggedCount} Issue{totalFlaggedCount > 1 ? 's' : ''})
                          </span>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed max-w-2xl">
                            Non-matching values in uploaded rows (Department, Asset Type, Condition, Status) have been intercepted to prevent duplicate entries and mapped to valid system categories.
                            <strong> You must review and accept the suggested mappings (or adjust via dropdowns) before importing.</strong>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAcceptAllMappings}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-md transition flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept Suggested Mappings</span>
                      </button>
                    </div>
                  )}

                  {/* Editable Preview Table with Standard Dropdowns & Horizontal Scroll */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto overflow-y-auto max-h-80 shadow-2xs custom-scrollbar bg-white dark:bg-slate-900">
                    <table className="w-full min-w-[1320px] text-left text-xs whitespace-nowrap">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 z-10">
                        <tr>
                          <th className="px-3 py-2.5 w-10">#</th>
                          <th className="px-3 py-2.5 min-w-[100px]">Validation</th>
                          <th className="px-3 py-2.5 min-w-[160px]">Asset Type *</th>
                          <th className="px-3 py-2.5 min-w-[140px]">Manufacturer *</th>
                          <th className="px-3 py-2.5 min-w-[150px]">Model *</th>
                          <th className="px-3 py-2.5 min-w-[140px]">Serial Number</th>
                          <th className="px-3 py-2.5 min-w-[240px]">Hospital Department *</th>
                          <th className="px-3 py-2.5 min-w-[140px]">Room / Location</th>
                          <th className="px-3 py-2.5 min-w-[160px]">Staff Custodian</th>
                          <th className="px-3 py-2.5 min-w-[130px]">Condition</th>
                          <th className="px-3 py-2.5 min-w-[140px]">Operational Status</th>
                          <th className="px-3 py-2.5 w-14 text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {parsedRows.map((row, index) => {
                          const isTypeFlagged = Boolean(row.fieldIssues?.assetType);
                          const isDeptFlagged = Boolean(row.fieldIssues?.department);
                          const isCondFlagged = Boolean(row.fieldIssues?.condition);
                          const isStatFlagged = Boolean(row.fieldIssues?.status);

                          return (
                            <tr
                              key={row.id}
                              className={
                                !row.isValid
                                  ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                  : row.flaggedIssues && row.flaggedIssues.length > 0
                                  ? 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }
                            >
                              <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">
                                {index + 1}
                              </td>
                              <td className="px-3 py-2">
                                {row.isValid ? (
                                  row.flaggedIssues && row.flaggedIssues.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span
                                        title={row.flaggedIssues.join('\n')}
                                        className="inline-flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded cursor-help"
                                      >
                                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                                        <span>Flagged</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Ready</span>
                                    </span>
                                  )
                                ) : (
                                  <span
                                    title={row.errors.join(', ')}
                                    className="inline-flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-bold cursor-help"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Error</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <select
                                    value={row.assetType}
                                    onChange={(e) => handleUpdateRow(row.id, 'assetType', e.target.value)}
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white ${
                                      isTypeFlagged
                                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-semibold'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                    title={isTypeFlagged ? row.fieldIssues.assetType : undefined}
                                  >
                                    {validAssetTypes.map((type) => (
                                      <option key={type} value={type}>
                                        {type}
                                      </option>
                                    ))}
                                  </select>
                                  {isTypeFlagged && (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                      Non-matching Asset Type
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.manufacturer}
                                  onChange={(e) => handleUpdateRow(row.id, 'manufacturer', e.target.value)}
                                  placeholder="e.g. Dell"
                                  className={`w-full bg-transparent border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white ${
                                    !row.manufacturer.trim() ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.model}
                                  onChange={(e) => handleUpdateRow(row.id, 'model', e.target.value)}
                                  placeholder="e.g. OptiPlex 7090"
                                  className={`w-full bg-transparent border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white ${
                                    !row.model.trim() ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                />
                              </td>
                              <td className="px-3 py-2 font-mono">
                                <input
                                  type="text"
                                  value={row.serialNumber}
                                  onChange={(e) => handleUpdateRow(row.id, 'serialNumber', e.target.value)}
                                  placeholder="Serial #"
                                  className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white font-mono"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <select
                                    value={row.department}
                                    onChange={(e) => handleUpdateRow(row.id, 'department', e.target.value)}
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white ${
                                      isDeptFlagged
                                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-semibold'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                    title={isDeptFlagged ? row.fieldIssues.department : undefined}
                                  >
                                    {validDepartments.map((dept) => (
                                      <option key={dept} value={dept}>
                                        {dept}
                                      </option>
                                    ))}
                                  </select>
                                  {isDeptFlagged && (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                      Non-matching Department
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.location}
                                  onChange={(e) => handleUpdateRow(row.id, 'location', e.target.value)}
                                  placeholder="Room / Desk"
                                  className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.assignedUser || ''}
                                  onChange={(e) => handleUpdateRow(row.id, 'assignedUser', e.target.value)}
                                  placeholder="Custodian Staff"
                                  className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <select
                                    value={row.condition}
                                    onChange={(e) => handleUpdateRow(row.id, 'condition', e.target.value)}
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white ${
                                      isCondFlagged
                                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-semibold'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                    title={isCondFlagged ? row.fieldIssues.condition : undefined}
                                  >
                                    {VALID_CONDITIONS.map((cond) => (
                                      <option key={cond} value={cond}>
                                        {cond}
                                      </option>
                                    ))}
                                  </select>
                                  {isCondFlagged && (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                      Non-matching Condition
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <select
                                    value={row.status}
                                    onChange={(e) => handleUpdateRow(row.id, 'status', e.target.value)}
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white ${
                                      isStatFlagged
                                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-semibold'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                    title={isStatFlagged ? row.fieldIssues.status : undefined}
                                  >
                                    {VALID_STATUSES.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                  {isStatFlagged && (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                      Non-matching Status
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right pr-4">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(row.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Remove row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[11px]">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        Rows with missing Manufacturer, Model, or Department must be filled or removed before importing.
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
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-800/40">
            <div className="text-[11px] text-slate-500">
              {parsedRows.length > 0 ? (
                hasUnacceptedFlags ? (
                  <span className="text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Please review and accept suggested mappings for flagged items to enable import.
                  </span>
                ) : (
                  <span>
                    {validCount} of {parsedRows.length} assets ready for immediate registry import.
                  </span>
                )
              ) : (
                'Download template or select file to begin.'
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isImportDisabled}
                onClick={handleExecuteImport}
                title={
                  hasUnacceptedFlags
                    ? 'Review and accept suggested mappings above to enable import'
                    : undefined
                }
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold shadow-md transition cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>
                  {isProcessing
                    ? 'Importing Assets...'
                    : hasUnacceptedFlags
                    ? 'Review Flags to Import'
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
