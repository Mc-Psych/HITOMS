import React, { useState, useRef } from 'react';
import { type HospitalMemo, type SystemSettings, type User, type MemoStatus } from '../types';
import { Shield, CheckCircle2, Clock, FileText, Printer, Edit3, X, Sparkles, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface OfficialMemoLetterheadProps {
  memo: HospitalMemo;
  systemSettings?: SystemSettings | null;
  currentUser?: User | null;
  onPrint?: () => void;
  onEdit?: (memo: HospitalMemo) => void;
  onUpdateStatus?: (id: string, status: MemoStatus) => void;
  onOpenLetterheadModal?: () => void;
  onClose?: () => void;
  hideTopControlBar?: boolean;
}

export const OfficialMemoLetterhead: React.FC<OfficialMemoLetterheadProps> = ({
  memo,
  systemSettings,
  currentUser,
  onPrint,
  onEdit,
  onUpdateStatus,
  onOpenLetterheadModal,
  onClose,
  hideTopControlBar = false,
}) => {
  const hospitalName = systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital';
  const unitTitle = systemSettings?.letterheadSubTitle || 'St. Mary Theresa Catholic Hospital I.T Support Unit';
  const addressLine = systemSettings?.letterheadAddressLine || 'DODI PAPASE, KADJEBI DISTRICT - OTI REGION';
  const contactPhone = systemSettings?.contactPhone || '055 272 2289';
  const contactEmail = systemSettings?.contactEmail || 'send2smthit@gmail.com';
  const letterheadImage = systemSettings?.hospitalLetterheadImage;
  const letterheadMode = systemSettings?.letterheadMode || 'DYNAMIC_HEADER';
  const isPdfLetterhead = Boolean(
    letterheadImage &&
      (letterheadImage.startsWith('data:application/pdf') ||
        letterheadImage.includes('application/pdf') ||
        letterheadImage.toLowerCase().includes('.pdf'))
  );

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const memoCanvasRef = useRef<HTMLDivElement>(null);

  const isITUser = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'IT_ADMIN' || currentUser?.role === 'IT_OFFICER';
  const isITLeader = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'IT_ADMIN';
  const isAuthor = currentUser?.id === memo.fromSender.uid;
  const canApprove = isITLeader;

  // Format date as DD/MM/YYYY
  const memoDate = new Date(memo.createdAt || Date.now());
  const day = String(memoDate.getDate()).padStart(2, '0');
  const month = String(memoDate.getMonth() + 1).padStart(2, '0');
  const year = memoDate.getFullYear();
  const formattedDateStr = `${day}/${month}/${year}`;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!memoCanvasRef.current) return;
    setIsGeneratingPdf(true);

    const originalGetComputedStyle = window.getComputedStyle;
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;

    const cssRuleProto = CSSRule.prototype;
    const styleProto = CSSStyleDeclaration.prototype;

    const originalCssRuleCssTextDesc = Object.getOwnPropertyDescriptor(cssRuleProto, 'cssText');
    const originalStyleCssTextDesc = Object.getOwnPropertyDescriptor(styleProto, 'cssText');

    try {
      // Helper to convert oklch colors to standard rgb/rgba
      const oklchToRgb = (val: string): string => {
        if (!val || typeof val !== 'string' || !val.includes('oklch')) return val;
        try {
          const match = val.match(/oklch\(\s*([\d.%]+)\s+([\d.%]+)\s+([\d.deg%]+)(?:\s*\/\s*([\d.%]+))?\s*\)/i);
          if (!match) return val;

          let l = parseFloat(match[1]);
          if (match[1].endsWith('%')) l /= 100;
          
          let c = parseFloat(match[2]);
          if (match[2].endsWith('%')) c /= 100;
          
          let hStr = match[3];
          let h = parseFloat(hStr);
          if (hStr.endsWith('rad')) {
            h = h * (180 / Math.PI);
          } else if (hStr.endsWith('turn')) {
            h = h * 360;
          }
          
          let alphaStr = match[4];
          let alpha = 1;
          if (alphaStr) {
            alpha = parseFloat(alphaStr);
            if (alphaStr.endsWith('%')) alpha /= 100;
          }

          const hRad = h * (Math.PI / 180);
          const a = c * Math.cos(hRad);
          const b = c * Math.sin(hRad);

          const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
          const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
          const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

          const l_3 = l_ * l_ * l_;
          const m_3 = m_ * m_ * m_;
          const s_3 = s_ * s_ * s_;

          let r = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
          let g = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
          let b_rgb = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;

          const gamma = (x: number) => {
            if (x <= 0.0031308) return 12.92 * x;
            return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
          };

          const R = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
          const G = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
          const B = Math.max(0, Math.min(255, Math.round(gamma(b_rgb) * 255)));

          return alpha === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha})`;
        } catch (e) {
          console.warn('Error parsing oklch color:', val, e);
          return 'rgb(0, 0, 0)';
        }
      };

      const replaceOklchInString = (str: string): string => {
        if (!str || typeof str !== 'string' || !str.includes('oklch')) return str;
        return str.replace(/oklch\([^)]+\)/gi, (match) => {
          return oklchToRgb(match);
        });
      };

      // Monkeypatch window.getComputedStyle
      window.getComputedStyle = (elt, pseudoElt) => {
        const style = originalGetComputedStyle(elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return (propertyName: string) => {
                const originalValue = target.getPropertyValue(propertyName);
                if (originalValue && originalValue.includes('oklch')) {
                  return oklchToRgb(originalValue);
                }
                return originalValue;
              };
            }
            
            const val = (target as any)[prop];
            if (typeof val === 'string' && val.includes('oklch')) {
              return oklchToRgb(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };

      // Monkeypatch CSSStyleDeclaration prototype getPropertyValue
      CSSStyleDeclaration.prototype.getPropertyValue = function(this: CSSStyleDeclaration, property: string) {
        const val = originalGetPropertyValue.call(this, property);
        if (val && typeof val === 'string' && val.includes('oklch')) {
          return oklchToRgb(val);
        }
        return val;
      };

      // Monkeypatch cssText globally during html2canvas runtime to prevent style parsing crashes
      if (originalCssRuleCssTextDesc && originalCssRuleCssTextDesc.configurable) {
        Object.defineProperty(cssRuleProto, 'cssText', {
          get() {
            const val = originalCssRuleCssTextDesc.get?.call(this);
            if (val && typeof val === 'string' && val.includes('oklch')) {
              return replaceOklchInString(val);
            }
            return val;
          },
          configurable: true
        });
      }

      if (originalStyleCssTextDesc && originalStyleCssTextDesc.configurable) {
        Object.defineProperty(styleProto, 'cssText', {
          get() {
            const val = originalStyleCssTextDesc.get?.call(this);
            if (val && typeof val === 'string' && val.includes('oklch')) {
              return replaceOklchInString(val);
            }
            return val;
          },
          configurable: true
        });
      }

      const element = memoCanvasRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const cleanNum = (memo.memoNumber || 'MEMO').replace(/[/\\?%*:|"<>]/g, '_');
      pdf.save(`${cleanNum}_St_Mary_Theresa.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF file directly. Please use "Print MEMO" and select "Save as PDF".');
    } finally {
      // Restore original methods
      window.getComputedStyle = originalGetComputedStyle;
      CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
      if (originalCssRuleCssTextDesc) {
        Object.defineProperty(cssRuleProto, 'cssText', originalCssRuleCssTextDesc);
      }
      if (originalStyleCssTextDesc) {
        Object.defineProperty(styleProto, 'cssText', originalStyleCssTextDesc);
      }
      setIsGeneratingPdf(false);
    }
  };

  const getStatusBadge = (status: HospitalMemo['status']) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Published</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Approved</span>
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Under Review</span>
          </span>
        );
      case 'DRAFT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Draft</span>
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full bg-white text-slate-900 font-serif print:bg-white print:text-black">
      {/* Optional Top Control Bar for UI modals */}
      {!hideTopControlBar && (
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 font-sans print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded border border-sky-200 dark:border-sky-800">
              {memo.memoNumber}
            </span>
            {getStatusBadge(memo.status)}
          </div>

          <div className="flex items-center gap-2">
            {isITLeader && onOpenLetterheadModal && (
              <button
                type="button"
                onClick={onOpenLetterheadModal}
                className="px-3 py-1.5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 text-sky-700 dark:text-sky-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Configure official hospital letterhead"
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Configure Letterhead</span>
              </button>
            )}

            {canApprove && memo.status !== 'PUBLISHED' && onUpdateStatus && (
              <button
                type="button"
                onClick={() => onUpdateStatus(memo.id, 'PUBLISHED')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Publish Memo</span>
              </button>
            )}

            {(isITLeader || isAuthor) && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(memo)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Memo</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="Download official PDF document"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Print official memorandum"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print MEMO</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* MEMO DOCUMENT PAPER CANVAS */}
      <div ref={memoCanvasRef} className="p-8 sm:p-12 md:p-16 max-w-4xl mx-auto space-y-6 print:p-0 print:max-w-none print:w-full bg-white text-slate-900">
        
        {/* GRAPHIC BANNER OVERLAY MODE */}
        {letterheadImage && (letterheadMode === 'CUSTOM_BANNER' || letterheadMode === 'HEADER_AND_BANNER') && (
          <div className="w-full mb-6 border-b border-slate-200 pb-4 print:pb-0">
            {isPdfLetterhead ? (
              <div className="w-full h-44 sm:h-52 rounded-lg overflow-hidden border border-slate-200 bg-white">
                <object
                  data={letterheadImage}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <iframe
                    src={`${letterheadImage}#toolbar=0&navpanes=0`}
                    className="w-full h-full border-none"
                    title="Hospital Letterhead PDF"
                  />
                </object>
              </div>
            ) : (
              <img
                src={letterheadImage}
                alt="Official Letterhead Banner"
                className="w-full max-h-44 object-contain sm:object-cover mx-auto"
              />
            )}
          </div>
        )}

        {/* DYNAMIC / STANDARD HEADER MODE */}
        {(letterheadMode === 'DYNAMIC_HEADER' || letterheadMode === 'HEADER_AND_BANNER' || !letterheadImage) && (
          <div className="border-b-2 border-slate-900 pb-3 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              
              {/* Left Column: Catholic Health Service Trust & Hospital Logos with green aligned text underneath */}
              <div className="flex flex-col items-start gap-1.5 max-w-[450px] text-left">
                <div className="flex items-center gap-3">
                  {/* Logo 1: Catholic Health Service Trust Emblem */}
                  <div className="w-16 h-16 sm:w-18 sm:h-18 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      {/* Outer Green Ring */}
                      <circle cx="50" cy="50" r="46" fill="none" stroke="#047857" strokeWidth="4" />
                      {/* Inner Circle */}
                      <circle cx="50" cy="50" r="38" fill="#f8fafc" stroke="#dc2626" strokeWidth="2" />
                      {/* Red Cross Symbol */}
                      <path d="M44 22 h12 v18 h18 v12 h-18 v22 h-12 v-22 h-18 v-12 h18 z" fill="#dc2626" />
                      {/* Center Medical Emblem */}
                      <circle cx="50" cy="50" r="7" fill="#047857" />
                      <path d="M50 45 v10 M45 50 h10" stroke="#ffffff" strokeWidth="2" />
                    </svg>
                  </div>

                  {/* Logo 2: St. Mary Theresa Portrait Image Badge */}
                  {systemSettings?.hospitalLogo ? (
                    <img
                      src={systemSettings.hospitalLogo}
                      alt="Hospital Logo"
                      className="w-14 h-14 object-contain rounded-lg shrink-0 border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-16 sm:w-14 sm:h-18 shrink-0 flex items-center justify-center border-2 border-amber-500 rounded bg-slate-100 overflow-hidden shadow-xs relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-200 opacity-60"></div>
                      <svg viewBox="0 0 40 50" className="w-full h-full z-10">
                        <circle cx="20" cy="18" r="10" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                        <path d="M10 22 c0 -10 6 -14 10 -14 s10 4 10 14 c0 6 -1 16 -3 18 h-14 c-2 -2 -3 -12 -3 -18 z" fill="#1e293b" />
                        <ellipse cx="20" cy="20" rx="6" ry="8" fill="#ffedd5" />
                        <path d="M14 24 q6 6 12 0" fill="#ffffff" />
                        <circle cx="18" cy="18" r="0.7" fill="#0f172a" />
                        <circle cx="22" cy="18" r="0.7" fill="#0f172a" />
                        <path d="M18 22 q2 2 4 0" stroke="#0f172a" strokeWidth="0.5" fill="none" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Left Header Aligned Text - Forest Green Color */}
                <div className="text-[10px] sm:text-[11px] font-sans font-extrabold uppercase leading-tight text-emerald-800 tracking-wider">
                  <div className="font-black">CATHOLIC HEALTH</div>
                  <div>SERVICE TRUST - GHANA</div>
                  <div className="text-[9px] font-bold text-emerald-700">(JASIKAN DIOCESE)</div>
                  <div className="font-black mt-1">{hospitalName}</div>
                  <div>CATHOLIC HOSPITAL</div>
                  <div className="text-[8px] font-bold tracking-tighter text-slate-600 mt-0.5 normal-case font-mono">{addressLine}</div>
                </div>
              </div>

              {/* Right Column: IT Support Unit Title & Contact Details */}
              <div className="text-left sm:text-right space-y-0.5">
                <h1 className="text-sm sm:text-base md:text-lg font-serif font-bold italic text-slate-900 leading-tight">
                  {unitTitle}
                </h1>
                <p className="text-xs font-sans text-slate-800">
                  <span className="font-semibold">Tel:</span> {contactPhone}
                </p>
                <p className="text-xs font-sans text-slate-800">
                  <span className="font-semibold">E-mail:</span>{' '}
                  <a href={`mailto:${contactEmail}`} className="text-blue-900 underline font-medium hover:text-blue-700">
                    {contactEmail}
                  </a>
                </p>
              </div>

            </div>
          </div>
        )}

        {/* MEMO CENTERED HEADING WITH THICK UNDERLINE */}
        <div className="text-center pt-2 pb-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black tracking-widest text-slate-950 uppercase inline-block border-b-4 border-slate-950 pb-1">
            MEMO
          </h1>
        </div>

        {/* METADATA BLOCK (TO, DATE, SUBJECT) */}
        <div className="space-y-2 text-sm sm:text-base font-serif border-b border-slate-200 pb-4">
          <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-start">
            <span className="font-bold text-slate-950">TO</span>
            <div className="flex items-start">
              <span className="font-bold mr-2">:</span>
              <span className="font-bold uppercase tracking-wide text-slate-900">
                {memo.targetAudience || 'THE HOSPITAL MANAGER'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-start">
            <span className="font-bold text-slate-950">DATE</span>
            <div className="flex items-start">
              <span className="font-bold mr-2">:</span>
              <span className="text-slate-900">{formattedDateStr}</span>
            </div>
          </div>

          <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-start">
            <span className="font-bold text-slate-950">SUBJECT</span>
            <div className="flex items-start">
              <span className="font-bold mr-2">:</span>
              <span className="font-bold uppercase tracking-wide text-slate-950 underline decoration-2 underline-offset-2">
                {memo.title}
              </span>
            </div>
          </div>
        </div>

        {/* MEMO BODY CONTENT */}
        <div className="space-y-6 pt-2 text-slate-900 text-sm sm:text-base font-serif leading-relaxed">
          
          {/* Main Content / Executive Summary */}
          {memo.executiveSummary && (
            <p className="whitespace-pre-line text-justify">
              {memo.executiveSummary}
            </p>
          )}

          {/* Background and Operational Context */}
          {memo.backgroundAndContext && (
            <div className="space-y-2">
              <h3 className="font-bold underline text-slate-950 text-base sm:text-lg">
                Background & Context
              </h3>
              <p className="whitespace-pre-line text-justify">
                {memo.backgroundAndContext}
              </p>
            </div>
          )}

          {/* Technical & Operational Directives / Specifications */}
          {memo.detailedFindingsOrBody && (
            <div className="space-y-2">
              {/* Look for specification or main text */}
              {!memo.detailedFindingsOrBody.toLowerCase().includes('specification') && (
                <h3 className="font-bold underline text-slate-950 text-base sm:text-lg">
                  Specification
                </h3>
              )}
              <div className="whitespace-pre-line leading-relaxed font-serif text-slate-900">
                {memo.detailedFindingsOrBody}
              </div>
            </div>
          )}

          {/* Action Required / Checklist Items */}
          {memo.actionRequiredOrChecklist && memo.actionRequiredOrChecklist.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="font-bold underline text-slate-950 text-base sm:text-lg">
                Action Required
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {memo.actionRequiredOrChecklist.map((item, idx) => (
                  <li key={idx} className="text-slate-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* CLOSING & SIGNATURE BLOCK */}
        <div className="pt-8 space-y-6 font-serif">
          <p className="text-base text-slate-900">
            Thank you.
          </p>

          <div className="pt-4 space-y-1">
            {/* Signature Space / Line */}
            <div className="h-10 border-b border-dashed border-slate-300 w-48 mb-2 opacity-50"></div>
            
            <p className="font-bold text-slate-950 text-base sm:text-lg leading-tight">
              {memo.fromSender?.name || 'Courage Kekesi'}
            </p>
            <p className="text-slate-800 text-sm sm:text-base font-semibold leading-tight">
              {memo.fromSender?.title || 'Snr. IT Officer'}
            </p>
          </div>
        </div>

        {/* OFFICIAL FOOTER / CONFIDENTIALITY LINE */}
        <div className="pt-12 border-t border-slate-200 text-center font-sans">
          <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            {systemSettings?.letterheadFooterText || 'ST. MARY THERESA CATHOLIC HOSPITAL — DEPARTMENT OF INFORMATION TECHNOLOGY'}
          </p>
        </div>

      </div>
    </div>
  );
};
