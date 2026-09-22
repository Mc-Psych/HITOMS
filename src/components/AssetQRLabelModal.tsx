import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  QrCode,
  Printer,
  Download,
  X,
  Check,
  Building2,
  ShieldCheck,
  Tag,
  Copy,
  Layers,
  Settings2,
  FileText,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { type Asset } from '../types';
import {
  generateAssetQrMetadataPayload,
  renderAssetQrJpegDataUrl,
} from '../utils/qrLabelGenerator';

export type LabelSizePreset = 'compact' | 'standard' | 'large';
export type LabelOrientationPreset = 'stacked' | 'horizontal';

interface AssetQRLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  selectedAssets?: Asset[];
  hospitalName?: string;
}

export const AssetQRLabelModal: React.FC<AssetQRLabelModalProps> = ({
  isOpen,
  onClose,
  asset,
  selectedAssets,
  hospitalName = 'GENERAL HOSPITAL IT UNIT',
}) => {
  const [labelSize, setLabelSize] = useState<LabelSizePreset>('standard');
  const [includeHospitalHeader, setIncludeHospitalHeader] = useState(true);
  const [includeSerial, setIncludeSerial] = useState(true);
  const [includeDeptLocation, setIncludeDeptLocation] = useState(true);
  const [includeCustodian, setIncludeCustodian] = useState(true);
  const [includeSecurityNotice, setIncludeSecurityNotice] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [batchQrCodes, setBatchQrCodes] = useState<{ [tag: string]: string }>({});
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingJpeg, setIsGeneratingJpeg] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const isBatch = Boolean(selectedAssets && selectedAssets.length > 0);
  const activeAssets = isBatch ? selectedAssets! : asset ? [asset] : [];

  // Generate QR Code data URLs with full rich label metadata embedded
  useEffect(() => {
    if (!isOpen || activeAssets.length === 0) return;

    let isMounted = true;

    const generateCodes = async () => {
      try {
        if (!isBatch && asset) {
          const payload = generateAssetQrMetadataPayload(asset, hospitalName);
          const url = await QRCode.toDataURL(payload, {
            width: 360,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          if (isMounted) setQrCodeDataUrl(url);
        } else {
          const mapping: { [tag: string]: string } = {};
          for (const item of activeAssets) {
            const payload = generateAssetQrMetadataPayload(item, hospitalName);
            mapping[item.assetTag] = await QRCode.toDataURL(payload, {
              width: 300,
              margin: 1,
              errorCorrectionLevel: 'H',
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
          }
          if (isMounted) setBatchQrCodes(mapping);
        }
      } catch (err) {
        console.error('Failed to generate QR codes:', err);
      }
    };

    generateCodes();

    return () => {
      isMounted = false;
    };
  }, [isOpen, asset, selectedAssets, isBatch, activeAssets, hospitalName]);

  if (!isOpen || activeAssets.length === 0) return null;

  // Render high-resolution JPEG data URL with details (Name, Serial, Assigned Department) below the QR image
  const generateLabelJpegDataUrl = async (targetAsset: Asset): Promise<string> => {
    return renderAssetQrJpegDataUrl(targetAsset, {
      hospitalName,
      includeHospitalHeader,
      includeSerial,
      includeDeptLocation,
      includeCustodian,
      includeSecurityNotice,
      scale: 2,
    });
  };

  // Download high-resolution JPEG Label for an asset
  const handleDownloadJPEG = async (targetAsset: Asset) => {
    setIsGeneratingJpeg(true);
    try {
      const dataUrl = await generateLabelJpegDataUrl(targetAsset);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `ASSET-LABEL-${targetAsset.assetTag}.jpeg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('JPEG download error:', e);
    } finally {
      setIsGeneratingJpeg(false);
    }
  };

  // Batch download all JPEG labels sequentially
  const handleDownloadAllJPEGs = async () => {
    setIsGeneratingJpeg(true);
    try {
      for (let i = 0; i < activeAssets.length; i++) {
        const item = activeAssets[i];
        const dataUrl = await generateLabelJpegDataUrl(item);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `ASSET-LABEL-${item.assetTag}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (i < activeAssets.length - 1) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } catch (e) {
      console.error('Batch JPEG download error:', e);
    } finally {
      setIsGeneratingJpeg(false);
    }
  };

  // Single label download as PNG
  const handleDownloadPNG = async (targetAsset: Asset) => {
    try {
      const payload = generateAssetQrMetadataPayload(targetAsset, hospitalName);
      const dataUrl = await QRCode.toDataURL(payload, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: 'H',
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR-LABEL-${targetAsset.assetTag}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    }
  };

  // Browser Direct Print Trigger
  const handlePrint = () => {
    window.print();
  };

  // Generate & Download PDF Labels (Single or Multi-Asset Sheet)
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: labelSize === 'large' ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (!isBatch && asset) {
        // Single formatted printable badge page
        const payload = asset.qrCodeData || `HITOMS-ASSET:${asset.assetTag}`;
        const qrUrl = await QRCode.toDataURL(payload, { width: 400, margin: 1, errorCorrectionLevel: 'H' });

        // Outer label border
        const labelW = labelSize === 'compact' ? 70 : labelSize === 'large' ? 140 : 95;
        const labelH = labelSize === 'compact' ? 36 : labelSize === 'large' ? 85 : 55;
        const startX = (pageWidth - labelW) / 2;
        const startY = 30;

        // Badge Box
        pdf.setDrawColor(15, 23, 42); // slate-900
        pdf.setLineWidth(0.8);
        pdf.roundedRect(startX, startY, labelW, labelH, 2, 2, 'S');

        // Header
        pdf.setFillColor(15, 23, 42);
        pdf.rect(startX, startY, labelW, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text(hospitalName.toUpperCase(), startX + labelW / 2, startY + 5.5, { align: 'center' });

        // QR Code
        const qrSize = labelSize === 'compact' ? 24 : labelSize === 'large' ? 45 : 36;
        pdf.addImage(qrUrl, 'PNG', startX + 3, startY + 10, qrSize, qrSize);

        // Details
        const textX = startX + qrSize + 6;
        let curY = startY + 14;

        pdf.setTextColor(2, 132, 199); // sky-600
        pdf.setFontSize(labelSize === 'compact' ? 10 : 13);
        pdf.setFont('helvetica', 'bold');
        pdf.text(asset.assetTag, textX, curY);

        curY += 5;
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(labelSize === 'compact' ? 7.5 : 8.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${asset.manufacturer} ${asset.model}`.substring(0, 24), textX, curY);

        if (includeSerial && asset.serialNumber) {
          curY += 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(71, 85, 105);
          pdf.text(`S/N: ${asset.serialNumber}`, textX, curY);
        }

        if (includeDeptLocation) {
          curY += 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(71, 85, 105);
          pdf.text(`Dept: ${asset.department} - ${asset.location}`.substring(0, 26), textX, curY);
        }

        if (includeCustodian && asset.assignedUser) {
          curY += 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(71, 85, 105);
          pdf.text(`User: ${asset.assignedUser}`.substring(0, 24), textX, curY);
        }

        if (includeSecurityNotice) {
          pdf.setFontSize(5.5);
          pdf.setTextColor(148, 163, 184);
          pdf.text('PROPERTY OF HOSPITAL IT - DO NOT REMOVE', startX + labelW / 2, startY + labelH - 2, {
            align: 'center',
          });
        }

        pdf.save(`ASSET-QR-${asset.assetTag}.pdf`);
      } else {
        // Multi-Asset Batch Sheet (2 Columns x 5 Rows per page = 10 labels / page)
        const cols = 2;
        const rows = 5;
        const labelW = 90;
        const labelH = 50;
        const marginX = (pageWidth - cols * labelW) / 3;
        const marginY = 15;
        const gapY = 6;

        let index = 0;
        while (index < activeAssets.length) {
          if (index > 0 && index % (cols * rows) === 0) {
            pdf.addPage();
          }

          const pageIndex = index % (cols * rows);
          const col = pageIndex % cols;
          const row = Math.floor(pageIndex / cols);

          const curAsset = activeAssets[index];
          const x = marginX + col * (labelW + marginX);
          const y = marginY + row * (labelH + gapY);

          // Outer Box
          pdf.setDrawColor(203, 213, 225); // slate-300
          pdf.setLineWidth(0.4);
          pdf.roundedRect(x, y, labelW, labelH, 2, 2, 'S');

          // Header
          if (includeHospitalHeader) {
            pdf.setFillColor(15, 23, 42);
            pdf.rect(x, y, labelW, 7, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'bold');
            pdf.text(hospitalName.toUpperCase(), x + labelW / 2, y + 4.8, { align: 'center' });
          }

          // Generate QR code
          const payload = curAsset.qrCodeData || `HITOMS-ASSET:${curAsset.assetTag}`;
          const qrUrl =
            batchQrCodes[curAsset.assetTag] ||
            (await QRCode.toDataURL(payload, { width: 260, margin: 1, errorCorrectionLevel: 'M' }));

          const qrSize = 32;
          const qrY = includeHospitalHeader ? y + 9 : y + 4;
          pdf.addImage(qrUrl, 'PNG', x + 3, qrY, qrSize, qrSize);

          // Details Column
          const textX = x + qrSize + 6;
          let textY = qrY + 5;

          pdf.setTextColor(2, 132, 199);
          pdf.setFontSize(10.5);
          pdf.setFont('helvetica', 'bold');
          pdf.text(curAsset.assetTag, textX, textY);

          textY += 4.5;
          pdf.setTextColor(15, 23, 42);
          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${curAsset.manufacturer} ${curAsset.model}`.substring(0, 22), textX, textY);

          if (includeSerial && curAsset.serialNumber) {
            textY += 3.8;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6.5);
            pdf.setTextColor(71, 85, 105);
            pdf.text(`S/N: ${curAsset.serialNumber}`.substring(0, 24), textX, textY);
          }

          if (includeDeptLocation) {
            textY += 3.8;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6.5);
            pdf.setTextColor(71, 85, 105);
            pdf.text(`Dept: ${curAsset.department}`.substring(0, 24), textX, textY);
          }

          if (includeCustodian && curAsset.assignedUser) {
            textY += 3.8;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6.5);
            pdf.setTextColor(71, 85, 105);
            pdf.text(`User: ${curAsset.assignedUser}`.substring(0, 22), textX, textY);
          }

          if (includeSecurityNotice) {
            pdf.setFontSize(5);
            pdf.setTextColor(148, 163, 184);
            pdf.text('PROPERTY OF HOSPITAL IT - DO NOT REMOVE', x + labelW / 2, y + labelH - 1.5, {
              align: 'center',
            });
          }

          index++;
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save(`HOSPITAL-ASSET-QR-SHEET-${dateStr}.pdf`);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const copyAssetTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
      {/* Hidden printable content styled strictly for @media print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-qr-label-area, #printable-qr-label-area * {
            visibility: visible;
          }
          #printable-qr-label-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .qr-print-card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #000 !important;
            margin-bottom: 5mm;
          }
        }
      `}</style>

      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sky-600/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isBatch ? `Batch QR Label Generator (${activeAssets.length} Assets)` : `Asset QR Code Label`}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  Physical Equipment Tagging
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Generate high-resolution printable QR labels for thermal rolls, A4 adhesive sheets, and equipment badges.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Split */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Formatting Sidebar (4 Cols) */}
          <div className="lg:col-span-4 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pb-5 lg:pb-0 lg:pr-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Label Size Preset</span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLabelSize('compact')}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                    labelSize === 'compact'
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-600 dark:text-sky-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[11px]">Compact</div>
                  <div className="text-[9px] font-normal text-slate-400">2" × 1" (50×25mm)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLabelSize('standard')}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                    labelSize === 'standard'
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-600 dark:text-sky-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[11px]">Standard</div>
                  <div className="text-[9px] font-normal text-slate-400">3" × 2" (75×50mm)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLabelSize('large')}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                    labelSize === 'large'
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-600 dark:text-sky-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[11px]">Large Badge</div>
                  <div className="text-[9px] font-normal text-slate-400">4" × 3" (100×75mm)</div>
                </button>
              </div>
            </div>

            {/* Content Field Toggles */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Printed Label Elements
              </h4>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeHospitalHeader}
                  onChange={(e) => setIncludeHospitalHeader(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Hospital IT Facility Header</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSerial}
                  onChange={(e) => setIncludeSerial(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Hardware Serial Number (S/N)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeDeptLocation}
                  onChange={(e) => setIncludeDeptLocation(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Department & Room Location</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCustodian}
                  onChange={(e) => setIncludeCustodian(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Assigned Staff Custodian</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSecurityNotice}
                  onChange={(e) => setIncludeSecurityNotice(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Security Notice & Warning Footer</span>
              </label>
            </div>

            {/* Quick Summary Info */}
            <div className="text-[11px] text-slate-500 space-y-1.5 p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-200/50 dark:border-sky-900/40">
              <div className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Offline Tracking Compliance</span>
              </div>
              <p>
                Each QR code encodes the immutable tag identifier (<code>HITOMS-ASSET:TAG</code>). Scanning with any hospital mobile scanner instantly retrieves the local database record even when disconnected from the internet.
              </p>
            </div>
          </div>

          {/* Label Preview & Print Canvas (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>Print Preview {isBatch && `(${activeAssets.length} Labels)`}</span>
              </span>

              {!isBatch && asset && (
                <button
                  type="button"
                  onClick={() => copyAssetTag(asset.assetTag)}
                  className="text-xs font-mono font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tag Copied!' : asset.assetTag}</span>
                </button>
              )}
            </div>

            {/* Printable Preview Area */}
            <div
              id="printable-qr-label-area"
              ref={printAreaRef}
              className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-4 overflow-y-auto max-h-[460px]"
            >
              {activeAssets.map((item) => {
                const qrUrl = isBatch ? batchQrCodes[item.assetTag] : qrCodeDataUrl;
                return (
                  <div
                    key={item.id}
                    className={`qr-print-card bg-white text-slate-900 rounded-xl border-2 border-slate-900 shadow-md flex flex-col justify-between overflow-hidden transition ${
                      labelSize === 'compact'
                        ? 'w-72 h-36 p-2.5'
                        : labelSize === 'large'
                        ? 'w-96 h-56 p-4'
                        : 'w-80 h-44 p-3'
                    }`}
                  >
                    {/* Header */}
                    {includeHospitalHeader && (
                      <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center justify-between mb-1.5">
                        <span className="truncate">{hospitalName}</span>
                        <span className="text-[8px] bg-sky-500 text-white px-1 rounded uppercase tracking-wider">
                          IT ASSET
                        </span>
                      </div>
                    )}

                    {/* Middle Section: QR + Metadata */}
                    <div className="flex items-center gap-3 flex-1 min-h-0">
                      {/* Scannable Real QR Code */}
                      <div className="flex-shrink-0 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center">
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt={`QR for ${item.assetTag}`}
                            className={
                              labelSize === 'compact'
                                ? 'w-16 h-16'
                                : labelSize === 'large'
                                ? 'w-24 h-24'
                                : 'w-20 h-20'
                            }
                          />
                        ) : (
                          <div className="w-20 h-20 flex items-center justify-center text-slate-400">
                            <QrCode className="w-12 h-12 animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Info Columns */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center text-left leading-tight">
                        <div className="font-mono font-black text-sky-600 text-sm tracking-tight truncate">
                          {item.assetTag}
                        </div>
                        <div className="font-bold text-slate-900 text-xs truncate mt-0.5">
                          {item.manufacturer} {item.model}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{item.assetType}</div>

                        {includeSerial && item.serialNumber && (
                          <div className="text-[10px] font-mono text-slate-600 truncate mt-1">
                            S/N: {item.serialNumber}
                          </div>
                        )}

                        {includeDeptLocation && (
                          <div className="text-[10px] text-slate-600 truncate">
                            {item.department} • {item.location}
                          </div>
                        )}

                        {includeCustodian && item.assignedUser && (
                          <div className="text-[10px] text-sky-700 font-medium truncate">
                            Cust: {item.assignedUser}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Security Notice Footer */}
                    {includeSecurityNotice && (
                      <div className="text-[8px] font-semibold text-slate-400 text-center tracking-tight border-t border-slate-200 pt-1 mt-1 truncate uppercase">
                        Property of Hospital IT • Do Not Remove
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                {!isBatch && asset && (
                  <button
                    type="button"
                    onClick={() => handleDownloadJPEG(asset)}
                    disabled={isGeneratingJpeg}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                    title="Download high-resolution label image (JPEG format) with full equipment specifications and QR code"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-100" />
                    <span>{isGeneratingJpeg ? 'Saving JPEG...' : 'Download Label (JPEG)'}</span>
                  </button>
                )}

                {isBatch && (
                  <button
                    type="button"
                    onClick={handleDownloadAllJPEGs}
                    disabled={isGeneratingJpeg}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                    title="Download all selected asset labels as separate JPEG images"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-100" />
                    <span>{isGeneratingJpeg ? 'Saving JPEGs...' : `Download ${activeAssets.length} Labels (JPEG)`}</span>
                  </button>
                )}

                {!isBatch && asset && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPNG(asset)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                    title="Download raw QR Code matrix image"
                  >
                    <QrCode className="w-3.5 h-3.5 text-sky-600" />
                    <span>QR Matrix (PNG)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isGeneratingPdf ? 'Generating PDF...' : isBatch ? 'Multi-Page PDF' : 'PDF Label'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  id="print-qr-labels-btn"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isBatch ? `Print ${activeAssets.length} QR Labels` : 'Print QR Label'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
