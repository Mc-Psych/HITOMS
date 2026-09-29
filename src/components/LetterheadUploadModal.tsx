import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  FileText,
  Building,
  Sparkles,
  Printer,
  Shield,
  Eye,
  Sliders,
  RotateCcw,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { type SystemSettings, type User, type LetterheadMode } from '../types';
import { settingsService } from '../services/settingsService';
import { compressImage } from '../utils/imageCompressor';

interface LetterheadUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemSettings: SystemSettings | null;
  currentUser: User | null;
  onSettingsSaved?: (newSettings: SystemSettings) => void;
}

export const LetterheadUploadModal: React.FC<LetterheadUploadModalProps> = ({
  isOpen,
  onClose,
  systemSettings,
  currentUser,
  onSettingsSaved,
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isITLeader = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'IT_ADMIN';

  const [letterheadImage, setLetterheadImage] = useState<string>('');
  const [hospitalName, setHospitalName] = useState<string>('');
  const [subTitle, setSubTitle] = useState<string>('');
  const [addressLine, setAddressLine] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('');
  const [letterheadMode, setLetterheadMode] = useState<LetterheadMode>('DYNAMIC_HEADER');

  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'TEXT_SETTINGS'>('UPLOAD');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [lastInitializedOpen, setLastInitializedOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setLastInitializedOpen(false);
      return;
    }
    if (lastInitializedOpen) {
      return;
    }
    setLastInitializedOpen(true);

    if (systemSettings) {
      setLetterheadImage(systemSettings.hospitalLetterheadImage || '');
      setHospitalName(systemSettings.hospitalName || 'St. Mary Theresa Catholic Hospital');
      setSubTitle(
        systemSettings.letterheadSubTitle ||
          'St. Mary Theresa Catholic Hospital I.T Support Unit'
      );
      setAddressLine(
        systemSettings.letterheadAddressLine ||
          'DODI PAPASE, KADJEBI DISTRICT - OTI REGION'
      );
      const sysName = systemSettings.systemName || 'HITOMS';
      setFooterText(
        systemSettings.letterheadFooterText ||
          'ST. MARY THERESA CATHOLIC HOSPITAL — DEPARTMENT OF INFORMATION TECHNOLOGY'
      );
      setLetterheadMode(systemSettings.letterheadMode || 'DYNAMIC_HEADER');
    }
    setError(null);
    setSaveSuccess(false);
  }, [systemSettings, isOpen, lastInitializedOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      setError('Please select a valid image file (PNG, JPG, SVG, WebP) or official letterhead PDF document.');
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setError('Letterhead file exceeds 6MB. Please choose an optimized file.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      if (isImage) {
        const compressed = await compressImage(base64, 1200, 350, 0.75);
        setLetterheadImage(compressed);
      } else {
        setLetterheadImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLetterhead = () => {
    setLetterheadImage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    if (!isITLeader) {
      setError('Access Denied: Only IT Administrators or Super Admins can update the official hospital letterhead.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updated = await settingsService.updateSettings(
        {
          hospitalLetterheadImage: letterheadImage,
          hospitalName: hospitalName.trim(),
          letterheadSubTitle: subTitle.trim(),
          letterheadAddressLine: addressLine.trim(),
          letterheadFooterText: footerText.trim(),
          letterheadMode: letterheadMode,
        },
        currentUser
      );

      setSaveSuccess(true);
      if (onSettingsSaved) {
        onSettingsSaved(updated);
      }
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to save letterhead configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Official Hospital Letterhead Studio</span>
              </h2>
              <p className="text-xs text-slate-500">
                Configure letterhead banner image and official directorate text details.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="px-6 pt-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'UPLOAD'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image / Banner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TEXT_SETTINGS')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'TEXT_SETTINGS'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Typography & Metadata</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Notifications */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Official hospital letterhead saved successfully to local database!</span>
            </div>
          )}

          {/* TAB 1: UPLOAD CUSTOM GRAPHIC BANNER */}
          {activeTab === 'UPLOAD' && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-sky-600" />
                    <span>Upload Custom Letterhead Banner or PDF</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload an official hospital letterhead banner (PNG, JPG, SVG, WebP) or PDF document.
                  </p>
                </div>

                {letterheadImage && (
                  <button
                    type="button"
                    onClick={handleRemoveLetterhead}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Banner</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-sky-300 dark:border-sky-800 rounded-2xl bg-white dark:bg-slate-950 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 transition cursor-pointer text-center relative group">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml, application/pdf, .pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3 group-hover:scale-110 transition shadow-inner">
                  <FileText className="w-7 h-7" />
                </div>
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Drag and drop your official letterhead (PDF or Image) here
                </h5>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  Click to browse from your computer. Supports PDF documents, PNG, JPG, WebP, and SVG formats up to 6MB.
                </p>
                <span className="mt-3 px-3 py-1 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700">
                  Select Letterhead File (PDF / Image)
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: TYPOGRAPHY & METADATA */}
          {activeTab === 'TEXT_SETTINGS' && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-sky-600" />
                  <span>Letterhead Text & Directorate Details</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customize the formal metadata lines that accompany printed hospital memorandums.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Hospital Official Name
                  </label>
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder="St. Mary Theresa Catholic Hospital"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Directorate / Sub-Title
                  </label>
                  <input
                    type="text"
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    placeholder="St. Mary Theresa Catholic Hospital I.T Support Unit"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Address, Extension & LAN URL Line
                  </label>
                  <input
                    type="text"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="DODI PAPASE, KADJEBI DISTRICT - OTI REGION"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Printed Footer / Legal Disclaimer Line
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="ST. MARY THERESA CATHOLIC HOSPITAL — DEPARTMENT OF INFORMATION TECHNOLOGY"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              Changes apply instantly to all saved and new memos upon save.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={loading || !isITLeader}
              onClick={() => handleSave()}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Saving Letterhead...' : 'Save & Apply Letterhead'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
