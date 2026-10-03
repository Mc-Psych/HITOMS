import QRCode from 'qrcode';
import { type Asset } from '../types';

export interface QrLabelRenderOptions {
  hospitalName?: string;
  labelSize?: 'compact' | 'standard' | 'large';
  includeHospitalHeader?: boolean;
  includeSerial?: boolean;
  includeDeptLocation?: boolean;
  includeCustodian?: boolean;
  includeSecurityNotice?: boolean;
  scale?: number;
  // Dynamic Label Content Overrides for Admins & IT Staff
  customHospitalHeader?: string;
  customBadgeText?: string;
  customAssetTag?: string;
  customModelText?: string;
  customAssetType?: string;
  customSerialNumber?: string;
  customDeptLocation?: string;
  customCustodian?: string;
  customFooterNotice?: string;
}

/**
 * Generates rich formatted metadata string to be embedded into the QR code matrix.
 * Encodes hospital, asset tag, model, serial number, department, location, custodian, and specifications.
 */
export function generateAssetQrMetadataPayload(
  asset: Partial<Asset>,
  hospitalNameOrOptions: string | QrLabelRenderOptions = 'SMTCH ITSUPPORT UNIT'
): string {
  const options: QrLabelRenderOptions =
    typeof hospitalNameOrOptions === 'string'
      ? { hospitalName: hospitalNameOrOptions }
      : hospitalNameOrOptions || {};

  const hospital = options.customHospitalHeader || options.hospitalName || 'SMTCH ITSUPPORT UNIT';
  const tag = options.customAssetTag || asset.assetTag || 'N/A';
  const assetName =
    options.customModelText ||
    `${asset.manufacturer || ''} ${asset.model || ''}`.trim() ||
    asset.assetType ||
    'IT Equipment';
  const serial = options.customSerialNumber || asset.serialNumber || 'N/A';
  const deptLoc =
    options.customDeptLocation ||
    `${asset.department || 'IT Unit'}${asset.location ? ` - ${asset.location}` : ''}`;
  const custodian = options.customCustodian || asset.assignedUser || '';
  const typeText = options.customAssetType || asset.assetType || '';
  const footer = options.customFooterNotice || 'PROPERTY OF SMTCH • DO NOT REMOVE';

  const lines: string[] = [
    `🏥 ${hospital}`,
    `🏷️ ASSET TAG: ${tag}`,
    `💻 NAME: ${assetName}`,
    `🔢 SERIAL (S/N): ${serial}`,
    `🏢 DEPT / LOC: ${deptLoc}`,
  ];

  if (custodian) {
    lines.push(`👤 CUSTODIAN: ${custodian}`);
  }
  if (typeText) {
    lines.push(`📦 TYPE: ${typeText}`);
  }
  if (asset.status || asset.condition) {
    lines.push(`⚡ STATUS: ${asset.status || 'Active'} (${asset.condition || 'Good'})`);
  }
  if (asset.ipAddress) {
    lines.push(`🌐 IP: ${asset.ipAddress}`);
  }
  if (asset.operatingSystem) {
    lines.push(`💿 OS: ${asset.operatingSystem}`);
  }

  lines.push(`🔒 ${footer}`);

  return lines.join('\n');
}

/**
 * Helper to draw a rounded rectangle on a canvas context
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Truncates text with ellipsis if it exceeds maxWidth
 */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Renders an off-screen HTML5 Canvas containing the EXACT visual layout of the
 * print preview card in AssetQRLabelModal.
 */
export async function renderAssetLabelCanvas(
  asset: Asset,
  options: QrLabelRenderOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    hospitalName = 'REGIONAL HOSPITAL IT UNIT',
    labelSize = 'standard',
    includeHospitalHeader = true,
    includeSerial = true,
    includeDeptLocation = true,
    includeCustodian = true,
    includeSecurityNotice = true,
    scale = 3, // 3x for ultra-sharp high-DPI rendering (300+ DPI equivalent)
    customHospitalHeader,
    customBadgeText,
    customAssetTag,
    customModelText,
    customAssetType,
    customSerialNumber,
    customDeptLocation,
    customCustodian,
    customFooterNotice,
  } = options;

  const activeHospitalName = customHospitalHeader || hospitalName || 'SMTCH ITSUPPORT UNIT';
  const activeBadgeText = customBadgeText || 'IT ASSET';
  const activeTag = customAssetTag || asset.assetTag || 'TAG-0000';
  const activeModel =
    customModelText ||
    `${asset.manufacturer || ''} ${asset.model || ''}`.trim() ||
    'IT Equipment';
  const activeType = customAssetType !== undefined ? customAssetType : asset.assetType;
  const activeSerial = customSerialNumber !== undefined ? customSerialNumber : asset.serialNumber;
  const activeDeptLoc =
    customDeptLocation !== undefined
      ? customDeptLocation
      : [asset.department || 'IT Unit', asset.location].filter(Boolean).join(' • ');
  const activeCustodian =
    customCustodian !== undefined ? customCustodian : asset.assignedUser;
  const activeFooter =
    customFooterNotice || 'PROPERTY OF SMTCH • DO NOT REMOVE';

  // Set card dimensions matching the exact print preview aspect ratios
  // Standard: 320 x 176 (approx 3" x 2" label)
  // Compact: 288 x 144 (approx 2" x 1" label)
  // Large: 384 x 224 (approx 4" x 3" label badge)
  let baseWidth = 320;
  let baseHeight = 176;

  if (labelSize === 'compact') {
    baseWidth = 288;
    baseHeight = 144;
  } else if (labelSize === 'large') {
    baseWidth = 384;
    baseHeight = 224;
  }

  const canvasWidth = baseWidth * scale;
  const canvasHeight = baseHeight * scale;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background - pure white with padding
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Outer Card Frame (matching: bg-white rounded-xl border-2 border-slate-900)
  const cardPadding = 6 * scale;
  const cardX = cardPadding;
  const cardY = cardPadding;
  const cardW = canvasWidth - cardPadding * 2;
  const cardH = canvasHeight - cardPadding * 2;
  const cardRadius = 12 * scale;

  // Card background & solid border
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();

  ctx.strokeStyle = '#0f172a'; // slate-900
  ctx.lineWidth = 2.5 * scale;
  ctx.stroke();

  const innerPad = (labelSize === 'compact' ? 8 : labelSize === 'large' ? 14 : 11) * scale;
  let currentY = cardY + innerPad;

  // 1. Header (matching: bg-slate-900 text-white font-bold px-2 py-0.5 rounded flex items-center justify-between)
  if (includeHospitalHeader) {
    const headerHeight = (labelSize === 'compact' ? 18 : labelSize === 'large' ? 24 : 21) * scale;
    const headerX = cardX + innerPad;
    const headerY = currentY;
    const headerW = cardW - innerPad * 2;
    const headerRadius = 4 * scale;

    ctx.fillStyle = '#0f172a'; // slate-900
    drawRoundedRect(ctx, headerX, headerY, headerW, headerHeight, headerRadius);
    ctx.fill();

    // Right Badge: IT ASSET (bg-sky-500 text-white uppercase)
    const badgeTextFormatted = activeBadgeText.toUpperCase();
    ctx.font = `bold ${8 * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    const measuredBadgeW = ctx.measureText(badgeTextFormatted).width + 12 * scale;
    const badgeW = Math.max((labelSize === 'compact' ? 44 : 54) * scale, measuredBadgeW);
    const badgeH = headerHeight - 4 * scale;
    const badgeX = headerX + headerW - badgeW - 3 * scale;
    const badgeY = headerY + 2 * scale;
    const badgeRadius = 3 * scale;

    ctx.fillStyle = '#0ea5e9'; // sky-500
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeRadius);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeTextFormatted, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // Left text: Hospital Name
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${(labelSize === 'compact' ? 9 : labelSize === 'large' ? 11 : 10) * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxHospitalNameWidth = headerW - badgeW - 14 * scale;
    const displayHospitalName = truncateText(ctx, activeHospitalName.toUpperCase(), maxHospitalNameWidth);
    ctx.fillText(displayHospitalName, headerX + 6 * scale, headerY + headerHeight / 2);

    currentY += headerHeight + 6 * scale;
  }

  // 2. Middle Section (QR Code on Left + Info Column on Right)
  // Calculate footer space requirement first
  const footerHeight = includeSecurityNotice ? 16 * scale : 0;
  const middleAreaHeight = cardY + cardH - innerPad - footerHeight - currentY;

  // Generate QR code data URL with full metadata
  const payload = generateAssetQrMetadataPayload(asset, options);
  const qrDataUrl = await QRCode.toDataURL(payload, {
    width: 320 * scale,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = (e) => reject(e);
    qrImg.src = qrDataUrl;
  });

  // QR Box Dimensions (matching preview: rounded-lg border border-slate-300)
  const qrBoxSize = Math.min(
    middleAreaHeight - 4 * scale,
    (labelSize === 'compact' ? 68 : labelSize === 'large' ? 104 : 84) * scale
  );
  const qrBoxX = cardX + innerPad;
  const qrBoxY = currentY + (middleAreaHeight - qrBoxSize) / 2;
  const qrBoxRadius = 6 * scale;

  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, qrBoxRadius);
  ctx.fill();

  ctx.strokeStyle = '#cbd5e1'; // slate-300
  ctx.lineWidth = 1 * scale;
  ctx.stroke();

  // Draw QR Image inside box with 3*scale padding
  const qrImgPad = 3 * scale;
  ctx.drawImage(
    qrImg,
    qrBoxX + qrImgPad,
    qrBoxY + qrImgPad,
    qrBoxSize - qrImgPad * 2,
    qrBoxSize - qrImgPad * 2
  );

  // Right Info Column
  const textX = qrBoxX + qrBoxSize + 10 * scale;
  const textMaxW = cardX + cardW - innerPad - textX;
  let textY = qrBoxY + 2 * scale;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 1. Asset Tag (matching: font-mono font-black text-sky-600 text-sm tracking-tight truncate)
  ctx.fillStyle = '#0284c7'; // sky-600
  ctx.font = `900 ${(labelSize === 'compact' ? 12 : labelSize === 'large' ? 17 : 14) * scale}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  const displayTag = truncateText(ctx, activeTag, textMaxW);
  ctx.fillText(displayTag, textX, textY);
  textY += (labelSize === 'compact' ? 13 : labelSize === 'large' ? 19 : 16) * scale;

  // 2. Hardware Model (matching: font-bold text-slate-900 text-xs truncate mt-0.5)
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.font = `bold ${(labelSize === 'compact' ? 9.5 : labelSize === 'large' ? 13 : 11) * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  const displayModel = truncateText(ctx, activeModel, textMaxW);
  ctx.fillText(displayModel, textX, textY);
  textY += (labelSize === 'compact' ? 11 : labelSize === 'large' ? 15 : 13) * scale;

  // 3. Asset Type (matching: text-[10px] text-slate-500 truncate)
  if (activeType) {
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = `${(labelSize === 'compact' ? 8.5 : labelSize === 'large' ? 11 : 9.5) * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    const displayType = truncateText(ctx, activeType, textMaxW);
    ctx.fillText(displayType, textX, textY);
    textY += (labelSize === 'compact' ? 10 : labelSize === 'large' ? 14 : 12) * scale;
  }

  // 4. Serial Number (matching: text-[10px] font-mono text-slate-600 truncate mt-1)
  if (includeSerial && activeSerial) {
    ctx.fillStyle = '#475569'; // slate-600
    ctx.font = `600 ${(labelSize === 'compact' ? 8.5 : labelSize === 'large' ? 11 : 9.5) * scale}px ui-monospace, SFMono-Regular, monospace`;
    const displaySerial = truncateText(
      ctx,
      activeSerial.startsWith('S/N:') ? activeSerial : `S/N: ${activeSerial}`,
      textMaxW
    );
    ctx.fillText(displaySerial, textX, textY);
    textY += (labelSize === 'compact' ? 10 : labelSize === 'large' ? 14 : 12) * scale;
  }

  // 5. Department & Location (matching: text-[10px] text-slate-600 truncate)
  if (includeDeptLocation && activeDeptLoc) {
    ctx.fillStyle = '#475569'; // slate-600
    ctx.font = `${(labelSize === 'compact' ? 8.5 : labelSize === 'large' ? 11 : 9.5) * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    const displayDept = truncateText(ctx, activeDeptLoc, textMaxW);
    ctx.fillText(displayDept, textX, textY);
    textY += (labelSize === 'compact' ? 10 : labelSize === 'large' ? 14 : 12) * scale;
  }

  // 6. Assigned Custodian (matching: text-[10px] text-sky-700 font-medium truncate)
  if (includeCustodian && activeCustodian) {
    ctx.fillStyle = '#0369a1'; // sky-700
    ctx.font = `600 ${(labelSize === 'compact' ? 8.5 : labelSize === 'large' ? 11 : 9.5) * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    const displayCust = truncateText(
      ctx,
      activeCustodian.startsWith('Cust:') ? activeCustodian : `Cust: ${activeCustodian}`,
      textMaxW
    );
    ctx.fillText(displayCust, textX, textY);
  }

  // 3. Footer (matching: text-[8px] font-semibold text-slate-400 text-center tracking-tight border-t border-slate-200 pt-1 mt-1 truncate uppercase)
  if (includeSecurityNotice) {
    const footerY = cardY + cardH - innerPad - 2 * scale;
    const footerLineY = footerY - 10 * scale;

    // Top border line
    ctx.strokeStyle = '#e2e8f0'; // slate-200
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(cardX + innerPad, footerLineY);
    ctx.lineTo(cardX + cardW - innerPad, footerLineY);
    ctx.stroke();

    // Footer Text
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = `600 ${(labelSize === 'compact' ? 7.5 : labelSize === 'large' ? 9.5 : 8) * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayFooter = truncateText(ctx, activeFooter.toUpperCase(), cardW - innerPad * 2);
    ctx.fillText(displayFooter, cardX + cardW / 2, footerY - 2 * scale);
  }

  return canvas;
}

/**
 * Returns high-resolution JPEG Data URL rendered exactly as the print preview design
 */
export async function renderAssetQrJpegDataUrl(
  asset: Asset,
  options: QrLabelRenderOptions = {}
): Promise<string> {
  const canvas = await renderAssetLabelCanvas(asset, options);
  return canvas.toDataURL('image/jpeg', 0.98);
}

/**
 * Triggers a direct download of the asset's QR label JPEG image formatted exactly as preview
 */
export async function downloadAssetQrJpeg(
  asset: Asset,
  optionsOrHospitalName?: string | QrLabelRenderOptions
): Promise<void> {
  const options: QrLabelRenderOptions =
    typeof optionsOrHospitalName === 'string'
      ? { hospitalName: optionsOrHospitalName }
      : optionsOrHospitalName || {};

  const dataUrl = await renderAssetQrJpegDataUrl(asset, options);
  const tag = options.customAssetTag || asset.assetTag || 'ASSET';
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `ASSET-LABEL-${tag}.jpeg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
