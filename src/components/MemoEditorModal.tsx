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
  const [targetAudience, setTargetAudience] = useState('HOSPITAL MANAGER');
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

  // Editable Document Layout Studio fields
  const [headerUnitName, setHeaderUnitName] = useState('');
  const [headerEmail, setHeaderEmail] = useState('');
  const [headerPhone, setHeaderPhone] = useState('');
  const [documentTypeText, setDocumentTypeText] = useState('MEMO');
  const [officerSignature, setOfficerSignature] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerTitle, setOfficerTitle] = useState('');
  const [memoDate, setMemoDate] = useState('');
  const [editorMode, setEditorMode] = useState<'FORM' | 'WYSIWYG'>('WYSIWYG');
  const [memoLogo, setMemoLogo] = useState('');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMemoLogo(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [lastInitializedMemoId, setLastInitializedMemoId] = useState<string | undefined>(undefined);
  const [isSignPadOpen, setIsSignPadOpen] = useState(false);
  const [signMethod, setSignMethod] = useState<'DRAW' | 'UPLOAD' | 'TYPE'>('DRAW');
  const [cursiveText, setCursiveText] = useState('');
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a'; // dark blue signature ink
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
      e.preventDefault();
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleInsertTable = () => {
    const tableTemplate = `\n| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n`;
    setExecutiveSummary(prev => prev + tableTemplate);
  };
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
    if (!isOpen) {
      setLastInitializedMemoId(undefined);
      return;
    }

    const currentMemoId = memoToEdit ? memoToEdit.id : 'NEW_MEMO';
    if (lastInitializedMemoId === currentMemoId) {
      return;
    }

    setLastInitializedMemoId(currentMemoId);

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
      let loadedBody = memoToEdit.executiveSummary || '';
      if (memoToEdit.backgroundAndContext && !loadedBody.includes(memoToEdit.backgroundAndContext)) {
        loadedBody += `\n\n### Background & Context\n${memoToEdit.backgroundAndContext}`;
      }
      if (memoToEdit.detailedFindingsOrBody && !loadedBody.includes(memoToEdit.detailedFindingsOrBody)) {
        loadedBody += `\n\n${memoToEdit.detailedFindingsOrBody}`;
      }
      setExecutiveSummary(loadedBody.trim());
      setBackgroundAndContext('');
      setDetailedFindingsOrBody('');
      setActionChecklist(memoToEdit.actionRequiredOrChecklist || []);
      setTimelineOrDeadline(memoToEdit.timelineOrDeadline || '');
      setContactPersonOrExtension(memoToEdit.contactPersonOrExtension || '');
      setRecommendedDistribution(memoToEdit.recommendedDistribution || '');
      setStatus(memoToEdit.status);

      // Initialize Studio Header/Footer fields
      setHeaderUnitName(memoToEdit.headerUnitName || systemSettings?.letterheadSubTitle || 'I.T Support Unit');
      setHeaderEmail(memoToEdit.headerEmail || systemSettings?.contactEmail || 'send2smthit@gmail.com');
      setHeaderPhone(memoToEdit.headerPhone || systemSettings?.contactPhone || '055 272 2289');
      setDocumentTypeText(memoToEdit.documentTypeText || (memoToEdit.memoType === 'OPERATIONS_REPORT' ? 'REPORT' : 'MEMO'));
      setOfficerSignature(memoToEdit.officerSignature || currentUser?.signature || '');
      if ((memoToEdit.officerSignature || currentUser?.signature) && !(memoToEdit.officerSignature || currentUser?.signature || '').startsWith('data:image/')) {
        setCursiveText(memoToEdit.officerSignature || currentUser?.signature || '');
      } else {
        setCursiveText('');
      }
      setOfficerName(memoToEdit.officerName || memoToEdit.fromSender?.name || currentUser?.fullName || 'Courage Kekesi');
      const isCourageEdit = (currentUser?.fullName || '').toLowerCase().includes('courage');
      const defaultTitleEdit = isCourageEdit ? 'Senior IT Officer' : (currentUser?.jobTitle || 'Senior IT Officer');
      setOfficerTitle(memoToEdit.officerTitle || memoToEdit.fromSender?.title || defaultTitleEdit);
      
      const formatDdMmYyyy = (d: Date = new Date()) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };
      setMemoDate(memoToEdit.memoDate || formatDdMmYyyy(new Date(memoToEdit.createdAt || Date.now())));
      setMemoLogo(memoToEdit.hospitalLogo || systemSettings?.hospitalLogo || '');
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
      setTargetAudience('HOSPITAL MANAGER');
      setExecutiveSummary('');
      setBackgroundAndContext('');
      setDetailedFindingsOrBody('');
      setActionChecklist([]);
      setTimelineOrDeadline('Effective immediately upon publication.');
      setContactPersonOrExtension(`${currentUser?.fullName || 'Courage Kekesi'} — IT Helpdesk Ext. 2101`);
      setRecommendedDistribution('All Clinical Noticeboards, Ward Supervisors, IT Helpdesk Archive');
      setStatus('PUBLISHED');

      // Initialize defaults for Studio Document Editor fields
      setHeaderUnitName(systemSettings?.letterheadSubTitle || 'I.T Support Unit');
      setHeaderEmail(systemSettings?.contactEmail || 'send2smthit@gmail.com');
      setHeaderPhone(systemSettings?.contactPhone || '055 272 2289');
      setDocumentTypeText('MEMO');
      setOfficerSignature(currentUser?.signature || '');
      if (currentUser?.signature && !currentUser.signature.startsWith('data:image/')) {
        setCursiveText(currentUser.signature);
      } else {
        setCursiveText('');
      }
      setOfficerName(currentUser?.fullName || 'Courage Kekesi');
      const isCourageNew = (currentUser?.fullName || '').toLowerCase().includes('courage');
      setOfficerTitle(isCourageNew ? 'Senior IT Officer' : (currentUser?.jobTitle || 'Senior IT Officer'));
      
      const formatDdMmYyyy = (d: Date = new Date()) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };
      setMemoDate(formatDdMmYyyy());
      setMemoLogo(systemSettings?.hospitalLogo || '');
    }
  }, [memoToEdit, isOpen, currentUser, systemSettings, lastInitializedMemoId]);

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
      
      let fullBody = '';
      if (aiResponse.executiveSummary) {
        fullBody += aiResponse.executiveSummary + '\n\n';
      }
      if (aiResponse.backgroundAndContext) {
        fullBody += `### Background & Context\n${aiResponse.backgroundAndContext}\n\n`;
      }
      if (aiResponse.detailedFindingsOrBody) {
        fullBody += aiResponse.detailedFindingsOrBody;
      }
      setExecutiveSummary(fullBody.trim());
      setBackgroundAndContext('');
      setDetailedFindingsOrBody('');
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
    if (!executiveSummary.trim()) {
      setErrorMessage('Please write or generate the memo content.');
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
        headerUnitName: headerUnitName.trim(),
        headerEmail: headerEmail.trim(),
        headerPhone: headerPhone.trim(),
        documentTypeText: documentTypeText.trim(),
        officerSignature: officerSignature.trim(),
        officerName: officerName.trim(),
        officerTitle: officerTitle.trim(),
        memoDate: memoDate.trim(),
        hospitalLogo: memoLogo,
      };

      const saved = await memoService.saveMemo(memoToSave, currentUser);

      // Save global settings updates so this letterhead becomes the official default one
      try {
        if (systemSettings && currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'IT_ADMIN')) {
          const { settingsService } = await import('../services/settingsService');
          await settingsService.updateSettings({
            letterheadSubTitle: headerUnitName.trim(),
            contactEmail: headerEmail.trim(),
            contactPhone: headerPhone.trim(),
            hospitalLogo: memoLogo,
          }, currentUser);
        }
      } catch (settingsErr) {
        console.warn('[MemoEditorModal] Failed to auto-save global letterhead settings:', settingsErr);
      }

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
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{memoToEdit ? 'Edit Hospital Memo & Report' : 'Hospital Official Memorandum Studio'}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Draft, format, and publish official hospital memorandums and clinical advisories.
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
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  <span>Topic & Directive Presets</span>
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
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
                  <span>Inject Live {systemSettings?.systemName || 'HITOMS'} Metrics</span>
                </label>
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGenerateAiMemo()}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Drafting Official Memorandum...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Auto-Draft Official Memo</span>
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
          <div className="lg:col-span-7 space-y-4 flex flex-col min-h-0">
            
            {/* Toggle Editor Mode Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 shrink-0">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Document Studio Workspace
              </label>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 font-sans">
                <button
                  type="button"
                  onClick={() => setEditorMode('WYSIWYG')}
                  className={`px-3 py-1 rounded-md text-[10px] sm:text-[11px] font-extrabold transition cursor-pointer ${
                    editorMode === 'WYSIWYG'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Studio Sheet (WYSIWYG)
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('FORM')}
                  className={`px-3 py-1 rounded-md text-[10px] sm:text-[11px] font-extrabold transition cursor-pointer ${
                    editorMode === 'FORM'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Standard Form
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {editorMode === 'WYSIWYG' ? (
                /* ========================================== */
                /* MODE A: IMMERSIVE STUDIO SHEET VIEW (WYSIWYG) */
                /* ========================================== */
                <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-10 text-slate-900 font-serif space-y-6 max-w-2xl mx-auto dark:bg-white dark:text-slate-900">
                  
                  {/* Letterhead Header Section */}
                  <div className="border-b-2 border-slate-900 pb-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      
                      {/* Left: System Logo only (without additional texts underneath) */}
                      <div className="flex flex-col items-start text-left max-w-[150px]">
                        <input
                          type="file"
                          id="memo-logo-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                        <label htmlFor="memo-logo-upload" className="cursor-pointer block relative group">
                          {memoLogo ? (
                            <img
                              src={memoLogo}
                              alt="Hospital Logo"
                              className="max-w-[140px] max-h-18 object-contain rounded border-2 border-dashed border-sky-400 bg-white hover:border-sky-600 transition"
                              title="Click to change hospital logo image"
                            />
                          ) : (
                            /* Native high-fidelity HTML/CSS reconstruction of Proposed Logo2 as interactive fallback */
                            <div className="border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-lg p-1.5 bg-white text-center font-sans max-w-[80px] shadow-2xs transition flex flex-col items-center justify-center gap-1.5">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Left: Catholic Health Circle Emblem */}
                                <div className="w-4 h-4 shrink-0">
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    <circle cx="50" cy="50" r="46" fill="none" stroke="#047857" strokeWidth="4" />
                                    <circle cx="50" cy="50" r="38" fill="#f8fafc" stroke="#dc2626" strokeWidth="2" />
                                    <path d="M44 22 h12 v18 h18 v12 h-18 v22 h-12 v-22 h-18 v-12 h18 z" fill="#dc2626" />
                                    <circle cx="50" cy="50" r="7" fill="#047857" />
                                    <path d="M50 45 v10 M45 50 h10" stroke="#ffffff" strokeWidth="2" />
                                  </svg>
                                </div>

                                {/* Divider */}
                                <div className="h-4 w-[1px] bg-slate-400"></div>

                                {/* Right: St. Mary Theresa Portrait fallback */}
                                <div className="w-4 h-4 shrink-0 rounded bg-slate-100 border border-slate-300 overflow-hidden relative">
                                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-200 opacity-40"></div>
                                  <svg viewBox="0 0 40 50" className="w-full h-full z-10">
                                    <circle cx="20" cy="18" r="10" fill="none" stroke="#d97706" strokeWidth="1.5" />
                                    <path d="M10 22 c0 -10 6 -14 10 -14 s10 4 10 14 c0 6 -1 16 -3 18 h-14 z" fill="#1e293b" />
                                    <ellipse cx="20" cy="20" rx="6" ry="8" fill="#ffedd5" />
                                  </svg>
                                </div>
                              </div>
                              
                              <div className="text-[6px] font-sans font-bold text-sky-600 bg-sky-50 px-0.5 py-0.2 rounded uppercase tracking-wider">
                                Upload Logo
                              </div>
                            </div>
                          )}
                        </label>
                      </div>

                      {/* Right: Editable Unit Name, Email & Telephone */}
                      <div className="text-left sm:text-right space-y-1 font-sans flex-1 max-w-xs sm:ml-auto">
                        <input
                          type="text"
                          value={headerUnitName}
                          onChange={(e) => setHeaderUnitName(e.target.value)}
                          placeholder="DEPARTMENT UNIT NAME"
                          className="text-left sm:text-right bg-transparent font-bold border-b border-transparent hover:bg-slate-100 hover:border-slate-300 focus:bg-slate-100 focus:border-sky-500 rounded px-1.5 py-0.5 text-xs text-slate-900 w-full focus:outline-none"
                          title="Click to edit Unit Name on Letterhead"
                        />
                        <div className="flex items-center justify-start sm:justify-end gap-1 text-[10px] text-slate-700">
                          <span className="font-semibold shrink-0">Tel:</span>
                          <input
                            type="text"
                            value={headerPhone}
                            onChange={(e) => setHeaderPhone(e.target.value)}
                            placeholder="055 272 2289"
                            className="text-left sm:text-right bg-transparent border-b border-transparent hover:bg-slate-100 hover:border-slate-300 focus:bg-slate-100 focus:border-sky-500 rounded px-1 w-28 focus:outline-none text-slate-800 font-medium"
                          />
                        </div>
                        <div className="flex items-center justify-start sm:justify-end gap-1 text-[10px] text-slate-700">
                          <span className="font-semibold shrink-0">E-mail:</span>
                          <input
                            type="text"
                            value={headerEmail}
                            onChange={(e) => setHeaderEmail(e.target.value)}
                            placeholder="send2smthit@gmail.com"
                            className="text-left sm:text-right bg-transparent border-b border-transparent hover:bg-slate-100 hover:border-slate-300 focus:bg-slate-100 focus:border-sky-500 rounded px-1 w-40 focus:outline-none text-slate-800 font-medium"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Content below header in Times New Roman */}
                  <div style={{ fontFamily: "'Times New Roman', Times, serif" }} className="space-y-6 text-slate-900">
                    {/* Centered Document Type Header */}
                    <div className="text-center pt-1 pb-2">
                      <input
                        type="text"
                        value={documentTypeText}
                        onChange={(e) => setDocumentTypeText(e.target.value)}
                        placeholder="MEMORANDUM"
                        className="text-center text-2xl sm:text-3xl font-serif font-black tracking-widest uppercase bg-transparent hover:bg-slate-100 focus:bg-slate-100 p-1 w-56 focus:outline-none text-slate-950"
                        title="Document type title (e.g. MEMO, REPORT)"
                      />
                    </div>

                    {/* Metadata block TO, DATE, SUBJECT */}
                    <div className="space-y-2 text-xs sm:text-sm border-b border-slate-300 pb-4 text-slate-900" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                      <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-center">
                        <span className="font-bold text-slate-950 text-left">TO</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold shrink-0">:</span>
                          <input
                            type="text"
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            placeholder="RECIPIENTS"
                            className="bg-transparent hover:bg-slate-100 focus:bg-slate-100 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide text-slate-950 w-full focus:outline-none"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-center" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                        <span className="font-bold text-slate-950 text-left">DATE</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold shrink-0">:</span>
                          <input
                            type="text"
                            value={memoDate}
                            onChange={(e) => setMemoDate(e.target.value)}
                            placeholder="DD/MM/YYYY"
                            className="bg-transparent hover:bg-slate-100 focus:bg-slate-100 px-1.5 py-0.5 rounded text-slate-900 w-full focus:outline-none font-medium"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-center">
                        <span className="font-bold text-slate-950 text-left">SUBJECT</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold shrink-0">:</span>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="SUBJECT TITLE"
                            className="bg-transparent hover:bg-slate-100 focus:bg-slate-100 px-1.5 py-0.5 rounded font-black uppercase text-slate-950 underline decoration-2 underline-offset-2 w-full focus:outline-none"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Body Content */}
                    <div className="space-y-4 text-xs sm:text-sm text-left">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between pb-1">
                          <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider">
                            Document Body / Content *
                          </label>
                          <button
                            type="button"
                            onClick={handleInsertTable}
                            className="flex items-center gap-1 text-[10px] font-sans font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-slate-700 px-2 py-1 rounded transition border border-slate-200 dark:border-slate-700 cursor-pointer shadow-3xs"
                            title="Click to insert a markdown table grid into the body text"
                          >
                            <svg className="w-3 h-3 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h18M3 14h18m-9-4v8m-6-8v8m12-8v8" />
                            </svg>
                            <span>Insert Table Grid</span>
                          </button>
                        </div>
                        <textarea
                          value={executiveSummary}
                          onChange={(e) => setExecutiveSummary(e.target.value)}
                          placeholder="Write the primary memorandum directives or content body here... You can insert beautiful markdown tables typing '| Header 1 | Header 2 |' or clicking the helper button above!"
                          rows={16}
                          className="w-full bg-transparent hover:bg-slate-50 focus:bg-slate-50 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded p-2 focus:outline-none font-serif text-xs sm:text-sm leading-relaxed text-slate-900 text-justify resize-y"
                        />
                      </div>
                    </div>

                    {/* Officer Sign Block */}
                    <div className="pt-4 text-left space-y-3 font-serif text-slate-900">
                      <p className="text-xs sm:text-sm">Thank you.</p>

                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-sans font-bold text-slate-400 uppercase tracking-wider">
                          Officer Signature (Draw Pad / Device Upload)
                        </label>
                        <div className="relative group w-48 border-b border-dashed border-slate-300 pb-1.5 cursor-pointer" onClick={() => setIsSignPadOpen(true)}>
                          {officerSignature ? (
                            officerSignature.startsWith('data:image/') ? (
                              <img
                                src={officerSignature}
                                alt="Signature"
                                className="max-h-12 max-w-[180px] object-contain block hover:opacity-80 transition"
                                title="Click to change or redraw signature"
                              />
                            ) : (
                              <span
                                className="text-xl sm:text-2xl text-blue-800 dark:text-blue-900 font-serif italic tracking-wide font-black"
                                style={{ fontFamily: "'Dancing Script', 'Cursive', 'Brush Script MT', serif" }}
                                title="Click to change or draw signature"
                              >
                                {officerSignature}
                              </span>
                            )
                          ) : (
                            <div className="text-[10px] text-slate-400 hover:text-slate-600 transition flex items-center gap-1 py-2">
                              <svg className="w-3.5 h-3.5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              <span>Click to Sign Document</span>
                            </div>
                          )}
                          <span className="absolute right-0 bottom-0 text-[8px] font-sans font-bold text-sky-600 bg-sky-50 px-1 rounded opacity-0 group-hover:opacity-100 transition">EDIT SIGN</span>
                        </div>
                        <div className="space-y-0.5">
                          <input
                            type="text"
                            value={officerName}
                            onChange={(e) => setOfficerName(e.target.value)}
                            placeholder="Officer Full Name"
                            className="bg-transparent hover:bg-slate-100 focus:bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-950 text-xs sm:text-sm focus:outline-none w-56 block text-left"
                          />
                          <input
                            type="text"
                            value={officerTitle}
                            onChange={(e) => setOfficerTitle(e.target.value)}
                            placeholder="Rank or Grade"
                            className="bg-transparent hover:bg-slate-100 focus:bg-slate-100 px-1 py-0.5 rounded text-slate-800 text-[10px] sm:text-xs font-semibold focus:outline-none w-56 block text-left"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Letterhead Footer */}
                    <div className="pt-6 border-t border-slate-200 text-center">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                        {systemSettings?.letterheadFooterText || 'ST. MARY THERESA CATHOLIC HOSPITAL — DEPARTMENT OF INFORMATION TECHNOLOGY'}
                      </p>
                    </div>
                  </div>

                </div>
              ) : (
                /* ========================================== */
                /* MODE B: STANDARD STRUCTURED FORM INPUTS */
                /* ========================================== */
                <div className="space-y-4">
                  {/* Subject Title & Ref # */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        Memorandum Subject Title *
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

                  {/* Document Body / Content */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Document Body / Content *
                    </label>
                    <textarea
                      rows={10}
                      value={executiveSummary}
                      onChange={(e) => setExecutiveSummary(e.target.value)}
                      placeholder="Write the primary memorandum directives or content body here... You can use markdown and tables too!"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-serif leading-relaxed resize-y"
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
              )}
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

      {isSignPadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Digital Signature Pad
              </h3>
              <button
                type="button"
                onClick={() => setIsSignPadOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Methods tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 pb-1.5 gap-2">
              <button
                type="button"
                onClick={() => setSignMethod('DRAW')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  signMethod === 'DRAW'
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setSignMethod('UPLOAD')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  signMethod === 'UPLOAD'
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Upload Device Image
              </button>
              <button
                type="button"
                onClick={() => setSignMethod('TYPE')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  signMethod === 'TYPE'
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Type Cursive
              </button>
            </div>

            {/* DRAW TAB */}
            {signMethod === 'DRAW' && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500">
                  Draw your official signature directly inside the grid below using your mouse or touch screen:
                </p>
                <div className="border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950">
                  <canvas
                    ref={canvasRef}
                    width={450}
                    height={160}
                    className="w-full bg-white dark:bg-slate-950 cursor-crosshair touch-none block"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                  >
                    Clear Canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const canvas = canvasRef.current;
                      if (canvas) {
                        const dataUrl = canvas.toDataURL();
                        setOfficerSignature(dataUrl);
                        setIsSignPadOpen(false);
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500 text-xs font-bold cursor-pointer"
                  >
                    Save Drawing
                  </button>
                </div>
              </div>
            )}

            {/* UPLOAD TAB */}
            {signMethod === 'UPLOAD' && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500">
                  Select an image file of your signature (e.g., png, jpg, svg) from your local device:
                </p>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 text-center bg-slate-50 dark:bg-slate-950">
                  <input
                    type="file"
                    id="sig-image-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setOfficerSignature(event.target.result as string);
                            setIsSignPadOpen(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label htmlFor="sig-image-upload" className="cursor-pointer block space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto text-slate-500">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-sky-600 block">Choose Signature Image File</span>
                    <span className="text-[10px] text-slate-400 block">PNG with transparent background is recommended</span>
                  </label>
                </div>
              </div>
            )}

            {/* TYPE TAB */}
            {signMethod === 'TYPE' && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500">
                  Type your name below to generate a cursive digital signature fallback:
                </p>
                <input
                  type="text"
                  value={cursiveText}
                  onChange={(e) => setCursiveText(e.target.value)}
                  placeholder="Type signature name..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-800 rounded-xl focus:outline-none text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950"
                />
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-2xl text-blue-800 dark:text-blue-400 font-serif italic" style={{ fontFamily: "'Dancing Script', 'Cursive', 'Brush Script MT', serif" }}>
                    {cursiveText || officerName || 'Your Signature'}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOfficerSignature(cursiveText || officerName || 'Your Signature');
                      setIsSignPadOpen(false);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500 text-xs font-bold cursor-pointer"
                  >
                    Use Typed Signature
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
