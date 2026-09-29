import React, { useState } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  FileText,
  Clock,
  Send,
  Building,
  Calendar,
  Sparkles,
  Download,
  AlertTriangle,
  BadgeAlert,
  Shield,
  Layers,
  Image as ImageIcon,
  Sliders,
} from 'lucide-react';
import {
  type HospitalMemo,
  type SystemSettings,
  type User,
  type Role,
} from '../types';
import { LetterheadUploadModal } from './LetterheadUploadModal';
import { OfficialMemoLetterhead } from './OfficialMemoLetterhead';

interface MemoDetailModalProps {
  memo: HospitalMemo | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  systemSettings?: SystemSettings | null;
  onUpdateStatus?: (id: string, status: HospitalMemo['status']) => void;
  onEdit?: (memo: HospitalMemo) => void;
  onRefreshSettings?: () => void;
}

export const MemoDetailModal: React.FC<MemoDetailModalProps> = ({
  memo,
  isOpen,
  onClose,
  currentUser,
  systemSettings,
  onUpdateStatus,
  onEdit,
  onRefreshSettings,
}) => {
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);

  if (!isOpen || !memo) return null;

  const hospitalName = systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital';
  const hospitalLogo = systemSettings?.hospitalLogo;
  const letterheadImage = systemSettings?.hospitalLetterheadImage;
  const letterheadSubTitle = systemSettings?.letterheadSubTitle || 'Department of Information Technology & Clinical Informatics';
  const letterheadAddressLine = systemSettings?.letterheadAddressLine || '104 Healthcare Boulevard, Ward 4 • Emergency: Ext 9911 / 222 • www.smthospital.local';
  const letterheadFooterText = systemSettings?.letterheadFooterText || `CONFIDENTIAL & PROPRIETARY — HEALTHCARE INFORMATION TECHNOLOGY & OPERATIONS MANAGEMENT (${systemSettings?.systemName || 'HITOMS'})`;
  const letterheadMode = systemSettings?.letterheadMode || 'HEADER_AND_BANNER';

  const isITUser = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'IT_ADMIN' || currentUser?.role === 'IT_OFFICER';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isITLeader = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'IT_ADMIN';
  const isAuthor = currentUser?.id === memo.fromSender.uid;
  const canApprove = isSuperAdmin || currentUser?.role === 'IT_ADMIN';

  const isPdfLetterhead = Boolean(
    letterheadImage &&
      (letterheadImage.startsWith('data:application/pdf') ||
        letterheadImage.includes('application/pdf') ||
        letterheadImage.toLowerCase().includes('.pdf'))
  );

  if (!isITUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Restricted Access
          </h3>
          <p className="text-xs text-slate-500">
            Access to hospital memorandums, directorate advisories, and publishing controls is strictly restricted to Super Administrators and IT Personnel.
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

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: HospitalMemo['status']) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Published & Active</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved</span>
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Under Review</span>
          </span>
        );
      case 'DRAFT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Draft</span>
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            Archived
          </span>
        );
    }
  };

  const getMemoTypeLabel = (type: HospitalMemo['memoType']) => {
    switch (type) {
      case 'EXECUTIVE_IT_MEMO':
        return 'Executive IT Memorandum';
      case 'INCIDENT_DEBRIEF':
        return 'Major Incident Debrief & Post-Mortem';
      case 'OPERATIONS_REPORT':
        return 'Operations Performance Report';
      case 'EQUIPMENT_JUSTIFICATION':
        return 'Equipment & Procurement Justification';
      case 'CLINICAL_ADVISORY':
        return 'Clinical Ward & Patient Safety Advisory';
      case 'MAINTENANCE_DOWNTIME':
        return 'Scheduled Maintenance & Downtime Notice';
      case 'POLICY_CIRCULAR':
        return 'Hospital Policy & Security Circular';
      default:
        return 'Official Memorandum';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none">
        
        <OfficialMemoLetterhead
          memo={memo}
          systemSettings={systemSettings}
          currentUser={currentUser}
          onPrint={handlePrint}
          onEdit={(m) => {
            onClose();
            if (onEdit) onEdit(m);
          }}
          onUpdateStatus={onUpdateStatus}
          onOpenLetterheadModal={() => setIsLetterheadModalOpen(true)}
          onClose={onClose}
        />

      </div>

      {/* MODAL: LETTERHEAD UPLOAD & CUSTOMIZATION */}
      <LetterheadUploadModal
        isOpen={isLetterheadModalOpen}
        onClose={() => setIsLetterheadModalOpen(false)}
        systemSettings={systemSettings || null}
        currentUser={currentUser}
        onSettingsSaved={() => {
          if (onRefreshSettings) onRefreshSettings();
        }}
      />
    </div>
  );
};
