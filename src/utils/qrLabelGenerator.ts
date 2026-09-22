import QRCode from 'qrcode';
import { type Asset } from '../types';

export interface QrLabelRenderOptions {
  hospitalName?: string;
  includeHospitalHeader?: boolean;
  includeSerial?: boolean;
  includeDeptLocation?: boolean;
  includeCustodian?: boolean;
  includeSecurityNotice?: boolean;
  scale?: number;
}

/**
 * Generates rich formatted metadata string to be embedded into the QR code matrix.
 * Includes Name, Serial, Assigned Department, Location, Custodian, and Tag.
 */
export function generateAssetQrMetadataPayload(
  asset: Partial<Asset>,
  hospitalName = 'REGIONAL HOSPITAL IT UNIT'
): string {
  const assetName = `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || asset.assetType || 'IT Equipment';
  
  const lines: string[] = [
    `🏥 ${hospitalName}`,
    `🏷️ ASSET TAG: ${asset.assetTag || 'N/A'}`,
    `💻 NAME: ${assetName}`,
    `🔢 SERIAL (S/N): ${asset.serialNumber || 'N/A'}`,
    `🏢 ASSIGNED DEPT: ${asset.department || 'N/A'}`,
  ];

  if (asset.location) {
    lines.push(`📍 LOCATION: ${asset.location}`);
  }
  if (asset.assignedUser) {
    lines.push(`👤 CUSTODIAN: ${asset.assignedUser}`);
  }
  if (asset.assetType) {
    lines.push(`📦 TYPE: ${asset.assetType}`);
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

  lines.push(`🔒 PROPERTY OF HOSPITAL IT • DO NOT REMOVE`);

  return lines.join('\n');
}

/**
 * Renders a high-resolution JPEG Data URL where the QR code image is placed at the top,
 * and text details (Asset Name, Serial, Assigned Department, etc.) are rendered directly
 * below the QR code image for instant manual visual identification.
 */
export async function renderAssetQrJpegDataUrl(
  asset: Asset,
  options: QrLabelRenderOptions = {}
): Promise<string> {
  const {
    hospitalName = 'REGIONAL HOSPITAL IT UNIT',
    includeHospitalHeader = true,
    includeSerial = true,
    includeDeptLocation = true,
    includeCustodian = true,
    includeSecurityNotice = true,
    scale = 2,
  } = options;

  // Generate QR Code matrix using rich metadata payload
  const payload = generateAssetQrMetadataPayload(asset, hospitalName);
  const qrDataUrl = await QRCode.toDataURL(payload, {
    width: 320 * scale,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  // Load QR image onto offscreen canvas
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = (e) => reject(e);
    qrImg.src = qrDataUrl;
  });

  // Canvas Dimensions: 420 x 580 (base) * scale
  const canvasWidth = 440 * scale;
  const canvasHeight = 620 * scale;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Outer border & subtle container frame
  ctx.strokeStyle = '#0284c7'; // sky-600
  ctx.lineWidth = 3 * scale;
  ctx.strokeRect(8 * scale, 8 * scale, canvasWidth - 16 * scale, canvasHeight - 16 * scale);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1 * scale;
  ctx.strokeRect(12 * scale, 12 * scale, canvasWidth - 24 * scale, canvasHeight - 24 * scale);

  let currentY = 24 * scale;

  // 1. Hospital Header
  if (includeHospitalHeader) {
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(13 * scale, 13 * scale, canvasWidth - 26 * scale, 34 * scale);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${13 * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`🏥 ${hospitalName.toUpperCase()}`, canvasWidth / 2, currentY + 14 * scale);

    ctx.fillStyle = '#38bdf8'; // sky-400
    ctx.font = `bold ${9 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText('CLINICAL IT ASSET IDENTIFICATION SYSTEM', canvasWidth / 2, currentY + 26 * scale);

    currentY += 42 * scale;
  } else {
    currentY += 10 * scale;
  }

  // 2. QR Code Image (Rendered Centrally at the top)
  const qrBoxSize = 220 * scale;
  const qrBoxX = (canvasWidth - qrBoxSize) / 2;
  const qrBoxY = currentY;

  // Background white box for QR with subtle border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

  // Draw QR matrix
  ctx.drawImage(qrImg, qrBoxX + 6 * scale, qrBoxY + 6 * scale, qrBoxSize - 12 * scale, qrBoxSize - 12 * scale);

  currentY = qrBoxY + qrBoxSize + 16 * scale;

  // 3. Asset Tag (Prominent Identifier)
  ctx.fillStyle = '#0284c7'; // sky-600
  ctx.font = `900 ${21 * scale}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(asset.assetTag, canvasWidth / 2, currentY);

  currentY += 12 * scale;

  // Separator Line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(24 * scale, currentY);
  ctx.lineTo(canvasWidth - 24 * scale, currentY);
  ctx.stroke();

  currentY += 20 * scale;

  // 4. Text Details Rendered Below the QR Code
  const detailsLeftX = 28 * scale;
  const detailsRightX = canvasWidth - 28 * scale;
  const valueLeftX = 145 * scale;

  const equipmentName = `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || asset.assetType || 'IT Workstation';

  // Row helper
  const drawDetailRow = (label: string, value: string, isHighlight = false, isMono = false) => {
    ctx.textAlign = 'left';
    ctx.font = `bold ${11.5 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.fillText(label, detailsLeftX, currentY);

    ctx.font = isMono
      ? `bold ${12 * scale}px ui-monospace, monospace`
      : isHighlight
      ? `bold ${13 * scale}px ui-sans-serif, system-ui, sans-serif`
      : `600 ${12 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = isHighlight ? '#0f172a' : '#1e293b';

    // Ellipsis truncate value if too long
    let displayVal = value;
    if (displayVal.length > 28) {
      displayVal = displayVal.slice(0, 26) + '...';
    }
    ctx.fillText(displayVal, valueLeftX, currentY);

    currentY += 20 * scale;
  };

  // Asset Name
  drawDetailRow('ASSET NAME:', equipmentName, true);

  // Serial Number
  if (includeSerial) {
    drawDetailRow('SERIAL (S/N):', asset.serialNumber || 'N/A', false, true);
  }

  // Assigned Department
  if (includeDeptLocation) {
    drawDetailRow('DEPARTMENT:', asset.department || 'General', true);
    if (asset.location) {
      drawDetailRow('LOCATION / ROOM:', asset.location);
    }
  }

  // Assigned Custodian
  if (includeCustodian && asset.assignedUser) {
    drawDetailRow('CUSTODIAN:', asset.assignedUser);
  }

  // Hardware Type & Status
  drawDetailRow('STATUS / TYPE:', `${asset.assetType} • ${asset.status}`);

  // 5. Security Notice Footer
  if (includeSecurityNotice) {
    const footerY = canvasHeight - 44 * scale;
    ctx.fillStyle = '#fef2f2'; // red-50
    ctx.fillRect(14 * scale, footerY, canvasWidth - 28 * scale, 30 * scale);
    ctx.strokeStyle = '#fecaca'; // red-200
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(14 * scale, footerY, canvasWidth - 28 * scale, 30 * scale);

    ctx.fillStyle = '#b91c1c'; // red-700
    ctx.font = `bold ${10 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🔒 PROPERTY OF HOSPITAL IT • DO NOT REMOVE OR DAMAGE', canvasWidth / 2, footerY + 19 * scale);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Triggers a direct download of the asset's QR code and details as a JPEG image.
 */
export async function downloadAssetQrJpeg(
  asset: Asset,
  hospitalName = 'REGIONAL HOSPITAL IT UNIT'
): Promise<void> {
  const dataUrl = await renderAssetQrJpegDataUrl(asset, { hospitalName });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `QR-${asset.assetTag}-${asset.serialNumber || 'LABEL'}.jpeg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
