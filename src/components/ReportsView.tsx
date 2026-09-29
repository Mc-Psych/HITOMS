import React, { useState, useEffect, useMemo } from 'react';
import {
  FileBarChart2,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  FileText,
  Sparkles,
  Plus,
  Search,
  Building,
  Shield,
  Layers,
  Clock,
  Send,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Check,
  Trash2,
  Flame,
  HardDrive,
  Package,
  Wand2,
  Image as ImageIcon,
  Camera,
  Upload,
  FolderArchive,
  Eye,
} from 'lucide-react';
import {
  type Ticket,
  type Asset,
  type MaintenanceRecord,
  type Incident,
  type InventoryItem,
  type SystemSettings,
  type User,
  type HospitalMemo,
  type MemoType,
  type MemoStatus,
} from '../types';
import { memoService } from '../services/memoService';
import { MemoDetailModal } from './MemoDetailModal';
import { MemoEditorModal } from './MemoEditorModal';
import { LetterheadUploadModal } from './LetterheadUploadModal';
import { MemoUploadArchiveModal } from './MemoUploadArchiveModal';
import { MemoScanViewerModal } from './MemoScanViewerModal';

interface ReportsViewProps {
  tickets?: Ticket[];
  assets?: Asset[];
  maintenance?: MaintenanceRecord[];
  incidents?: Incident[];
  inventory?: InventoryItem[];
  systemSettings?: SystemSettings | null;
  currentUser?: User | null;
  allUsers?: User[];
  onRefresh?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  tickets = [],
  assets = [],
  maintenance = [],
  incidents = [],
  inventory = [],
  systemSettings,
  currentUser = null,
  allUsers = [],
  onRefresh,
}) => {
  const safeTickets = tickets || [];
  const safeAssets = assets || [];
  const safeMaintenance = maintenance || [];
  const safeIncidents = incidents || [];
  const safeInventory = inventory || [];

  const isITUser =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'IT_ADMIN' ||
    currentUser?.role === 'IT_OFFICER';

  // Active Main Navigation Tab (Default to MEMOS if IT User, else DATA_REGISTERS)
  const [activeTab, setActiveTab] = useState<'MEMOS' | 'DATA_REGISTERS'>(
    isITUser ? 'MEMOS' : 'DATA_REGISTERS'
  );

  useEffect(() => {
    if (!isITUser && activeTab === 'MEMOS') {
      setActiveTab('DATA_REGISTERS');
    }
  }, [isITUser, activeTab]);

  // Memos State
  const [memos, setMemos] = useState<HospitalMemo[]>([]);
  const [loadingMemos, setLoadingMemos] = useState(true);
  const [selectedMemoForDetail, setSelectedMemoForDetail] = useState<HospitalMemo | null>(null);
  const [selectedMemoForScanViewer, setSelectedMemoForScanViewer] = useState<HospitalMemo | null>(null);
  const [memoToEdit, setMemoToEdit] = useState<HospitalMemo | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);
  const [isUploadArchiveModalOpen, setIsUploadArchiveModalOpen] = useState(false);

  // Memo Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Data Register Report Selection
  const [reportType, setReportType] = useState<'TICKETS' | 'ASSETS' | 'MAINTENANCE' | 'INVENTORY' | 'SLA'>('TICKETS');

  // AI Operations Debrief State
  const [isGeneratingDebrief, setIsGeneratingDebrief] = useState(false);
  const [executiveDebriefText, setExecutiveDebriefText] = useState<string | null>(null);

  // Load Memos from Local Database
  const loadMemos = async () => {
    setLoadingMemos(true);
    try {
      const items = await memoService.getMemos();
      setMemos(items || []);
    } catch (err) {
      console.error('Failed to load hospital memos:', err);
    } finally {
      setLoadingMemos(false);
    }
  };

  useEffect(() => {
    loadMemos();
  }, []);

  // Filtered Memos List
  const filteredMemos = useMemo(() => {
    return memos.filter((m) => {
      if (filterType === 'ARCHIVED_SCANS') {
        const hasScan = Boolean(m.archivedScanImage || m.archiveSource === 'CAMERA_CAPTURE' || m.archiveSource === 'DEVICE_UPLOAD' || (m.attachments && m.attachments.length > 0));
        if (!hasScan) return false;
      } else if (filterType !== 'ALL' && m.memoType !== filterType) {
        return false;
      }
      if (filterStatus !== 'ALL' && m.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (m.title || '').toLowerCase().includes(q);
        const matchesRef = (m.memoNumber || '').toLowerCase().includes(q);
        const matchesAudience = (m.targetAudience || '').toLowerCase().includes(q);
        const matchesSender = (m.fromSender?.name || '').toLowerCase().includes(q);
        const matchesSummary = (m.executiveSummary || '').toLowerCase().includes(q);
        const matchesLocation = (m.physicalArchiveLocation || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesRef && !matchesAudience && !matchesSender && !matchesSummary && !matchesLocation) {
          return false;
        }
      }
      return true;
    });
  }, [memos, filterType, filterStatus, searchQuery]);

  // Status updates
  const handleUpdateMemoStatus = async (id: string, newStatus: MemoStatus) => {
    if (!currentUser) return;
    try {
      const updated = await memoService.updateMemoStatus(id, newStatus, currentUser);
      setMemos((prev) => prev.map((m) => (m.id === id ? updated : m)));
      if (selectedMemoForDetail?.id === id) {
        setSelectedMemoForDetail(updated);
      }
    } catch (err) {
      console.error('Failed to update memo status:', err);
    }
  };

  const handleDeleteMemo = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this memorandum?')) return;
    try {
      await memoService.deleteMemo(id, currentUser);
      setMemos((prev) => prev.filter((m) => m.id !== id));
      if (selectedMemoForDetail?.id === id) {
        setSelectedMemoForDetail(null);
      }
    } catch (err) {
      console.error('Failed to delete memo:', err);
    }
  };

  const handleDeleteAllSampleMemos = async () => {
    if (!window.confirm('Are you sure you want to delete ALL sample and stored memorandums from the hospital repository? This will clear all default memos.')) return;
    try {
      await memoService.deleteAllMemos(currentUser);
      setMemos([]);
      setSelectedMemoForDetail(null);
    } catch (err) {
      console.error('Failed to delete sample memos:', err);
    }
  };

  const handleRestoreSampleMemos = async () => {
    try {
      const restored = await memoService.restoreSampleMemos(currentUser);
      setMemos(restored);
    } catch (err) {
      console.error('Failed to restore sample memos:', err);
    }
  };

  const handleSavedMemo = (saved: HospitalMemo) => {
    setMemos((prev) => {
      const index = prev.findIndex((m) => m.id === saved.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    setSelectedMemoForDetail(saved);
  };

  // Generate Executive AI Debrief on the fly
  const handleGenerateExecutiveDebrief = async () => {
    setIsGeneratingDebrief(true);
    try {
      const openTickets = safeTickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length;
      const criticalCount = safeTickets.filter((t) => t.priority === 'Critical').length;
      const activeIncidents = safeIncidents.filter((i) => i.status !== 'RESOLVED').length;
      const lowStockCount = safeInventory.filter((i) => i.quantity <= i.minimumStock).length;
      const maintenanceCount = safeMaintenance.filter((m) => m.status === 'Scheduled').length;

      const promptRequest = {
        memoType: 'OPERATIONS_REPORT' as MemoType,
        topic: `Executive Hospital IT Operations Debrief — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        targetAudience: 'Hospital Directorate, Medical Director, and Clinical Operations Board',
        department: 'Hospital IT Operations & Systems Administration',
        rawNotes: `Hospital Operations Snapshot:
- Open Helpdesk Tickets: ${openTickets} (Critical: ${criticalCount})
- Total Tracked Assets: ${safeAssets.length}
- Active Major Incidents: ${activeIncidents}
- Scheduled Preventive Maintenance: ${maintenanceCount}
- Consumables below threshold: ${lowStockCount} items
- Starlink and Core Fiber WAN auto-failover link status: Operational`,
        tone: 'EXECUTIVE' as const,
        hospitalName: systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital',
        senderName: currentUser?.fullName || 'Courage Kay',
        senderTitle: currentUser?.jobTitle || 'Super Administrator & CIO',
        includeLiveData: true,
      };

      const res = await memoService.generateAiMemo(promptRequest);
      setExecutiveDebriefText(`## ${res.title}
**Reference:** ${res.memoNumber} | **Date:** ${new Date().toLocaleDateString()}
**Recipients:** ${res.targetAudience}

### Executive Overview
${res.executiveSummary}

### Clinical & Technical Context
${res.backgroundAndContext}

### Detailed Operational Directives & System Status
${res.detailedFindingsOrBody}

### Mandatory Directorate Action Items
${res.actionRequiredOrChecklist.map((item, i) => `${i + 1}. ${item}`).join('\n')}

**Timeline:** ${res.timelineOrDeadline}
**IT Authority:** ${res.contactPersonOrExtension}`);
    } catch (err: any) {
      console.error('Error generating executive debrief:', err);
    } finally {
      setIsGeneratingDebrief(false);
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = `hitoms-report-${reportType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'TICKETS') {
      csvContent += 'Ticket Number,Title,Category,Priority,Status,Department,Location,Reported By,Created At\n';
      safeTickets.forEach((t) => {
        csvContent += `"${t.ticketNumber}","${t.title.replace(/"/g, '""')}","${t.category}","${t.priority}","${t.status}","${t.department}","${t.location}","${t.reportedBy.name}","${t.createdAt}"\n`;
      });
    } else if (reportType === 'ASSETS') {
      csvContent += 'Asset Tag,Type,Manufacturer,Model,Serial Number,Department,Location,Condition,Status,Assigned User\n';
      safeAssets.forEach((a) => {
        csvContent += `"${a.assetTag}","${a.assetType}","${a.manufacturer}","${a.model}","${a.serialNumber}","${a.department}","${a.location}","${a.condition}","${a.status}","${a.assignedUser || ''}"\n`;
      });
    } else if (reportType === 'MAINTENANCE') {
      csvContent += 'Maintenance Number,Asset Tag,Type,Frequency,Scheduled Date,Status,Assigned Tech,Completed At,Cost\n';
      safeMaintenance.forEach((m) => {
        csvContent += `"${m.maintenanceNumber}","${m.assetTag}","${m.maintenanceType}","${m.frequency}","${m.scheduledDate}","${m.status}","${m.assignedTechnician}","${m.completedAt || ''}","${m.cost}"\n`;
      });
    } else if (reportType === 'INVENTORY') {
      csvContent += 'Item Code,Item Name,Category,Quantity,Unit,Min Stock,Location\n';
      safeInventory.forEach((i) => {
        csvContent += `"${i.itemCode}","${i.itemName}","${i.category}","${i.quantity}","${i.unit}","${i.minimumStock}","${i.location}"\n`;
      });
    } else if (reportType === 'SLA') {
      csvContent += 'Ticket Number,Priority,Department,Reported By,Resolution Due,Status,SLA Met\n';
      safeTickets.forEach((t) => {
        const met = t.status === 'Resolved' || t.status === 'Closed';
        csvContent += `"${t.ticketNumber}","${t.priority}","${t.department}","${t.reportedBy.name}","${t.sla?.resolutionDue || ''}","${t.status}","${met ? 'YES' : 'PENDING'}"\n`;
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

  const getMemoBadge = (type: MemoType) => {
    switch (type) {
      case 'EXECUTIVE_IT_MEMO':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Executive IT Memo</span>;
      case 'CLINICAL_ADVISORY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Clinical Safety Advisory</span>;
      case 'OPERATIONS_REPORT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">Operations Report</span>;
      case 'EQUIPMENT_JUSTIFICATION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Procurement Justification</span>;
      case 'POLICY_CIRCULAR':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Security Policy Circular</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">Memorandum</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <span>{isITUser ? 'Hospital Memos & Operations Reports' : 'Hospital Operations & Data Reports'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isITUser
              ? 'Issue official clinical memorandums, view department circulars, and export operational datasets.'
              : 'Access operational registers, system performance datasets, and hospital IT compliance reports.'}
          </p>
        </div>

        {isITUser && (
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
            {memos.length > 0 ? (
              <button
                type="button"
                onClick={handleDeleteAllSampleMemos}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold text-xs shadow-2xs transition cursor-pointer"
                title="Delete all sample and seed memos from the repository"
              >
                <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Delete Sample Memos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreSampleMemos}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-2xs transition cursor-pointer"
                title="Restore initial default sample memos"
              >
                <RefreshCw className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Restore Sample Memos</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsUploadArchiveModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold text-xs shadow-2xs transition cursor-pointer"
              title="Upload memo documents or capture photos of physical paper memos into the system"
            >
              <Camera className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Upload / Camera Scan Memo</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLetterheadModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-2xs transition cursor-pointer"
              title="Upload or change official hospital letterhead"
            >
              <ImageIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Configure Letterhead</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMemoToEdit(null);
                setIsEditorOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Official Memo</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Top Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {isITUser && (
          <button
            type="button"
            onClick={() => setActiveTab('MEMOS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'MEMOS'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Hospital Memos & Circulars</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'MEMOS' ? 'bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {memos.length}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('DATA_REGISTERS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'DATA_REGISTERS'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Operational Registers & CSV Exports</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: HOSPITAL MEMOS & CIRCULARS */}
      {/* ============================================================== */}
      {activeTab === 'MEMOS' && (
        <div className="space-y-6">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Memorandums</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {memos.length}
              </div>
              <span className="text-[10px] text-slate-500">Repository Archives</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Published & Active</span>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                {memos.filter((m) => m.status === 'PUBLISHED').length}
              </div>
              <span className="text-[10px] text-slate-500">Active Directives</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Clinical Advisories</span>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">
                {memos.filter((m) => m.memoType === 'CLINICAL_ADVISORY').length}
              </div>
              <span className="text-[10px] text-slate-500">Patient Safety SOPs</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">Archived Directives</span>
              <div className="text-2xl font-black text-sky-700 dark:text-sky-400 mt-1">
                {memos.filter((m) => m.status === 'ARCHIVED').length}
              </div>
              <span className="text-[10px] text-slate-500">Historical Records</span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memos, topics, reference #..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
              >
                <option value="ALL">All Memo Types</option>
                <option value="ARCHIVED_SCANS">Archived Scans & Uploads Only</option>
                <option value="EXECUTIVE_IT_MEMO">Executive IT Memo</option>
                <option value="CLINICAL_ADVISORY">Clinical Ward Advisory</option>
                <option value="INCIDENT_DEBRIEF">Incident Debrief</option>
                <option value="OPERATIONS_REPORT">Operations Report</option>
                <option value="EQUIPMENT_JUSTIFICATION">Equipment Justification</option>
                <option value="POLICY_CIRCULAR">Policy Circular</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="APPROVED">Approved</option>
                <option value="ARCHIVED">Archived</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="DRAFT">Draft</option>
              </select>

              <button
                type="button"
                onClick={loadMemos}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Refresh Memos"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Memos Cards Grid */}
          {loadingMemos ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600" />
              <p className="text-xs">Loading Hospital Memorandums...</p>
            </div>
          ) : filteredMemos.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                No Memorandums Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No hospital memos matched your search filters. Click below to draft a new formal memo or upload a document scan.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadArchiveModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Upload / Camera Scan Memo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMemoToEdit(null);
                    setIsEditorOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Draft New Memo</span>
                </button>
                {memos.length === 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreSampleMemos}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-sky-500" />
                    <span>Restore Sample Memos</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMemos.map((memo) => {
                const hasScanOrAttachment = Boolean(memo.archivedScanImage || (memo.attachments && memo.attachments.length > 0));

                return (
                  <div
                    key={memo.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs hover:border-purple-300 dark:hover:border-purple-800 transition flex flex-col justify-between group space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                            {memo.memoNumber}
                          </span>
                          {getMemoBadge(memo.memoType)}
                          {memo.archiveSource === 'CAMERA_CAPTURE' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              <span>Camera Scan</span>
                            </span>
                          )}
                          {memo.archiveSource === 'DEVICE_UPLOAD' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-1">
                              <Upload className="w-3 h-3" />
                              <span>Uploaded File</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {memo.status === 'PUBLISHED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Published</span>
                            </span>
                          )}
                          {memo.status === 'APPROVED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                              Approved
                            </span>
                          )}
                          {memo.status === 'ARCHIVED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 flex items-center gap-1">
                              <FolderArchive className="w-3 h-3" />
                              <span>Archived</span>
                            </span>
                          )}
                          {memo.status === 'UNDER_REVIEW' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Under Review
                            </span>
                          )}
                          {memo.status === 'DRAFT' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3
                          onClick={() => setSelectedMemoForDetail(memo)}
                          className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition cursor-pointer line-clamp-2"
                        >
                          {memo.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Target: <span className="text-slate-600 dark:text-slate-300 font-medium">{memo.targetAudience}</span>
                        </p>
                      </div>

                      {/* Scanned Image / Document Thumbnail if available */}
                      {memo.archivedScanImage && (
                        <div
                          onClick={() => setSelectedMemoForScanViewer(memo)}
                          className="relative h-24 bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer group/thumb hover:ring-2 hover:ring-sky-500 transition"
                        >
                          <img
                            src={memo.archivedScanImage}
                            alt={memo.title}
                            className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-2 justify-between text-white">
                            <span className="text-[10px] font-bold flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded">
                              <Eye className="w-3 h-3" />
                              <span>Inspect Scanned Document</span>
                            </span>
                            {memo.physicalArchiveLocation && (
                              <span className="text-[10px] text-slate-300 font-mono truncate max-w-[150px]">
                                {memo.physicalArchiveLocation}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                        {memo.executiveSummary}
                      </p>

                      {memo.physicalArchiveLocation && !memo.archivedScanImage && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <FolderArchive className="w-3.5 h-3.5 text-sky-600" />
                          <span>Filing Location: <strong className="text-slate-700 dark:text-slate-300 font-medium">{memo.physicalArchiveLocation}</strong></span>
                        </div>
                      )}

                      {memo.actionRequiredOrChecklist && memo.actionRequiredOrChecklist.length > 0 && (
                        <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{memo.actionRequiredOrChecklist.length} Mandatory Clinical/IT Action Items</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="text-[11px] text-slate-400">
                        <span>By <strong>{memo.fromSender?.name || 'IT Staff'}</strong></span>
                        <span className="mx-1">•</span>
                        <span>{new Date(memo.memoDate || memo.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasScanOrAttachment && (
                          <button
                            type="button"
                            onClick={() => setSelectedMemoForScanViewer(memo)}
                            className="px-2.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                            title="Inspect high-resolution document scan / camera photo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Scan</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedMemoForDetail(memo)}
                          className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <span>View Letterhead</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMemoToEdit(memo);
                            setIsEditorOpen(true);
                          }}
                          className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          title="Edit / Refine Draft"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.id === memo.fromSender?.uid) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMemo(memo.id)}
                            className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete Memo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: OPERATIONAL REGISTERS & CSV EXPORTS */}
      {/* ============================================================== */}
      {activeTab === 'DATA_REGISTERS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Operational Registers & CSV Exports
              </h2>
              <p className="text-xs text-slate-500">
                Export raw ticket audits, equipment inventories, maintenance records, and SLA logs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Table</span>
              </button>
              <button
                type="button"
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
              type="button"
              onClick={() => setReportType('TICKETS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                reportType === 'TICKETS' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Ticket Workload Summary ({safeTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setReportType('SLA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                reportType === 'SLA' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              SLA Compliance Register
            </button>
            <button
              type="button"
              onClick={() => setReportType('ASSETS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                reportType === 'ASSETS' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Equipment Register ({safeAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setReportType('MAINTENANCE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                reportType === 'MAINTENANCE' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Preventive Maintenance ({safeMaintenance.length})
            </button>
            <button
              type="button"
              onClick={() => setReportType('INVENTORY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                reportType === 'INVENTORY' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Consumables & Spares ({safeInventory.length})
            </button>
          </div>

          {/* Table Preview */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Report Preview: {reportType}
                </h3>
                <p className="text-xs text-slate-400">
                  Generated for {systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital'} IT Operations
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
      )}

      {/* Memo Detail & Letterhead View Modal */}
      <MemoDetailModal
        memo={selectedMemoForDetail}
        isOpen={Boolean(selectedMemoForDetail)}
        onClose={() => setSelectedMemoForDetail(null)}
        currentUser={currentUser}
        systemSettings={systemSettings}
        onUpdateStatus={handleUpdateMemoStatus}
        onRefreshSettings={onRefresh}
        onEdit={(m) => {
          setSelectedMemoForDetail(null);
          setMemoToEdit(m);
          setIsEditorOpen(true);
        }}
      />

      {/* Memo Editor & AI Write-Up Modal */}
      <MemoEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setMemoToEdit(null);
        }}
        memoToEdit={memoToEdit}
        currentUser={currentUser}
        systemSettings={systemSettings}
        tickets={safeTickets}
        incidents={safeIncidents}
        onSaved={handleSavedMemo}
      />

      {/* Letterhead Upload & Customization Modal */}
      <LetterheadUploadModal
        isOpen={isLetterheadModalOpen}
        onClose={() => setIsLetterheadModalOpen(false)}
        systemSettings={systemSettings || null}
        currentUser={currentUser}
        onSettingsSaved={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* Memo Document Upload & Camera Capture Modal */}
      <MemoUploadArchiveModal
        isOpen={isUploadArchiveModalOpen}
        onClose={() => setIsUploadArchiveModalOpen(false)}
        currentUser={currentUser}
        systemSettings={systemSettings}
        onSaved={handleSavedMemo}
      />

      {/* High-Resolution Memo Scan / Attachment Viewer */}
      <MemoScanViewerModal
        memo={selectedMemoForScanViewer}
        isOpen={Boolean(selectedMemoForScanViewer)}
        onClose={() => setSelectedMemoForScanViewer(null)}
      />

    </div>
  );
};
