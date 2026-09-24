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
  const letterheadFooterText = systemSettings?.letterheadFooterText || 'CONFIDENTIAL & PROPRIETARY — HEALTHCARE INFORMATION TECHNOLOGY & OPERATIONS MANAGEMENT (HITOMS)';
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
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Top Control Bar (Hidden on print) */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
              {memo.memoNumber}
            </span>
            {getStatusBadge(memo.status)}
            {memo.isAiGenerated && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                <Sparkles className="w-3 h-3" />
                <span>AI Write-Up Verified</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isITLeader && (
              <button
                type="button"
                onClick={() => setIsLetterheadModalOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 text-sky-700 dark:text-sky-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Upload or customize official hospital letterhead banner and typography"
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Upload Letterhead</span>
              </button>
            )}

            {canApprove && memo.status !== 'PUBLISHED' && (
              <button
                type="button"
                onClick={() => onUpdateStatus?.(memo.id, 'PUBLISHED')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Publish Memo</span>
              </button>
            )}

            {(isITLeader || isAuthor) && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(memo);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Edit Draft
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Print official hospital letterhead"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Letterhead</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Memorandum Letterhead */}
        <div className="p-6 sm:p-10 space-y-8 text-slate-900 dark:text-slate-100 font-sans print:p-8 print:text-black">
          
          {/* UPLOADED GRAPHIC LETTERHEAD BANNER (If present) */}
          {letterheadImage && (letterheadMode === 'CUSTOM_BANNER' || letterheadMode === 'HEADER_AND_BANNER') && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm print:border-none print:shadow-none bg-slate-900 print:bg-transparent">
              {isPdfLetterhead ? (
                <div className="w-full">
                  <object
                    data={letterheadImage}
                    type="application/pdf"
                    className="w-full h-44 sm:h-56 rounded-xl overflow-hidden print:h-48"
                  >
                    <iframe
                      src={`${letterheadImage}#toolbar=0&navpanes=0`}
                      className="w-full h-44 sm:h-56 rounded-xl border-none"
                      title="Hospital Letterhead PDF Banner"
                    />
                  </object>
                </div>
              ) : (
                <img
                  src={letterheadImage}
                  alt="Hospital Letterhead Banner"
                  className="w-full max-h-44 sm:max-h-56 object-contain sm:object-cover mx-auto print:max-h-48"
                />
              )}
            </div>
          )}

          {/* Hospital Formal Header (Dynamic or Header+Banner mode) */}
          {(letterheadMode === 'DYNAMIC_HEADER' || letterheadMode === 'HEADER_AND_BANNER' || !letterheadImage) && (
            <div className="border-b-4 border-sky-600 dark:border-sky-500 pb-6 print:border-black">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-4">
                  {hospitalLogo ? (
                    <img
                      src={hospitalLogo}
                      alt="Hospital Logo"
                      className="w-16 h-16 object-contain rounded-xl border border-slate-200 dark:border-slate-700 print:border-none"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-2xl shadow-md print:border print:border-black print:text-black print:bg-white">
                      H
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white print:text-black">
                      {hospitalName}
                    </h1>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 print:text-black">
                      {letterheadSubTitle}
                    </p>
                    <p className="text-[11px] text-slate-500 print:text-black">
                      {letterheadAddressLine}
                    </p>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:pl-6 border-slate-200 dark:border-slate-800 print:border-black">
                  <div className="text-xl font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 print:text-black">
                    MEMORANDUM
                  </div>
                  <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 print:text-black mt-0.5">
                    REF: {memo.memoNumber}
                  </div>
                  <div className="text-[11px] text-slate-500 print:text-black">
                    Date: {new Date(memo.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Memo Metadata Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs print:bg-white print:border-black print:rounded-none">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-500 print:text-black min-w-16">TO:</span>
                <span className="font-semibold text-slate-900 dark:text-white print:text-black">
                  {memo.targetAudience}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-500 print:text-black min-w-16">FROM:</span>
                <span className="font-semibold text-slate-900 dark:text-white print:text-black">
                  {memo.fromSender.name} ({memo.fromSender.title || memo.fromSender.role})
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-500 print:text-black min-w-16">DEPT:</span>
                <span className="text-slate-700 dark:text-slate-300 print:text-black">{memo.department}</span>
              </div>
              {memo.physicalArchiveLocation && (
                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-500 print:text-black min-w-16">ARCHIVE:</span>
                  <span className="text-sky-700 dark:text-sky-400 font-medium print:text-black">{memo.physicalArchiveLocation}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-500 print:text-black min-w-20">SUBJECT:</span>
                <span className="font-black text-slate-900 dark:text-white print:text-black uppercase">
                  {memo.title}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-500 print:text-black min-w-20">DOC TYPE:</span>
                <span className="text-sky-700 dark:text-sky-300 font-semibold print:text-black">
                  {getMemoTypeLabel(memo.memoType)}
                </span>
              </div>
              {memo.timelineOrDeadline && (
                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-500 print:text-black min-w-20">TIMELINE:</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400 print:text-black">
                    {memo.timelineOrDeadline}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Scanned Physical Document Preview if available */}
          {memo.archivedScanImage && (
            <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-2 print:border-black print:bg-white print:text-black">
              <div className="flex items-center justify-between text-xs font-bold text-sky-400 print:text-black">
                <span>Scanned Paper Memo Document / Camera Capture Archive:</span>
                {memo.originalFileName && <span className="font-mono text-[11px] text-slate-400">{memo.originalFileName}</span>}
              </div>
              <div className="rounded-xl overflow-hidden max-h-80 flex items-center justify-center bg-black">
                <img
                  src={memo.archivedScanImage}
                  alt={memo.title}
                  className="max-h-80 w-auto object-contain"
                />
              </div>
            </div>
          )}

          {/* Executive Summary Callout */}
          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border-l-4 border-sky-600 dark:border-sky-500 space-y-1 print:bg-white print:border-black print:rounded-none">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 print:text-black flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Executive Summary & Directive Overview</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 print:text-black leading-relaxed">
              {memo.executiveSummary}
            </p>
          </div>

          {/* Background and Operational Context */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 print:text-black border-b border-slate-200 dark:border-slate-800 pb-1 print:border-black">
              1. Background & Operational Context
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 print:text-black leading-relaxed whitespace-pre-line">
              {memo.backgroundAndContext}
            </p>
          </div>

          {/* Detailed Findings and Technical Directives */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 print:text-black border-b border-slate-200 dark:border-slate-800 pb-1 print:border-black">
              2. Technical & Operational Directives
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm text-slate-800 dark:text-slate-200 print:text-black whitespace-pre-line leading-relaxed">
              {memo.detailedFindingsOrBody}
            </div>
          </div>

          {/* Action Required / Checklist */}
          {memo.actionRequiredOrChecklist && memo.actionRequiredOrChecklist.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 print:text-black border-b border-slate-200 dark:border-slate-800 pb-1 print:border-black">
                3. Mandatory Action Checklist for Clinical & Technical Staff
              </h3>
              <div className="space-y-2">
                {memo.actionRequiredOrChecklist.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 print:bg-white print:border-black print:rounded-none"
                  >
                    <span className="w-5 h-5 shrink-0 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold text-[10px] flex items-center justify-center print:border print:border-black print:bg-white print:text-black">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Distribution & IT Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs print:border-black">
            <div>
              <span className="font-bold text-slate-500 print:text-black block mb-0.5">
                Recommended Distribution:
              </span>
              <span className="text-slate-700 dark:text-slate-300 print:text-black">
                {memo.recommendedDistribution || 'Clinical Noticeboards, Ward Supervisors, IT Helpdesk Archive'}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-500 print:text-black block mb-0.5">
                IT Support & Escalation Contact:
              </span>
              <span className="text-slate-700 dark:text-slate-300 print:text-black">
                {memo.contactPersonOrExtension || 'Hospital IT Helpdesk Ext. 2101 / On-Call Engineer'}
              </span>
            </div>
          </div>

          {/* Official Sign-Off Block with Digital Authorization Seal */}
          <div className="pt-8 border-t-2 border-slate-200 dark:border-slate-800 print:border-black grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black block">
                Issued & Authorized By:
              </span>
              <div className="font-serif italic text-lg text-slate-900 dark:text-white print:text-black font-semibold">
                {memo.fromSender.name}
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 print:text-black">
                {memo.fromSender.title || memo.fromSender.role}
              </div>
              <div className="text-[11px] text-slate-500 print:text-black">
                Hospital IT Systems Operations
              </div>
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black block">
                Approval & Governance Seal:
              </span>
              {memo.approvedBy ? (
                <div>
                  <div className="inline-block p-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-left sm:text-right print:bg-white print:border-black">
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 print:text-black flex items-center gap-1 sm:justify-end">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      <span>APPROVED FOR HOSPITAL PUBLICATION</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                      {memo.approvedBy.name} — {memo.approvedBy.title}
                    </div>
                    <div className="text-[10px] text-slate-400 print:text-black font-mono">
                      Timestamp: {new Date(memo.approvedBy.approvedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-600 dark:text-amber-400 italic">
                  Pending Administrative Seal & Directorate Approval
                </div>
              )}
            </div>
          </div>

          {/* Official Footer / Legal Disclaimer Line */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 print:border-black text-center">
            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400 print:text-black">
              {letterheadFooterText}
            </p>
          </div>

        </div>

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
