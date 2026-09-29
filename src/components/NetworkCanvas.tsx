import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  downloadTopologyAsPDF,
  downloadTopologyAsJPEG,
} from '../utils/topologyExport';
import {
  Radio,
  Network,
  Layers,
  Server,
  Wifi,
  Shield,
  Cpu,
  Copy,
  Edit2,
  Trash2,
  Link2,
  Unlink2,
  Move,
  Cable,
  Zap,
  RotateCcw,
  Sparkles,
  Grid,
  Check,
  X,
  ArrowRight,
  Activity,
  Plus,
  ZoomIn,
  ZoomOut,
  BoxSelect,
  MousePointer,
  CheckSquare,
  Square,
  AlignJustify,
  Maximize2,
  Minimize2,
  Info,
  Hand,
  Compass,
  Laptop,
  Monitor,
  Printer,
  Save,
  Download,
  HelpCircle,
  CheckCircle2,
  FileText,
  Image,
  Mail,
  StickyNote,
  Search,
  Clock,
  Timer,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import {
  type NetworkDevice,
  type NetworkDeviceType,
  type NetworkConnectionType,
  type User as UserType,
} from '../types';
import { networkService } from '../services/networkService';
import { authService } from '../services/authService';
import { settingsService } from '../services/settingsService';
import {
  CiscoDeviceIcon,
  CiscoLinkLight,
} from './packet-tracer/CiscoTopologyIcons';
import {
  CiscoBottomShelf,
  type DeviceTemplate,
  CABLE_TEMPLATES,
} from './packet-tracer/CiscoBottomShelf';
import { CiscoDeviceModal } from './packet-tracer/CiscoDeviceModal';

interface NetworkCanvasProps {
  devices: NetworkDevice[];
  currentUser: UserType | null;
  onSelectDevice: (device: NetworkDevice) => void;
  onEditDevice: (device: NetworkDevice) => void;
  onCloneDevice: (device: NetworkDevice) => void;
  onDeleteDevice: (device: NetworkDevice) => void;
  onRefresh: () => void;
  onAddDevice?: () => void;
}

interface Point {
  x: number;
  y: number;
}

export type CanvasTool =
  | 'pointer'
  | 'pan'
  | 'wire'
  | 'marquee'
  | 'pdu'
  | 'note'
  | 'delete'
  | 'inspect';

const CABLE_CONFIGS: Record<
  NetworkConnectionType,
  { stroke: string; glow: string; label: string; dash?: string; speedDefault: string }
> = {
  Fiber: {
    stroke: '#ea580c', // orange-600
    glow: 'rgba(234, 88, 12, 0.4)',
    label: 'Fiber OM3/OM4',
    speedDefault: '1 Gbps OM3 Fiber',
  },
  'Ethernet Cat6': {
    stroke: '#10b981', // emerald-500
    glow: 'rgba(16, 185, 129, 0.4)',
    label: 'Ethernet Cat6',
    speedDefault: '1 Gbps Full-Duplex',
  },
  'SFP+ 10G': {
    stroke: '#818cf8', // indigo-400
    glow: 'rgba(129, 140, 248, 0.5)',
    label: '10G SFP+ Trunk',
    speedDefault: '10 Gbps SFP+ Trunk',
  },
  'Wireless 5GHz/6GHz': {
    stroke: '#c084fc', // purple-400
    glow: 'rgba(192, 132, 252, 0.4)',
    dash: '6 4',
    label: 'Wi-Fi 6 Wireless',
    speedDefault: '1.2 Gbps Wi-Fi 6',
  },
  'Satellite RF': {
    stroke: '#fbbf24', // amber-400
    glow: 'rgba(251, 191, 36, 0.5)',
    dash: '8 4',
    label: 'Satellite RF Microwave',
    speedDefault: '220 Mbps Low-Earth Orbit',
  },
};

// Node dimensions for Enterprise Cards mode
const CARD_NODE_WIDTH = 250;
const CARD_NODE_HEIGHT = 110;

// Node dimensions for Cisco Packet Tracer compact iconic mode
const PT_NODE_WIDTH = 84;
const PT_NODE_HEIGHT = 76;

/**
 * Computes strict hierarchical DAG positions based on predecessor-successor tree structure
 */
function computeHierarchicalOrder(devs: NetworkDevice[], isPacketTracer = true): Record<string, Point> {
  if (!devs || devs.length === 0) return {};

  const devMap = new Map<string, NetworkDevice>();
  devs.forEach((d) => devMap.set(d.id, d));

  // Build adjacency graph: parentId -> childrenIds
  const childrenMap = new Map<string, Set<string>>();
  const parentMap = new Map<string, string>();

  devs.forEach((d) => {
    childrenMap.set(d.id, new Set());
  });

  devs.forEach((d) => {
    const parentId = d.predecessorId || d.uplinkDeviceId;
    if (parentId && devMap.has(parentId)) {
      parentMap.set(d.id, parentId);
      childrenMap.get(parentId)?.add(d.id);
    }
    // Also check successorIds
    if (d.successorIds && Array.isArray(d.successorIds)) {
      d.successorIds.forEach((childId) => {
        if (devMap.has(childId)) {
          childrenMap.get(d.id)?.add(childId);
          if (!parentMap.has(childId)) {
            parentMap.set(childId, d.id);
          }
        }
      });
    }
  });

  // Identify root devices (in-degree = 0 or specific WAN gateways)
  const roots: NetworkDevice[] = [];
  devs.forEach((d) => {
    if (!parentMap.has(d.id) || d.deviceType === 'Starlink Terminal') {
      roots.push(d);
    }
  });

  // If no roots found (e.g. cycle), pick devices with deviceType Gateway or Router, or first device
  if (roots.length === 0) {
    const fallbackRoot =
      devs.find((d) => d.deviceType === 'Starlink Terminal') ||
      devs.find((d) => d.deviceType === 'Router') ||
      devs[0];
    if (fallbackRoot) roots.push(fallbackRoot);
  }

  // Calculate depths via BFS
  const depthMap = new Map<string, number>();
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = roots.map((r) => ({ id: r.id, depth: 0 }));
  roots.forEach((r) => {
    depthMap.set(r.id, 0);
    visited.add(r.id);
  });

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const children = childrenMap.get(id);
    if (children) {
      children.forEach((childId) => {
        const nextDepth = Math.max(depth + 1, depthMap.get(childId) || 0);
        depthMap.set(childId, nextDepth);
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push({ id: childId, depth: nextDepth });
        }
      });
    }
  }

  // Any remaining unvisited devices get assigned depth based on deviceType
  devs.forEach((d) => {
    if (!depthMap.has(d.id)) {
      if (d.deviceType === 'Starlink Terminal') depthMap.set(d.id, 0);
      else if (d.deviceType === 'Router' || d.deviceType === 'Firewall') depthMap.set(d.id, 1);
      else if (['Core Switch', 'Server'].includes(d.deviceType)) depthMap.set(d.id, 2);
      else if (['Distribution Switch', 'Managed Switch'].includes(d.deviceType)) depthMap.set(d.id, 3);
      else if (['Switch', 'Access Switch', 'Access Point', 'Access Point (Indoor)', 'Access Point (Outdoor)'].includes(d.deviceType)) depthMap.set(d.id, 4);
      else depthMap.set(d.id, 5); // Tier 5: Endpoints (Workstations, Laptops, Computers, Printers)
    }
  });

  // Group devices by depth level
  const levels = new Map<number, NetworkDevice[]>();
  devs.forEach((d) => {
    const lvl = depthMap.get(d.id) ?? 0;
    if (!levels.has(lvl)) levels.set(lvl, []);
    levels.get(lvl)!.push(d);
  });

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const posMap: Record<string, Point> = {};
  const CANVAS_CENTER_X = 800;
  const LEVEL_Y_SPACING = isPacketTracer ? 135 : 175;
  const NODE_X_SPACING = isPacketTracer ? 160 : 300;

  sortedLevels.forEach((lvl) => {
    const levelDevs = levels.get(lvl)!;

    // Sort nodes in this level to align nicely below their parent
    levelDevs.sort((a, b) => {
      const parentA = parentMap.get(a.id);
      const parentB = parentMap.get(b.id);
      const parentAPosX = parentA && posMap[parentA] ? posMap[parentA].x : 0;
      const parentBPosX = parentB && posMap[parentB] ? posMap[parentB].x : 0;
      if (parentAPosX !== parentBPosX) return parentAPosX - parentBPosX;
      return a.deviceName.localeCompare(b.deviceName);
    });

    const count = levelDevs.length;
    const totalWidth = (count - 1) * NODE_X_SPACING;
    const startX = Math.max(60, Math.round((CANVAS_CENTER_X - totalWidth / 2) / 20) * 20);
    const y = 45 + lvl * LEVEL_Y_SPACING;

    levelDevs.forEach((d, idx) => {
      posMap[d.id] = {
        x: startX + idx * NODE_X_SPACING,
        y,
      };
    });
  });

  return posMap;
}

export function getDeviceTierInfo(type: NetworkDeviceType): {
  tier: number;
  name: string;
  badge: string;
  bg: string;
} {
  switch (type) {
    case 'Starlink Terminal':
      return { tier: 1, name: 'Tier 1: WAN Gateway', badge: 'Tier 1 • WAN', bg: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
    case 'Router':
      return { tier: 1, name: 'Tier 1: Edge Router', badge: 'Tier 1 • Router', bg: 'bg-sky-950/80 text-sky-300 border-sky-700/60' };
    case 'Firewall':
      return { tier: 1, name: 'Tier 1: Security Firewall', badge: 'Tier 1 • Firewall', bg: 'bg-rose-950/80 text-rose-300 border-rose-700/60' };
    case 'Core Switch':
      return { tier: 2, name: 'Tier 2: Core Switch Backbone', badge: 'Tier 2 • Core Backbone', bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60' };
    case 'Server':
      return { tier: 2, name: 'Tier 2: Edge Server', badge: 'Tier 2 • Server', bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60' };
    case 'Distribution Switch':
      return { tier: 3, name: 'Tier 3: Distribution Switch', badge: 'Tier 3 • Dist Switch', bg: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60' };
    case 'Managed Switch':
      return { tier: 3, name: 'Tier 3: Managed Switch (VLANs)', badge: 'Tier 3 • Managed (VLANs)', bg: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60' };
    case 'Access Switch':
      return { tier: 4, name: 'Tier 4: Access Switch', badge: 'Tier 4 • Access Switch', bg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
    case 'Switch':
      return { tier: 4, name: 'Tier 4: Switch', badge: 'Tier 4 • Switch', bg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
    case 'Access Point (Indoor)':
      return { tier: 4, name: 'Tier 4: Indoor Wi-Fi AP', badge: 'Tier 4 • Indoor AP', bg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
    case 'Access Point (Outdoor)':
      return { tier: 4, name: 'Tier 4: Outdoor Wi-Fi AP (IP67)', badge: 'Tier 4 • Outdoor AP (IP67)', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
    case 'Access Point':
      return { tier: 4, name: 'Tier 4: Wireless AP', badge: 'Tier 4 • Wi-Fi AP', bg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
    case 'Workstation':
      return { tier: 5, name: 'Tier 5: Endpoint Workstation', badge: 'Tier 5 • Computer / PC', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
    case 'Laptop':
      return { tier: 5, name: 'Tier 5: Endpoint Laptop', badge: 'Tier 5 • Laptop', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
    case 'Printer':
      return { tier: 5, name: 'Tier 5: Endpoint Printer', badge: 'Tier 5 • Printer', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
    default:
      return { tier: 5, name: 'Tier 5: Endpoint', badge: 'Tier 5 • Endpoint', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

interface AnchorPoint extends Point {
  side: 'top' | 'bottom' | 'left' | 'right';
  normal: Point;
}

/**
 * Returns all 4 port anchor points (Top, Bottom, Left, Right) for a device node
 */
function getNodeAnchors(
  pos: Point,
  width: number,
  height: number
): Record<'top' | 'bottom' | 'left' | 'right', AnchorPoint> {
  return {
    top: {
      x: pos.x + width / 2,
      y: pos.y,
      side: 'top',
      normal: { x: 0, y: -1 },
    },
    bottom: {
      x: pos.x + width / 2,
      y: pos.y + height,
      side: 'bottom',
      normal: { x: 0, y: 1 },
    },
    left: {
      x: pos.x,
      y: pos.y + height / 2,
      side: 'left',
      normal: { x: -1, y: 0 },
    },
    right: {
      x: pos.x + width,
      y: pos.y + height / 2,
      side: 'right',
      normal: { x: 1, y: 0 },
    },
  };
}

/**
 * Dynamically determines the closest, most natural pair of connection ports between two devices
 */
function getBestCableEndpoints(
  p1: Point,
  p2: Point,
  width: number,
  height: number
): {
  source: AnchorPoint;
  target: AnchorPoint;
  path: string;
} {
  const anchors1 = getNodeAnchors(p1, width, height);
  const anchors2 = getNodeAnchors(p2, width, height);

  let bestScore = Infinity;
  let bestSource = anchors1.bottom;
  let bestTarget = anchors2.top;

  const a1List = Object.values(anchors1);
  const a2List = Object.values(anchors2);

  a1List.forEach((a1) => {
    a2List.forEach((a2) => {
      const dist = Math.hypot(a2.x - a1.x, a2.y - a1.y);
      const dot1 = a1.normal.x * (a2.x - a1.x) + a1.normal.y * (a2.y - a1.y);
      const dot2 = a2.normal.x * (a1.x - a2.x) + a2.normal.y * (a1.y - a2.y);
      const score = dist - (dot1 > 0 ? 40 : -40) - (dot2 > 0 ? 40 : -40);

      if (score < bestScore) {
        bestScore = score;
        bestSource = a1;
        bestTarget = a2;
      }
    });
  });

  const dist = Math.hypot(bestTarget.x - bestSource.x, bestTarget.y - bestSource.y);
  const curvature = Math.max(30, Math.min(130, dist * 0.42));

  const c1x = bestSource.x + bestSource.normal.x * curvature;
  const c1y = bestSource.y + bestSource.normal.y * curvature;
  const c2x = bestTarget.x + bestTarget.normal.x * curvature;
  const c2y = bestTarget.y + bestTarget.normal.y * curvature;

  const path = `M ${bestSource.x} ${bestSource.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${bestTarget.x} ${bestTarget.y}`;

  return {
    source: bestSource,
    target: bestTarget,
    path,
  };
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  devices,
  currentUser,
  onSelectDevice,
  onEditDevice,
  onCloneDevice,
  onDeleteDevice,
  onRefresh,
  onAddDevice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Layout node coordinates (x, y) map
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const positionsRef = useRef<Record<string, Point>>({});
  positionsRef.current = positions;

  // View Mode: 'PACKET_TRACER' (default iconic Cisco style) vs 'CARDS' (expanded dashboard cards)
  const [canvasViewMode, setCanvasViewMode] = useState<'PACKET_TRACER' | 'CARDS'>('PACKET_TRACER');
  const [showPortLabels, setShowPortLabels] = useState<boolean>(true);
  const [simulationMode, setSimulationMode] = useState<'REALTIME' | 'SIMULATION'>('REALTIME');

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState<CanvasTool>('pointer');

  // Drag tracking to distinguish pure clicks from drags
  const isDragMovedRef = useRef<boolean>(false);
  const dragStartClientPos = useRef<Point>({ x: 0, y: 0 });

  // Canvas Panning State
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  isPanningRef.current = isPanning;
  const panStartRef = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number }>({
    clientX: 0,
    clientY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // Multi-Selection Marquee State
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const selectedDeviceIdsRef = useRef<Set<string>>(selectedDeviceIds);
  selectedDeviceIdsRef.current = selectedDeviceIds;

  const [isMarqueeDragging, setIsMarqueeDragging] = useState<boolean>(false);
  const [marqueeStart, setMarqueeStart] = useState<Point | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<Point | null>(null);

  // Multi-Device Dragging State
  const [isDraggingGroup, setIsDraggingGroup] = useState<boolean>(false);
  const isDraggingGroupRef = useRef<boolean>(false);
  isDraggingGroupRef.current = isDraggingGroup;

  const dragAnchorIdRef = useRef<string | null>(null);
  const [dragAnchorId, setDragAnchorId] = useState<string | null>(null);
  dragAnchorIdRef.current = dragAnchorId;

  const [dragStartMouse, setDragStartMouse] = useState<Point>({ x: 0, y: 0 });
  const [dragInitialPositions, setDragInitialPositions] = useState<Record<string, Point>>({});

  // Canvas Settings
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [selectedCable, setSelectedCable] = useState<{
    sourceId: string;
    targetId: string;
    type: NetworkConnectionType;
    speed?: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavingTopology, setIsSavingTopology] = useState(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'jpeg' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showTierGuide, setShowTierGuide] = useState(false);

  // Cisco Packet Tracer Bottom Shelf & Placement Palette
  const [selectedDeviceTemplate, setSelectedDeviceTemplate] = useState<DeviceTemplate | null>(null);
  const [selectedCableType, setSelectedCableType] = useState<NetworkConnectionType | null>('Ethernet Cat6');
  const [isShelfCollapsed, setIsShelfCollapsed] = useState<boolean>(false);

  // Cisco Device Window (Physical faceplate, Config, Cisco IOS CLI, Desktop)
  const [ciscoModalDevice, setCiscoModalDevice] = useState<NetworkDevice | null>(null);

  // Simple PDU Simulation State
  const [pduSourceId, setPduSourceId] = useState<string | null>(null);
  const [pduActivePacket, setPduActivePacket] = useState<{
    path: string;
    sourceName: string;
    targetName: string;
  } | null>(null);
  const [pduLogs, setPduLogs] = useState<Array<{
    id: string;
    time: string;
    source: string;
    target: string;
    status: 'Successful' | 'Failed';
    latency: string;
    type: string;
  }>>([
    {
      id: 'pdu-seed-1',
      time: '0.001s',
      source: 'Workstation-01',
      target: 'Core-Switch',
      status: 'Successful',
      latency: '1.2ms',
      type: 'ICMP',
    },
  ]);
  const [showPduDrawer, setShowPduDrawer] = useState<boolean>(false);

  // Canvas Notes / Annotations
  const [canvasNotes, setCanvasNotes] = useState<Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
  }>>([
    {
      id: 'note-1',
      x: 80,
      y: 40,
      text: 'Hospital Core Backbone\nVLAN 10: Clinical LHIMS\nVLAN 99: Management',
      color: '#fef08a',
    },
  ]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Quick Inspector
  const [inspectingDevice, setInspectingDevice] = useState<NetworkDevice | null>(null);

  const canManage = Boolean(
    currentUser &&
      (
        ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'SYSTEM_ADMIN'].includes(currentUser.role) ||
        authService.isSuperAdminOrIT(currentUser) ||
        authService.hasPermission('network.create', currentUser) ||
        authService.hasPermission('network.manage', currentUser)
      )
  );

  // Active node footprint depending on view mode
  const isPacketTracer = canvasViewMode === 'PACKET_TRACER';
  const activeNodeWidth = isPacketTracer ? PT_NODE_WIDTH : CARD_NODE_WIDTH;
  const activeNodeHeight = isPacketTracer ? PT_NODE_HEIGHT : CARD_NODE_HEIGHT;

  // Spacebar listener for temporary Hand Pan tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        (e.target as HTMLElement).tagName !== 'INPUT' &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA'
      ) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Device Map for O(1) lookups
  const deviceMap = useMemo(() => {
    const map = new Map<string, NetworkDevice>();
    devices.forEach((d) => map.set(d.id, d));
    return map;
  }, [devices]);

  // Initialize or update positions with stored coordinates or hierarchical ordering
  useEffect(() => {
    setPositions((prev) => {
      if (Object.keys(prev).length === 0 && devices.length > 0) {
        const hierarchical = computeHierarchicalOrder(devices, isPacketTracer);
        const initial: Record<string, Point> = {};
        devices.forEach((d) => {
          if (typeof d.canvasX === 'number' && typeof d.canvasY === 'number') {
            initial[d.id] = { x: d.canvasX, y: d.canvasY };
          } else if (hierarchical[d.id]) {
            initial[d.id] = hierarchical[d.id];
          } else {
            initial[d.id] = { x: 200, y: 200 };
          }
        });
        return initial;
      }

      const next = { ...prev };
      let hasChanges = false;
      const hierarchical = computeHierarchicalOrder(devices, isPacketTracer);
      devices.forEach((d) => {
        if (!next[d.id]) {
          if (typeof d.canvasX === 'number' && typeof d.canvasY === 'number') {
            next[d.id] = { x: d.canvasX, y: d.canvasY };
          } else {
            next[d.id] = hierarchical[d.id] || { x: 200, y: 200 };
          }
          hasChanges = true;
        }
      });

      const currentIds = new Set(devices.map((d) => d.id));
      Object.keys(next).forEach((id) => {
        if (!currentIds.has(id)) {
          delete next[id];
          hasChanges = true;
        }
      });

      return hasChanges ? next : prev;
    });
  }, [devices, isPacketTracer]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Convert client viewport coordinates to canvas virtual coordinates
  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: clientX, y: clientY };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left + containerRef.current.scrollLeft) / zoomLevel;
      const y = (clientY - rect.top + containerRef.current.scrollTop) / zoomLevel;
      return { x, y };
    },
    [zoomLevel]
  );

  // Center canvas viewport on devices
  const centerCanvasView = useCallback(() => {
    if (!containerRef.current || devices.length === 0) return;
    const currentPositions = positionsRef.current;
    const devPositions = devices.map((d) => currentPositions[d.id] || { x: 400, y: 300 });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    devPositions.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const centerX = (minX + maxX) / 2 + activeNodeWidth / 2;
    const centerY = (minY + maxY) / 2 + activeNodeHeight / 2;

    const viewportW = containerRef.current.clientWidth;
    const viewportH = containerRef.current.clientHeight;

    const targetLeft = Math.max(0, centerX * zoomLevel - viewportW / 2);
    const targetTop = Math.max(0, centerY * zoomLevel - viewportH / 2);

    containerRef.current.scrollTo({
      left: targetLeft,
      top: targetTop,
      behavior: 'smooth',
    });
  }, [devices, zoomLevel, activeNodeWidth, activeNodeHeight]);

  useEffect(() => {
    const timer = setTimeout(() => {
      centerCanvasView();
    }, 150);
    return () => clearTimeout(timer);
  }, [centerCanvasView]);

  // Layout Arrangers
  const applyHierarchicalLayout = () => {
    const newPos = computeHierarchicalOrder(devices, isPacketTracer);
    setPositions(newPos);
    setHasUnsavedChanges(true);
    showToast('Applied Hierarchical Tree Layout');
    setTimeout(centerCanvasView, 100);
  };

  const applyStarLayout = () => {
    if (devices.length === 0) return;
    const center = { x: 800, y: 450 };
    const radius = isPacketTracer ? 220 : 360;
    const newPos: Record<string, Point> = {};

    const hub =
      devices.find((d) => d.deviceType === 'Core Switch') ||
      devices.find((d) => d.deviceType === 'Router') ||
      devices[0];

    newPos[hub.id] = { ...center };
    const satellites = devices.filter((d) => d.id !== hub.id);
    const angleStep = (2 * Math.PI) / (satellites.length || 1);

    satellites.forEach((d, i) => {
      const angle = i * angleStep;
      newPos[d.id] = {
        x: Math.round(center.x + radius * Math.cos(angle)),
        y: Math.round(center.y + radius * Math.sin(angle)),
      };
    });

    setPositions(newPos);
    setHasUnsavedChanges(true);
    showToast('Applied Radial Star Hub Layout');
    setTimeout(centerCanvasView, 100);
  };

  const applyGridLayout = () => {
    const cols = Math.ceil(Math.sqrt(devices.length));
    const cellW = isPacketTracer ? 150 : 300;
    const cellH = isPacketTracer ? 130 : 160;
    const startX = 100;
    const startY = 80;
    const newPos: Record<string, Point> = {};

    devices.forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      newPos[d.id] = {
        x: startX + col * cellW,
        y: startY + row * cellH,
      };
    });

    setPositions(newPos);
    setHasUnsavedChanges(true);
    showToast('Applied Grid Matrix Layout');
    setTimeout(centerCanvasView, 100);
  };

  // Alignment Helpers
  const handleAlignSelectedHorizontally = () => {
    if (selectedDeviceIds.size < 2) return;
    const ids = Array.from(selectedDeviceIds) as string[];
    let avgY = 0;
    ids.forEach((id: string) => {
      avgY += (positions[id]?.y || 0);
    });
    avgY = Math.round(avgY / ids.length / 20) * 20;

    const next = { ...positions };
    ids.forEach((id: string) => {
      if (next[id]) next[id] = { ...next[id], y: avgY };
    });
    setPositions(next);
    setHasUnsavedChanges(true);
    showToast(`Aligned ${ids.length} devices horizontally`);
  };

  const handleAlignSelectedVertically = () => {
    if (selectedDeviceIds.size < 2) return;
    const ids = Array.from(selectedDeviceIds) as string[];
    let avgX = 0;
    ids.forEach((id: string) => {
      avgX += (positions[id]?.x || 0);
    });
    avgX = Math.round(avgX / ids.length / 20) * 20;

    const next = { ...positions };
    ids.forEach((id: string) => {
      if (next[id]) next[id] = { ...next[id], x: avgX };
    });
    setPositions(next);
    setHasUnsavedChanges(true);
    showToast(`Aligned ${ids.length} devices vertically`);
  };

  const handleDistributeSelectedHorizontally = () => {
    if (selectedDeviceIds.size < 3) return;
    const ids = Array.from(selectedDeviceIds) as string[];
    const sorted = ids
      .map((id: string) => ({ id, x: positions[id]?.x || 0, y: positions[id]?.y || 0 }))
      .sort((a, b) => a.x - b.x);

    const minX = sorted[0].x;
    const maxX = sorted[sorted.length - 1].x;
    const span = maxX - minX;
    const step = span / (sorted.length - 1);

    const next = { ...positions };
    sorted.forEach((item, idx) => {
      next[item.id] = {
        x: Math.round((minX + idx * step) / 20) * 20,
        y: item.y,
      };
    });
    setPositions(next);
    setHasUnsavedChanges(true);
    showToast(`Distributed ${ids.length} devices evenly`);
  };

  // Canvas Mouse Down: handles panning, box marquee, device drop, or note placement
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Check if target is background
    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      'button, a, input, select, textarea, [data-node-id], [data-no-pan], [data-note-id]'
    );

    if (isInteractive) return;

    const pt = getCanvasPoint(e.clientX, e.clientY);

    // 1. STAMP DEVICE FROM BOTTOM SHELF
    if (selectedDeviceTemplate && canManage) {
      handleDropTemplateDevice(selectedDeviceTemplate, pt);
      return;
    }

    // 2. PLACE NOTE TOOL
    if (activeTool === 'note') {
      const newNote = {
        id: `note-${Date.now()}`,
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        text: 'New Network Note\nClick to edit text...',
        color: '#fef08a',
      };
      setCanvasNotes((prev) => [...prev, newNote]);
      setEditingNoteId(newNote.id);
      setActiveTool('pointer');
      showToast('Annotation note added');
      return;
    }

    // 3. MARQUEE OR PAN
    const isMarquee = activeTool === 'marquee' || e.shiftKey || e.metaKey || e.ctrlKey;
    if (isMarquee) {
      setIsMarqueeDragging(true);
      setMarqueeStart(pt);
      setMarqueeEnd(pt);
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        setSelectedDeviceIds(new Set());
      }
    } else {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        scrollLeft: containerRef.current?.scrollLeft || 0,
        scrollTop: containerRef.current?.scrollTop || 0,
      };
    }
  };

  // Node Mouse Down
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isConnecting) return;

    if (activeTool === 'pan' || isSpacePressed) {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        scrollLeft: containerRef.current?.scrollLeft || 0,
        scrollTop: containerRef.current?.scrollTop || 0,
      };
      return;
    }

    isDragMovedRef.current = false;
    dragStartClientPos.current = { x: e.clientX, y: e.clientY };

    const pt = getCanvasPoint(e.clientX, e.clientY);
    const isShift = e.shiftKey || e.metaKey || e.ctrlKey;

    let nextSelected = new Set(selectedDeviceIds);
    if (isShift) {
      if (nextSelected.has(id)) nextSelected.delete(id);
      else nextSelected.add(id);
      setSelectedDeviceIds(nextSelected);
      return;
    }

    if (!nextSelected.has(id)) {
      nextSelected = new Set([id]);
      setSelectedDeviceIds(nextSelected);
    }

    setIsDraggingGroup(true);
    setDragAnchorId(id);
    setDragStartMouse(pt);
    setDragInitialPositions({ ...positions });
  };

  // Canvas Mouse Move
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const pt = getCanvasPoint(e.clientX, e.clientY);
    setMousePos(pt);

    // Pan viewport
    if (isPanningRef.current && containerRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      return;
    }

    // Marquee
    if (isMarqueeDragging && marqueeStart) {
      setMarqueeEnd(pt);
      const minX = Math.min(marqueeStart.x, pt.x);
      const maxX = Math.max(marqueeStart.x, pt.x);
      const minY = Math.min(marqueeStart.y, pt.y);
      const maxY = Math.max(marqueeStart.y, pt.y);

      const inside = new Set<string>();
      devices.forEach((dev) => {
        const p = positions[dev.id];
        if (p) {
          const centerX = p.x + activeNodeWidth / 2;
          const centerY = p.y + activeNodeHeight / 2;
          if (centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY) {
            inside.add(dev.id);
          }
        }
      });
      setSelectedDeviceIds(inside);
      return;
    }

    // Group drag
    if (isDraggingGroupRef.current && dragAnchorIdRef.current) {
      const distFromStart = Math.hypot(
        e.clientX - dragStartClientPos.current.x,
        e.clientY - dragStartClientPos.current.y
      );
      if (distFromStart > 4) {
        isDragMovedRef.current = true;
      }

      let deltaX = pt.x - dragStartMouse.x;
      let deltaY = pt.y - dragStartMouse.y;

      const next = { ...positions };
      selectedDeviceIdsRef.current.forEach((id) => {
        const init = dragInitialPositions[id];
        if (init) {
          let newX = init.x + deltaX;
          let newY = init.y + deltaY;
          if (snapToGrid) {
            newX = Math.round(newX / 20) * 20;
            newY = Math.round(newY / 20) * 20;
          }
          next[id] = {
            x: Math.max(20, newX),
            y: Math.max(20, newY),
          };
        }
      });
      setPositions(next);
      setHasUnsavedChanges(true);
    }
  };

  // Canvas Mouse Up
  const handleCanvasMouseUp = () => {
    isPanningRef.current = false;
    setIsPanning(false);

    if (isMarqueeDragging) {
      setIsMarqueeDragging(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }

    if (isDraggingGroupRef.current) {
      isDraggingGroupRef.current = false;
      setIsDraggingGroup(false);
      setDragAnchorId(null);
    }
  };

  // Drop Device Template onto Canvas
  const handleDropTemplateDevice = async (template: DeviceTemplate, pt: Point) => {
    if (!currentUser) return;
    try {
      const typePrefix = template.type.split(' ')[0];
      const count = devices.filter((d) => d.deviceType === template.type).length + 1;
      const deviceName = `${template.name.replace('-PT', '')}-${count}`;

      await networkService.addDevice(
        {
          deviceName,
          deviceType: template.type,
          manufacturer: 'Cisco Systems',
          model: template.model,
          serialNumber: `FOC${Math.floor(10000000 + Math.random() * 90000000)}`,
          ipAddress: `192.168.10.${devices.length + 15}`,
          macAddress: `00:1C:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}`,
          location: 'Building A Network Closet',
          department: 'IT Operations',
          status: 'Online',
          firmware: 'Cisco IOS 15.0(2)SE4',
          installationDate: new Date().toISOString().slice(0, 10),
          lastMaintenance: new Date().toISOString().slice(0, 10),
          portsCount: template.defaultPorts || 24,
          activePorts: 1,
          vlanEnabled: template.vlanEnabled,
          canvasX: Math.round(pt.x),
          canvasY: Math.round(pt.y),
        },
        currentUser
      );

      setSelectedDeviceTemplate(null);
      showToast(`Placed ${deviceName} on topology`);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add device');
    }
  };

  // Handle Node Click
  const handleNodeClick = (e: React.MouseEvent, device: NetworkDevice) => {
    if (isDragMovedRef.current) return;

    // 1. DELETE TOOL
    if (activeTool === 'delete') {
      if (canManage) {
        onDeleteDevice(device);
        showToast(`Deleted ${device.deviceName}`);
      }
      return;
    }

    // 2. INSPECT TOOL
    if (activeTool === 'inspect') {
      setInspectingDevice(device);
      return;
    }

    // 3. PDU SIMPLE PING TOOL
    if (activeTool === 'pdu') {
      if (!pduSourceId) {
        setPduSourceId(device.id);
        showToast(`PDU Source: ${device.deviceName}. Click destination device.`);
      } else if (pduSourceId === device.id) {
        setPduSourceId(null);
        showToast('PDU source cancelled');
      } else {
        const srcDev = deviceMap.get(pduSourceId);
        const tgtDev = device;
        if (srcDev) {
          // Trigger PDU packet animation along cable
          const srcPos = positions[srcDev.id] || { x: 0, y: 0 };
          const tgtPos = positions[tgtDev.id] || { x: 0, y: 0 };
          const cable = getBestCableEndpoints(srcPos, tgtPos, activeNodeWidth, activeNodeHeight);

          setPduActivePacket({
            path: cable.path,
            sourceName: srcDev.deviceName,
            targetName: tgtDev.deviceName,
          });

          setTimeout(() => {
            setPduActivePacket(null);
            setPduLogs((prev) => [
              {
                id: `pdu-${Date.now()}`,
                time: new Date().toLocaleTimeString(),
                source: srcDev.deviceName,
                target: tgtDev.deviceName,
                status: 'Successful',
                latency: '1.2ms',
                type: 'ICMP',
              },
              ...prev,
            ]);
            showToast(`ICMP Ping Successful: ${srcDev.deviceName} → ${tgtDev.deviceName} (1.2ms)`);
          }, 1800);
        }
        setPduSourceId(null);
      }
      return;
    }

    // 4. WIRING TOOL
    if (isConnecting) {
      handleTargetConnect(e, device.id);
      return;
    } else if (activeTool === 'wire' || e.altKey) {
      handleStartConnect(e, device.id);
      return;
    }

    // 5. SELECT NODE
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const next = new Set(selectedDeviceIds);
      if (next.has(device.id)) next.delete(device.id);
      else next.add(device.id);
      setSelectedDeviceIds(next);
    } else {
      setSelectedDeviceIds(new Set([device.id]));
    }
  };

  // Start Wiring Connection
  const handleStartConnect = (e: React.MouseEvent, deviceId: string) => {
    e.stopPropagation();
    if (!canManage) {
      showToast('Permission denied: Administrator role required to modify cabling.');
      return;
    }
    setConnectingSourceId(deviceId);
    setIsConnecting(true);
    showToast(`Wiring from ${deviceMap.get(deviceId)?.deviceName || 'Device'}. Click target node to connect.`);
  };

  // Complete Connection
  const handleTargetConnect = async (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (!connectingSourceId) return;

    if (connectingSourceId === targetId) {
      showToast('Cannot connect a hardware device to itself.');
      setIsConnecting(false);
      setConnectingSourceId(null);
      return;
    }

    const sourceDev = deviceMap.get(connectingSourceId);
    const targetDev = deviceMap.get(targetId);

    if (!sourceDev || !targetDev) {
      setIsConnecting(false);
      setConnectingSourceId(null);
      return;
    }

    try {
      const cableMedium: NetworkConnectionType = selectedCableType || 'Ethernet Cat6';
      if (currentUser) {
        await networkService.connectNodes(connectingSourceId, targetId, currentUser, cableMedium);
      }
      showToast(`Connected ${sourceDev.deviceName} to ${targetDev.deviceName} via ${cableMedium}`);
      setIsConnecting(false);
      setConnectingSourceId(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Connection failed');
      setIsConnecting(false);
      setConnectingSourceId(null);
    }
  };

  const cancelConnect = () => {
    setIsConnecting(false);
    setConnectingSourceId(null);
    showToast('Wiring connection cancelled');
  };

  // Disconnect Cable
  const handleDisconnectCable = async (sourceId: string, targetId: string) => {
    if (!canManage || !currentUser) return;
    try {
      await networkService.disconnectNodes(sourceId, targetId, currentUser);
      setSelectedCable(null);
      showToast('Physical connection severed');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect');
    }
  };

  // Save Topology Coordinates
  const handleManualSaveTopology = async () => {
    if (!currentUser) return;
    setIsSavingTopology(true);
    try {
      for (const dev of devices) {
        const pos = positions[dev.id];
        if (pos) {
          await networkService.updateDevice(
            dev.id,
            {
              canvasX: Math.round(pos.x),
              canvasY: Math.round(pos.y),
            },
            currentUser
          );
        }
      }
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date().toLocaleTimeString());
      showToast('Topology positions saved to system database');
    } catch (err: any) {
      showToast(err.message || 'Failed to save topology');
    } finally {
      setIsSavingTopology(false);
    }
  };

  // Export Topology JSON
  const handleExportTopologyJson = () => {
    const exportData = {
      hospitalSystem: 'HITOMS Offline-First Network Architecture',
      exportedAt: new Date().toISOString(),
      nodesCount: devices.length,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.deviceName,
        type: d.deviceType,
        model: d.model,
        ip: d.ipAddress,
        mac: d.macAddress,
        status: d.status,
        predecessorId: d.predecessorId,
        successorIds: d.successorIds,
        connectionType: d.connectionType,
        x: positions[d.id]?.x,
        y: positions[d.id]?.y,
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `cisco-topology-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Topology JSON exported');
  };

  // Collect All Physical / Logical Cable Edges
  const edges = useMemo(() => {
    const list: {
      id: string;
      sourceId: string;
      targetId: string;
      type: NetworkConnectionType;
      speed?: string;
      path: string;
      sourcePos: AnchorPoint;
      targetPos: AnchorPoint;
      isVlanTrunk?: boolean;
      sourcePortLabel: string;
      targetPortLabel: string;
    }[] = [];

    const addedPairs = new Set<string>();

    devices.forEach((dev) => {
      const parentIds = new Set<string>();
      if (dev.predecessorId) parentIds.add(dev.predecessorId);
      if (dev.uplinkDeviceId) parentIds.add(dev.uplinkDeviceId);
      if (dev.predecessorIds && Array.isArray(dev.predecessorIds)) {
        dev.predecessorIds.forEach((p) => p && parentIds.add(p));
      }

      devices.forEach((other) => {
        if (other.successorIds && other.successorIds.includes(dev.id)) {
          parentIds.add(other.id);
        }
      });

      parentIds.forEach((predId) => {
        const pairKey = `${predId}->${dev.id}`;
        if (addedPairs.has(pairKey)) return;
        addedPairs.add(pairKey);

        if (deviceMap.has(predId) && positions[predId] && positions[dev.id]) {
          const p1 = positions[predId];
          const p2 = positions[dev.id];
          const cableInfo = getBestCableEndpoints(p1, p2, activeNodeWidth, activeNodeHeight);
          const parentDev = deviceMap.get(predId);
          const isVlanTrunk = Boolean(
            (dev.vlanEnabled || (dev.vlans && dev.vlans.length > 0)) &&
            (parentDev?.vlanEnabled ||
              parentDev?.deviceType === 'Core Switch' ||
              parentDev?.deviceType === 'Router' ||
              parentDev?.deviceType === 'Managed Switch')
          );

          // Port interface labeling standard for Packet Tracer
          const isRouter = parentDev?.deviceType === 'Router';
          const isSwitch = ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(dev.deviceType);
          const isEnd = ['Workstation', 'Laptop', 'Server', 'Printer'].includes(dev.deviceType);

          const srcPort = isRouter ? 'Gi0/0/0' : parentDev?.deviceType === 'Core Switch' ? 'Gi1/0/1' : 'Fa0/1';
          const tgtPort = isEnd ? 'Fa0' : isSwitch ? 'Fa0/24' : 'Gi0/1';

          list.push({
            id: pairKey,
            sourceId: predId,
            targetId: dev.id,
            type: dev.connectionType || (isVlanTrunk ? 'SFP+ 10G' : 'Ethernet Cat6'),
            speed: isVlanTrunk ? (dev.portSpeed || '10G Trunk (VLANs Tagged)') : (dev.portSpeed || '1 Gbps'),
            path: cableInfo.path,
            sourcePos: cableInfo.source,
            targetPos: cableInfo.target,
            isVlanTrunk,
            sourcePortLabel: srcPort,
            targetPortLabel: tgtPort,
          });
        }
      });
    });

    return list;
  }, [devices, positions, deviceMap, activeNodeWidth, activeNodeHeight]);

  // Export Topology as High-Resolution PDF & JPEG (100% Identical to Canvas)
  const handleExportPDF = async () => {
    setIsExporting('pdf');
    try {
      await downloadTopologyAsPDF(
        {
          devices,
          positions,
          edges,
          notes: canvasNotes,
          isPacketTracer,
          showPortLabels,
        },
        'st-mary-theresa-cisco-topology'
      );
      showToast('High-Resolution PDF generated and downloaded');
    } catch (err: any) {
      console.error('PDF export failed:', err);
      showToast(err?.message || 'Failed to export PDF');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportJPEG = async () => {
    setIsExporting('jpeg');
    try {
      await downloadTopologyAsJPEG(
        {
          devices,
          positions,
          edges,
          notes: canvasNotes,
          isPacketTracer,
          showPortLabels,
        },
        'st-mary-theresa-cisco-topology'
      );
      showToast('High-Resolution JPEG generated and downloaded');
    } catch (err: any) {
      console.error('JPEG export failed:', err);
      showToast(err?.message || 'Failed to export JPEG');
    } finally {
      setIsExporting(null);
    }
  };

  // Rubberband Cable Path for live connection
  const getLiveRubberbandPath = (sourcePos: Point, mouse: Point) => {
    const anchors = getNodeAnchors(sourcePos, activeNodeWidth, activeNodeHeight);
    let bestAnchor = anchors.bottom;
    let minD = Infinity;

    Object.values(anchors).forEach((a) => {
      const d = Math.hypot(mouse.x - a.x, mouse.y - a.y);
      if (d < minD) {
        minD = d;
        bestAnchor = a;
      }
    });

    const dist = Math.hypot(mouse.x - bestAnchor.x, mouse.y - bestAnchor.y);
    const curvature = Math.max(30, Math.min(120, dist * 0.4));
    const cx = bestAnchor.x + bestAnchor.normal.x * curvature;
    const cy = bestAnchor.y + bestAnchor.normal.y * curvature;

    return {
      d: `M ${bestAnchor.x} ${bestAnchor.y} Q ${cx} ${cy}, ${mouse.x} ${mouse.y}`,
      start: bestAnchor,
    };
  };

  // Marquee Selection Box
  const marqueeBox = useMemo(() => {
    if (!isMarqueeDragging || !marqueeStart || !marqueeEnd) return null;
    const x = Math.min(marqueeStart.x, marqueeEnd.x);
    const y = Math.min(marqueeStart.y, marqueeEnd.y);
    const width = Math.abs(marqueeStart.x - marqueeEnd.x);
    const height = Math.abs(marqueeStart.y - marqueeEnd.y);
    return { x, y, width, height };
  }, [isMarqueeDragging, marqueeStart, marqueeEnd]);

  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative select-none">
      {/* Cisco Packet Tracer Primary Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-slate-900 border-b border-slate-800 gap-3 z-30">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher: Cisco Packet Tracer vs Enterprise Cards */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setCanvasViewMode('PACKET_TRACER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                canvasViewMode === 'PACKET_TRACER'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cisco Packet Tracer Mode: Exact topology symbols, compact scale, port labels and link lights"
            >
              <Network className="w-3.5 h-3.5 text-sky-300" />
              <span>Cisco Packet Tracer</span>
            </button>
            <button
              onClick={() => setCanvasViewMode('CARDS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                canvasViewMode === 'CARDS'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Enterprise Cards Mode: Expanded telemetry cards with hardware specs"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-300" />
              <span>Enterprise Cards</span>
            </button>
          </div>

          {/* Cisco Packet Tracer Standard Tools */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            {/* 1. Pointer (Select) */}
            <button
              onClick={() => setActiveTool('pointer')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'pointer'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Select / Move Tool (Pointer)"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            {/* 2. Hand (Pan) */}
            <button
              onClick={() => setActiveTool('pan')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'pan'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hand Tool (Pan Canvas - Spacebar shortcut)"
            >
              <Hand className="w-4 h-4" />
            </button>

            {/* 3. Wire (Cable) */}
            <button
              onClick={() => {
                setActiveTool('wire');
                if (!isConnecting && selectedDeviceIds.size === 1) {
                  const firstId = Array.from(selectedDeviceIds)[0];
                  setConnectingSourceId(firstId);
                  setIsConnecting(true);
                }
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'wire' || isConnecting
                  ? 'bg-amber-600 text-white shadow-xs animate-pulse'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cable Wiring Tool (Connect nodes)"
            >
              <Cable className="w-4 h-4" />
            </button>

            {/* 4. Simple PDU Tool (Mail Envelope Ping) */}
            <button
              onClick={() => {
                setActiveTool('pdu');
                setPduSourceId(null);
                showToast('Simple PDU Tool: Click Source device, then Destination device to test ping');
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'pdu'
                  ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Simple PDU Tool: Click Source node then Destination node to ping test"
            >
              <Mail className="w-4 h-4" />
            </button>

            {/* 5. Place Note Tool */}
            <button
              onClick={() => {
                setActiveTool('note');
                showToast('Place Note Tool: Click anywhere on the canvas to place a note');
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'note'
                  ? 'bg-yellow-400 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Place Note Tool: Add text annotation on canvas"
            >
              <StickyNote className="w-4 h-4" />
            </button>

            {/* 6. Delete Tool (Red X) */}
            <button
              onClick={() => {
                setActiveTool('delete');
                showToast('Delete Tool: Click any device or cable to delete');
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'delete'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
              title="Delete Tool: Click node or cable to delete"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 7. Inspect Tool */}
            <button
              onClick={() => {
                setActiveTool('inspect');
                showToast('Inspect Tool: Click any device to inspect configuration and status');
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'inspect'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Inspect Tool: View ARP, MAC and Port tables"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Realtime vs Simulation Mode */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setSimulationMode('REALTIME')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                simulationMode === 'REALTIME'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Realtime Mode (Normal speed execution)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Realtime</span>
            </button>
            <button
              onClick={() => {
                setSimulationMode('SIMULATION');
                setShowPduDrawer(true);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                simulationMode === 'SIMULATION'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Simulation Mode (Event list and step-by-step PDU packet inspection)"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Simulation</span>
            </button>
          </div>

          {/* Port Labels Toggle */}
          <button
            onClick={() => setShowPortLabels(!showPortLabels)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              showPortLabels
                ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Always Show Port Labels (e.g. Fa0/1, Gi0/1)"
          >
            <span>Ports: {showPortLabels ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              onClick={handleManualSaveTopology}
              disabled={isSavingTopology}
              title="Save current layout positions and topology configuration"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-800'
              }`}
            >
              {isSavingTopology ? (
                <Activity className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{hasUnsavedChanges ? 'Save Layout' : lastSavedAt ? `Saved (${lastSavedAt})` : 'Save'}</span>
            </button>
          )}

          {/* Export Topology Buttons: High-Resolution PDF & JPEG */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 p-0.5 rounded-xl">
            <button
              onClick={handleExportPDF}
              disabled={isExporting !== null}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Download Network Topology as High-Resolution PDF"
            >
              {isExporting === 'pdf' ? (
                <Activity className="w-3.5 h-3.5 animate-spin text-rose-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span>{isExporting === 'pdf' ? 'Exporting...' : 'PDF'}</span>
            </button>

            <button
              onClick={handleExportJPEG}
              disabled={isExporting !== null}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Download Network Topology as High-Resolution JPEG Image"
            >
              {isExporting === 'jpeg' ? (
                <Activity className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Image className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{isExporting === 'jpeg' ? 'Exporting...' : 'JPEG'}</span>
            </button>
          </div>

          {/* Auto Layout Dropdown */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              onClick={applyHierarchicalLayout}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:text-white rounded-lg cursor-pointer"
              title="Arrange in Hierarchical Tree"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Hierarchy</span>
            </button>
            <button
              onClick={applyStarLayout}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-300 hover:text-white rounded-lg cursor-pointer"
              title="Arrange in Radial Star Hub"
            >
              <span>Star</span>
            </button>
            <button
              onClick={applyGridLayout}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-300 hover:text-white rounded-lg cursor-pointer"
              title="Arrange in Grid Matrix"
            >
              <span>Grid</span>
            </button>
          </div>

          {/* Grid Snap Toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`p-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              snapToGrid ? 'bg-sky-600/20 border-sky-500 text-sky-300' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={snapToGrid ? 'Snap-to-Grid: ON (20px)' : 'Snap-to-Grid: OFF'}
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Center View */}
          <button
            onClick={centerCanvasView}
            className="p-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl cursor-pointer"
            title="Center View on Topology"
          >
            <Compass className="w-4 h-4 text-sky-400" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800/90 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-slate-300 font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Realtime Notification & Guidance Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-1.5 bg-slate-950/90 border-b border-slate-800 text-xs gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
            <CiscoLinkLight status="up" size={10} />
            <span>Green = Link Forwarding</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px]">
            <CiscoLinkLight status="blocking" size={8} />
            <span>Amber = STP Negotiating</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[11px]">
            <CiscoLinkLight status="down" size={10} />
            <span>Red = Link Down</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>Double-click any device to open <strong>Cisco IOS CLI & Rack Config</strong></span>
          <button
            onClick={() => setShowPduDrawer(!showPduDrawer)}
            className="text-sky-400 hover:underline font-bold cursor-pointer"
          >
            Simulation Events ({pduLogs.length}) {showPduDrawer ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Main Canvas Scrollable Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        className={`w-full overflow-auto relative min-h-[560px] max-h-[68vh] transition-colors ${
          activeTool === 'pan' || isSpacePressed
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'wire'
            ? 'cursor-crosshair'
            : activeTool === 'pdu'
            ? 'cursor-pointer'
            : activeTool === 'delete'
            ? 'cursor-not-allowed'
            : selectedDeviceTemplate
            ? 'cursor-copy'
            : 'cursor-default'
        }`}
        style={{
          // Cisco Packet Tracer subtle technical grid
          backgroundColor: '#090d16',
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      >
        <div
          style={{
            width: '2800px',
            height: '2000px',
            transform: `scale(${zoomLevel})`,
            transformOrigin: '0 0',
            position: 'relative',
          }}
        >
          {/* SVG LAYER: CONNECTORS, PACKET TRACER LINK LIGHTS & LIVE PARTICLES */}
          <svg
            className="absolute inset-0 pointer-events-none z-10"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <filter id="cable-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* RENDER CABLE EDGES */}
            {edges.map((edge) => {
              const isSelected =
                selectedCable?.sourceId === edge.sourceId &&
                selectedCable?.targetId === edge.targetId;
              const cfg = CABLE_CONFIGS[edge.type] || CABLE_CONFIGS['Ethernet Cat6'];

              const srcDev = deviceMap.get(edge.sourceId);
              const tgtDev = deviceMap.get(edge.targetId);

              const srcStatus: 'up' | 'blocking' | 'down' =
                srcDev?.status === 'Offline' ? 'down' : srcDev?.status === 'Warning' ? 'blocking' : 'up';
              const tgtStatus: 'up' | 'blocking' | 'down' =
                tgtDev?.status === 'Offline' ? 'down' : tgtDev?.status === 'Warning' ? 'blocking' : 'up';

              // Midpoint calculation for cable badge
              const midX = (edge.sourcePos.x + edge.targetPos.x) / 2;
              const midY = (edge.sourcePos.y + edge.targetPos.y) / 2;

              // Compute link light positions offset by ~12px from anchor along the normal
              const lightSrcX = edge.sourcePos.x + edge.sourcePos.normal.x * 12;
              const lightSrcY = edge.sourcePos.y + edge.sourcePos.normal.y * 12;
              const lightTgtX = edge.targetPos.x + edge.targetPos.normal.x * 12;
              const lightTgtY = edge.targetPos.y + edge.targetPos.normal.y * 12;

              // Calculate angle pointing into the devices
              const srcAngle = Math.atan2(-edge.sourcePos.normal.y, -edge.sourcePos.normal.x) * (180 / Math.PI);
              const tgtAngle = Math.atan2(-edge.targetPos.normal.y, -edge.targetPos.normal.x) * (180 / Math.PI);

              return (
                <g key={edge.id} className="pointer-events-auto">
                  {/* Invisible Wide Hit Area for Easy Selection */}
                  <path
                    d={edge.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    className="cursor-pointer"
                    onClick={() => {
                      if (activeTool === 'delete') {
                        handleDisconnectCable(edge.sourceId, edge.targetId);
                      } else {
                        setSelectedCable({
                          sourceId: edge.sourceId,
                          targetId: edge.targetId,
                          type: edge.type,
                          speed: edge.speed,
                        });
                      }
                    }}
                  />

                  {/* Outer Glowing Stroke */}
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={cfg.stroke}
                    strokeWidth={isSelected ? 4.5 : 2.5}
                    strokeOpacity={isSelected ? 1 : 0.8}
                    strokeDasharray={cfg.dash}
                    className="transition-all duration-300"
                  />

                  {/* Flowing Traffic Pulse Animated Particle */}
                  <circle r="3" fill="#ffffff">
                    <animateMotion
                      dur="2.5s"
                      repeatCount="indefinite"
                      path={edge.path}
                    />
                  </circle>

                  {/* CISCO PACKET TRACER LINK LIGHTS (GREEN/AMBER/RED TRIANGLES) */}
                  {/* 1. Source Link Light */}
                  <g transform={`translate(${lightSrcX}, ${lightSrcY}) rotate(${srcAngle})`}>
                    <polygon
                      points="-6,-4 0,0 -6,4"
                      fill={srcStatus === 'up' ? '#22c55e' : srcStatus === 'blocking' ? '#f59e0b' : '#ef4444'}
                      stroke="#0f172a"
                      strokeWidth="1"
                      className={srcStatus === 'up' ? 'drop-shadow-[0_0_3px_#22c55e]' : ''}
                    />
                  </g>

                  {/* 2. Target Link Light */}
                  <g transform={`translate(${lightTgtX}, ${lightTgtY}) rotate(${tgtAngle})`}>
                    <polygon
                      points="-6,-4 0,0 -6,4"
                      fill={tgtStatus === 'up' ? '#22c55e' : tgtStatus === 'blocking' ? '#f59e0b' : '#ef4444'}
                      stroke="#0f172a"
                      strokeWidth="1"
                      className={tgtStatus === 'up' ? 'drop-shadow-[0_0_3px_#22c55e]' : ''}
                    />
                  </g>

                  {/* PORT INTERFACE LABELS (Fa0/1, Gi0/1) */}
                  {showPortLabels && (
                    <>
                      <g transform={`translate(${lightSrcX + 6}, ${lightSrcY - 6})`}>
                        <rect x="-2" y="-9" width="32" height="11" rx="2" fill="#020617" fillOpacity="0.85" />
                        <text fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">
                          {edge.sourcePortLabel}
                        </text>
                      </g>

                      <g transform={`translate(${lightTgtX + 6}, ${lightTgtY - 6})`}>
                        <rect x="-2" y="-9" width="32" height="11" rx="2" fill="#020617" fillOpacity="0.85" />
                        <text fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">
                          {edge.targetPortLabel}
                        </text>
                      </g>
                    </>
                  )}

                  {/* Midpoint Cable Speed Badge */}
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    className="cursor-pointer group"
                    onClick={() =>
                      setSelectedCable({
                        sourceId: edge.sourceId,
                        targetId: edge.targetId,
                        type: edge.type,
                        speed: edge.speed,
                      })
                    }
                  >
                    <rect
                      x="-42"
                      y="-10"
                      width="84"
                      height="20"
                      rx="5"
                      fill="#0f172a"
                      stroke={cfg.stroke}
                      strokeWidth={isSelected ? 2 : 1}
                      className="shadow-md transition group-hover:scale-105"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {edge.speed || cfg.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* LIVE RUBBERBAND CABLE (During Wire Mode) */}
            {isConnecting && connectingSourceId && positions[connectingSourceId] && (
              <g>
                {(() => {
                  const live = getLiveRubberbandPath(positions[connectingSourceId], mousePos);
                  return (
                    <>
                      <path
                        d={live.d}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeDasharray="4 3"
                        className="animate-pulse"
                      />
                      <circle
                        cx={mousePos.x}
                        cy={mousePos.y}
                        r="5"
                        fill="#38bdf8"
                        className="animate-ping opacity-75"
                      />
                    </>
                  );
                })()}
              </g>
            )}

            {/* LIVE PDU PING ANIMATION (Flying Packet) */}
            {pduActivePacket && (
              <g>
                <circle r="7" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" className="animate-pulse">
                  <animateMotion
                    dur="1.6s"
                    repeatCount="1"
                    path={pduActivePacket.path}
                  />
                </circle>
                <text
                  fontSize="8"
                  fontWeight="bold"
                  fill="#fbbf24"
                  fontFamily="sans-serif"
                >
                  <animateMotion
                    dur="1.6s"
                    repeatCount="1"
                    path={pduActivePacket.path}
                  />
                  ICMP
                </text>
              </g>
            )}
          </svg>

          {/* LIVE MARQUEE RECTANGLE */}
          {marqueeBox && (
            <div
              className="absolute pointer-events-none z-40 border-2 border-dashed border-sky-400 bg-sky-500/15 rounded-lg transition-none"
              style={{
                left: `${marqueeBox.x}px`,
                top: `${marqueeBox.y}px`,
                width: `${marqueeBox.width}px`,
                height: `${marqueeBox.height}px`,
              }}
            />
          )}

          {/* RENDER CANVAS STICKY NOTES / ANNOTATIONS */}
          {canvasNotes.map((note) => (
            <div
              key={note.id}
              data-note-id="true"
              style={{
                transform: `translate(${note.x}px, ${note.y}px)`,
                minWidth: '150px',
                maxWidth: '240px',
              }}
              className="absolute z-20 p-2.5 rounded-lg shadow-xl border border-yellow-500/50 bg-yellow-100 text-slate-900 text-xs font-mono group"
            >
              <div className="flex items-center justify-between pb-1 border-b border-yellow-300 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-800">
                  Network Note
                </span>
                <button
                  onClick={() => setCanvasNotes((prev) => prev.filter((n) => n.id !== note.id))}
                  className="opacity-0 group-hover:opacity-100 text-rose-600 hover:text-rose-800 p-0.5"
                  title="Delete Note"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <textarea
                value={note.text}
                onChange={(e) => {
                  const val = e.target.value;
                  setCanvasNotes((prev) =>
                    prev.map((n) => (n.id === note.id ? { ...n, text: val } : n))
                  );
                }}
                className="w-full bg-transparent resize-none focus:outline-hidden text-slate-800 text-[11px] leading-tight"
                rows={3}
              />
            </div>
          ))}

          {/* RENDER HARDWARE DEVICE NODES */}
          {devices.map((device) => {
            const pos = positions[device.id] || { x: 100, y: 100 };
            const isSelected = selectedDeviceIds.has(device.id);
            const isDraggingThis = isDraggingGroup && isSelected;
            const isSourceForWiring = connectingSourceId === device.id;
            const isPduSource = pduSourceId === device.id;
            const tierInfo = getDeviceTierInfo(device.deviceType);

            // 1. CISCO PACKET TRACER MODE (Compact, Authentic Topology Glyph)
            if (isPacketTracer) {
              return (
                <div
                  key={device.id}
                  data-node-id="true"
                  onMouseDown={(e) => handleNodeMouseDown(e, device.id)}
                  onDoubleClick={() => setCiscoModalDevice(device)}
                  onClick={(e) => handleNodeClick(e, device)}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    width: `${PT_NODE_WIDTH}px`,
                    minHeight: `${PT_NODE_HEIGHT}px`,
                  }}
                  className={`absolute z-20 flex flex-col items-center justify-start cursor-pointer select-none group transition-all ${
                    isConnecting
                      ? isSourceForWiring
                        ? 'ring-4 ring-amber-400 bg-amber-950/60 rounded-xl p-1 scale-105'
                        : 'ring-2 ring-emerald-400 bg-emerald-950/40 rounded-xl p-1 hover:scale-105'
                      : isPduSource
                      ? 'ring-4 ring-amber-400 bg-amber-950/70 rounded-xl p-1 animate-pulse'
                      : isSelected
                      ? 'ring-2 ring-sky-400 bg-sky-950/60 rounded-xl p-1 shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                      : 'p-1 hover:bg-slate-800/40 rounded-xl'
                  } ${isDraggingThis ? 'opacity-90' : ''}`}
                >
                  {/* Connection Overlay */}
                  {isConnecting && !isSourceForWiring && (
                    <div className="absolute inset-0 rounded-xl bg-emerald-500/10 border border-emerald-400/80 flex items-center justify-center pointer-events-none z-30">
                      <span className="bg-emerald-950/90 text-emerald-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500">
                        Connect
                      </span>
                    </div>
                  )}

                  {/* 4 Multi-Directional Port Snap Pins */}
                  {/* Top */}
                  <div
                    title="Top Port: Connect"
                    onClick={(e) => {
                      if (isConnecting) handleTargetConnect(e, device.id);
                      else handleStartConnect(e, device.id);
                    }}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-950 border border-slate-600 hover:border-emerald-400 flex items-center justify-center cursor-pointer transition opacity-0 group-hover:opacity-100 z-30"
                  >
                    <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                  </div>

                  {/* Bottom */}
                  <div
                    title="Bottom Port: Connect"
                    onClick={(e) => {
                      if (isConnecting) handleTargetConnect(e, device.id);
                      else handleStartConnect(e, device.id);
                    }}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-950 border border-slate-600 hover:border-emerald-400 flex items-center justify-center cursor-pointer transition opacity-0 group-hover:opacity-100 z-30"
                  >
                    <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                  </div>

                  {/* Left */}
                  <div
                    title="Left Port: Connect"
                    onClick={(e) => {
                      if (isConnecting) handleTargetConnect(e, device.id);
                      else handleStartConnect(e, device.id);
                    }}
                    className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-950 border border-slate-600 hover:border-emerald-400 flex items-center justify-center cursor-pointer transition opacity-0 group-hover:opacity-100 z-30"
                  >
                    <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                  </div>

                  {/* Right */}
                  <div
                    title="Right Port: Connect"
                    onClick={(e) => {
                      if (isConnecting) handleTargetConnect(e, device.id);
                      else handleStartConnect(e, device.id);
                    }}
                    className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-950 border border-slate-600 hover:border-emerald-400 flex items-center justify-center cursor-pointer transition opacity-0 group-hover:opacity-100 z-30"
                  >
                    <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                  </div>

                  {/* Cisco Topology Icon */}
                  <div className="flex items-center justify-center relative mt-1">
                    <CiscoDeviceIcon
                      type={device.deviceType}
                      size={48}
                      highlighted={isSelected || isPduSource}
                    />

                    {isPduSource && (
                      <div className="absolute -top-2 -right-2 p-1 rounded-full bg-amber-500 text-slate-950 shadow-md">
                        <Mail className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {/* Packet Tracer Device Label Underneath */}
                  <div className="mt-1 text-center w-full px-0.5">
                    <div
                      className="font-bold text-[10px] text-slate-100 truncate w-full tracking-tight"
                      title={device.deviceName}
                    >
                      {device.deviceName}
                    </div>
                    <div className="font-mono text-[8.5px] text-sky-400 truncate w-full">
                      {device.ipAddress}
                    </div>
                  </div>
                </div>
              );
            }

            // 2. ENTERPRISE CARDS MODE (Expanded Telemetry Dashboard Card)
            return (
              <div
                key={device.id}
                data-node-id="true"
                onMouseDown={(e) => handleNodeMouseDown(e, device.id)}
                onDoubleClick={() => setCiscoModalDevice(device)}
                onClick={(e) => handleNodeClick(e, device)}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: `${CARD_NODE_WIDTH}px`,
                  minHeight: `${CARD_NODE_HEIGHT}px`,
                }}
                className={`absolute z-20 rounded-2xl p-3.5 transition-all border ${
                  isConnecting
                    ? isSourceForWiring
                      ? 'shadow-2xl ring-4 ring-amber-500/60 bg-slate-900 border-amber-400 animate-pulse'
                      : 'bg-slate-900/95 border-emerald-500/60 ring-2 ring-emerald-500/40 hover:ring-4 hover:ring-emerald-400 hover:border-emerald-300 cursor-pointer scale-[1.01]'
                    : isSelected
                    ? 'ring-3 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.5)] bg-slate-900 border-sky-400 z-30 scale-[1.02] cursor-grab active:cursor-grabbing'
                    : 'bg-slate-900/90 hover:bg-slate-900 border-slate-700/80 hover:border-slate-500 shadow-xl cursor-grab active:cursor-grabbing'
                } ${isDraggingThis ? 'opacity-95' : ''}`}
              >
                {/* Visual Connection Overlay during Wiring Mode */}
                {isConnecting && !isSourceForWiring && (
                  <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 border-2 border-emerald-400/80 flex items-center justify-center pointer-events-none z-30 backdrop-blur-[1px]">
                    <span className="bg-emerald-950/90 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500 flex items-center gap-1 shadow-lg">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>Click to Connect</span>
                    </span>
                  </div>
                )}

                {/* 4 Port Pins */}
                <div
                  title="Top Port"
                  onClick={(e) => {
                    if (isConnecting) handleTargetConnect(e, device.id);
                    else handleStartConnect(e, device.id);
                  }}
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-600 hover:border-emerald-400 flex items-center justify-center cursor-pointer transition shadow-md z-30"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                </div>
                <div
                  title="Bottom Port"
                  onClick={(e) => {
                    if (isConnecting) handleTargetConnect(e, device.id);
                    else handleStartConnect(e, device.id);
                  }}
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-600 hover:border-emerald-400 flex items-center justify-center cursor-pointer transition shadow-md z-30"
                >
                  <Plus className="w-3 h-3 text-slate-400 hover:text-emerald-300" />
                </div>

                {/* Card Header with Cisco Icon */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 pr-4">
                    <div className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                      <CiscoDeviceIcon type={device.deviceType} size={32} />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate" title={device.deviceName}>
                        {device.deviceName}
                      </h4>
                      <div className="text-[10px] font-mono text-sky-400 font-semibold truncate">
                        {device.ipAddress}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${tierInfo.bg}`}>
                          {tierInfo.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Toolbar */}
                {canManage && (
                  <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-xs">
                    <button
                      title="Clone Device"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloneDevice(device);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-sky-300 hover:text-white hover:bg-sky-600/30 transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-sky-400" />
                      <span>Clone</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        title="Wire / Connect Cable"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isConnecting) handleTargetConnect(e, device.id);
                          else handleStartConnect(e, device.id);
                        }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-300 hover:text-white hover:bg-amber-600/40 transition cursor-pointer"
                      >
                        <Cable className="w-3 h-3 text-amber-400" />
                        <span>Wire</span>
                      </button>
                      <button
                        title="Cisco Config & IOS CLI"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCiscoModalDevice(device);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 cursor-pointer"
                      >
                        <Terminal className="w-3 h-3 text-emerald-400" />
                      </button>
                      <button
                        title="Edit Node Settings"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDevice(device);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        title="Delete Device"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDevice(device);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cisco Packet Tracer Device Shelf & Palette (Bottom Dock) */}
      <CiscoBottomShelf
        onSelectDeviceTemplate={(template) => {
          setSelectedDeviceTemplate(template);
          showToast(`Ready to drop ${template.name} — Click anywhere on the canvas`);
        }}
        onSelectCableType={(cableType) => {
          setSelectedCableType(cableType);
          setActiveTool('wire');
          showToast(`Selected ${cableType} — Click source node then target node`);
        }}
        selectedDeviceTemplate={selectedDeviceTemplate}
        selectedCableType={selectedCableType}
        activeTool={activeTool}
        isCollapsed={isShelfCollapsed}
        onToggleCollapse={() => setIsShelfCollapsed(!isShelfCollapsed)}
      />

      {/* PDU SIMULATION DRAWER (Bottom-Right Floating Event List) */}
      {showPduDrawer && (
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col gap-2 z-30 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Packet Tracer Simulation / PDU Event Log
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPduLogs([])}
                className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
              >
                Clear Log
              </button>
              <button
                onClick={() => setShowPduDrawer(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="text-slate-500 font-mono border-b border-slate-850">
                <th className="py-1">Last Status</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Protocol</th>
                <th>Latency</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 font-mono">
              {pduLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/60">
                  <td className="py-1">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px]">
                      {log.status}
                    </span>
                  </td>
                  <td className="text-white font-semibold">{log.source}</td>
                  <td className="text-white font-semibold">{log.target}</td>
                  <td className="text-amber-400 font-bold">{log.type}</td>
                  <td className="text-slate-400">{log.latency}</td>
                  <td className="text-slate-500">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK DEVICE INSPECT MODAL */}
      {inspectingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-3">
                <CiscoDeviceIcon type={inspectingDevice.deviceType} size={36} />
                <div>
                  <h3 className="text-sm font-bold text-white">{inspectingDevice.deviceName}</h3>
                  <div className="text-[11px] text-sky-400 font-mono">{inspectingDevice.ipAddress}</div>
                </div>
              </div>
              <button
                onClick={() => setInspectingDevice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Device Model:</span>
                <span className="font-semibold text-white">{inspectingDevice.model || inspectingDevice.deviceType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">MAC Address:</span>
                <span className="font-mono text-slate-300">{inspectingDevice.macAddress || '00:1C:AA:BB:CC:01'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Physical Location:</span>
                <span className="text-slate-300">{inspectingDevice.location || 'Server Room'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Firmware IOS:</span>
                <span className="font-mono text-emerald-400">{inspectingDevice.firmware || 'Cisco IOS 15.0(2)'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-emerald-400">{inspectingDevice.status}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  const dev = inspectingDevice;
                  setInspectingDevice(null);
                  setCiscoModalDevice(dev);
                }}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Open Full Cisco IOS CLI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CISCO PACKET TRACER DEVICE CONFIGURATION & IOS CLI MODAL */}
      {ciscoModalDevice && (
        <CiscoDeviceModal
          device={ciscoModalDevice}
          allDevices={devices}
          onClose={() => setCiscoModalDevice(null)}
          onUpdateDevice={(updated) => {
            if (currentUser) {
              networkService.updateDevice(
                updated.id,
                {
                  deviceName: updated.deviceName,
                  ipAddress: updated.ipAddress,
                  status: updated.status,
                },
                currentUser
              );
            }
            setCiscoModalDevice(null);
            showToast(`Updated ${updated.deviceName}`);
            onRefresh();
          }}
        />
      )}

      {/* CABLE INSPECTION & MANAGEMENT DRAWER */}
      {selectedCable && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-400">
              <Cable className="w-5 h-5" />
            </div>

            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>{deviceMap.get(selectedCable.sourceId)?.deviceName}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                <span>{deviceMap.get(selectedCable.targetId)?.deviceName}</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Connected link: <strong className="text-white">{selectedCable.type}</strong> ({selectedCable.speed || '1 Gbps'})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <button
                onClick={() =>
                  handleDisconnectCable(selectedCable.sourceId, selectedCable.targetId)
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Unlink2 className="w-3.5 h-3.5" />
                <span>Sever Cable (Disconnect)</span>
              </button>
            )}

            <button
              onClick={() => setSelectedCable(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-4 right-4 bg-slate-800 border border-slate-700 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 z-50 animate-fade-in">
          <Activity className="w-4 h-4 text-sky-400 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tier Guide Modal */}
      {showTierGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-xs text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-700 text-indigo-400">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Hospital Network Tier Architecture Guide</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cisco Packet Tracer hierarchical model classification.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTierGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/80 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                <Monitor className="w-4 h-4 text-emerald-400" />
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>Endpoint Devices (Computers & Laptops)</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Computers, Desktops, Laptops, Nurse Stations, and Printers connect to <strong className="text-sky-300">Tier 4 Access Switches</strong> (via Ethernet Cat6) or <strong className="text-purple-300">Wireless Access Points</strong> (via Wi-Fi).
              </p>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowTierGuide(false)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
