import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Save,
  FileText,
  AlertCircle,
  CheckCircle2,
  Send,
  Wand2,
  RefreshCw,
  Plus,
  Trash2,
  Activity,
  Layers,
  HelpCircle,
  Building,
  Shield,
  CheckSquare,
  Square,
  Users,
} from 'lucide-react';
import {
  type HospitalMemo,
  type MemoType,
  type MemoStatus,
  type Role,
  type User,
  type SystemSettings,
  type Ticket,
  type Incident,
} from '../types';
import { memoService } from '../services/memoService';
import { generateUUID } from '../services/localDatabaseService';

interface MemoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoToEdit?: HospitalMemo | null;
  currentUser: User | null;
  systemSettings?: SystemSettings | null;
  tickets?: Ticket[];
  incidents?: Incident[];
  onSaved: (memo: HospitalMemo) => void;
}

export const ROLE_TARGET_OPTIONS: { role: Role; label: string; subLabel: string; badgeColor: string }[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Administrators',
    subLabel: 'CIO, Lead Directors & System Controllers',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  {
    role: 'IT_ADMIN',
    label: 'IT Administrators',
    subLabel: 'IT Infrastructure, Systems & Database Leads',
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
  {
    role: 'IT_OFFICER',
    label: 'IT Support Officers',
    subLabel: 'Ward Technicians & Helpdesk Engineers',
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  {
    role: 'HOSPITAL_MANAGEMENT',
    label: 'Hospital Executive Management',
    subLabel: 'Medical Directorate, Administrator & Board',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  {
    role: 'DEPARTMENT_HEAD',
    label: 'Heads of Department (HODs)',
    subLabel: 'Clinical In-Charges, Unit Heads & Ward In-Charges',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  {
    role: 'STAFF_USER',
    label: 'General Staff & Ward Nurses',
    subLabel: 'Ward Nurses, Bedside Staff & Allied Healthcare',
    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  },
  {
    role: 'PROCUREMENT_OFFICER',
    label: 'Procurement & Inventory Officers',
    subLabel: 'Pharmacy Stores, Medical Supplies & Logistics',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  {
    role: 'AUDITOR',
    label: 'Compliance & Quality Auditors',
    subLabel: 'Clinical Governance, QA & Accreditation',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
];

const ALL_ROLE_KEYS: Role[] = ROLE_TARGET_OPTIONS.map((r) => r.role);

const PRESET_TOPICS = [
  {
    type: 'EXECUTIVE_IT_MEMO' as MemoType,
    title: 'Starlink Satellite WAN Failover Activation',
    topic: 'Commissioning of secondary Starlink WAN link and automated BGP routing failover for LHIMS EHR uptime',
    roles: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD'] as Role[],
    notes: 'Secondary satellite link active. Core switches auto-failover in < 4 seconds. Clinical staff must keep emergency terminals on red power outlets.',
  },
  {
    type: 'CLINICAL_ADVISORY' as MemoType,
    title: 'LHIMS EMR Downtime & Paper Fallback SOP',
    topic: 'Standard operating procedure for bedside charting, pharmacy dispensing, and ER admissions during scheduled LHIMS maintenance',
    roles: ['DEPARTMENT_HEAD', 'STAFF_USER', 'HOSPITAL_MANAGEMENT', 'IT_OFFICER'] as Role[],
    notes: 'Declare downtime if unreachable for > 5 min. Switch to yellow paper encounter binders. High-alert meds on carbon pads. Retroactive digitization within 4h after restore.',
  },
  {
    type: 'POLICY_CIRCULAR' as MemoType,
    title: 'USB & Removable Media Security Lockdown',
    topic: 'Strict prohibition of personal USB flash drives on all hospital clinical workstations and diagnostic imaging consoles',
    roles: ALL_ROLE_KEYS,
    notes: 'Kaspersky endpoint lockdown active. USB mass storage blocked to stop ransomware. Secure hospital network share (Z: drive) available for clinical PDF transfers.',
  },
  {
    type: 'EQUIPMENT_JUSTIFICATION' as MemoType,
    title: 'Datacenter UPS Batteries Emergency Requisition',
    topic: 'Urgent technical procurement justification for replacement of 8 high-rate discharge UPS battery modules in Datacenter Rack 2',
    roles: ['SUPER_ADMIN', 'IT_ADMIN', 'HOSPITAL_MANAGEMENT', 'PROCUREMENT_OFFICER'] as Role[],
    notes: 'Existing batteries swollen after 38 months of continuous service. Runtime down to 6 mins (required: 30 mins). Total estimated cost $1,850. High risk of EHR database corruption during grid blips.',
  },
  {
    type: 'OPERATIONS_REPORT' as MemoType,
    title: 'Monthly Hospital IT Operations & SLA Review',
    topic: 'Comprehensive review of monthly helpdesk tickets, 98% SLA resolution rate, ward workstation audits, and Starlink backup performance',
    roles: ALL_ROLE_KEYS,
    notes: 'Total tickets logged: 148. Average response 14 mins. Thermal barcode printers in pharmacy need roller replacements. Preventive maintenance completed on 100% of ICU terminals.',
  },
];

export const MemoEditorModal: React.FC<MemoEditorModalProps> = ({
  isOpen,
  onClose,
  memoToEdit,
  currentUser,
  systemSettings,
  tickets = [],
  incidents = [],
  onSaved,
}) => {
  const isITUser =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'IT_ADMIN' ||
    currentUser?.role === 'IT_OFFICER';

  const [memoType, setMemoType] = useState<MemoType>('EXECUTIVE_IT_MEMO');
  const [topic, setTopic] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(ALL_ROLE_KEYS);
  const [specificRecipientNotes, setSpecificRecipientNotes] = useState('');
  const [targetAudience, setTargetAudience] = useState('All Hospital Staff & User Roles (Hospital-Wide)');
  const [department, setDepartment] = useState('Hospital IT Department');
  const [rawNotes, setRawNotes] = useState('');
  const [tone, setTone] = useState<'FORMAL' | 'URGENT' | 'CLINICAL_ADVISORY' | 'EXECUTIVE' | 'EDUCATIONAL'>('FORMAL');
  const [includeLiveData, setIncludeLiveData] = useState(true);

  // Form Fields for generated/editable output
  const [memoNumber, setMemoNumber] = useState('');
  const [title, setTitle] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [backgroundAndContext, setBackgroundAndContext] = useState('');
  const [detailedFindingsOrBody, setDetailedFindingsOrBody] = useState('');
  const [actionChecklist, setActionChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [timelineOrDeadline, setTimelineOrDeadline] = useState('');
  const [contactPersonOrExtension, setContactPersonOrExtension] = useState('');
  const [recommendedDistribution, setRecommendedDistribution] = useState('');
  const [status, setStatus] = useState<MemoStatus>('PUBLISHED');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const hospitalName = systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital';

  const formatAudienceString = (roles: Role[], notes: string) => {
    if (roles.length === ALL_ROLE_KEYS.length) {
      return notes.trim()
        ? `All Hospital Staff & Roles (Specific: ${notes.trim()})`
        : 'All Hospital Staff & User Roles (Hospital-Wide)';
    }
    if (roles.length === 0) {
      return notes.trim() || 'Unspecified Audience';
    }
    const roleNames = roles
      .map((r) => ROLE_TARGET_OPTIONS.find((opt) => opt.role === r)?.label || r)
      .join(', ');
    return notes.trim() ? `${roleNames} (Specific: ${notes.trim()})` : roleNames;
  };

  const handleToggleRole = (role: Role) => {
    const nextRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    setSelectedRoles(nextRoles);
    setTargetAudience(formatAudienceString(nextRoles, specificRecipientNotes));
  };

  const handleSelectAllRoles = () => {
    setSelectedRoles(ALL_ROLE_KEYS);
    setTargetAudience(formatAudienceString(ALL_ROLE_KEYS, specificRecipientNotes));
  };

  const handleSelectRolePreset = (roles: Role[]) => {
    setSelectedRoles(roles);
    setTargetAudience(formatAudienceString(roles, specificRecipientNotes));
  };

  const handleSpecificNotesChange = (note: string) => {
    setSpecificRecipientNotes(note);
    setTargetAudience(formatAudienceString(selectedRoles, note));
  };

  // Populate state when editing
  useEffect(() => {
    if (memoToEdit) {
      setMemoType(memoToEdit.memoType);
      setTitle(memoToEdit.title);
      setMemoNumber(memoToEdit.memoNumber);
      setTargetAudience(memoToEdit.targetAudience);
      if (memoToEdit.targetRoles && memoToEdit.targetRoles.length > 0) {
        setSelectedRoles(memoToEdit.targetRoles);
      } else {
        setSelectedRoles(ALL_ROLE_KEYS);
      }
      setDepartment(memoToEdit.department);
      setExecutiveSummary(memoToEdit.executiveSummary);
      setBackgroundAndContext(memoToEdit.backgroundAndContext);
      setDetailedFindingsOrBody(memoToEdit.detailedFindingsOrBody);
      setActionChecklist(memoToEdit.actionRequiredOrChecklist || []);
      setTimelineOrDeadline(memoToEdit.timelineOrDeadline || '');
      setContactPersonOrExtension(memoToEdit.contactPersonOrExtension || '');
      setRecommendedDistribution(memoToEdit.recommendedDistribution || '');
      setStatus(memoToEdit.status);
    } else {
      // Defaults for new memo
      const year = new Date().getFullYear();
      const rand = Math.floor(100 + Math.random() * 900);
      setMemoNumber(`MEMO-${year}-${rand}`);
      setTitle('');
      setTopic('');
      setRawNotes('');
      setSelectedRoles(ALL_ROLE_KEYS);
      setSpecificRecipientNotes('');
      setTargetAudience('All Hospital Staff & User Roles (Hospital-Wide)');
      setExecutiveSummary('');
      setBackgroundAndContext('');
      setDetailedFindingsOrBody('');
      setActionChecklist([]);
      setTimelineOrDeadline('Effective immediately upon publication.');
      setContactPersonOrExtension(`${currentUser?.fullName || 'Courage Kay'} — IT Helpdesk Ext. 2101`);
      setRecommendedDistribution('All Clinical Noticeboards, Ward Supervisors, IT Helpdesk Archive');
      setStatus('PUBLISHED');
    }
  }, [memoToEdit, isOpen, currentUser]);

  if (!isOpen) return null;

  if (!isITUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Access Restricted
          </h3>
          <p className="text-xs text-slate-500">
            Only Super Administrators and IT Personnel have permission to author, edit, and publish hospital memorandums.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold cursor-pointer hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleApplyPreset = (preset: typeof PRESET_TOPICS[0]) => {
    setMemoType(preset.type);
    setTopic(preset.topic);
    setSelectedRoles(preset.roles);
    setTargetAudience(formatAudienceString(preset.roles, specificRecipientNotes));
    setRawNotes(preset.notes);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setActionChecklist([...actionChecklist, newChecklistItem.trim()]);
    setNewChecklistItem('');
  };

  const handleRemoveChecklistItem = (index: number) => {
    setActionChecklist(actionChecklist.filter((_, i) => i !== index));
  };

  const handleGenerateAiMemo = async (specificRefine?: string) => {
    if (!topic && !rawNotes && !specificRefine && !title) {
      setErrorMessage('Please provide a Topic or some notes for the AI write-up.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);

    try {
      const openTicketsCount = tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length;
      const criticalIncidentsCount = incidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'POST_MORTEM').length;

      const aiResponse = await memoService.generateAiMemo({
        memoType,
        topic: topic || title,
        targetAudience,
        targetRoles: selectedRoles,
        department,
        rawNotes,
        tone,
        hospitalName,
        senderName: currentUser?.fullName || 'Courage Kay',
        senderTitle: currentUser?.jobTitle || 'Super Administrator & CIO',
        includeLiveData,
        refineInstruction: specificRefine || refinePrompt,
        existingDraft: title
          ? {
              title,
              executiveSummary,
              backgroundAndContext,
              detailedFindingsOrBody,
              actionRequiredOrChecklist: actionChecklist,
            }
          : undefined,
      });

      if (aiResponse.title) setTitle(aiResponse.title);
      if (aiResponse.memoNumber && !memoToEdit) setMemoNumber(aiResponse.memoNumber);
      if (aiResponse.targetAudience) setTargetAudience(aiResponse.targetAudience);
      if (aiResponse.targetRoles && aiResponse.targetRoles.length > 0) setSelectedRoles(aiResponse.targetRoles);
      if (aiResponse.executiveSummary) setExecutiveSummary(aiResponse.executiveSummary);
      if (aiResponse.backgroundAndContext) setBackgroundAndContext(aiResponse.backgroundAndContext);
      if (aiResponse.detailedFindingsOrBody) setDetailedFindingsOrBody(aiResponse.detailedFindingsOrBody);
      if (aiResponse.actionRequiredOrChecklist) setActionChecklist(aiResponse.actionRequiredOrChecklist);
      if (aiResponse.timelineOrDeadline) setTimelineOrDeadline(aiResponse.timelineOrDeadline);
      if (aiResponse.contactPersonOrExtension) setContactPersonOrExtension(aiResponse.contactPersonOrExtension);
      if (aiResponse.recommendedDistribution) setRecommendedDistribution(aiResponse.recommendedDistribution);

      setGenerationSuccess(true);
      setTimeout(() => setGenerationSuccess(false), 4000);
      setRefinePrompt('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate AI memo write-up.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveMemo = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter a Memo Title.');
      return;
    }
    if (!executiveSummary.trim() && !detailedFindingsOrBody.trim()) {
      setErrorMessage('Please generate or write the memo content.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const memoToSave: HospitalMemo = {
        id: memoToEdit ? memoToEdit.id : `memo-${generateUUID().substring(0, 8)}`,
        memoNumber: memoNumber || `MEMO-${new Date().getFullYear()}-001`,
        title: title.trim(),
        memoType,
        department: department.trim(),
        targetAudience: targetAudience.trim(),
        targetRoles: selectedRoles,
        fromSender: {
          uid: currentUser?.id || 'usr-system',
          name: currentUser?.fullName || 'Courage Kay',
          role: currentUser?.role || 'SUPER_ADMIN',
          title: currentUser?.jobTitle || 'Hospital IT Operations',
        },
        executiveSummary: executiveSummary.trim(),
        backgroundAndContext: backgroundAndContext.trim(),
        detailedFindingsOrBody: detailedFindingsOrBody.trim(),
        actionRequiredOrChecklist: actionChecklist,
        timelineOrDeadline: timelineOrDeadline.trim(),
        contactPersonOrExtension: contactPersonOrExtension.trim(),
        recommendedDistribution: recommendedDistribution.trim(),
        status,
        isAiGenerated: true,
        aiPromptContext: topic || rawNotes,
        createdAt: memoToEdit?.createdAt || now,
        updatedAt: now,
        approvedBy:
          status === 'PUBLISHED' || status === 'APPROVED'
            ? {
                name: currentUser?.fullName || 'Courage Kay',
                title: currentUser?.jobTitle || 'Super Administrator & CIO',
                approvedAt: now,
              }
            : undefined,
      };

      const saved = await memoService.saveMemo(memoToSave, currentUser);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save memo');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{memoToEdit ? 'Edit Hospital Memo & Report' : 'AI Hospital Memo & Report Studio'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Gemini 3.8 Write-Up Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Draft, format, and publish authoritative hospital memorandums, executive debriefs, and clinical advisories.
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

        {/* Content Body: Two Columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: AI PROMPTING & SPECIFICATIONS (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>AI Prompt Presets</span>
                </span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                  Click to auto-fill
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_TOPICS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 hover:border-purple-400 text-purple-950 dark:text-purple-200 transition cursor-pointer shadow-2xs text-left truncate max-w-full"
                    title={preset.topic}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Type & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Document Type
                </label>
                <select
                  value={memoType}
                  onChange={(e) => setMemoType(e.target.value as MemoType)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                >
                  <option value="EXECUTIVE_IT_MEMO">Executive IT Memo</option>
                  <option value="CLINICAL_ADVISORY">Clinical Ward Advisory</option>
                  <option value="INCIDENT_DEBRIEF">Incident Debrief & Post-Mortem</option>
                  <option value="OPERATIONS_REPORT">Operations Review Report</option>
                  <option value="EQUIPMENT_JUSTIFICATION">Equipment & Procurement Justification</option>
                  <option value="MAINTENANCE_DOWNTIME">Scheduled Downtime Notice</option>
                  <option value="POLICY_CIRCULAR">Policy & Cybersecurity Circular</option>
                  <option value="GENERAL_MEMO">General Hospital Memo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Issuing Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Target Audience User Role Checkboxes */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-600" />
                  <span>Target Audience / User Roles ({selectedRoles.length}/{ALL_ROLE_KEYS.length} Selected)</span>
                </label>

                {/* Role Quick Selector Preset Pills */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={handleSelectAllRoles}
                    className="px-2 py-0.5 rounded-md font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-200 cursor-pointer transition"
                  >
                    All Roles
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRolePreset(['DEPARTMENT_HEAD', 'STAFF_USER', 'HOSPITAL_MANAGEMENT'])}
                    className="px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200 cursor-pointer transition"
                  >
                    Clinical & Wards
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRolePreset(['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'])}
                    className="px-2 py-0.5 rounded-md font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-200 cursor-pointer transition"
                  >
                    IT Team
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRolePreset(['SUPER_ADMIN', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD'])}
                    className="px-2 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 cursor-pointer transition"
                  >
                    Executives & HODs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRolePreset([])}
                    className="px-2 py-0.5 rounded-md font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Checkbox Grid for All 8 Roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {ROLE_TARGET_OPTIONS.map((opt) => {
                  const isChecked = selectedRoles.includes(opt.role);
                  return (
                    <div
                      key={opt.role}
                      onClick={() => handleToggleRole(opt.role)}
                      className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs cursor-pointer select-none transition ${
                        isChecked
                          ? 'bg-white dark:bg-slate-900 border-sky-400 dark:border-sky-500 shadow-2xs'
                          : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-65 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by container onClick
                        className="mt-0.5 w-3.5 h-3.5 text-sky-600 rounded cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {opt.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {opt.subLabel}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Specific Recipient Notes or Wards */}
              <div>
                <input
                  type="text"
                  value={specificRecipientNotes}
                  onChange={(e) => handleSpecificNotesChange(e.target.value)}
                  placeholder="Optional specific wards/departments (e.g., ICU, Emergency, Pharmacy, NICU)"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                />
              </div>

              {/* Formatted Target Audience Output Preview */}
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-start gap-1 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">TO Header:</span>
                <span className="truncate">{targetAudience}</span>
              </div>
            </div>

            {/* Topic & Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Topic / Subject Focus
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Fiber Line Cut: Activating Emergency Starlink WAN for LHIMS"
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
              />
            </div>

            {/* Raw Notes / Bullet Points */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center justify-between">
                <span>Key Talking Points or Raw Bullet Points</span>
                <span className="text-[10px] text-slate-400 font-normal">AI will expand professionally</span>
              </label>
              <textarea
                rows={4}
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
                placeholder="- Incident happened at 14:00 due to municipal road grading
- LHIMS switched to Starlink satellite within 4 seconds
- Nurses should not unplug emergency red outlets
- Autoclave machines must use separate generator line"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Tone & Live Data Switch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Drafting Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                >
                  <option value="FORMAL">Formal & Administrative</option>
                  <option value="CLINICAL_ADVISORY">Clinical Patient Safety</option>
                  <option value="URGENT">Urgent & Time-Sensitive</option>
                  <option value="EXECUTIVE">Executive Directorate</option>
                  <option value="EDUCATIONAL">Educational & Informational</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLiveData}
                    onChange={(e) => setIncludeLiveData(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                  />
                  <span>Inject Live HITOMS Metrics</span>
                </label>
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGenerateAiMemo()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Hospital Memo Write-Up with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Draft Full Memo with Gemini AI</span>
                </>
              )}
            </button>

            {generationSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>AI Write-up complete! Review and refine the document on the right.</span>
              </div>
            )}

            {/* AI Refinement Quick Bar */}
            {title && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Quick AI Polish Actions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGenerateAiMemo('Make tone more authoritative, concise, and formal.')}
                    disabled={isGenerating}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Make More Formal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiMemo('Add a detailed clinical ward action checklist with 4-5 items.')}
                    disabled={isGenerating}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Add Ward Checklist
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiMemo('Condense executive summary so it fits cleanly on ward noticeboards.')}
                    disabled={isGenerating}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Condense for Noticeboard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiMemo('Emphasize patient data privacy, cybersecurity, and LHIMS login guidelines.')}
                    disabled={isGenerating}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Emphasize Cyber Security
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: GENERATED MEMO EDITING & LETTERHEAD PREVIEW (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Subject Title & Ref # */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Memorandum Subject Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="INTERNAL MEMORANDUM: ..."
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Memo Ref #
                </label>
                <input
                  type="text"
                  value={memoNumber}
                  onChange={(e) => setMemoNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-sky-600 dark:text-sky-400"
                />
              </div>
            </div>

            {/* Executive Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Executive Summary (Directorate Synopsis)
              </label>
              <textarea
                rows={3}
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                placeholder="High-level synopsis of the directive or findings..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Background & Context */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                1. Background & Operational Context
              </label>
              <textarea
                rows={3}
                value={backgroundAndContext}
                onChange={(e) => setBackgroundAndContext(e.target.value)}
                placeholder="Contextual narrative explaining why this memo is issued..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Detailed Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                2. Technical & Operational Directives (Markdown Supported)
              </label>
              <textarea
                rows={6}
                value={detailedFindingsOrBody}
                onChange={(e) => setDetailedFindingsOrBody(e.target.value)}
                placeholder="### 1. Procedures&#10;Write detailed technical instructions, procedures, or debrief findings..."
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Action Checklist */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500">
                3. Mandatory Action Checklist
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {actionChecklist.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold text-[9px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200">{item}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklistItem())}
                  placeholder="Add another mandatory action item..."
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Timeline, Contact, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Timeline / Deadline
                </label>
                <input
                  type="text"
                  value={timelineOrDeadline}
                  onChange={(e) => setTimelineOrDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  IT Support Contact
                </label>
                <input
                  type="text"
                  value={contactPersonOrExtension}
                  onChange={(e) => setContactPersonOrExtension(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Publication Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MemoStatus)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                >
                  <option value="PUBLISHED">Published & Active</option>
                  <option value="APPROVED">Approved by Directorate</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            {errorMessage ? (
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                Author: <strong>{currentUser?.fullName || 'Courage Kay'}</strong> ({currentUser?.jobTitle || 'IT Operations'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveMemo}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Publish Memorandum</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
