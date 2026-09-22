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

interface LetterheadUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemSettings: SystemSettings | null;
  currentUser: User | null;
  onSettingsSaved?: (newSettings: SystemSettings) => void;
}

// Built-in presets for quick hospital setup if user doesn't have an image ready
const PRESET_LETTERHEADS = [
  {
    id: 'st-mary-classic',
    name: 'St. Mary Theresa Official Crest & Banner',
    description: 'Gold & Deep Navy Blue Catholic Hospital Letterhead with formal seal',
    svgData: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" width="1200" height="240"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230f172a"/><stop offset="60%" stop-color="%230369a1"/><stop offset="100%" stop-color="%230284c7"/></linearGradient></defs><rect width="1200" height="240" fill="url(%23g1)"/><rect y="230" width="1200" height="10" fill="%23f59e0b"/><g transform="translate(40, 30)"><circle cx="85" cy="85" r="75" fill="%23ffffff" fill-opacity="0.12"/><circle cx="85" cy="85" r="65" stroke="%23f59e0b" stroke-width="4" fill="%230f172a"/><path d="M85 40 v90 M40 85 h90" stroke="%23ffffff" stroke-width="12" stroke-linecap="round"/><circle cx="85" cy="85" r="20" fill="%23f59e0b"/></g><text x="230" y="85" font-family="system-ui,-apple-system,sans-serif" font-size="34" font-weight="900" fill="%23ffffff" letter-spacing="1.5">ST. MARY THERESA CATHOLIC HOSPITAL</text><text x="230" y="125" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="700" fill="%2338bdf8" letter-spacing="2">DIRECTORATE OF INFORMATION TECHNOLOGY &amp; CLINICAL INFORMATICS</text><text x="230" y="165" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="%23e2e8f0">104 Healthcare Boulevard, P.O. Box 450 • Emergency: Ext 9911 / 222 • LHIMS: hitoms.local</text><line x1="230" y1="185" x2="1140" y2="185" stroke="%2338bdf8" stroke-opacity="0.4" stroke-width="1.5"/><text x="230" y="208" font-family="monospace" font-size="12" font-weight="700" fill="%23f59e0b">HEALTHCARE INFORMATION TECHNOLOGY &amp; OPERATIONS MANAGEMENT (HITOMS)</text><text x="1140" y="85" text-anchor="end" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="800" fill="%23ffffff" fill-opacity="0.7">OFFICIAL DIRECTIVE</text><text x="1140" y="110" text-anchor="end" font-family="monospace" font-size="12" fill="%2338bdf8">ACC-HOSP-2026</text></svg>`,
  },
  {
    id: 'health-service-green',
    name: 'Ghana Health Service / District Health Style',
    description: 'Emerald Green & Gold official clinical memorandum header',
    svgData: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" width="1200" height="240"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23064e3b"/><stop offset="60%" stop-color="%23047857"/><stop offset="100%" stop-color="%23059669"/></linearGradient></defs><rect width="1200" height="240" fill="url(%23g2)"/><rect y="228" width="1200" height="12" fill="%23d97706"/><g transform="translate(45, 30)"><circle cx="85" cy="85" r="70" fill="%23ffffff" fill-opacity="0.15"/><polygon points="85,35 125,75 110,135 60,135 45,75" fill="%23d97706"/><circle cx="85" cy="85" r="28" fill="%23064e3b"/><text x="85" y="93" text-anchor="middle" fill="%23ffffff" font-weight="900" font-size="22">GHS</text></g><text x="230" y="80" font-family="system-ui,-apple-system,sans-serif" font-size="32" font-weight="900" fill="%23ffffff" letter-spacing="1">DISTRICT HEALTHCARE ADMINISTRATION</text><text x="230" y="120" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="700" fill="%236ee7b7" letter-spacing="1.5">CLINICAL COMPUTING &amp; EMR OPERATIONS UNIT</text><text x="230" y="160" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="%23ecfdf5">Regional Health Directorate • Official Hospital Noticeboard &amp; Ward Circular</text><line x1="230" y1="180" x2="1140" y2="180" stroke="%2334d399" stroke-opacity="0.4" stroke-width="1.5"/><text x="230" y="205" font-family="monospace" font-size="12" font-weight="700" fill="%23fde68a">ELECTRONIC MEDICAL RECORDS SECURITY PROTOCOL</text></svg>`,
  },
  {
    id: 'modern-clinical-indigo',
    name: 'Modern Clean Slate & Indigo Header',
    description: 'High-contrast minimalist layout ideal for official PDF & paper printing',
    svgData: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" width="1200" height="240"><rect width="1200" height="240" fill="%231e1b4b"/><rect y="232" width="1200" height="8" fill="%236366f1"/><g transform="translate(50, 40)"><rect width="100" height="100" rx="20" fill="%234338ca"/><path d="M50 25 v50 M25 50 h50" stroke="%23ffffff" stroke-width="10" stroke-linecap="round"/></g><text x="180" y="85" font-family="system-ui,-apple-system,sans-serif" font-size="32" font-weight="900" fill="%23ffffff">ST. MARY THERESA MEMORIAL HOSPITAL</text><text x="180" y="125" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="600" fill="%23a5b4fc">Executive Medical &amp; Technical Services Directorate</text><text x="180" y="165" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="%23c7d2fe">LHIMS EMR System • Starlink WAN Failover • Biomedical Support Ext 221</text></svg>`,
  },
];

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
  const [letterheadMode, setLetterheadMode] = useState<LetterheadMode>('HEADER_AND_BANNER');

  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'PRESETS' | 'TEXT_SETTINGS'>('UPLOAD');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPdfLetterhead = Boolean(
    letterheadImage &&
      (letterheadImage.startsWith('data:application/pdf') ||
        letterheadImage.includes('application/pdf') ||
        letterheadImage.toLowerCase().includes('.pdf'))
  );

  useEffect(() => {
    if (systemSettings) {
      setLetterheadImage(systemSettings.hospitalLetterheadImage || '');
      setHospitalName(systemSettings.hospitalName || 'St. Mary Theresa Catholic Hospital');
      setSubTitle(
        systemSettings.letterheadSubTitle ||
          'Department of Information Technology & Clinical Informatics'
      );
      setAddressLine(
        systemSettings.letterheadAddressLine ||
          (systemSettings.address
            ? `${systemSettings.address} • Emergency: ${systemSettings.emergencyExtension || 'Ext 9911'} • ${systemSettings.hospitalLanUrl || 'hitoms.local'}`
            : '104 Healthcare Boulevard, Ward 4 • Emergency: Ext 9911 / 222 • www.smthospital.local')
      );
      setFooterText(
        systemSettings.letterheadFooterText ||
          'CONFIDENTIAL & PROPRIETARY — HEALTHCARE INFORMATION TECHNOLOGY & OPERATIONS MANAGEMENT (HITOMS)'
      );
      setLetterheadMode(systemSettings.letterheadMode || 'HEADER_AND_BANNER');
    }
    setError(null);
    setSaveSuccess(false);
  }, [systemSettings, isOpen]);

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
    reader.onload = () => {
      const base64 = reader.result as string;
      setLetterheadImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (presetSvg: string) => {
    setLetterheadImage(presetSvg);
    setError(null);
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
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Official Hospital Letterhead Studio</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  Print & PDF Header
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Upload or design the hospital banner that appears on all official memorandums, circulars, and executive reports.
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
            onClick={() => setActiveTab('PRESETS')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PRESETS'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Preset Hospital Crests</span>
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
        <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">
          
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

          {/* LIVE LETTERHEAD PREVIEW CONTAINER */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>Live Letterhead Output Preview</span>
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-semibold">Layout Mode:</span>
                <select
                  value={letterheadMode}
                  onChange={(e) => setLetterheadMode(e.target.value as LetterheadMode)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="HEADER_AND_BANNER">Banner + Hospital Metadata</option>
                  <option value="CUSTOM_BANNER">Full Graphic Banner Only</option>
                  <option value="DYNAMIC_HEADER">Standard Dynamic Typographic Header</option>
                </select>
              </div>
            </div>

            {/* Visual Paper Simulation Box */}
            <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-inner overflow-hidden">
              
              {/* If Uploaded/Preset Banner exists and mode is BANNER */}
              {letterheadImage && (letterheadMode === 'CUSTOM_BANNER' || letterheadMode === 'HEADER_AND_BANNER') && (
                <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-900">
                  {isPdfLetterhead ? (
                    <div className="p-3 text-center space-y-2 bg-slate-900">
                      <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-xs">
                        <FileText className="w-4 h-4" />
                        <span>Official PDF Letterhead Document Loaded</span>
                      </div>
                      <div className="w-full h-44 sm:h-52 rounded-lg overflow-hidden border border-slate-700 bg-white">
                        <object
                          data={letterheadImage}
                          type="application/pdf"
                          className="w-full h-full"
                        >
                          <iframe
                            src={`${letterheadImage}#toolbar=0&navpanes=0`}
                            className="w-full h-full border-none"
                            title="Hospital Letterhead PDF Preview"
                          />
                        </object>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={letterheadImage}
                      alt="Official Letterhead Banner"
                      className="w-full max-h-36 sm:max-h-44 object-contain sm:object-cover mx-auto"
                    />
                  )}
                </div>
              )}

              {/* Dynamic Metadata Section */}
              {(letterheadMode === 'DYNAMIC_HEADER' || letterheadMode === 'HEADER_AND_BANNER' || !letterheadImage) && (
                <div className="border-b-2 border-sky-600 dark:border-sky-500 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    {systemSettings?.hospitalLogo ? (
                      <img
                        src={systemSettings.hospitalLogo}
                        alt="Hospital Logo"
                        className="w-12 h-12 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                        H
                      </div>
                    )}
                    <div>
                      <h3 className="text-base sm:text-lg font-black tracking-tight uppercase text-slate-900 dark:text-white">
                        {hospitalName || 'St. Mary Theresa Catholic Hospital'}
                      </h3>
                      <p className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
                        {subTitle}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {addressLine}
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:border-l sm:pl-4 border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                      MEMORANDUM
                    </span>
                    <div className="text-[10px] font-mono font-bold text-sky-600">
                      REF: SMT-IT-2026-001
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Date: {new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Memo Body Watermark Simulation */}
              <div className="mt-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 space-y-2">
                <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                  <span>TO: All Clinical Units &amp; Wards</span>
                  <span>FROM: Head of IT &amp; Clinical Informatics</span>
                </div>
                <div className="h-2 w-3/4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="h-2 w-5/6 bg-slate-100 dark:bg-slate-800 rounded"></div>
              </div>

              {/* Footer Preview */}
              <div className="mt-3 text-center text-[9px] font-mono text-slate-400 uppercase">
                {footerText}
              </div>
            </div>
          </div>

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

          {/* TAB 2: PRESET HOSPITAL CRESTS */}
          {activeTab === 'PRESETS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Built-In Hospital Letterhead Presets</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a ready-to-use high-resolution vector letterhead designed for clinical governance.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {PRESET_LETTERHEADS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.svgData)}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-white dark:bg-slate-950 transition cursor-pointer space-y-3 group shadow-2xs hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-sky-600">
                          {preset.name}
                        </span>
                        <p className="text-[11px] text-slate-500">{preset.description}</p>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 group-hover:bg-sky-600 group-hover:text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Use This Template</span>
                      </button>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-24 bg-slate-900">
                      <img
                        src={preset.svgData}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TYPOGRAPHY & METADATA */}
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
                    placeholder="Department of Information Technology & Clinical Informatics"
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
                    placeholder="104 Healthcare Boulevard, Ward 4 • Emergency: Ext 9911 / 222 • www.smthospital.local"
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
                    placeholder="CONFIDENTIAL & PROPRIETARY — HEALTHCARE INFORMATION TECHNOLOGY & OPERATIONS MANAGEMENT (HITOMS)"
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
