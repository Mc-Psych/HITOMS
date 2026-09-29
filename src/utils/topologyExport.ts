import { jsPDF } from 'jspdf';
import {
  type NetworkDevice,
  type NetworkConnectionType,
} from '../types';

export interface ExportTopologyOptions {
  devices: NetworkDevice[];
  positions: Record<string, { x: number; y: number }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    type: NetworkConnectionType;
    speed?: string;
    path?: string;
    sourcePortLabel?: string;
    targetPortLabel?: string;
  }>;
  notes?: Array<{
    id: string;
    x: number;
    y: number;
    text: string;
  }>;
  isPacketTracer?: boolean;
}

/**
 * Cable visual configurations matching the live interactive canvas
 */
const CABLE_COLORS: Record<NetworkConnectionType, { stroke: string; label: string; dash?: number[] }> = {
  Fiber: {
    stroke: '#ea580c', // Orange-600
    label: 'Fiber OM3/OM4',
  },
  'Ethernet Cat6': {
    stroke: '#10b981', // Emerald-500
    label: 'Ethernet Cat6',
  },
  'SFP+ 10G': {
    stroke: '#818cf8', // Indigo-400
    label: '10G SFP+ Trunk',
  },
  'Wireless 5GHz/6GHz': {
    stroke: '#c084fc', // Purple-400
    label: 'Wi-Fi 6 Wireless',
    dash: [8, 6],
  },
  'Satellite RF': {
    stroke: '#fbbf24', // Amber-400
    label: 'Satellite RF Microwave',
    dash: [10, 6],
  },
};

/**
 * Draws authentic vector Cisco Packet Tracer icons directly onto HTML5 Canvas
 */
function drawCiscoIcon(
  ctx: CanvasRenderingContext2D,
  type: string,
  centerX: number,
  centerY: number,
  size = 50
) {
  ctx.save();
  ctx.translate(centerX, centerY);

  switch (type) {
    case 'Router': {
      // 1. Cisco Router Cylinder / Puck in Cisco Blue
      const rx = size * 0.44;
      const ry = size * 0.24;

      // Lower Cylinder Rim
      ctx.fillStyle = '#0369a1';
      ctx.strokeStyle = '#082f49';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 8, rx, ry, 0, 0, Math.PI);
      ctx.lineTo(rx, -2);
      ctx.ellipse(0, -2, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top Ellipse Face
      const grad = ctx.createLinearGradient(-rx, -ry, rx, ry);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(1, '#075985');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, -2, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cisco 4 Crossed Routing Arrows
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Left Inward Arrow
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-5, -2);
      ctx.moveTo(-9, -5);
      ctx.lineTo(-5, -2);
      ctx.lineTo(-9, 1);
      ctx.stroke();

      // Right Inward Arrow
      ctx.beginPath();
      ctx.moveTo(16, -2);
      ctx.lineTo(5, -2);
      ctx.moveTo(9, -5);
      ctx.lineTo(5, -2);
      ctx.lineTo(9, 1);
      ctx.stroke();

      // Top Outward Arrow
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(0, -11);
      ctx.moveTo(-3, -8);
      ctx.lineTo(0, -11);
      ctx.lineTo(3, -8);
      ctx.stroke();

      // Bottom Outward Arrow
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 7);
      ctx.moveTo(-3, 4);
      ctx.lineTo(0, 7);
      ctx.lineTo(3, 4);
      ctx.stroke();

      // Center pivot dot
      ctx.beginPath();
      ctx.arc(0, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'Core Switch':
    case 'Distribution Switch': {
      // 2. Cisco Multilayer Switch (3560 / 3650)
      const w = size * 0.9;
      const h = size * 0.48;

      // 3D Top Bevel Plane
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 6, -h / 2 - 8);
      ctx.lineTo(w / 2 - 6, -h / 2 - 8);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(-w / 2, -h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Front Face
      ctx.fillStyle = '#1e3a8a';
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fill();
      ctx.stroke();

      // Port LEDs
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(-w / 2 + 6, -h / 2 + 5, 1.2, 0, Math.PI * 2);
      ctx.arc(-w / 2 + 11, -h / 2 + 5, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // X-pattern crossed double arrows
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.lineTo(14, 6);
      ctx.moveTo(-14, 6);
      ctx.lineTo(14, -6);
      ctx.stroke();

      // Center Core Diamond
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'Managed Switch':
    case 'Access Switch':
    case 'Switch': {
      // 3. Cisco Layer 2 Switch (2960)
      const w = size * 0.9;
      const h = size * 0.44;

      // 3D Top Bevel
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 6, -h / 2 - 7);
      ctx.lineTo(w / 2 - 6, -h / 2 - 7);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(-w / 2, -h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Front Face
      ctx.fillStyle = '#172554';
      ctx.strokeStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fill();
      ctx.stroke();

      // Green Port Activity LEDs
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(-w / 2 + 6, -h / 2 + 4, 1.2, 0, Math.PI * 2);
      ctx.arc(-w / 2 + 10, -h / 2 + 4, 1.2, 0, Math.PI * 2);
      ctx.arc(-w / 2 + 14, -h / 2 + 4, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // 4 Horizontal Opposing Arrows
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Top Left arrow pointing left
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(-14, -3);
      ctx.moveTo(-10, -6);
      ctx.lineTo(-14, -3);
      ctx.lineTo(-10, 0);
      ctx.stroke();

      // Top Right arrow pointing right
      ctx.beginPath();
      ctx.moveTo(3, -3);
      ctx.lineTo(14, -3);
      ctx.moveTo(10, -6);
      ctx.lineTo(14, -3);
      ctx.lineTo(10, 0);
      ctx.stroke();

      // Bottom Left arrow pointing right
      ctx.beginPath();
      ctx.moveTo(-14, 5);
      ctx.lineTo(-3, 5);
      ctx.moveTo(-7, 2);
      ctx.lineTo(-3, 5);
      ctx.lineTo(-7, 8);
      ctx.stroke();

      // Bottom Right arrow pointing left
      ctx.beginPath();
      ctx.moveTo(14, 5);
      ctx.lineTo(3, 5);
      ctx.moveTo(7, 2);
      ctx.lineTo(3, 5);
      ctx.lineTo(7, 8);
      ctx.stroke();
      break;
    }

    case 'Firewall': {
      // 4. Cisco ASA Firewall Brick Wall
      const w = size * 0.82;
      const h = size * 0.65;

      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fill();
      ctx.stroke();

      // Mortar Horizontal Lines
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 6);
      ctx.lineTo(w / 2, -h / 6);
      ctx.moveTo(-w / 2, h / 6);
      ctx.lineTo(w / 2, h / 6);
      ctx.stroke();

      // Mortar Vertical Lines
      ctx.beginPath();
      ctx.moveTo(-w / 6, -h / 2);
      ctx.lineTo(-w / 6, -h / 6);
      ctx.moveTo(w / 6, -h / 2);
      ctx.lineTo(w / 6, -h / 6);
      ctx.moveTo(-w / 3, -h / 6);
      ctx.lineTo(-w / 3, h / 6);
      ctx.moveTo(0, -h / 6);
      ctx.lineTo(0, h / 6);
      ctx.moveTo(w / 3, -h / 6);
      ctx.lineTo(w / 3, h / 6);
      ctx.moveTo(-w / 6, h / 6);
      ctx.lineTo(-w / 6, h / 2);
      ctx.moveTo(w / 6, h / 6);
      ctx.lineTo(w / 6, h / 2);
      ctx.stroke();

      // Central Shield & Flame
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'Access Point (Indoor)':
    case 'Access Point': {
      // 5. Indoor Saucer AP
      // Wi-Fi arcs
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -6, 16, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -6, 11, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();

      // Saucer Dome
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 8, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center LED
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(0, 7, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(0, 7, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'Access Point (Outdoor)': {
      // 6. Outdoor AP IP67
      // Antennas
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, -3);
      ctx.lineTo(-14, -18);
      ctx.moveTo(10, -3);
      ctx.lineTo(14, -18);
      ctx.stroke();

      // Enclosure
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-14, -3, 28, 22, 3);
      ctx.fill();
      ctx.stroke();

      // Status Badge
      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.roundRect(-8, 11, 16, 5, 1);
      ctx.fill();
      break;
    }

    case 'Server': {
      // 7. Cisco UCS Server Unit
      const w = size * 0.76;
      const h = size * 0.85;

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fill();
      ctx.stroke();

      // Optical Top Bay
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, 4);

      // 3 Drive Bays with Green Activity LEDs
      for (let i = 0; i < 3; i++) {
        const by = -h / 2 + 13 + i * 8;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-w / 2 + 4, by, w - 8, 6);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(-w / 2 + 7, by + 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'Workstation': {
      // 8. PC Monitor & Desktop Unit
      // Monitor Screen
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-18, -14, 24, 18, 2);
      ctx.fill();
      ctx.stroke();

      // Screen Display
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-16, -12, 20, 14);

      // Monitor Stand
      ctx.fillStyle = '#475569';
      ctx.fillRect(-8, 4, 4, 5);
      ctx.fillRect(-12, 9, 12, 2.5);

      // System Tower (Right side)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(8, -12, 11, 23, 2);
      ctx.fill();
      ctx.stroke();

      // Power LED
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(13.5, -4, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'Laptop': {
      // 9. Laptop Clamshell
      // Screen Lid
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, -14);
      ctx.lineTo(16, -14);
      ctx.lineTo(14, 2);
      ctx.lineTo(-14, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // LCD Screen
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-13, -12, 26, 12);

      // Keyboard Deck
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(-18, 2);
      ctx.lineTo(18, 2);
      ctx.lineTo(21, 12);
      ctx.lineTo(-21, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'Printer': {
      // 10. Network Printer
      // Paper Input
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-10, -14, 20, 6);

      // Printer Chassis
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-16, -8, 32, 16, 3);
      ctx.fill();
      ctx.stroke();

      // LCD Panel
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-12, -5, 6, 4);

      // Output Document
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10, 2, 20, 10);
      break;
    }

    case 'Starlink Terminal': {
      // 11. Satellite Dish
      // RF Microwave waves
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(6, -8, 14, Math.PI * 1.5, Math.PI * 1.95);
      ctx.stroke();

      // Parabolic Dish
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(-2, 2, 16, 7, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Feed horn stalk
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2, 2);
      ctx.lineTo(8, -8);
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(8, -8, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Base Pole
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-4, 7);
      ctx.lineTo(-8, 15);
      ctx.moveTo(-14, 15);
      ctx.lineTo(-2, 15);
      ctx.stroke();
      break;
    }

    default: {
      // Generic Router fallback
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

/**
 * Builds and renders the full network topology onto an HTML5 Canvas element
 */
export function renderTopologyToCanvas(options: ExportTopologyOptions): HTMLCanvasElement {
  const { devices, positions, edges, notes = [], isPacketTracer = true } = options;

  const nodeWidth = isPacketTracer ? 84 : 250;
  const nodeHeight = isPacketTracer ? 76 : 110;

  // 1. Calculate Bounding Box of all devices & notes
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

  notes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + 160);
    maxY = Math.max(maxY, n.y + 90);
  });

  if (!isFinite(minX) || !isFinite(minY)) {
    minX = 100;
    minY = 100;
    maxX = 1200;
    maxY = 800;
  }

  // Padding configuration
  const padX = 100;
  const padTop = 150; // space for header banner
  const padBottom = 120; // space for legend

  const contentW = Math.max(1200, maxX - minX + padX * 2);
  const contentH = Math.max(850, maxY - minY + padTop + padBottom);

  // 2x Retina Supersampling
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(contentW * dpr);
  canvas.height = Math.round(contentH * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D rendering context');

  ctx.scale(dpr, dpr);

  // Helper coordinate mapper
  const mapX = (x: number) => x - minX + padX;
  const mapY = (y: number) => y - minY + padTop;

  // 2. Technical Blueprint Background (#090d16)
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, contentW, contentH);

  // Subtle Engineering Grid Lines
  ctx.strokeStyle = '#141d30';
  ctx.lineWidth = 1;
  const gridSize = 25;
  for (let x = 0; x <= contentW; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, contentH);
    ctx.stroke();
  }
  for (let y = 0; y <= contentH; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(contentW, y);
    ctx.stroke();
  }

  // 3. Hospital Header Banner
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(40, 25, contentW - 80, 90, 12);
  ctx.fill();
  ctx.stroke();

  // Header Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px monospace, sans-serif';
  ctx.fillText('ST. MARY THERESA MEMORIAL HOSPITAL', 60, 58);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('CISCO PACKET TRACER NETWORK TOPOLOGY & INFRASTRUCTURE MAP', 60, 80);

  // Header Right Metadata
  const onlineCount = devices.filter((d) => d.status === 'Online').length;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px monospace, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Exported: ${dateStr} ${timeStr}`, contentW - 60, 55);

  ctx.font = '11px monospace, sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`Active Nodes: ${onlineCount} / ${devices.length} Operational`, contentW - 60, 75);

  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Backbone: 10G SFP+ Trunk / OM4 Fiber / Starlink WAN', contentW - 60, 95);
  ctx.textAlign = 'left';

  // 4. Draw Cable Edges & Links
  edges.forEach((edge) => {
    const srcPos = positions[edge.sourceId];
    const tgtPos = positions[edge.targetId];
    if (!srcPos || !tgtPos) return;

    const x1 = mapX(srcPos.x + nodeWidth / 2);
    const y1 = mapY(srcPos.y + nodeHeight);
    const x2 = mapX(tgtPos.x + nodeWidth / 2);
    const y2 = mapY(tgtPos.y);

    const cfg = CABLE_COLORS[edge.type] || CABLE_COLORS['Ethernet Cat6'];

    // Curvature calculation
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const curvature = Math.max(30, Math.min(100, dist * 0.4));
    const cp1x = x1;
    const cp1y = y1 + curvature;
    const cp2x = x2;
    const cp2y = y2 - curvature;

    // Glowing outer stroke
    ctx.save();
    ctx.shadowColor = cfg.stroke;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth = 2.8;

    if (cfg.dash) {
      ctx.setLineDash(cfg.dash);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.stroke();
    ctx.restore();

    // Packet Tracer Link Light Triangles
    // 1. Source Link Light
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 - 4, y1 + 3);
    ctx.lineTo(x1 + 4, y1 + 3);
    ctx.lineTo(x1, y1 + 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Target Link Light
    ctx.beginPath();
    ctx.moveTo(x2 - 4, y2 - 3);
    ctx.lineTo(x2 + 4, y2 - 3);
    ctx.lineTo(x2, y2 - 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Port Labels (e.g. Gi0/1, Fa0/24)
    ctx.font = 'bold 9px monospace, sans-serif';
    if (edge.sourcePortLabel) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x1 + 8, y1 + 1, 38, 13);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(edge.sourcePortLabel, x1 + 10, y1 + 11);
    }
    if (edge.targetPortLabel) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x2 + 8, y2 - 14, 38, 13);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(edge.targetPortLabel, x2 + 10, y2 - 4);
    }

    // Midpoint Cable Speed/Type Badge
    const midX = 0.125 * x1 + 0.375 * cp1x + 0.375 * cp2x + 0.125 * x2;
    const midY = 0.125 * y1 + 0.375 * cp1y + 0.375 * cp2y + 0.125 * y2;

    const labelText = edge.speed || cfg.label;
    ctx.font = 'bold 9.5px monospace, sans-serif';
    const textW = ctx.measureText(labelText).width;

    ctx.fillStyle = '#020617';
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - textW / 2 - 6, midY - 9, textW + 12, 18, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(labelText, midX, midY + 3.5);
    ctx.textAlign = 'left';
  });

  // 5. Draw Device Nodes
  devices.forEach((dev) => {
    const pos = positions[dev.id];
    if (!pos) return;

    const dx = mapX(pos.x);
    const dy = mapY(pos.y);

    if (isPacketTracer) {
      // Compact Cisco Packet Tracer Device Node
      const centerX = dx + nodeWidth / 2;
      const iconCenterY = dy + 28;

      // Draw Cisco Icon
      drawCiscoIcon(ctx, dev.deviceType, centerX, iconCenterY, 52);

      // Online/Offline status LED dot next to icon
      const isOnline = dev.status === 'Online';
      ctx.fillStyle = isOnline ? '#22c55e' : dev.status === 'Warning' ? '#f59e0b' : '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX + 24, iconCenterY - 14, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Device Name (Bold White)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(dev.deviceName, centerX, dy + 58);

      // IP Address (Emerald / Sky Monospace)
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9.5px monospace, sans-serif';
      ctx.fillText(dev.ipAddress, centerX, dy + 70);

      // Model or VLAN tag
      if (dev.vlanEnabled) {
        ctx.fillStyle = '#a855f7';
        ctx.font = '8px monospace, sans-serif';
        ctx.fillText('802.1Q VLANs', centerX, dy + 80);
      }
      ctx.textAlign = 'left';
    } else {
      // Enterprise Card Layout
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(dx, dy, nodeWidth, nodeHeight, 8);
      ctx.fill();
      ctx.stroke();

      // Icon on Left
      drawCiscoIcon(ctx, dev.deviceType, dx + 32, dy + 45, 42);

      // Card Text on Right
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(dev.deviceName, dx + 65, dy + 32);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace, sans-serif';
      ctx.fillText(dev.ipAddress, dx + 65, dy + 48);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9.5px sans-serif';
      ctx.fillText(dev.model || dev.deviceType, dx + 65, dy + 64);
      ctx.fillText(dev.location, dx + 65, dy + 78);
    }
  });

  // 6. Draw Canvas Notes
  notes.forEach((note) => {
    const nx = mapX(note.x);
    const ny = mapY(note.y);

    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(nx, ny, 160, 75, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#713f12';
    ctx.font = 'bold 10px sans-serif';

    const lines = note.text.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(line, nx + 8, ny + 18 + idx * 14);
    });
  });

  // 7. Legend & Footer
  const legendY = contentH - 80;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(40, legendY, contentW - 80, 55, 10);
  ctx.fill();
  ctx.stroke();

  // Legend Items
  let legX = 60;
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('LEGEND:', legX, legendY + 32);
  legX += 60;

  // Swatches
  const swatches: { label: string; color: string; dash?: number[] }[] = [
    { label: 'Fiber OM3/OM4', color: '#ea580c' },
    { label: 'Ethernet Cat6', color: '#10b981' },
    { label: '10G SFP+ Trunk', color: '#818cf8' },
    { label: 'Wi-Fi 6 Wireless', color: '#c084fc', dash: [6, 4] },
    { label: 'Satellite RF Microwave', color: '#fbbf24', dash: [8, 4] },
  ];

  swatches.forEach((sw) => {
    ctx.save();
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = 2.5;
    if (sw.dash) ctx.setLineDash(sw.dash);
    ctx.beginPath();
    ctx.moveTo(legX, legendY + 28);
    ctx.lineTo(legX + 22, legendY + 28);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '10px sans-serif';
    ctx.fillText(sw.label, legX + 28, legendY + 32);
    legX += ctx.measureText(sw.label).width + 45;
  });

  // Link lights legend on right
  ctx.textAlign = 'right';
  ctx.fillStyle = '#4ade80';
  ctx.fillText('▲ Green: Port UP', contentW - 190, legendY + 32);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('▲ Red: Port Down', contentW - 70, legendY + 32);
  ctx.textAlign = 'left';

  return canvas;
}

/**
 * High-Resolution JPEG Downloader
 */
export function downloadTopologyAsJPEG(options: ExportTopologyOptions, filenamePrefix = 'hospital-cisco-topology') {
  const canvas = renderTopologyToCanvas(options);
  const dateStr = new Date().toISOString().slice(0, 10);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filenamePrefix}-${dateStr}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * High-Resolution PDF Downloader (Landscape A4 fitted)
 */
export function downloadTopologyAsPDF(options: ExportTopologyOptions, filenamePrefix = 'hospital-cisco-topology') {
  const canvas = renderTopologyToCanvas(options);
  const dateStr = new Date().toISOString().slice(0, 10);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.98);

  const isLandscape = canvas.width >= canvas.height;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const margin = 8;
  const maxW = pdfW - margin * 2;
  const maxH = pdfH - margin * 2;

  let imgW = maxW;
  let imgH = (canvas.height * maxW) / canvas.width;

  if (imgH > maxH) {
    imgH = maxH;
    imgW = (canvas.width * maxH) / canvas.height;
  }

  const posX = margin + (maxW - imgW) / 2;
  const posY = margin + (maxH - imgH) / 2;

  pdf.addImage(dataUrl, 'JPEG', posX, posY, imgW, imgH);
  pdf.save(`${filenamePrefix}-${dateStr}.pdf`);
}
