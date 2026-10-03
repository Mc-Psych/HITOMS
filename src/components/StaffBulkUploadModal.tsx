import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Key,
  Users,
  FileText,
  Check,
  Shield,
  Trash2,
  HelpCircle,
  Eye,
  Info,
} from 'lucide-react';
import { type Role, type User as UserType } from '../types';
import {
  authService,
  extractSurname,
  getDefaultPasswordForSurname,
} from '../services/authService';
import { departmentService } from '../services/departmentService';
import { downloadTextFile } from '../utils/fileDownloader';
import { matchOptionWithFallback } from '../utils/fuzzyMatcher';

const VALID_ROLES: Role[] = [
  'SUPER_ADMIN',
  'IT_ADMIN',
  'IT_OFFICER',
  'HOSPITAL_MANAGEMENT',
  'DEPARTMENT_HEAD',
  'STAFF_USER',
  'PROCUREMENT_OFFICER',
  'AUDITOR',
];

interface StaffBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  existingUsers?: UserType[];
  onUploadComplete?: () => void;
  onSuccess?: () => void;
}

export interface ParsedStaffRecord {
  id: string;
  fullName: string;
  surname: string;
  username: string;
  defaultPassword: string;
  department: string;
  role: Role;
  jobTitle?: string;
  phone?: string;
  email?: string;
  isValid: boolean;
  warnings: string[];
  flaggedIssues: string[];
}

export function generateStaffCsvTemplate(existingUsers: UserType[] = [], withSamples: boolean = true): string {
  const headers = 'fullName,department,role';

  if (!withSamples) {
    return `${headers}\n`;
  }

  // Filter out Super Admin accounts
  const nonSuperAdmins = (existingUsers || []).filter(
    (u) => u.role !== 'SUPER_ADMIN' && u.username?.toLowerCase() !== 'admin' && u.id !== 'usr-admin-001'
  );

  if (nonSuperAdmins.length === 0) {
    return `${headers}\n`;
  }

  const rows = nonSuperAdmins.map((u) => {
    const fullName = u.fullName || '';
    const dept = u.department || 'OPD (Outpatient Department)';
    const role = u.role || 'STAFF_USER';
    const escapedName = fullName.includes(',') ? `"${fullName}"` : fullName;
    const escapedDept = dept.includes(',') ? `"${dept}"` : dept;
    return `${escapedName},${escapedDept},${role}`;
  });

  return `${headers}\n${rows.join('\n')}`;
}

export function downloadStaffTemplate(withSamples: boolean = true, existingUsers: UserType[] = []) {
  const content = generateStaffCsvTemplate(existingUsers, withSamples);
  const filename = withSamples
    ? 'HITOMS_Staff_Upload_Template_Sample.csv'
    : 'HITOMS_Staff_Upload_Template_Blank.csv';

  downloadTextFile(filename, content, { mimeType: 'text/csv;charset=utf-8' });
}

export function normalizeStaffRole(roleStr?: string): Role {
  if (!roleStr) return 'STAFF_USER';
  const clean = roleStr.trim().toUpperCase().replace(/[\s-]+/g, '_');

  if (clean === 'SUPER_ADMIN' || clean === 'SUPERADMIN' || clean === 'SUPER_ADMINISTRATOR') return 'SUPER_ADMIN';
  if (clean === 'IT_ADMIN' || clean === 'IT_ADMINISTRATOR' || clean === 'SYSTEM_ADMIN') return 'IT_ADMIN';
  if (clean === 'IT_OFFICER' || clean === 'IT' || clean === 'IT_SUPPORT' || clean === 'TECHNICIAN' || clean === 'NETWORK_ADMIN') return 'IT_OFFICER';
  if (clean === 'HOSPITAL_MANAGEMENT' || clean === 'MANAGEMENT' || clean === 'EXECUTIVE' || clean === 'DIRECTOR') return 'HOSPITAL_MANAGEMENT';
  if (clean === 'DEPARTMENT_HEAD' || clean === 'DEPT_HEAD' || clean === 'HEAD_OF_DEPARTMENT' || clean === 'CLINICAL_LEAD' || clean === 'MATRON' || clean === 'HOD') return 'DEPARTMENT_HEAD';
  if (clean === 'PROCUREMENT_OFFICER' || clean === 'PROCUREMENT' || clean === 'STORES' || clean === 'SUPPLY_CHAIN') return 'PROCUREMENT_OFFICER';
  if (clean === 'AUDITOR' || clean === 'AUDIT' || clean === 'COMPLIANCE' || clean === 'QA') return 'AUDITOR';
  if (clean === 'STAFF_USER' || clean === 'STAFF' || clean === 'USER' || clean === 'NURSE' || clean === 'DOCTOR' || clean === 'PHARMACIST' || clean === 'MIDWIFE' || clean === 'CLINICIAN') return 'STAFF_USER';

  return 'STAFF_USER';
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

export const StaffBulkUploadModal: React.FC<StaffBulkUploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  existingUsers,
  onUploadComplete,
  onSuccess,
}) => {
  const [activeInputMode, setActiveInputMode] = useState<'FILE' | 'MANUAL'>('FILE');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [manualInputText, setManualInputText] = useState('');
  const [mandatoryPasswordChange, setMandatoryPasswordChange] = useState(true);
  const [parsedRecords, setParsedRecords] = useState<ParsedStaffRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRoleGuide, setShowRoleGuide] = useState(false);
  const [fetchedUsers, setFetchedUsers] = useState<UserType[]>([]);
  const [systemDepartments, setSystemDepartments] = useState<string[]>([]);
  const [hasAcceptedFlaggedMappings, setHasAcceptedFlaggedMappings] = useState(false);

  // Load existing users and system departments
  useEffect(() => {
    if (isOpen) {
      setHasAcceptedFlaggedMappings(false);
      if (existingUsers && existingUsers.length > 0) {
        setFetchedUsers(existingUsers);
      } else {
        authService.getAllUsers().then((users) => {
          setFetchedUsers(users);
        });
      }

      departmentService.getStandardDepartmentNames().then((depts) => {
        if (depts && depts.length > 0) {
          setSystemDepartments(depts);
        }
      });
    }
  }, [isOpen, existingUsers]);

  const activeUserList = existingUsers && existingUsers.length > 0 ? existingUsers : fetchedUsers;

  const validDepartments = React.useMemo(() => {
    const list = new Set<string>();
    if (systemDepartments && systemDepartments.length > 0) {
      systemDepartments.forEach((d) => list.add(d.trim()));
    }
    activeUserList.forEach((u) => {
      if (u.department && u.department.trim()) list.add(u.department.trim());
    });
    if (list.size === 0) {
      list.add('OPD (Outpatient Department)');
      list.add('Pharmacy');
      list.add('Accident & Emergency (A&E)');
      list.add('Main Surgical Theatre');
      list.add('Diagnostic Laboratory');
      list.add('Radiology & Imaging');
      list.add('IT & Systems Administration');
    }
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [systemDepartments, activeUserList]);

  // Outcome state
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
    accounts: Array<{
      fullName: string;
      username: string;
      defaultPassword: string;
      role: Role;
      department: string;
    }>;
  } | null>(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Global ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Download Sample Template CSV
  const handleDownloadTemplate = (withSamples: boolean = true) => {
    downloadStaffTemplate(withSamples, activeUserList);
  };

  // Export created accounts list
  const handleDownloadProvisionedAccounts = () => {
    if (!bulkResult || bulkResult.accounts.length === 0) return;

    const headers = ['Full Name', 'Username', 'Initial Password', 'Department', 'Role'];
    const rows = bulkResult.accounts.map((acc) => [
      `"${acc.fullName.replace(/"/g, '""')}"`,
      `"${acc.username}"`,
      `"${acc.defaultPassword}"`,
      `"${acc.department.replace(/"/g, '""')}"`,
      `"${acc.role}"`,
    ]);

    const csvData = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadTextFile(`HITOMS_Staff_Credentials_${new Date().toISOString().split('T')[0]}.csv`, csvData, {
      mimeType: 'text/csv;charset=utf-8',
    });
  };

  // Parse raw text into structured staff records
  const parseRawText = (rawText: string, autoSubmit: boolean = false) => {
    setErrorMessage(null);
    setHasAcceptedFlaggedMappings(false);
    const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length === 0) {
      setParsedRecords([]);
      return;
    }

    let headerIndices: {
      fullName: number;
      department: number;
      role: number;
      jobTitle: number;
      phone: number;
      email: number;
    } | null = null;

    const firstLineLower = lines[0].toLowerCase();
    const hasHeader =
      firstLineLower.includes('fullname') ||
      firstLineLower.includes('full name') ||
      firstLineLower.includes('name,') ||
      firstLineLower.includes('department');

    let startIndex = 0;

    if (hasHeader) {
      startIndex = 1;
      const headerCols = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
      headerIndices = {
        fullName: headerCols.findIndex((h) => h.includes('name')),
        department: headerCols.findIndex((h) => h.includes('dept') || h.includes('department') || h.includes('unit')),
        role: headerCols.findIndex((h) => h.includes('role') || h.includes('access')),
        jobTitle: headerCols.findIndex((h) => h.includes('title') || h.includes('designation') || h.includes('position')),
        phone: headerCols.findIndex((h) => h.includes('phone') || h.includes('contact') || h.includes('mobile') || h.includes('tel')),
        email: headerCols.findIndex((h) => h.includes('email') || h.includes('mail')),
      };
    }

    const records: ParsedStaffRecord[] = [];
    const existingNameSet = new Set(
      activeUserList.map((u) => (u.fullName || '').trim().toLowerCase())
    );
    const existingEmailSet = new Set(
      activeUserList.map((u) => (u.email || '').trim().toLowerCase())
    );
    const seenBatchNames = new Set<string>();

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = parseCsvLine(line);
      if (cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

      let fullName = '';
      let department = validDepartments[0] || 'OPD (Outpatient Department)';
      let roleRaw = '';
      let jobTitle = 'Hospital Staff';
      let phone = '+233 24 000 0000';
      let email = '';

      if (headerIndices && headerIndices.fullName !== -1) {
        fullName = cols[headerIndices.fullName] || '';
        if (headerIndices.department !== -1 && cols[headerIndices.department]) {
          department = cols[headerIndices.department];
        }
        if (headerIndices.role !== -1 && cols[headerIndices.role]) {
          roleRaw = cols[headerIndices.role];
        }
        if (headerIndices.jobTitle !== -1 && cols[headerIndices.jobTitle]) {
          jobTitle = cols[headerIndices.jobTitle];
        }
        if (headerIndices.phone !== -1 && cols[headerIndices.phone]) {
          phone = cols[headerIndices.phone];
        }
        if (headerIndices.email !== -1 && cols[headerIndices.email]) {
          email = cols[headerIndices.email];
        }
      } else {
        // Positional fallback
        fullName = cols[0] || '';
        department = cols[1] || validDepartments[0] || 'OPD (Outpatient Department)';
        roleRaw = cols[2] || '';

        // If col 3 looks like a phone number, treat as phone
        if (cols[3] && (cols[3].includes('+') || /\d{5,}/.test(cols[3]))) {
          phone = cols[3];
          email = cols[4] || '';
        } else {
          jobTitle = cols[3] || 'Hospital Staff';
          phone = cols[4] || '+233 24 000 0000';
          email = cols[5] || '';
        }
      }

      const warnings: string[] = [];
      const flaggedIssues: string[] = [];
      let isValid = true;

      const cleanFullName = (fullName || '').trim();
      const rawDept = (department || validDepartments[0] || 'OPD (Outpatient Department)').trim();
      const cleanJobTitle = (jobTitle || '').trim();
      const cleanPhone = (phone || '').trim();
      let cleanEmail = (email || '').trim();

      // Pre-populated Fuzzy Value Matching for Department and Role
      const deptMatch = matchOptionWithFallback(rawDept, validDepartments, validDepartments[0] || 'OPD (Outpatient Department)', 'Department');
      const roleMatch = matchOptionWithFallback(roleRaw, VALID_ROLES, 'STAFF_USER', 'Role');

      if (!deptMatch.isExactMatch && rawDept) {
        flaggedIssues.push(deptMatch.issueDescription!);
        warnings.push(deptMatch.issueDescription!);
      }
      if (!roleMatch.isExactMatch && roleRaw.trim()) {
        flaggedIssues.push(roleMatch.issueDescription!);
        warnings.push(roleMatch.issueDescription!);
      }

      if (!cleanFullName) {
        isValid = false;
        warnings.push('Full Name is required');
      } else {
        const lowerName = cleanFullName.toLowerCase();
        if (existingNameSet.has(lowerName)) {
          isValid = false;
          warnings.push('Duplicate: User already exists in staff directory');
        } else if (seenBatchNames.has(lowerName)) {
          isValid = false;
          warnings.push('Duplicate: Appears multiple times in this upload file');
        } else {
          seenBatchNames.add(lowerName);
        }
      }

      const role = roleMatch.matchedValue;

      const surname = extractSurname(cleanFullName);
      const username = surname.toLowerCase();
      const defaultPassword = getDefaultPasswordForSurname(surname);

      if (!cleanEmail) {
        cleanEmail = `${username}@hospital.local`;
      }

      if (cleanEmail && existingEmailSet.has(cleanEmail.toLowerCase())) {
        if (isValid) {
          warnings.push('Note: Email already exists, unique handle will be assigned');
        }
      }

      records.push({
        id: `rec-${i}-${Date.now()}`,
        fullName: cleanFullName,
        surname,
        username,
        defaultPassword,
        department: deptMatch.matchedValue,
        role,
        jobTitle: cleanJobTitle || 'Hospital Staff',
        phone: cleanPhone || '+233 24 000 0000',
        email: cleanEmail,
        isValid,
        warnings,
        flaggedIssues,
      });
    }

    setParsedRecords(records);
  };

  // Row update handler for interactive table edits
  const handleUpdateRow = (id: string, field: keyof ParsedStaffRecord, val: any) => {
    setParsedRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === 'fullName') {
          const sname = extractSurname(val || '');
          updated.surname = sname;
          updated.username = sname.toLowerCase();
          updated.defaultPassword = getDefaultPasswordForSurname(sname);
          updated.isValid = Boolean((val || '').trim());
        }
        if (field === 'department') {
          updated.flaggedIssues = updated.flaggedIssues.filter((f) => !f.toLowerCase().includes('department'));
        }
        if (field === 'role') {
          updated.flaggedIssues = updated.flaggedIssues.filter((f) => !f.toLowerCase().includes('role'));
        }
        return updated;
      })
    );
  };

  // Accept all suggested fuzzy mappings
  const handleAcceptAllMappings = () => {
    setHasAcceptedFlaggedMappings(true);
    setParsedRecords((prev) =>
      prev.map((r) => ({
        ...r,
        flaggedIssues: [],
        warnings: r.warnings.filter((w) => !w.startsWith('Non-matching')),
      }))
    );
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    if (
      !fileName.endsWith('.csv') &&
      !fileName.endsWith('.xlsx') &&
      !fileName.endsWith('.xls') &&
      !fileName.endsWith('.txt') &&
      !fileName.endsWith('.tsv')
    ) {
      setErrorMessage('Please upload a valid Excel (.xlsx, .xls), CSV, or TSV file.');
      return;
    }

    setSelectedFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          setManualInputText(csvText);
          parseRawText(csvText, true);
        } catch (err) {
          setErrorMessage('Failed to read Excel workbook. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setManualInputText(text);
          parseRawText(text, true);
        }
      };
      reader.onerror = () => {
        setErrorMessage('Failed to read the uploaded file.');
      };
      reader.readAsText(file);
    }
  };

  // Drag and drop handlers
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
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Insert sample data into manual text area
  const handlePasteSample = () => {
    const sampleText = generateStaffCsvTemplate(activeUserList, true);
    setManualInputText(sampleText);
    setSelectedFileName('Sample Hospital Staff Template');
    parseRawText(sampleText);
  };

  // Clear loaded data
  const handleClear = () => {
    setManualInputText('');
    setSelectedFileName(null);
    setParsedRecords([]);
    setErrorMessage(null);
    setBulkResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execute provision
  const handleExecuteUpload = async (customRecords?: ParsedStaffRecord[]) => {
    if (!currentUser || !isSuperAdmin) {
      setErrorMessage('Access Denied: Only Super Administrators can provision staff accounts.');
      return;
    }

    const recordsToUse = customRecords || parsedRecords;
    const validRecords = recordsToUse.filter((r) => r.isValid);
    if (validRecords.length === 0) {
      setErrorMessage('No valid staff records found to provision. Please verify the template columns and names.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Ensure all unique departments present in staff upload exist in system database & Firestore
      const uniqueDepts: string[] = Array.from(new Set(validRecords.map((r) => r.department.trim()).filter(Boolean)));
      if (uniqueDepts.length > 0) {
        await departmentService.ensureDepartmentsExist(uniqueDepts, currentUser);
      }

      const staffList = validRecords.map((r) => ({
        fullName: r.fullName,
        department: r.department,
        role: r.role,
        jobTitle: r.jobTitle,
        phone: r.phone,
        email: r.email,
      }));

      const res = await authService.bulkCreateStaff(
        staffList,
        mandatoryPasswordChange,
        currentUser
      );

      try {
        const { syncService } = await import('../services/syncService');
        await syncService.runAutomaticSync();
      } catch (e) {
        console.warn('[StaffBulkUploadModal] Error triggering post-upload sync:', e);
      }

      setBulkResult(res);
      setShowConfirmDialog(false);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to bulk provision staff accounts.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRecords.filter((r) => r.isValid).length;
  const invalidCount = parsedRecords.filter((r) => !r.isValid).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bulk Hospital Staff Upload & Template</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  CSV / TSV Template
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Download the official template, fill in your staff roster in Excel or Sheets, and upload to provision accounts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Upload Error</span>
                <span className="text-[11px]">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* STEP 1: DOWNLOAD TEMPLATE BANNER */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/80 to-sky-50/80 dark:from-emerald-950/30 dark:to-sky-950/30 border border-emerald-200 dark:border-emerald-800/80">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Step 1: Download Staff Roster Template</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-xl">
                  Use this template formatted with the expected columns (<code className="font-mono text-emerald-700 dark:text-emerald-300">fullName, department, role, jobTitle, phone, email</code>). Fill it in and upload below.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Download template pre-populated with realistic hospital staff rows"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample Template (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(false)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Download clean headers-only template ready for data entry"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Blank Template (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRoleGuide(!showRoleGuide)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-xs hover:text-slate-900 transition flex items-center gap-1 cursor-pointer"
                  title="Toggle Role and Department Guidelines"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Role Guide</span>
                </button>
              </div>
            </div>

            {/* Collapsible Role Guide */}
            {showRoleGuide && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 text-[11px] text-slate-700 dark:text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block mb-1">Supported Roles:</span>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li><strong className="font-mono">DEPARTMENT_HEAD</strong>: Clinical Leads, HODs, Matrons</li>
                    <li><strong className="font-mono">STAFF_USER</strong>: Doctors, Nurses, Midwives, Pharmacists, Technicians</li>
                    <li><strong className="font-mono">IT_OFFICER</strong>: Help Desk, Network Admins, Hardware Techs</li>
                    <li><strong className="font-mono">PROCUREMENT_OFFICER</strong>: Storekeepers, Supply Chain</li>
                    <li><strong className="font-mono">AUDITOR</strong>: Compliance & QA Staff</li>
                    <li><strong className="font-mono">HOSPITAL_MANAGEMENT</strong>: Medical Directors, Administrators</li>
                  </ul>
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block mb-1">Recommended Departments:</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Outpatient Department (OPD), Accident & Emergency (A&E), Pharmacy Unit, Diagnostic Imaging / Radiology, Intensive Care Unit (ICU), Maternity Ward, Surgical Theatre, IT Operations, Finance & Stores, Hospital Administration.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CREDENTIALS GENERATION RULES & TOGGLE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <Key className="w-3.5 h-3.5 text-sky-600" />
                <span>Automated Credentials Rule</span>
              </div>
              <ul className="text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Username:</strong> Staff member&apos;s surname in lowercase (e.g. <em>Dr. Kwame Mensah</em> &rarr; <code className="font-mono font-bold text-sky-600">mensah</code>).
                </li>
                <li>
                  <strong>Default Password:</strong> Last 4 letters of surname (e.g. <em>Mensah</em> &rarr; <code className="font-mono font-bold text-emerald-600">nsah</code>, <em>Boateng</em> &rarr; <code className="font-mono font-bold text-emerald-600">teng</code>).
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
              <input
                id="mandatory-pwd-toggle"
                type="checkbox"
                checked={mandatoryPasswordChange}
                onChange={(e) => setMandatoryPasswordChange(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-sky-600 rounded border-slate-300 cursor-pointer"
              />
              <label htmlFor="mandatory-pwd-toggle" className="cursor-pointer">
                <span className="font-bold text-slate-900 dark:text-white block text-xs">
                  Enforce Password Change on First Login
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                  Users logging in with their initial password must set a confidential password before accessing clinical tickets or assets.
                </span>
              </label>
            </div>
          </div>

          {/* STEP 2: UPLOAD OR PASTE AREA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                <span>Step 2: Upload Filled Template or Paste Staff Data</span>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('FILE')}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                    activeInputMode === 'FILE'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  File Upload (.xlsx, .csv)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('MANUAL')}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                    activeInputMode === 'MANUAL'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Manual Text Entry
                </button>
              </div>
            </div>

            {/* File Upload Mode */}
            {activeInputMode === 'FILE' && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.xlsx,.xls,.txt,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                />

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : selectedFileName
                      ? 'border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10'
                      : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mb-2">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  {selectedFileName ? (
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">
                        {selectedFileName}
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                        File loaded successfully. Click or drag to replace.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">
                        Click to browse or drag & drop your completed Staff CSV file here
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Supports standard .csv, .tsv, and .txt files generated from Excel, Sheets, or Hospital HRIS
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manual Text Mode */}
            {activeInputMode === 'MANUAL' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    Format: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">fullName, department, role, jobTitle, phone, email</code>
                  </span>
                  <button
                    type="button"
                    onClick={handlePasteSample}
                    className="text-sky-600 hover:text-sky-500 font-bold cursor-pointer"
                  >
                    Paste Sample Staff Data
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={manualInputText}
                  onChange={(e) => {
                    setManualInputText(e.target.value);
                    parseRawText(e.target.value);
                  }}
                  placeholder="e.g. Dr. Kwame Mensah, Outpatient Department (OPD), DEPARTMENT_HEAD, Lead Physician, +233 24 111 2222, mensah@hospital.local"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* STEP 3: PARSED RECORDS PREVIEW */}
          {parsedRecords.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    Preview Staff Accounts to Provision:
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                    {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                      {invalidCount} Issues
                    </span>
                  )}
                  {parsedRecords.some((r) => r.flaggedIssues.length > 0) && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                      {parsedRecords.filter((r) => r.flaggedIssues.length > 0).length} Flagged
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-400 hover:text-rose-600 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>

              {/* Flagged Values & Mappings Banner */}
              {parsedRecords.some((r) => r.flaggedIssues.length > 0) && !hasAcceptedFlaggedMappings && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold block">
                        Non-matching Values Detected &amp; Pre-Mapped
                      </span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        Uploaded departments or roles that did not match existing hospital categories were flagged to prevent duplicate entries. Review or change any value directly using the dropdowns in the table, or accept suggestions.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAcceptAllMappings}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs transition"
                  >
                    Accept Suggested Mappings
                  </button>
                </div>
              )}

              <div className="max-h-64 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs custom-scrollbar bg-white dark:bg-slate-900">
                <table className="w-full min-w-[960px] text-left text-[11px] whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 font-bold z-10">
                    <tr>
                      <th className="p-2.5 w-16">Status</th>
                      <th className="p-2.5 min-w-[180px]">Full Name *</th>
                      <th className="p-2.5 min-w-[120px]">Username</th>
                      <th className="p-2.5 min-w-[130px]">Initial Password</th>
                      <th className="p-2.5 min-w-[220px]">Department *</th>
                      <th className="p-2.5 min-w-[170px]">Role *</th>
                      <th className="p-2.5 min-w-[160px]">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {parsedRecords.map((rec) => {
                      const isDeptFlagged = rec.flaggedIssues.some((f) => f.toLowerCase().includes('department'));
                      const isRoleFlagged = rec.flaggedIssues.some((f) => f.toLowerCase().includes('role'));

                      return (
                        <tr
                          key={rec.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                            !rec.isValid ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="p-2.5">
                            {rec.isValid ? (
                              rec.flaggedIssues && rec.flaggedIssues.length > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded cursor-help"
                                  title={rec.flaggedIssues.join('\n')}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Flagged</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400" title="Ready to provision">
                                  <CheckCircle2 className="w-4 h-4" />
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center text-rose-600 dark:text-rose-400" title={rec.warnings.join(', ')}>
                                <AlertTriangle className="w-4 h-4" />
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white min-w-[160px]">
                            <input
                              type="text"
                              value={rec.fullName}
                              onChange={(e) => handleUpdateRow(rec.id, 'fullName', e.target.value)}
                              placeholder="Full Name *"
                              className={`w-full bg-transparent border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white ${
                                !rec.fullName.trim() ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30' : 'border-slate-200 dark:border-slate-700'
                              }`}
                            />
                            {rec.jobTitle && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{rec.jobTitle}</div>}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-sky-600 dark:text-sky-400">
                            @{rec.username}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {rec.defaultPassword}
                          </td>
                          <td className="p-2.5 min-w-[180px]">
                            <div className="flex flex-col gap-0.5">
                              <select
                                value={rec.department}
                                onChange={(e) => handleUpdateRow(rec.id, 'department', e.target.value)}
                                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none ${
                                  isDeptFlagged
                                    ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-semibold'
                                    : 'border-slate-200 dark:border-slate-700'
                                }`}
                                title={isDeptFlagged ? rec.flaggedIssues.find((f) => f.includes('Department')) : undefined}
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
                          <td className="p-2.5 min-w-[150px]">
                            <div className="flex flex-col gap-0.5">
                              <select
                                value={rec.role}
                                onChange={(e) => handleUpdateRow(rec.id, 'role', e.target.value as Role)}
                                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white font-mono focus:outline-none ${
                                  isRoleFlagged
                                    ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 font-bold'
                                    : 'border-slate-200 dark:border-slate-700'
                                }`}
                                title={isRoleFlagged ? rec.flaggedIssues.find((f) => f.includes('Role')) : undefined}
                              >
                                {VALID_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                              {isRoleFlagged && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                  Non-matching Role
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[10px]">
                            <div>{rec.phone}</div>
                            <div className="text-slate-400">{rec.email}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: PROVISIONING OUTCOME RESULT */}
          {bulkResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                      Bulk Provisioning Complete!
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Successfully created <strong>{bulkResult.created}</strong> staff accounts ({bulkResult.skipped} skipped/duplicates).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadProvisionedAccounts}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Staff Credentials Sheet (.csv)</span>
                </button>
              </div>

              {/* Accounts list */}
              <div className="max-h-40 overflow-y-auto border border-emerald-200/80 dark:border-emerald-800/80 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px] bg-white dark:bg-slate-900">
                  <thead className="bg-emerald-100/60 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 sticky top-0 font-bold">
                    <tr>
                      <th className="p-2">Full Name</th>
                      <th className="p-2">Username</th>
                      <th className="p-2">Initial Password</th>
                      <th className="p-2">Department</th>
                      <th className="p-2">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bulkResult.accounts.map((acc, i) => (
                      <tr key={i}>
                        <td className="p-2 font-medium">{acc.fullName}</td>
                        <td className="p-2 font-mono font-bold text-sky-600 dark:text-sky-400">@{acc.username}</td>
                        <td className="p-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{acc.defaultPassword}</td>
                        <td className="p-2 text-slate-500">{acc.department}</td>
                        <td className="p-2 font-mono text-[10px] text-slate-400">{acc.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="text-[11px] text-slate-500">
            {bulkResult ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Staff directory updated in offline IndexedDB.
              </span>
            ) : parsedRecords.length > 0 && !hasAcceptedFlaggedMappings && parsedRecords.some((r) => r.flaggedIssues.length > 0) ? (
              <span className="text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Please review and accept suggested mappings for flagged items to enable import.
              </span>
            ) : (
              <span>
                {validCount > 0 ? `${validCount} staff records ready to provision` : 'Download template above to begin'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {bulkResult ? 'Done' : 'Cancel'}
            </button>

            {!bulkResult && (
              <button
                type="button"
                onClick={() => setShowConfirmDialog(true)}
                disabled={isProcessing || validCount === 0 || (!hasAcceptedFlaggedMappings && parsedRecords.some((r) => r.flaggedIssues.length > 0))}
                title={
                  !hasAcceptedFlaggedMappings && parsedRecords.some((r) => r.flaggedIssues.length > 0)
                    ? 'Review and accept suggested mappings above to enable import'
                    : undefined
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Importing & Syncing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {!hasAcceptedFlaggedMappings && parsedRecords.some((r) => r.flaggedIssues.length > 0)
                        ? 'Review Flags to Import'
                        : `Import & Confirm ${validCount > 0 ? `(${validCount} Staff)` : ''}`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Staff Import to Firestore
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You are about to provision and save <strong>{validCount} verified hospital staff accounts</strong> into the local terminal and synchronize them directly to the Firestore cloud database.
            </p>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300">
              ✓ Initial passwords set to surname lowercase<br />
              ✓ Automatic cloud replication to Firestore active<br />
              ✓ Instant access across all connected terminals
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteUpload()}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <span>Confirm & Save to Firestore</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
