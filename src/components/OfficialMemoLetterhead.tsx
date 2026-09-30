import React, { useState, useRef } from 'react';
import { type HospitalMemo, type SystemSettings, type User, type MemoStatus } from '../types';
import { Shield, CheckCircle2, Clock, FileText, Printer, Edit3, X, Sparkles, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

const renderFormattedCellText = (cellText: string) => {
  const trimmed = cellText.trim();
  if (!trimmed) return <span className="text-slate-300">-</span>;
  const parts = trimmed.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} className="font-bold text-slate-950 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <em key={index} className="italic text-slate-800 dark:text-slate-200">
              {part.slice(1, -1)}
            </em>
          );
        }
        return part;
      })}
    </>
  );
};

const renderContentWithMarkdownTables = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentParagraphLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableKey = 0;

  const renderCurrentParagraph = () => {
    if (currentParagraphLines.length > 0) {
      elements.push(
        <p key={`p-${elements.length}`} className="whitespace-pre-line text-justify mb-4">
          {currentParagraphLines.join('\n')}
        </p>
      );
      currentParagraphLines = [];
    }
  };

  const renderCurrentTable = () => {
    if (tableRows.length > 0) {
      const hasSeparator =
        tableRows.length > 1 &&
        tableRows[1].every((cell) => cell.trim().match(/^:?-+:?$/) || cell.trim() === '');

      const headers = hasSeparator ? tableRows[0] : [];
      const separatorRow = hasSeparator ? tableRows[1] : [];
      const dataRows = hasSeparator ? tableRows.slice(2) : tableRows;

      // Determine column alignments from separator
      const alignments = separatorRow.map((sep) => {
        const s = sep.trim();
        if (s.startsWith(':') && s.endsWith(':')) return 'center';
        if (s.endsWith(':')) return 'right';
        return 'left';
      });

      elements.push(
        <div
          key={`table-container-${tableKey++}`}
          className="overflow-x-auto my-5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          <table className="min-w-full text-xs sm:text-sm border-collapse">
            {headers.length > 0 && (
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700">
                  {headers.map((h, idx) => {
                    const align = alignments[idx] || 'left';
                    const alignClass =
                      align === 'center'
                        ? 'text-center'
                        : align === 'right'
                        ? 'text-right'
                        : 'text-left';
                    return (
                      <th
                        key={`th-${idx}`}
                        className={`px-3 py-2.5 font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 border-r border-slate-300 dark:border-slate-700 last:border-r-0 ${alignClass}`}
                      >
                        {renderFormattedCellText(h)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {dataRows.map((row, rowIdx) => (
                <tr
                  key={`tr-${rowIdx}`}
                  className={`${
                    rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/40'
                  } hover:bg-sky-50/40 transition`}
                >
                  {row.map((cell, cellIdx) => {
                    const align = alignments[cellIdx] || 'left';
                    const alignClass =
                      align === 'center'
                        ? 'text-center'
                        : align === 'right'
                        ? 'text-right'
                        : 'text-left';
                    return (
                      <td
                        key={`td-${cellIdx}`}
                        className={`px-3 py-2 text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${alignClass}`}
                      >
                        {renderFormattedCellText(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');

    if (isTableLine) {
      renderCurrentParagraph();
      inTable = true;
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
    } else {
      if (inTable) {
        renderCurrentTable();
        inTable = false;
      }
      currentParagraphLines.push(line);
    }
  }

  renderCurrentParagraph();
  renderCurrentTable();

  return <>{elements}</>;
};

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
      <div ref={memoCanvasRef} className="p-8 sm:p-12 md:p-16 max-w-4xl mx-auto space-y-6 print:p-8 print:max-w-none print:w-full bg-white text-slate-900">
        
        {/* DYNAMIC / STANDARD HEADER MODE */}
        <div className="border-b-2 border-slate-900 pb-3 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            {/* Left Column: System Logo only (without additional texts underneath) */}
            <div className="flex flex-col items-start text-left max-w-[170px]">
              {(memo.hospitalLogo || systemSettings?.hospitalLogo) ? (
                 <img
                   src={memo.hospitalLogo || systemSettings?.hospitalLogo}
                   alt="Hospital Logo"
                   className="max-w-[160px] max-h-18 object-contain border-none"
                 />
              ) : (
                /* Native high-fidelity HTML/CSS reconstruction of Proposed Logo2 as fallback */
                <div className="border border-slate-200 rounded-xl p-1.5 bg-white text-center font-sans max-w-[80px] shadow-xs shrink-0 flex items-center justify-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {/* Left: Catholic Health Circle Emblem */}
                    <div className="w-6 h-6 shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <circle cx="50" cy="50" r="46" fill="none" stroke="#047857" strokeWidth="4" />
                        <circle cx="50" cy="50" r="38" fill="#f8fafc" stroke="#dc2626" strokeWidth="2" />
                        <path d="M44 22 h12 v18 h18 v12 h-18 v22 h-12 v-22 h-18 v-12 h-18 z" fill="#dc2626" />
                        <circle cx="50" cy="50" r="7" fill="#047857" />
                        <path d="M50 45 v10 M45 50 h10" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                    </div>

                    {/* Divider */}
                    <div className="h-5 w-[1px] bg-slate-400"></div>

                    {/* Right: St. Mary Theresa Portrait fallback */}
                    <div className="w-6 h-6 shrink-0 rounded bg-slate-100 border border-slate-300 overflow-hidden relative shadow-3xs">
                      <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-200 opacity-40"></div>
                      <svg viewBox="0 0 40 50" className="w-full h-full z-10">
                        <circle cx="20" cy="18" r="10" fill="none" stroke="#d97706" strokeWidth="1.5" />
                        <path d="M10 22 c0 -10 6 -14 10 -14 s10 4 10 14 c0 6 -1 16 -3 18 h-14 z" fill="#1e293b" />
                        <ellipse cx="20" cy="20" rx="6" ry="8" fill="#ffedd5" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: IT Support Unit Title & Contact Details */}
            <div className="text-left sm:text-right space-y-0.5">
              <h1 className="text-sm sm:text-base md:text-lg font-serif font-bold italic text-slate-900 leading-tight">
                {memo.headerUnitName || unitTitle}
              </h1>
              <p className="text-xs font-sans text-slate-800">
                <span className="font-semibold">Tel:</span> {memo.headerPhone || contactPhone}
              </p>
              <p className="text-xs font-sans text-slate-800">
                <span className="font-semibold">E-mail:</span>{' '}
                <a href={`mailto:${memo.headerEmail || contactEmail}`} className="text-blue-900 underline font-medium hover:text-blue-700">
                  {memo.headerEmail || contactEmail}
                </a>
              </p>
            </div>

          </div>
        </div>

        {/* Content below header in Times New Roman */}
        <div style={{ fontFamily: "'Times New Roman', Times, serif" }} className="space-y-6">
          {/* MEMO CENTERED HEADING */}
          <div className="text-center pt-2 pb-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black tracking-widest text-slate-950 uppercase inline-block pb-1">
              {memo.documentTypeText || 'MEMO'}
            </h1>
          </div>

          {/* METADATA BLOCK (TO, DATE, SUBJECT) */}
          <div className="space-y-2 text-sm sm:text-base border-b border-slate-200 pb-4" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-start">
              <span className="font-bold text-slate-950">TO</span>
              <div className="flex items-start">
                <span className="font-bold mr-2">:</span>
                <span className="font-bold uppercase tracking-wide text-slate-900">
                  {memo.targetAudience || 'THE HOSPITAL MANAGER'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-start" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              <span className="font-bold text-slate-950">DATE</span>
              <div className="flex items-start">
                <span className="font-bold mr-2">:</span>
                <span className="text-slate-900">{memo.memoDate || formattedDateStr}</span>
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
            {memo.executiveSummary && renderContentWithMarkdownTables(memo.executiveSummary)}

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
              {memo.officerSignature ? (
                memo.officerSignature.startsWith('data:image/') ? (
                  <img src={memo.officerSignature} className="max-h-16 max-w-[200px] object-contain block mb-2" alt="Officer Signature" />
                ) : (
                  <div className="text-xl sm:text-2xl text-blue-800 dark:text-blue-900 font-serif italic tracking-wide font-black" style={{ fontFamily: "'Dancing Script', 'Cursive', 'Brush Script MT', serif" }}>
                    {memo.officerSignature}
                  </div>
                )
              ) : (
                <div className="h-6"></div>
              )}
              <div className="border-b border-dashed border-slate-300 w-48 mb-2 opacity-50"></div>
              
              <p className="font-bold text-slate-950 text-base sm:text-lg leading-tight">
                {memo.officerName || memo.fromSender?.name || 'Courage Kekesi'}
              </p>
              <p className="text-slate-800 text-sm sm:text-base font-semibold leading-tight">
                {memo.officerTitle || memo.fromSender?.title || 'Snr. IT Officer'}
              </p>
            </div>
          </div>

          {/* OFFICIAL FOOTER / CONFIDENTIALITY LINE */}
          <div className="pt-12 border-t border-slate-200 text-center">
            <p className="text-[10px] sm:text-[11px] text-slate-500 uppercase tracking-wider">
              {systemSettings?.letterheadFooterText || 'ST. MARY THERESA CATHOLIC HOSPITAL — DEPARTMENT OF INFORMATION TECHNOLOGY'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
