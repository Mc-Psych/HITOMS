import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { jsPDF } from 'jspdf';
import {
  type NetworkDevice,
  type NetworkConnectionType,
} from '../types';
import { CiscoDeviceIcon } from '../components/packet-tracer/CiscoTopologyIcons';

export interface ExportTopologyOptions {
  devices: NetworkDevice[];
  positions: Record<string, { x: number; y: number }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    type: NetworkConnectionType;
    speed?: string;
    path: string;
    sourcePos: {
      x: number;
      y: number;
      side: 'top' | 'bottom' | 'left' | 'right';
      normal: { x: number; y: number };
    };
    targetPos: {
      x: number;
      y: number;
      side: 'top' | 'bottom' | 'left' | 'right';
      normal: { x: number; y: number };
    };
    isVlanTrunk?: boolean;
    sourcePortLabel: string;
    targetPortLabel: string;
  }>;
  notes?: Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    color?: string;
  }>;
  isPacketTracer?: boolean;
  showPortLabels?: boolean;
}

const CABLE_CONFIGS: Record<
  NetworkConnectionType,
  { stroke: string; glow: string; label: string; dash?: string; speedDefault: string }
> = {
  Fiber: {
    stroke: '#ea580c',
    glow: 'rgba(234, 88, 12, 0.4)',
    label: 'Fiber OM3/OM4',
    speedDefault: '1 Gbps OM3 Fiber',
  },
  'Ethernet Cat6': {
    stroke: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
    label: 'Ethernet Cat6',
    speedDefault: '1 Gbps Full-Duplex',
  },
  'SFP+ 10G': {
    stroke: '#818cf8',
    glow: 'rgba(129, 140, 248, 0.5)',
    label: '10G SFP+ Trunk',
    speedDefault: '10 Gbps SFP+ Trunk',
  },
  'Wireless 5GHz/6GHz': {
    stroke: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.4)',
    dash: '6 4',
    label: 'Wi-Fi 6 Wireless',
    speedDefault: '1.2 Gbps Wi-Fi 6',
  },
  'Satellite RF': {
    stroke: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.5)',
    dash: '8 4',
    label: 'Satellite RF Microwave',
    speedDefault: '220 Mbps Low-Earth Orbit',
  },
};

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds an SVG string that is 100% identical in layout, coordinates, icons, cables, and labels to the interactive canvas
 */
export function generateTopologySvg(options: ExportTopologyOptions): {
  svgString: string;
  width: number;
  height: number;
} {
  const {
    devices,
    positions,
    edges,
    notes = [],
    isPacketTracer = true,
    showPortLabels = true,
  } = options;

  const nodeWidth = isPacketTracer ? 84 : 250;
  const nodeHeight = isPacketTracer ? 76 : 110;

  const deviceMap = new Map<string, NetworkDevice>();
  devices.forEach((d) => deviceMap.set(d.id, d));

  // Compute exact bounding box of all active devices, cables, and notes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  devices.forEach((d) => {
    const pos = positions[d.id];
    if (pos) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + nodeWidth);
      maxY = Math.max(maxY, pos.y + nodeHeight);
    }
  });

  edges.forEach((edge) => {
    if (edge.sourcePos && edge.targetPos) {
      minX = Math.min(minX, edge.sourcePos.x - 30, edge.targetPos.x - 30);
      minY = Math.min(minY, edge.sourcePos.y - 30, edge.targetPos.y - 30);
      maxX = Math.max(maxX, edge.sourcePos.x + 30, edge.targetPos.x + 30);
      maxY = Math.max(maxY, edge.sourcePos.y + 30, edge.targetPos.y + 30);
    }
  });

  notes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + 200);
    maxY = Math.max(maxY, n.y + 100);
  });

  if (!isFinite(minX) || !isFinite(minY)) {
    minX = 100;
    minY = 100;
    maxX = 900;
    maxY = 700;
  }

  // Consistent 60px padding around all content
  const pad = 60;
  const viewBoxX = Math.round(minX - pad);
  const viewBoxY = Math.round(minY - pad);
  const viewBoxW = Math.round(Math.max(600, maxX - minX + pad * 2));
  const viewBoxH = Math.round(Math.max(450, maxY - minY + pad * 2));

  let svgElements = '';

  // 1. Grid Background
  svgElements += `
    <defs>
      <pattern id="canvas-grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" />
      </pattern>
    </defs>
    <!-- Technical Background -->
    <rect x="${viewBoxX}" y="${viewBoxY}" width="${viewBoxW}" height="${viewBoxH}" fill="#090d16" />
    <rect x="${viewBoxX}" y="${viewBoxY}" width="${viewBoxW}" height="${viewBoxH}" fill="url(#canvas-grid-pattern)" />
  `;

  // 2. Cables, Link Lights, Port Labels, and Speed Badges
  edges.forEach((edge) => {
    const cfg = CABLE_CONFIGS[edge.type] || CABLE_CONFIGS['Ethernet Cat6'];
    const srcDev = deviceMap.get(edge.sourceId);
    const tgtDev = deviceMap.get(edge.targetId);

    const srcStatus: 'up' | 'blocking' | 'down' =
      srcDev?.status === 'Offline' ? 'down' : srcDev?.status === 'Warning' ? 'blocking' : 'up';
    const tgtStatus: 'up' | 'blocking' | 'down' =
      tgtDev?.status === 'Offline' ? 'down' : tgtDev?.status === 'Warning' ? 'blocking' : 'up';

    const lightSrcX = edge.sourcePos.x + edge.sourcePos.normal.x * 12;
    const lightSrcY = edge.sourcePos.y + edge.sourcePos.normal.y * 12;
    const lightTgtX = edge.targetPos.x + edge.targetPos.normal.x * 12;
    const lightTgtY = edge.targetPos.y + edge.targetPos.normal.y * 12;

    const srcAngle = Math.atan2(-edge.sourcePos.normal.y, -edge.sourcePos.normal.x) * (180 / Math.PI);
    const tgtAngle = Math.atan2(-edge.targetPos.normal.y, -edge.targetPos.normal.x) * (180 / Math.PI);

    const midX = (edge.sourcePos.x + edge.targetPos.x) / 2;
    const midY = (edge.sourcePos.y + edge.targetPos.y) / 2;

    const dashAttr = cfg.dash ? `stroke-dasharray="${cfg.dash}"` : '';

    // Cable stroke
    svgElements += `
      <g>
        <path d="${edge.path}" fill="none" stroke="${cfg.stroke}" stroke-width="2.5" stroke-opacity="0.85" ${dashAttr} />
    `;

    // Link light 1 (Source)
    const srcColor = srcStatus === 'up' ? '#22c55e' : srcStatus === 'blocking' ? '#f59e0b' : '#ef4444';
    svgElements += `
      <g transform="translate(${lightSrcX}, ${lightSrcY}) rotate(${srcAngle})">
        <polygon points="-6,-4 0,0 -6,4" fill="${srcColor}" stroke="#0f172a" stroke-width="1" />
      </g>
    `;

    // Link light 2 (Target)
    const tgtColor = tgtStatus === 'up' ? '#22c55e' : tgtStatus === 'blocking' ? '#f59e0b' : '#ef4444';
    svgElements += `
      <g transform="translate(${lightTgtX}, ${lightTgtY}) rotate(${tgtAngle})">
        <polygon points="-6,-4 0,0 -6,4" fill="${tgtColor}" stroke="#0f172a" stroke-width="1" />
      </g>
    `;

    // Port Interface Labels (if enabled)
    if (showPortLabels) {
      if (edge.sourcePortLabel) {
        svgElements += `
          <g transform="translate(${lightSrcX + 6}, ${lightSrcY - 6})">
            <rect x="-2" y="-9" width="34" height="11" rx="2" fill="#020617" fill-opacity="0.85" />
            <text fill="#38bdf8" font-size="8" font-family="ui-monospace, monospace" font-weight="bold">${escapeXml(edge.sourcePortLabel)}</text>
          </g>
        `;
      }
      if (edge.targetPortLabel) {
        svgElements += `
          <g transform="translate(${lightTgtX + 6}, ${lightTgtY - 6})">
            <rect x="-2" y="-9" width="34" height="11" rx="2" fill="#020617" fill-opacity="0.85" />
            <text fill="#38bdf8" font-size="8" font-family="ui-monospace, monospace" font-weight="bold">${escapeXml(edge.targetPortLabel)}</text>
          </g>
        `;
      }
    }

    // Midpoint Speed Badge
    const labelText = edge.speed || cfg.label;
    svgElements += `
      <g transform="translate(${midX}, ${midY})">
        <rect x="-42" y="-10" width="84" height="20" rx="5" fill="#0f172a" stroke="${cfg.stroke}" stroke-width="1" />
        <text x="0" y="4" text-anchor="middle" fill="#e2e8f0" font-size="8.5" font-family="ui-monospace, monospace" font-weight="bold">${escapeXml(labelText)}</text>
      </g>
    `;

    svgElements += `</g>`;
  });

  // 3. Canvas Notes / Annotations
  notes.forEach((note) => {
    const lines = (note.text || '').split('\n');
    const textSpans = lines
      .map((line, i) => `<tspan x="8" dy="${i === 0 ? 0 : 13}">${escapeXml(line)}</tspan>`)
      .join('');

    svgElements += `
      <g transform="translate(${note.x}, ${note.y})">
        <rect width="170" height="75" rx="6" fill="#fef9c3" stroke="#eab308" stroke-width="1" />
        <rect width="170" height="18" rx="6" fill="#fef08a" />
        <text x="8" y="12" fill="#854d0e" font-size="9" font-family="system-ui, sans-serif" font-weight="bold">NETWORK NOTE</text>
        <text x="8" y="32" fill="#1e293b" font-size="10.5" font-family="ui-monospace, monospace">${textSpans}</text>
      </g>
    `;
  });

  // 4. Hardware Device Nodes
  devices.forEach((dev) => {
    const pos = positions[dev.id] || { x: 100, y: 100 };

    if (isPacketTracer) {
      // Authentic Cisco Packet Tracer Iconic Node
      const iconMarkup = renderToStaticMarkup(
        React.createElement(CiscoDeviceIcon, {
          type: dev.deviceType,
          size: 48,
          highlighted: false,
        })
      );

      svgElements += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <!-- Cisco Topology Icon -->
          <g transform="translate(${(nodeWidth - 48) / 2}, 4)">
            ${iconMarkup}
          </g>

          <!-- Device Name Label -->
          <text x="${nodeWidth / 2}" y="60" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="bold" font-family="system-ui, -apple-system, sans-serif">
            ${escapeXml(dev.deviceName)}
          </text>

          <!-- IP Address Label -->
          <text x="${nodeWidth / 2}" y="72" text-anchor="middle" fill="#38bdf8" font-size="8.5" font-family="ui-monospace, monospace">
            ${escapeXml(dev.ipAddress)}
          </text>
        </g>
      `;
    } else {
      // Enterprise Cards Mode
      const iconMarkup = renderToStaticMarkup(
        React.createElement(CiscoDeviceIcon, {
          type: dev.deviceType,
          size: 46,
          highlighted: false,
        })
      );

      svgElements += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <rect width="250" height="110" rx="16" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
          
          <!-- Left Icon -->
          <g transform="translate(14, 28)">
            ${iconMarkup}
          </g>

          <!-- Right Hardware Telemetry -->
          <text x="76" y="34" fill="#f8fafc" font-size="12" font-weight="bold" font-family="system-ui, sans-serif">
            ${escapeXml(dev.deviceName)}
          </text>
          <text x="76" y="52" fill="#38bdf8" font-size="10.5" font-family="ui-monospace, monospace">
            ${escapeXml(dev.ipAddress)}
          </text>
          <text x="76" y="68" fill="#94a3b8" font-size="9.5" font-family="system-ui, sans-serif">
            ${escapeXml(dev.model || dev.deviceType)}
          </text>
          <text x="76" y="84" fill="#64748b" font-size="9" font-family="system-ui, sans-serif">
            ${escapeXml(dev.location || '')}
          </text>
        </g>
      `;
    }
  });

  const svgString = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}"
      width="${viewBoxW}"
      height="${viewBoxH}"
    >
      ${svgElements}
    </svg>
  `;

  return {
    svgString,
    width: viewBoxW,
    height: viewBoxH,
  };
}

/**
 * High-performance, cross-browser rasterization of the exact topology SVG to HTML5 Canvas
 */
export async function svgToCanvas(svgString: string, width: number, height: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const scale = 2; // 2x supersampling for high-DPI retina sharpness
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG topology image: ' + String(e)));
    };

    img.src = url;
  });
}

/**
 * High-Resolution JPEG Downloader: 100% identical to the canvas layout
 */
export async function downloadTopologyAsJPEG(
  options: ExportTopologyOptions,
  filenamePrefix = 'cisco-network-topology'
) {
  const { svgString, width, height } = generateTopologySvg(options);
  const canvas = await svgToCanvas(svgString, width, height);
  const dateStr = new Date().toISOString().slice(0, 10);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.96);

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filenamePrefix}-${dateStr}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * High-Resolution PDF Downloader: 100% identical to the canvas layout
 */
export async function downloadTopologyAsPDF(
  options: ExportTopologyOptions,
  filenamePrefix = 'cisco-network-topology'
) {
  const { svgString, width, height } = generateTopologySvg(options);
  const canvas = await svgToCanvas(svgString, width, height);
  const dateStr = new Date().toISOString().slice(0, 10);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.96);

  const isLandscape = width >= height;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const margin = 10;
  const maxW = pdfW - margin * 2;
  const maxH = pdfH - margin * 2;

  let imgW = maxW;
  let imgH = (height * maxW) / width;

  if (imgH > maxH) {
    imgH = maxH;
    imgW = (width * maxH) / height;
  }

  const posX = margin + (maxW - imgW) / 2;
  const posY = margin + (maxH - imgH) / 2;

  pdf.addImage(dataUrl, 'JPEG', posX, posY, imgW, imgH);
  pdf.save(`${filenamePrefix}-${dateStr}.pdf`);
}
