import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  QrCode,
  X,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Search,
  HardDrive,
  Building,
  MapPin,
  RefreshCw,
  Upload,
  ChevronRight,
  LifeBuoy,
} from 'lucide-react';
import { type Asset } from '../types';
import { findAssetFromQrScan, parseQrPayloadToAssetTag } from '../utils/qrScannerHelper';

interface ScanQrToReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onReportIssueForAsset: (asset: Asset) => void;
  onViewAssetDetails?: (asset: Asset) => void;
}

export const ScanQrToReportModal: React.FC<ScanQrToReportModalProps> = ({
  isOpen,
  onClose,
  assets,
  onReportIssueForAsset,
  onViewAssetDetails,
}) => {
  const [activeTab, setActiveTab] = useState<'CAMERA' | 'MANUAL' | 'FILE'>('CAMERA');
  const [manualInput, setManualInput] = useState('');
  const [matchedAsset, setMatchedAsset] = useState<Asset | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream cleanly and release hardware immediately
  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('Error stopping video stream tracks:', e);
      }
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraEnabled(false);
    setIsRequestingCamera(false);
  };

  // Start live camera QR scanner loop on-demand when requested by user
  const startCamera = async () => {
    setCameraPermissionError(null);
    setIsRequestingCamera(true);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Camera access API is not available in this browser environment.');
      }
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1024 }, height: { ideal: 768 } },
        });
      } catch (e) {
        console.warn('Environment camera failed, falling back to any standard webcam...', e);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        setCameraEnabled(true);
        setIsRequestingCamera(false);
        requestScanFrame();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. You can still look up assets by tag/serial or upload a QR image.'
        : 'Could not access live camera. Please use manual search or image upload.';
      setCameraPermissionError(msg);
      setCameraActive(false);
      setCameraEnabled(false);
      setIsRequestingCamera(false);
    }
  };

  const requestScanFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameIdRef.current = requestAnimationFrame(requestScanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        const found = findAssetFromQrScan(code.data, assets);
        if (found) {
          setMatchedAsset(found);
          setScanError(null);
          stopCamera();
          return;
        } else {
          setScanError(`Scanned QR code payload "${parseQrPayloadToAssetTag(code.data)}" not found in asset registry.`);
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(requestScanFrame);
  };

  // Cleanly shut down camera if modal is closed or user navigates to manual/upload tabs
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  useEffect(() => {
    if (activeTab !== 'CAMERA') {
      stopCamera();
    }
  }, [activeTab]);

  if (!isOpen) return null;

  const handleManualSearch = (textToSearch?: string) => {
    const query = textToSearch !== undefined ? textToSearch : manualInput;
    if (!query.trim()) return;

    const found = findAssetFromQrScan(query, assets);
    if (found) {
      setMatchedAsset(found);
      setScanError(null);
    } else {
      setMatchedAsset(null);
      setScanError(`No asset found matching Tag or Serial Number "${query.trim()}".`);
    }
  };

  // Process uploaded QR code image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Smart downscaling of large mobile photos (limit max width/height to 1024px to drastically improve scan accuracy)
        const maxDim = 1024;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          const found = findAssetFromQrScan(code.data, assets);
          if (found) {
            setMatchedAsset(found);
            setScanError(null);
          } else {
            setMatchedAsset(null);
            setScanError(`Decoded QR payload "${parseQrPayloadToAssetTag(code.data)}" does not match any registered asset.`);
          }
        } else {
          setScanError('Could not detect a valid QR code in the uploaded image. Please try another photo or enter the tag manually.');
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Scan Asset QR Code</h3>
              <p className="text-[11px] text-slate-400">
                Scan hardware QR tag to report an issue or lodge a service ticket directly
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

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Result Card if Asset Found */}
          {matchedAsset ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/50 space-y-3.5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Asset Verified for Direct Incident Reporting</span>
                </div>
                <span className="font-mono font-black text-xs text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  {matchedAsset.assetTag}
                </span>
              </div>

              {/* Asset Specs Grid */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Hardware / Model:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {matchedAsset.manufacturer} {matchedAsset.model}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Serial Number:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {matchedAsset.serialNumber || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Department / Room:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {matchedAsset.department} ({matchedAsset.location})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Assigned Custodian:</span>
                  <span className="font-medium text-sky-700 dark:text-sky-300">
                    {matchedAsset.assignedUser || 'Department Shared'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onReportIssueForAsset(matchedAsset);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-white" />
                  <span>Report Issue on {matchedAsset.assetTag}</span>
                </button>

                {onViewAssetDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      onViewAssetDetails(matchedAsset);
                      onClose();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <span>View Details</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMatchedAsset(null);
                    setScanError(null);
                    setManualInput('');
                    if (activeTab === 'CAMERA') startCamera();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
                >
                  Scan Another
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Scan Method Switcher Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-medium text-slate-600 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => setActiveTab('CAMERA')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'CAMERA'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 font-bold shadow-xs'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Live Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('MANUAL')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'MANUAL'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 font-bold shadow-xs'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Enter Tag / Serial</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('FILE')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'FILE'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 font-bold shadow-xs'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload QR Image</span>
                </button>
              </div>

              {/* Tab 1: Live Camera View */}
              {activeTab === 'CAMERA' && (
                <div className="space-y-3">
                  {cameraActive ? (
                    <div className="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      {/* Scanning Frame Reticle */}
                      <div className="absolute inset-0 border-2 border-dashed border-sky-400/70 rounded-xl m-8 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-0.5 bg-sky-400/80 animate-pulse shadow-sm shadow-sky-400" />
                      </div>

                      {/* Stop Camera Button */}
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-xs transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Stop Camera</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
                      <video ref={videoRef} className="hidden" muted playsInline />
                      <canvas ref={canvasRef} className="hidden" />

                      <div className="w-12 h-12 rounded-2xl bg-sky-950/80 border border-sky-800/80 flex items-center justify-center mb-3">
                        <Camera className="w-6 h-6 text-sky-400" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">
                        Optical QR Barcode Scanner
                      </h4>
                      <p className="text-xs text-slate-300 max-w-xs mb-4">
                        Camera access is strictly on-demand. Click below to activate your webcam or mobile camera to scan asset QR labels.
                      </p>

                      <button
                        type="button"
                        onClick={startCamera}
                        disabled={isRequestingCamera}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-sky-950 cursor-pointer transition"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isRequestingCamera ? 'Requesting Camera Access...' : 'Start Camera Scanner'}</span>
                      </button>

                      {cameraPermissionError ? (
                        <div className="mt-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] max-w-xs text-left">
                          {cameraPermissionError}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-3">
                          No camera? Switch to{' '}
                          <button
                            type="button"
                            onClick={() => setActiveTab('MANUAL')}
                            className="text-sky-400 hover:underline font-semibold cursor-pointer"
                          >
                            Enter Tag
                          </button>{' '}
                          or{' '}
                          <button
                            type="button"
                            onClick={() => setActiveTab('FILE')}
                            className="text-sky-400 hover:underline font-semibold cursor-pointer"
                          >
                            Upload Photo
                          </button>.
                        </p>
                      )}
                    </div>
                  )}

                  {cameraActive && (
                    <p className="text-center text-[11px] text-slate-400">
                      Position the physical asset QR code label inside the reticle.
                    </p>
                  )}
                </div>
              )}

              {/* Tab 2: Manual Search */}
              {activeTab === 'MANUAL' && (
                <div className="space-y-3">
                  <label className="block text-slate-500 font-semibold text-[11px]">
                    Enter Asset Tag, Serial Number, or Paste QR Text Payload:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. HIT-AST-000101 or S/N 7X89231"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualSearch();
                      }}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleManualSearch()}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Search
                    </button>
                  </div>

                  {/* Sample Asset Tags */}
                  {assets.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] text-slate-400 block mb-1">
                        Quick Sample Assets (Click to test scan):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {assets.slice(0, 5).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setManualInput(a.assetTag);
                              handleManualSearch(a.assetTag);
                            }}
                            className="px-2 py-1 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-800 dark:text-sky-300 font-mono text-[10px] rounded-lg border border-sky-200/60 dark:border-sky-800 cursor-pointer"
                          >
                            {a.assetTag} ({a.manufacturer} {a.model})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Upload Image */}
              {activeTab === 'FILE' && (
                <div className="space-y-3 text-center py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
                  <Upload className="w-8 h-8 text-sky-500 mx-auto" />
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      Upload QR Code Photo or Barcode Image
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Select an image taken on phone or desktop containing the asset QR code
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Select Photo File
                  </button>
                </div>
              )}

              {/* Scan Error Alert */}
              {scanError && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-snug">{scanError}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
