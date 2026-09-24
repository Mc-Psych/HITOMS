import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FolderArchive,
  FileText,
  Calendar,
  Building,
  Shield,
  Tag,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { type HospitalMemo } from '../types';

interface MemoScanViewerModalProps {
  memo: HospitalMemo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemoScanViewerModal: React.FC<MemoScanViewerModalProps> = ({
  memo,
  isOpen,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !memo) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const scanImage = memo.archivedScanImage || memo.attachments?.[0]?.data;
  const isPdf = memo.fileMimeType?.includes('pdf') || memo.originalFileName?.endsWith('.pdf');

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!scanImage) return;
    const a = document.createElement('a');
    a.href = scanImage;
    a.download = memo.originalFileName || `${memo.memoNumber.replace(/[/\\?%*:|"<>]/g, '_')}_scan.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-300 shrink-0">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                  {memo.title}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-mono border border-sky-500/30 shrink-0">
                  {memo.memoNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Physical Location: {memo.physicalArchiveLocation || 'IT Archives'} • Date: {memo.memoDate || memo.createdAt?.slice(0, 10)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {scanImage && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body Grid: Preview + Metadata Sidebar */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          {/* Main Visual Document Canvas */}
          <div className="lg:col-span-2 bg-slate-950 p-4 flex items-center justify-center overflow-auto min-h-[350px]">
            {scanImage ? (
              isPdf ? (
                <iframe
                  src={scanImage}
                  title="Archived PDF Document"
                  className="w-full h-full rounded-xl border border-slate-800 bg-white"
                />
              ) : (
                <div
                  className="transition-transform duration-150 flex items-center justify-center"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  }}
                >
                  <img
                    src={scanImage}
                    alt={memo.title}
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800"
                  />
                </div>
              )
            ) : (
              <div className="text-center p-8 text-slate-400 space-y-3 max-w-md">
                <FileText className="w-12 h-12 mx-auto text-slate-600" />
                <h4 className="font-bold text-slate-200">No Image Preview Available</h4>
                <p className="text-xs text-slate-400">
                  This memo was archived with text metadata only or the attachment file format cannot be rendered inline.
                </p>
              </div>
            )}
          </div>

          {/* Metadata & Content Summary Sidebar */}
          <div className="bg-slate-50 dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Document Details
              </span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                {memo.title}
              </h4>
              <p className="text-slate-500 mt-0.5">{memo.memoType.replace(/_/g, ' ')}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Issuing Department:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{memo.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Document Date:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{memo.memoDate || memo.createdAt?.slice(0, 10)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Physical Filing:</span>
                <span className="font-semibold text-sky-600 dark:text-sky-400">{memo.physicalArchiveLocation || 'IT Records'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ingestion Source:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {memo.archiveSource === 'CAMERA_CAPTURE' ? 'Camera Photo Scan' : memo.archiveSource === 'DEVICE_UPLOAD' ? 'Device File Upload' : 'Digital Draft'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                  {memo.status}
                </span>
              </div>
            </div>

            {memo.executiveSummary && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Summary & Key Decisions
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {memo.executiveSummary}
                </p>
              </div>
            )}

            {memo.actionRequiredOrChecklist && memo.actionRequiredOrChecklist.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Required Action Items
                </span>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                  {memo.actionRequiredOrChecklist.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-sky-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {memo.tags && memo.tags.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Indexed Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {memo.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
