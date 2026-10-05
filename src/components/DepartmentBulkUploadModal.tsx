import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  Flame,
  Layers,
  Sparkles,
  Trash2,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { type Department, type User } from '../types';
import { departmentService, generateDepartmentCode } from '../services/departmentService';
import { matchOptionWithFallback } from '../utils/fuzzyMatcher';
import {
  downloadDepartmentTemplateExcel,
  getActiveHospitalName,
} from '../utils/templateGenerator';

interface DepartmentBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  existingDepartments: Department[];
  allUsers?: User[];
  onSuccess: (created: Department[]) => void;
}

interface ParsedDeptRow {
  code: string;
  name: string;
  locationDescription: string;
  building: string;
  floor: string;
  headOfDepartment: string;
  phone: string;
  isEmergency: boolean;
  isValid: boolean;
  error?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function generateDepartmentCsvTemplate(existingDepts: Department[] = []): string {
  const hospital = getActiveHospitalName().toUpperCase();
  const titleHeader = `# ${hospital} - OFFICIAL HOSPITAL DEPARTMENT REGISTRY IMPORT TEMPLATE\n# Required columns: code, name. isEmergency: TRUE or FALSE\n`;
  const headers = 'code,name,building,floor,locationDescription,headOfDepartment,phone,isEmergency';

  if (!existingDepts || existingDepts.length === 0) {
    const samples = [
      'A&E,"Accident & Emergency (A&E)",Emergency Complex,Ground Floor,"Emergency Complex, Ground Floor",Dr. Kwame Mensah,Ext. 101,TRUE',
      'ICU,"Intensive Care Unit (ICU)",Main Clinical Block,1st Floor,"Main Clinical Block, 1st Floor",Dr. Sarah Owusu,Ext. 102,TRUE',
      'OPD,"OPD (Outpatient Department)",Main Complex,Ground Floor,"Main Complex Atrium",Mrs. Grace Mensah,Ext. 103,FALSE',
      'THEATRE,"Main Surgical Theatre",Surgical Wing,2nd Floor,"Surgical Wing, Operating Suites 1-4",Dr. Alex Osei,Ext. 104,TRUE',
      'MAT,"Maternity & Neonatal",Maternity Block,Ground Floor,"Maternity Block, Labor Ward",Dr. Joyce Antwi,Ext. 105,TRUE',
      'LAB,"Diagnostic Laboratory",Diagnostic Center,Ground Floor,"Diagnostic Center Room 12",Mr. David Boateng,Ext. 106,FALSE',
      'PHARM,"Central Pharmacy",Main Complex,Ground Floor,"Central Dispensary",Pharm. Esther Darko,Ext. 107,FALSE',
    ];
    return `${titleHeader}${headers}\n${samples.join('\n')}`;
  }

  const rows = existingDepts.map((d) => {
    const code = d.code || '';
    const name = d.name || '';
    const bldg = d.building || '';
    const flr = d.floor || '';
    const loc = d.locationDescription || '';
    const hod = d.headOfDepartment || '';
    const phone = d.phone || '';
    const emerg = d.isEmergency ? 'TRUE' : 'FALSE';

    const escapedName = name.includes(',') ? `"${name}"` : name;
    const escapedLoc = loc.includes(',') ? `"${loc}"` : loc;
    return `${code},${escapedName},${bldg},${flr},${escapedLoc},${hod},${phone},${emerg}`;
  });

  return `${titleHeader}${headers}\n${rows.join('\n')}`;
}

export const DepartmentBulkUploadModal: React.FC<DepartmentBulkUploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  existingDepartments,
  allUsers = [],
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [csvText, setCsvText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedDeptRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const hospitalName = getActiveHospitalName();

  const handleDownloadExcel = () => {
    downloadDepartmentTemplateExcel(hospitalName, existingDepartments);
  };

  const handleDownloadCsv = () => {
    const content = generateDepartmentCsvTemplate(existingDepartments);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${hospitalName.replace(/[^A-Za-z0-9]/g, '_')}_Departments_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvContent = (text: string) => {
    setErrorMessage('');
    const rawLines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    if (rawLines.length <= 1) {
      setErrorMessage('Spreadsheet contains no data rows. Please check file content or template structure.');
      setParsedRows([]);
      setHasParsed(true);
      return;
    }

    // Dynamic Header Detection: Search up to 12 rows for the row containing standard department column names
    let headerRowIndex = -1;
    for (let r = 0; r < Math.min(rawLines.length, 12); r++) {
      const tokens = parseCsvLine(rawLines[r]).map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (tokens.some((t) => ['name', 'department', 'deptname', 'departmentname'].includes(t))) {
        headerRowIndex = r;
        break;
      }
    }

    if (headerRowIndex === -1) {
      setErrorMessage('Could not find column headers in spreadsheet (must contain a "name" or "department" header). Please use the official sample template.');
      setParsedRows([]);
      setHasParsed(true);
      return;
    }

    const header = parseCsvLine(rawLines[headerRowIndex]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const codeIdx = header.findIndex((h) => h.includes('code') || h === 'abbrev');
    const nameIdx = header.findIndex((h) => h.includes('name') || h.includes('dept'));
    const locIdx = header.findIndex((h) => h.includes('location') || h === 'loc');
    const buildingIdx = header.findIndex((h) => h.includes('building') || h.includes('wing') || h.includes('block'));
    const floorIdx = header.findIndex((h) => h.includes('floor') || h.includes('level'));
    const hodIdx = header.findIndex((h) => h.includes('head') || h.includes('hod'));
    const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('extension') || h.includes('ext'));
    const isEmergIdx = header.findIndex((h) => h.includes('emerg'));

    if (nameIdx === -1) {
      setErrorMessage('Spreadsheet header must contain a "name" or "department" column.');
      setParsedRows([]);
      setHasParsed(true);
      return;
    }

    const existingCodes = new Set(existingDepartments.map((d) => d.code.toUpperCase()));
    const existingNames = new Set(existingDepartments.map((d) => d.name.toLowerCase().trim()));
    const existingDeptNamesList = existingDepartments.map((d) => d.name);
    const seenBatchCodes = new Set<string>();
    const seenBatchNames = new Set<string>();
    const results: ParsedDeptRow[] = [];

    for (let i = headerRowIndex + 1; i < rawLines.length; i++) {
      const line = rawLines[i];
      const tokens = parseCsvLine(line);
      const cleanTokens = tokens.map((t) => t.trim().replace(/^"|"$/g, ''));

      const name = (cleanTokens[nameIdx] || '').trim();
      if (!name) continue; // Skip empty rows

      let code = (codeIdx >= 0 ? cleanTokens[codeIdx] : '').trim().toUpperCase();
      if (!code && name) {
        code = generateDepartmentCode(name);
      }

      const locDesc = (locIdx >= 0 ? cleanTokens[locIdx] : '').trim();
      const building = (buildingIdx >= 0 ? cleanTokens[buildingIdx] : '').trim();
      const floor = (floorIdx >= 0 ? cleanTokens[floorIdx] : '').trim();
      const locationDescription =
        locDesc ||
        [building, floor].filter(Boolean).join(', ') ||
        (building ? building : 'Main Hospital Complex, Ground Floor');

      const headOfDepartment = (hodIdx >= 0 ? cleanTokens[hodIdx] : '') || '';
      const phone = (phoneIdx >= 0 ? cleanTokens[phoneIdx] : 'Ext. ') || 'Ext. ';
      const isEmergencyRaw = (isEmergIdx >= 0 ? cleanTokens[isEmergIdx] : 'false') || 'false';
      const isEmergency =
        isEmergencyRaw.toLowerCase() === 'true' ||
        isEmergencyRaw.toLowerCase() === 'yes' ||
        isEmergencyRaw === '1';

      let isValid = true;
      let error = '';

      if (!name) {
        isValid = false;
        error = 'Missing department name';
      } else if (!code) {
        isValid = false;
        error = 'Failed to generate department code';
      } else if (existingCodes.has(code)) {
        isValid = false;
        error = `Code "${code}" already exists in registry`;
      } else if (seenBatchCodes.has(code)) {
        isValid = false;
        error = `Duplicate code "${code}" in this batch`;
      } else if (existingNames.has(name.toLowerCase())) {
        isValid = false;
        error = `Department "${name}" already registered`;
      } else if (seenBatchNames.has(name.toLowerCase())) {
        isValid = false;
        error = `Duplicate department "${name}" in this batch`;
      } else if (existingDeptNamesList.length > 0) {
        const matchResult = matchOptionWithFallback(name, existingDeptNamesList, existingDeptNamesList[0], 'Department');
        if (!matchResult.isExactMatch && matchResult.issueType === 'NON_MATCHING_DEPARTMENT' && matchResult.matchedValue) {
          isValid = false;
          error = `Similar variation of existing unit "${matchResult.matchedValue}"`;
        }
      }

      if (isValid) {
        seenBatchCodes.add(code);
        seenBatchNames.add(name.toLowerCase());
      }

      results.push({
        code,
        name,
        locationDescription,
        building: building || locationDescription,
        floor: floor || '',
        headOfDepartment,
        phone,
        isEmergency,
        isValid,
        error,
      });
    }

    const revalidateDeptRows = (rawRows: ParsedDeptRow[]): ParsedDeptRow[] => {
      const existingCodes = new Set(existingDepartments.map((d) => d.code.toUpperCase()));
      const existingNames = new Set(existingDepartments.map((d) => d.name.toLowerCase().trim()));
      const existingDeptNamesList = existingDepartments.map((d) => d.name);
      const seenBatchCodes = new Set<string>();
      const seenBatchNames = new Set<string>();

      return rawRows.map((row) => {
        let isValid = true;
        let error = '';

        if (!row.name) {
          isValid = false;
          error = 'Missing department name';
        } else if (!row.code) {
          isValid = false;
          error = 'Failed to generate department code';
        } else if (existingCodes.has(row.code)) {
          isValid = false;
          error = `Code "${row.code}" already exists in registry`;
        } else if (seenBatchCodes.has(row.code)) {
          isValid = false;
          error = `Duplicate code "${row.code}" in this batch`;
        } else if (existingNames.has(row.name.toLowerCase())) {
          isValid = false;
          error = `Department "${row.name}" already registered`;
        } else if (seenBatchNames.has(row.name.toLowerCase())) {
          isValid = false;
          error = `Duplicate department "${row.name}" in this batch`;
        } else if (existingDeptNamesList.length > 0) {
          const matchResult = matchOptionWithFallback(row.name, existingDeptNamesList, existingDeptNamesList[0], 'Department');
          if (!matchResult.isExactMatch && matchResult.issueType === 'NON_MATCHING_DEPARTMENT' && matchResult.matchedValue) {
            isValid = false;
            error = `Similar variation of existing unit "${matchResult.matchedValue}"`;
          }
        }

        if (isValid) {
          seenBatchCodes.add(row.code);
          seenBatchNames.add(row.name.toLowerCase());
        }

        return {
          ...row,
          isValid,
          error,
        };
      });
    };

    setParsedRows(revalidateDeptRows(results));
    setHasParsed(true);
    // Explicitly NO auto-submit: User must inspect the preview and click "Import"
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvContent = XLSX.utils.sheet_to_csv(worksheet);
          setCsvText(csvContent);
          parseCsvContent(csvContent);
        } catch (err: any) {
          setErrorMessage('Failed to read Excel workbook. Please verify it is a valid .xlsx or .xls file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
        parseCsvContent(text);
      };
      reader.readAsText(file);
    }
  };

  const recomputeValidation = (rows: ParsedDeptRow[]) => {
    const existingCodes = new Set(existingDepartments.map((d) => d.code.toUpperCase()));
    const existingNames = new Set(existingDepartments.map((d) => d.name.toLowerCase().trim()));
    const existingDeptNamesList = existingDepartments.map((d) => d.name);
    const seenBatchCodes = new Set<string>();
    const seenBatchNames = new Set<string>();

    return rows.map((row) => {
      let isValid = true;
      let error = '';

      if (!row.name) {
        isValid = false;
        error = 'Missing department name';
      } else if (!row.code) {
        isValid = false;
        error = 'Failed to generate department code';
      } else if (existingCodes.has(row.code)) {
        isValid = false;
        error = `Code "${row.code}" already exists in registry`;
      } else if (seenBatchCodes.has(row.code)) {
        isValid = false;
        error = `Duplicate code "${row.code}" in this batch`;
      } else if (existingNames.has(row.name.toLowerCase())) {
        isValid = false;
        error = `Department "${row.name}" already registered`;
      } else if (seenBatchNames.has(row.name.toLowerCase())) {
        isValid = false;
        error = `Duplicate department "${row.name}" in this batch`;
      } else if (existingDeptNamesList.length > 0) {
        const matchResult = matchOptionWithFallback(row.name, existingDeptNamesList, existingDeptNamesList[0], 'Department');
        if (!matchResult.isExactMatch && matchResult.issueType === 'NON_MATCHING_DEPARTMENT' && matchResult.matchedValue) {
          isValid = false;
          error = `Similar variation of existing unit "${matchResult.matchedValue}"`;
        }
      }

      if (isValid) {
        seenBatchCodes.add(row.code);
        seenBatchNames.add(row.name.toLowerCase());
      }

      return {
        ...row,
        isValid,
        error,
      };
    });
  };

  const handleDeleteRow = (index: number) => {
    setParsedRows((prev) => {
      const remaining = prev.filter((_, idx) => idx !== index);
      return recomputeValidation(remaining);
    });
  };

  const handleDeleteFlaggedRows = () => {
    setParsedRows((prev) => {
      const remaining = prev.filter((r) => r.isValid);
      return recomputeValidation(remaining);
    });
  };

  const handleImportSubmit = async () => {
    const validItems = parsedRows.filter((r) => r.isValid);
    if (validItems.length === 0) return;

    setIsProcessing(true);
    try {
      const { created } = await departmentService.bulkCreateDepartments(
        validItems.map((r) => ({
          code: r.code,
          name: r.name,
          locationDescription: r.locationDescription,
          building: r.building,
          floor: r.floor,
          headOfDepartment: r.headOfDepartment,
          phone: r.phone,
          isEmergency: r.isEmergency,
        })),
        currentUser
      );

      try {
        const { syncService } = await import('../services/syncService');
        await syncService.runAutomaticSync();
      } catch (syncErr) {
        console.warn('[DepartmentBulkUploadModal] Error triggering Firestore sync:', syncErr);
      }

      onSuccess(created);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import departments in bulk.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-4xl w-full max-h-[94vh] shadow-2xl flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Bulk Hospital Department Upload
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Excel & CSV
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {hospitalName} • Departmental Registry Management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* STEP 1: DOWNLOAD OFFICIAL SAMPLE TEMPLATE */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-emerald-50/80 dark:from-indigo-950/40 dark:via-sky-950/30 dark:to-emerald-950/30 border border-indigo-200/80 dark:border-indigo-800/80">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 tracking-tight flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Official Template: {hospitalName}</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    With Boolean & Dropdown Guide
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                  Download the formatted workbook bearing the hospital header, pre-configured columns (Code, Name, Wing, Floor, HOD, Ext, Boolean Emergency flag), and an in-sheet Reference guide.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Download styled Excel template with merged hospital header and Reference guide sheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Download clean CSV template"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>CSV Template</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('FILE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'FILE'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Upload Excel / CSV File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PASTE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'PASTE'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Paste Rows / Text
            </button>
          </div>

          {/* File Upload Tab */}
          {activeTab === 'FILE' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/80 hover:border-indigo-400 rounded-3xl p-7 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/50 space-y-2.5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  {selectedFileName ? selectedFileName : 'Click to select or drop Excel (.xlsx, .xls) or CSV template here'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Compatible with Microsoft Excel, Google Sheets, LibreOffice, and CSV format
                </span>
              </div>
              <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                Note: Files are parsed for your inspection first. Nothing is saved until you click Import.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Paste Tabular Data or CSV Rows:
              </label>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="code,name,building,floor,locationDescription,headOfDepartment,phone,isEmergency&#10;ICU,Intensive Care Unit,Main Block,1st Floor,Critical Care Wing,Dr. Sarah Owusu,Ext. 102,TRUE"
                className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => parseCsvContent(csvText)}
                disabled={!csvText.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer"
              >
                Parse & Preview Rows
              </button>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Validation & Preview Table with Row Deletion */}
          {hasParsed && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Parsed Preview ({parsedRows.length} Total):
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold text-[11px] bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{validCount} Ready to Import</span>
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-rose-700 dark:text-rose-300 font-bold text-[11px] bg-rose-100/80 dark:bg-rose-950/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-rose-300 dark:border-rose-800">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      <span>{invalidCount} Flagged Issues</span>
                    </span>
                  )}
                </div>

                {/* Batch Actions: Delete Flagged */}
                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteFlaggedRows}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-3xs"
                    title="Remove all invalid or duplicate rows before importing"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete All Flagged ({invalidCount})</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="overflow-x-auto overflow-y-auto max-h-64 custom-scrollbar">
                  <table className="w-full min-w-[920px] text-xs text-left whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="p-2.5 w-24">Status</th>
                        <th className="p-2.5 w-20">Code</th>
                        <th className="p-2.5 min-w-[200px]">Department Name</th>
                        <th className="p-2.5 min-w-[220px]">Location Description</th>
                        <th className="p-2.5 min-w-[140px]">HOD</th>
                        <th className="p-2.5 min-w-[100px]">Ext</th>
                        <th className="p-2.5 w-24">Emergency</th>
                        <th className="p-2.5 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={row.isValid ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30' : 'bg-rose-50/50 dark:bg-rose-950/20'}
                        >
                          <td className="p-2.5">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 max-w-[180px]">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 w-fit">
                                  <AlertCircle className="w-3 h-3" /> Flagged
                                </span>
                                <div className="text-[10px] text-rose-700 dark:text-rose-300 font-medium leading-tight bg-rose-50/80 dark:bg-rose-950/40 p-1 rounded border border-rose-200 dark:border-rose-800/60 whitespace-normal">
                                  {row.error || 'Invalid entry'}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-indigo-600">{row.code || '-'}</td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{row.name || '-'}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{row.locationDescription}</td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.headOfDepartment || '-'}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row.phone}</td>
                          <td className="p-2.5">
                            {row.isEmergency ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Flame className="w-3 h-3" /> Emergency
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Standard</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete this row from import"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {hasParsed
              ? `${validCount} of ${parsedRows.length} departments valid and ready to register.`
              : 'Select template file or paste rows to preview.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImportSubmit}
              disabled={validCount === 0 || isProcessing}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              {isProcessing ? 'Importing Departments...' : `Import ${validCount} Departments`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

