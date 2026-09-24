import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  FolderArchive,
  Save,
  RotateCw,
  Trash2,
  Eye,
  Building,
  Shield,
  Tag,
  Calendar,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import {
  type HospitalMemo,
  type MemoType,
  type MemoStatus,
  type User,
  type SystemSettings,
  type Attachment,
} from '../types';
import { putToStore, generateUUID, getDeviceId } from '../services/localDatabaseService';
import { auditService } from '../services/auditService';
import { syncService } from '../services/syncService';

interface MemoUploadArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  systemSettings?: SystemSettings | null;
  onSaved: (savedMemo: HospitalMemo) => void;
}

export const MemoUploadArchiveModal: React.FC<MemoUploadArchiveModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  systemSettings,
  onSaved,
}) => {
  const [sourceMode, setSourceMode] = useState<'DEVICE_UPLOAD' | 'CAMERA_CAPTURE'>('DEVICE_UPLOAD');
  
  // Memo form states
  const [title, setTitle] = useState('');
  const [memoNumber, setMemoNumber] = useState('');
  const [memoType, setMemoType] = useState<MemoType>('GENERAL_MEMO');
  const [department, setDepartment] = useState('Information Technology');
  const [targetAudience, setTargetAudience] = useState('All Hospital Staff & Clinical Units');
  const [memoDate, setMemoDate] = useState(new Date().toISOString().split('T')[0]);
  const [physicalLocation, setPhysicalLocation] = useState('IT Archive Cabinet 1 / Binder 2026');
  const [confidentiality, setConfidentiality] = useState<'STANDARD' | 'CONFIDENTIAL' | 'STRICTLY_RESTRICTED'>('STANDARD');
  const [summary, setSummary] = useState('');
  const [actionItems, setActionItems] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('IT Operations, Official Memo');
  const [status, setStatus] = useState<MemoStatus>('ARCHIVED');

  // File & Camera states
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  } | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize auto memo number
  useEffect(() => {
    if (isOpen) {
      const year = new Date().getFullYear();
      const rand = Math.floor(100 + Math.random() * 900);
      setMemoNumber(`MEMO/ARCH/${year}/${rand}`);
      setMemoDate(new Date().toISOString().split('T')[0]);
      setTitle('');
      setSummary('');
      setActionItems('');
      setUploadedFile(null);
      setCapturedPhoto(null);
      setFormError(null);
      setCameraError(null);
      setIsCameraActive(false);
    }
  }, [isOpen]);

  // Clean up camera stream on modal close or unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setCapturedPhoto(null);
    try {
      if (streamRef.current) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('[Camera] Could not open camera stream:', err);
      setCameraError(
        'Unable to access camera directly in this browser window. You can take a picture using the Device Upload option or mobile camera picker.'
      );
      setIsCameraActive(false);
    }
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedPhoto(dataUrl);
      setUploadedFile({
        name: `Scanned_Memo_Photo_${new Date().toISOString().slice(0, 10)}.jpg`,
        size: Math.round(dataUrl.length * 0.75),
        type: 'image/jpeg',
        dataUrl,
      });
      stopCamera();
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      startCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setFormError('Selected file exceeds the 15MB limit for local memo archive.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl,
      });
      if (file.type.startsWith('image/')) {
        setCapturedPhoto(dataUrl);
      }
      // Auto fill title if empty
      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a Memo Title.');
      return;
    }

    if (!uploadedFile && !capturedPhoto) {
      setFormError('Please upload a memo document file or take a picture of the memo first.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const now = new Date().toISOString();
      const deviceId = getDeviceId();
      const memoId = `memo-arch-${generateUUID()}`;

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const parsedActionItems = actionItems
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const attachmentObj: Attachment | undefined = uploadedFile
        ? {
            id: generateUUID(),
            name: uploadedFile.name,
            size: uploadedFile.size,
            type: uploadedFile.type,
            dataUrl: uploadedFile.dataUrl,
            data: uploadedFile.dataUrl,
            uploadedBy: currentUser?.fullName || 'IT Staff',
            createdAt: now,
          }
        : undefined;

      const newMemo: HospitalMemo = {
        id: memoId,
        memoNumber: memoNumber.trim(),
        title: title.trim(),
        memoType,
        department: department.trim() || 'Information Technology',
        targetAudience: targetAudience.trim() || 'All Hospital Staff',
        targetRoles: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD'],
        fromSender: {
          uid: currentUser?.id || 'usr-it',
          name: currentUser?.fullName || 'IT Unit Officer',
          role: currentUser?.role || 'IT_ADMIN',
          title: currentUser?.jobTitle || 'IT Operations Specialist',
        },
        executiveSummary: summary.trim() || `Archived hospital memo: ${title.trim()}`,
        backgroundAndContext: `Archived Document Record. Stored at: ${physicalLocation.trim() || 'IT Archives'}. Document date: ${memoDate}.`,
        detailedFindingsOrBody: summary.trim() || 'Official scanned copy archived into HITOMS document repository.',
        actionRequiredOrChecklist: parsedActionItems.length > 0 ? parsedActionItems : ['Review archived circular / memo compliance'],
        timelineOrDeadline: memoDate,
        contactPersonOrExtension: currentUser?.phone || 'Ext. 100 / IT Helpdesk',
        status,
        isAiGenerated: false,
        tags,
        attachments: attachmentObj ? [attachmentObj] : [],
        archivedScanImage: capturedPhoto || (uploadedFile?.type.startsWith('image/') ? uploadedFile.dataUrl : undefined),
        archiveSource: sourceMode,
        physicalArchiveLocation: physicalLocation.trim(),
        confidentialityLevel: confidentiality,
        originalFileName: uploadedFile?.name,
        fileMimeType: uploadedFile?.type,
        fileSizeBytes: uploadedFile?.size,
        memoDate,
        createdAt: now,
        updatedAt: now,
        approvedBy: {
          name: currentUser?.fullName || 'Super Admin',
          title: currentUser?.jobTitle || 'IT Lead',
          approvedAt: now,
        },
      };

      await putToStore('memos', newMemo);

      await auditService.logAction(
        'ARCHIVE_MEMO_DOCUMENT',
        'Hospital Memo Archive',
        memoId,
        null,
        `Archived Memo [${newMemo.memoNumber}] "${newMemo.title}" via ${sourceMode} (${uploadedFile?.name || 'Camera Scan'})`
      );

      stopCamera();
      onSaved(newMemo);
      onClose();
    } catch (err: any) {
      console.error('[MemoUploadArchiveModal] Save failed:', err);
      setFormError(err?.message || 'Failed to archive memo document.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-300">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>IT Memo & Document Archive</span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/30">
                  Super Admin & IT Unit
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Upload device documents or take photo scans of paper memos into the central hospital repository
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Capture Method Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Memo Ingestion Method <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSourceMode('DEVICE_UPLOAD');
                  stopCamera();
                }}
                className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  sourceMode === 'DEVICE_UPLOAD'
                    ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload From Device (PDF / Doc / Image)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceMode('CAMERA_CAPTURE');
                  startCamera();
                }}
                className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  sourceMode === 'CAMERA_CAPTURE'
                    ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Take Picture / Camera Scan</span>
              </button>
            </div>
          </div>

          {/* Method 1: Device File Upload Area */}
          {sourceMode === 'DEVICE_UPLOAD' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />

              {!uploadedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-sky-500 hover:bg-sky-50/20 dark:hover:bg-sky-950/20 transition cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 mx-auto flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Click to browse or drag & drop memo document
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports PDF, Word Documents (.docx), high-res scanned images (.png, .jpg) up to 15MB
                  </p>
                </div>
              ) : (
                <div className="bg-sky-50/50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-sky-600 text-white shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {uploadedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • {uploadedFile.type}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                    >
                      Change File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null);
                        setCapturedPhoto(null);
                      }}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Method 2: Live Camera Capture Area */}
          {sourceMode === 'CAMERA_CAPTURE' && (
            <div className="space-y-3">
              {cameraError && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.setAttribute('capture', 'environment');
                      fileInputRef.current?.click();
                    }}
                    className="px-2.5 py-1 rounded bg-amber-600 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Open Camera App
                  </button>
                </div>
              )}

              {!capturedPhoto ? (
                <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 aspect-video flex flex-col items-center justify-center text-white">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                  />

                  {!isCameraActive && (
                    <div className="text-center p-4">
                      <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 mb-3">Camera is currently idle.</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition cursor-pointer"
                      >
                        Start Camera Viewfinder
                      </button>
                    </div>
                  )}

                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                      {/* Document alignment guidelines */}
                      <div className="flex items-center justify-between text-[11px] bg-black/60 px-3 py-1 rounded-full text-slate-300 self-center">
                        <span>Align paper memo within frame</span>
                      </div>

                      <div className="border-2 border-dashed border-sky-400/60 rounded-xl flex-1 my-3 m-4 pointer-events-none" />

                      <div className="flex items-center justify-center gap-4 pointer-events-auto pb-2">
                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          className="p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition cursor-pointer"
                          title="Flip Camera"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={captureCameraPhoto}
                          className="px-6 py-2.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/30 transition cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Snap Memo Photo</span>
                        </button>

                        <button
                          type="button"
                          onClick={stopCamera}
                          className="p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition cursor-pointer"
                          title="Close Camera"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Memo Photo Captured Successfully</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedPhoto(null);
                        startCamera();
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retake Photo</span>
                    </button>
                  </div>

                  <div className="rounded-xl overflow-hidden max-h-64 flex items-center justify-center bg-black">
                    <img
                      src={capturedPhoto}
                      alt="Captured Memo Scan"
                      className="max-h-64 w-auto object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Memo Metadata Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Memo Title / Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled Network & LHIMS Downtime for Block A"
                required
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Memo Reference Code
              </label>
              <input
                type="text"
                value={memoNumber}
                onChange={(e) => setMemoNumber(e.target.value)}
                placeholder="e.g. MEMO/ARCH/2026/042"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Memo Classification Type
              </label>
              <select
                value={memoType}
                onChange={(e) => setMemoType(e.target.value as MemoType)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="EXECUTIVE_IT_MEMO">Executive IT Directive</option>
                <option value="MAINTENANCE_DOWNTIME">Maintenance & Planned Downtime</option>
                <option value="CLINICAL_ADVISORY">Clinical Systems Advisory</option>
                <option value="INCIDENT_DEBRIEF">Incident Debrief & Post-Mortem</option>
                <option value="EQUIPMENT_JUSTIFICATION">Equipment & Hardware Justification</option>
                <option value="POLICY_CIRCULAR">Hospital IT Policy Circular</option>
                <option value="OPERATIONS_REPORT">Operations Status Report</option>
                <option value="GENERAL_MEMO">General Internal Memo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Issuing Department / Unit
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Information Technology & Clinical Informatics"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Original Document Date
              </label>
              <input
                type="date"
                value={memoDate}
                onChange={(e) => setMemoDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Physical Archive Filing Location
              </label>
              <input
                type="text"
                value={physicalLocation}
                onChange={(e) => setPhysicalLocation(e.target.value)}
                placeholder="e.g. IT Rack 2 / Hardcopy Binder B-2026 / Shelf 4"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confidentiality Level
              </label>
              <select
                value={confidentiality}
                onChange={(e) => setConfidentiality(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="STANDARD">Standard (Hospital Staff Access)</option>
                <option value="CONFIDENTIAL">Confidential (Super Admin & IT Unit)</option>
                <option value="STRICTLY_RESTRICTED">Strictly Restricted (Super Admin & Directorate Only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tags & Keywords (Comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Network, Starlink, LHIMS, Maintenance"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Executive Summary / Memo Contents Note
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary of memo decisions, affected systems, downtime window, or clinical protocol instructions..."
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Required Actions / Directive Steps (One item per line)
            </label>
            <textarea
              rows={2}
              value={actionItems}
              onChange={(e) => setActionItems(e.target.value)}
              placeholder="1. Department in-charges must backup offline ledgers&#10;2. IT team to execute switch firmware flash at 18:00 GMT"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Archiving Memo...' : 'Archive Memo to Repository'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
