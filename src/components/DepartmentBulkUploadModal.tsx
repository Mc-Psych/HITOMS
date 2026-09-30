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
} from 'lucide-react';
import { type Department, type User } from '../types';
import { departmentService, generateDepartmentCode } from '../services/departmentService';

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
  const headers = 'code,name,locationDescription';

  if (!existingDepts || existingDepts.length === 0) {
    return `${headers}\n`;
  }

  const rows = existingDepts.map((d) => {
    const code = d.code || '';
    const name = d.name || '';
    const loc = d.locationDescription || d.building || '';
    const escapedName = name.includes(',') ? `"${name}"` : name;
    const escapedLoc = loc.includes(',') ? `"${loc}"` : loc;
    return `${code},${escapedName},${escapedLoc}`;
  });

  return `${headers}\n${rows.join('\n')}`;
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

  const downloadSampleCsv = () => {
    const content = generateDepartmentCsvTemplate(existingDepartments);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Hospital_Departments_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvContent = (text: string, autoSubmit: boolean = false) => {
    setErrorMessage('');
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      setErrorMessage('CSV contains no data rows. Please check file or input.');
      setParsedRows([]);
      setHasParsed(true);
      return;
    }

    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/["']/g, ''));
    const codeIdx = header.findIndex((h) => h === 'code' || h === 'deptcode' || h === 'abbrev');
    const nameIdx = header.findIndex((h) => h === 'name' || h === 'department' || h === 'deptname');
    const locIdx = header.findIndex((h) => h === 'locationdescription' || h === 'location' || h === 'loc');
    const buildingIdx = header.findIndex((h) => h === 'building' || h === 'wing' || h === 'block');
    const floorIdx = header.findIndex((h) => h === 'floor' || h === 'level');
    const hodIdx = header.findIndex((h) => h === 'headofdepartment' || h === 'hod' || h === 'head');
    const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'extension' || h === 'ext');
    const isEmergIdx = header.findIndex((h) => h === 'isemergency' || h === 'emergency');

    if (nameIdx === -1) {
      setErrorMessage('CSV must contain at least a "name" or "department" column in the header row.');
      setParsedRows([]);
      setHasParsed(true);
      return;
    }

    const existingCodes = new Set(existingDepartments.map((d) => d.code.toUpperCase()));
    const seenBatchCodes = new Set<string>();
    const results: ParsedDeptRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const tokens = parseCsvLine(line);
      const cleanTokens = tokens.map((t) => t.trim().replace(/^"|"$/g, ''));

      const name = (cleanTokens[nameIdx] || '').trim();
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
        'Main Hospital Complex, Ground Floor';

      const headOfDepartment = (hodIdx >= 0 ? cleanTokens[hodIdx] : '') || '';
      const phone = (phoneIdx >= 0 ? cleanTokens[phoneIdx] : 'Ext. ') || 'Ext. ';
      const isEmergencyRaw = (isEmergIdx >= 0 ? cleanTokens[isEmergIdx] : 'false') || 'false';
      const isEmergency = isEmergencyRaw.toLowerCase() === 'true' || isEmergencyRaw.toLowerCase() === 'yes' || isEmergencyRaw === '1';

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
        error = `Code "${code}" already exists in hospital registry`;
      } else if (seenBatchCodes.has(code)) {
        isValid = false;
        error = `Duplicate code "${code}" in this upload batch`;
      }

      if (isValid) {
        seenBatchCodes.add(code);
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

    setParsedRows(results);
    setHasParsed(true);

    if (autoSubmit) {
      const validItems = results.filter((r) => r.isValid);
      if (validItems.length > 0) {
        handleImportSubmit(results);
      }
    }
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
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          setCsvText(csvText);
          parseCsvContent(csvText, true);
        } catch (err: any) {
          setErrorMessage('Failed to read Excel workbook. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
        parseCsvContent(text, true);
      };
      reader.readAsText(file);
    }
  };

  const handleImportSubmit = async (customRows?: ParsedDeptRow[]) => {
    const rowsToUse = customRows || parsedRows;
    const validItems = rowsToUse.filter((r) => r.isValid);
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-4xl w-full max-h-[92vh] shadow-2xl flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Bulk Department & Clinical Unit Upload
              </h3>
              <p className="text-[11px] text-slate-500">
                Import hospital wards, departments, building floors, and leadership from CSV or Excel sheets
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
          {/* Action Row: Template & Method Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200 block">
                  Need the Department CSV Template?
                </span>
                <span className="text-[10px] text-indigo-700 dark:text-indigo-400">
                  Pre-formatted with Code, Name, Building, Floor, HOD, Extension, and Emergency flags
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 text-xs font-bold transition cursor-pointer shadow-3xs shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template (.CSV)</span>
            </button>
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
              Upload CSV File
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
              Paste CSV / Text
            </button>
          </div>

          {/* File Upload Tab */}
          {activeTab === 'FILE' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/80 hover:border-indigo-400 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
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
                  {selectedFileName ? selectedFileName : 'Click to browse or drop Excel (.xlsx, .xls) or CSV file here'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Compatible with Microsoft Excel (.xlsx / .xls), Google Sheets, and standard CSV files
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Paste CSV Rows with Headers:
              </label>
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="code,name,building,floor,headOfDepartment,phone,isEmergency&#10;ICU,Intensive Care Unit,Block A,Level 2,Dr. K. Adjei,Ext. 104,true"
                className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => parseCsvContent(csvText, true)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Parse & Validate Data
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

          {/* Validation & Preview Table */}
          {hasParsed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Batch Validation Summary ({parsedRows.length} Rows):
                </span>
                <div className="flex items-center gap-2 font-bold text-[11px]">
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{validCount} Valid</span>
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{invalidCount} Invalid (Skipped)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Department Name</th>
                        <th className="p-2.5">Location Description</th>
                        <th className="p-2.5">HOD</th>
                        <th className="p-2.5">Ext</th>
                        <th className="p-2.5">Emergency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={row.isValid ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30' : 'bg-rose-50/40 dark:bg-rose-950/20'}
                        >
                          <td className="p-2.5">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" title={row.error}>
                                <AlertCircle className="w-3 h-3" /> {row.error || 'Error'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-indigo-600">{row.code || '-'}</td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{row.name || '-'}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{row.locationDescription}</td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.headOfDepartment || '-'}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row.phone}</td>
                          <td className="p-2.5">
                            {row.isEmergency ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Flame className="w-3 h-3" /> Emergency
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Standard</span>
                            )}
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
          <span className="text-[11px] text-slate-400">
            {validCount > 0 ? `${validCount} departments ready to register.` : 'Upload a CSV to begin.'}
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              {isProcessing ? 'Importing Departments...' : `Import ${validCount} Departments`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
