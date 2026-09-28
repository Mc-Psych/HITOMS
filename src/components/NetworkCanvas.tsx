import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
} from 'lucide-react';
import {
  type NetworkDevice,
  type NetworkDeviceType,
  type NetworkConnectionType,
  type User as UserType,
} from '../types';
import { networkService } from '../services/networkService';

interface NetworkCanvasProps {
  devices: NetworkDevice[];
  currentUser: UserType | null;
  onSelectDevice: (device: NetworkDevice) => void;
  onEditDevice: (device: NetworkDevice) => void;
  onCloneDevice: (device: NetworkDevice) => void;
  onDeleteDevice: (device: NetworkDevice) => void;
  onRefresh: () => void;
}

interface Point {
  x: number;
  y: number;
}

const CABLE_CONFIGS: Record<
  NetworkConnectionType,
  { stroke: string; glow: string; label: string; dash?: string; speedDefault: string }
> = {
  Fiber: {
    stroke: '#22d3ee', // cyan-400
    glow: 'rgba(34, 211, 238, 0.4)',
    label: 'Fiber OM3/OM4',
    speedDefault: '1 Gbps OM3 Fiber',
  },
  'Ethernet Cat6': {
    stroke: '#34d399', // emerald-400
    glow: 'rgba(52, 211, 153, 0.4)',
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

const NODE_WIDTH = 250;
const NODE_HEIGHT = 110;

/**
 * Computes strict hierarchical DAG positions based on predecessor-successor tree structure
 */
function computeHierarchicalOrder(devs: NetworkDevice[]): Record<string, Point> {
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
      else if (d.deviceType === 'Distribution Switch') depthMap.set(d.id, 3);
      else if (['Switch', 'Access Point'].includes(d.deviceType)) depthMap.set(d.id, 4);
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
  const LEVEL_Y_SPACING = 175;
  const NODE_X_SPACING = 300;

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
      return { tier: 2, name: 'Tier 2: Core Switch', badge: 'Tier 2 • Core Backbone', bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60' };
    case 'Server':
      return { tier: 2, name: 'Tier 2: Edge Server', badge: 'Tier 2 • Server', bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60' };
    case 'Distribution Switch':
      return { tier: 3, name: 'Tier 3: Distribution Switch', badge: 'Tier 3 • Dist Switch', bg: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60' };
    case 'Switch':
      return { tier: 4, name: 'Tier 4: Access Switch', badge: 'Tier 4 • Access Switch', bg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
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
  width = NODE_WIDTH,
  height = NODE_HEIGHT
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
  width = NODE_WIDTH,
  height = NODE_HEIGHT
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
      // Prefer anchor normals pointing toward each other
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Layout node coordinates (x, y) map
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const positionsRef = useRef<Record<string, Point>>({});
  positionsRef.current = positions;

  // Drag tracking to distinguish pure clicks from drags
  const isDragMovedRef = useRef<boolean>(false);
  const dragStartClientPos = useRef<Point>({ x: 0, y: 0 });

  // Canvas Panning State (Drag canvas in all directions: left, right, top, bottom)
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

  // Tool Mode: 'pointer' (drag nodes or drag background to pan), 'pan' (hand tool), 'wire' (cable connection), 'marquee' (box select)
  const [activeTool, setActiveTool] = useState<'pointer' | 'pan' | 'wire' | 'marquee'>('pointer');

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

  const canManage = Boolean(currentUser && ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'SYSTEM_ADMIN'].includes(currentUser.role));

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
      // If initial state was empty, load from devices or compute hierarchy
      if (Object.keys(prev).length === 0 && devices.length > 0) {
        const hierarchical = computeHierarchicalOrder(devices);
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

      // Check if there are new devices that don't have coordinates in state
      const hierarchical = computeHierarchicalOrder(devices);
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

      // If devices were deleted, clean up from positions map
      const currentIds = new Set(devices.map((d) => d.id));
      Object.keys(next).forEach((id) => {
        if (!currentIds.has(id)) {
          delete next[id];
          hasChanges = true;
        }
      });

      return hasChanges ? next : prev;
    });
  }, [devices]);

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
    const avgX = devPositions.reduce((acc, p) => acc + p.x, 0) / devPositions.length;
    const avgY = devPositions.reduce((acc, p) => acc + p.y, 0) / devPositions.length;

    const viewportW = containerRef.current.clientWidth;
    const viewportH = containerRef.current.clientHeight;

    containerRef.current.scrollTo({
      left: Math.max(0, avgX * zoomLevel - viewportW / 2 + (NODE_WIDTH * zoomLevel) / 2),
      top: Math.max(0, avgY * zoomLevel - viewportH / 2 + (NODE_HEIGHT * zoomLevel) / 2),
      behavior: 'smooth',
    });
  }, [devices, zoomLevel]);

  // Canvas Mouse Down: Starts Canvas Panning OR Marquee Box Selection on background
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (isConnecting) return;

    // Check if clicked directly on canvas background (not on an interactive node, button, input, or badge)
    const target = e.target as HTMLElement;
    const isInteractive = Boolean(
      target.closest('[data-node-id="true"]') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('[data-interactive="true"]') ||
      target.closest('[data-cable-badge="true"]')
    );

    if (!isInteractive) {
      const isMarquee = activeTool === 'marquee' || e.shiftKey || e.metaKey || e.ctrlKey;

      if (isMarquee) {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        setIsMarqueeDragging(true);
        setMarqueeStart(pt);
        setMarqueeEnd(pt);

        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
          setSelectedDeviceIds(new Set());
        }
      } else {
        // Drag canvas to pan in all directions (left, right, top, bottom)
        isPanningRef.current = true;
        setIsPanning(true);
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          scrollLeft: containerRef.current?.scrollLeft || 0,
          scrollTop: containerRef.current?.scrollTop || 0,
        };
      }
    }
  };

  // Node Mouse Down: Selects individual or starts dragging group
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isConnecting) return;

    // If Hand tool or Spacebar is active, delegate to canvas panning
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

    // Reset drag movement tracker
    isDragMovedRef.current = false;
    dragStartClientPos.current = { x: e.clientX, y: e.clientY };

    const pt = getCanvasPoint(e.clientX, e.clientY);
    const isShift = e.shiftKey || e.metaKey || e.ctrlKey;

    let nextSelected = new Set(selectedDeviceIds);

    if (isShift) {
      if (nextSelected.has(id)) {
        nextSelected.delete(id);
      } else {
        nextSelected.add(id);
      }
      setSelectedDeviceIds(nextSelected);
      return;
    }

    // If clicking on an unselected node without Shift, make it the sole selection
    if (!nextSelected.has(id)) {
      nextSelected = new Set([id]);
      setSelectedDeviceIds(nextSelected);
    }

    // Start multi-device drag
    setIsDraggingGroup(true);
    setDragAnchorId(id);
    setDragStartMouse(pt);
    setDragInitialPositions({ ...positions });
  };

  // Canvas Mouse Move: Handles Panning, Marquee Box, and Multi-Device Dragging
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const pt = getCanvasPoint(e.clientX, e.clientY);
    setMousePos(pt);

    // 1. CANVAS VIEWPORT PANNING (Left, Right, Top, Bottom)
    if (isPanningRef.current && containerRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      return;
    }

    // 2. MARQUEE SELECTION LOGIC
    if (isMarqueeDragging && marqueeStart) {
      setMarqueeEnd(pt);

      const minX = Math.min(marqueeStart.x, pt.x);
      const maxX = Math.max(marqueeStart.x, pt.x);
      const minY = Math.min(marqueeStart.y, pt.y);
      const maxY = Math.max(marqueeStart.y, pt.y);

      // Find all devices intersecting selection rectangle
      const newlySelected = new Set(
        e.shiftKey || e.metaKey || e.ctrlKey ? selectedDeviceIds : []
      );

      devices.forEach((dev) => {
        const nodePos = positions[dev.id] || { x: 0, y: 0 };
        const nodeMinX = nodePos.x;
        const nodeMaxX = nodePos.x + NODE_WIDTH;
        const nodeMinY = nodePos.y;
        const nodeMaxY = nodePos.y + NODE_HEIGHT;

        // Check AABB 2D bounding box intersection
        const intersects = !(
          nodeMaxX < minX ||
          nodeMinX > maxX ||
          nodeMaxY < minY ||
          nodeMinY > maxY
        );

        if (intersects) {
          newlySelected.add(dev.id);
        }
      });

      setSelectedDeviceIds(newlySelected);
      return;
    }

    // 3. SIMULTANEOUS MULTI-DEVICE DRAG LOGIC
    if (isDraggingGroup && dragAnchorId) {
      const dist = Math.hypot(
        e.clientX - dragStartClientPos.current.x,
        e.clientY - dragStartClientPos.current.y
      );
      if (dist > 4) {
        isDragMovedRef.current = true;
      }

      let deltaX = pt.x - dragStartMouse.x;
      let deltaY = pt.y - dragStartMouse.y;

      if (snapToGrid) {
        deltaX = Math.round(deltaX / 20) * 20;
        deltaY = Math.round(deltaY / 20) * 20;
      }

      setHasUnsavedChanges(true);
      setPositions((prev) => {
        const next = { ...prev };
        const targetIds = selectedDeviceIds.size > 0 ? selectedDeviceIds : new Set([dragAnchorId]);
        targetIds.forEach((devId) => {
          const initPos = dragInitialPositions[devId] || prev[devId] || { x: 100, y: 100 };
          const newX = Math.max(20, Math.min(2200, initPos.x + deltaX));
          const newY = Math.max(20, Math.min(1600, initPos.y + deltaY));
          next[devId] = { x: newX, y: newY };
        });
        return next;
      });
    }
  };

  // Canvas Mouse Up: Finalize Panning, Marquee & Save All Moved Positions Permanently
  const handleCanvasMouseUp = async () => {
    // Finalize Panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
    }

    // Finalize Marquee selection
    if (isMarqueeDragging) {
      setIsMarqueeDragging(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }

    // Finalize Multi-Device Drag and save coordinates to storage
    if (isDraggingGroupRef.current) {
      const wasMoved = isDragMovedRef.current;
      const anchorId = dragAnchorIdRef.current;
      const currentSelected = selectedDeviceIdsRef.current;

      setIsDraggingGroup(false);
      setDragAnchorId(null);

      if (wasMoved) {
        const idsToUpdate: string[] = Array.from(
          currentSelected.size > 0 ? currentSelected : (anchorId ? [anchorId] : [])
        ) as string[];

        const updatesToSave: { id: string; canvasX: number; canvasY: number }[] = [];
        idsToUpdate.forEach((devId: string) => {
          const p = positionsRef.current[devId];
          if (p) {
            updatesToSave.push({ id: devId, canvasX: p.x, canvasY: p.y });
          }
        });

        if (updatesToSave.length > 0) {
          await networkService.updatePositions(updatesToSave);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSavedAt(timeStr);
          setHasUnsavedChanges(false);
          onRefresh();
          showToast(`Saved new layout position for ${updatesToSave.length} device(s)`);
        }
      }
    }
  };

  // Global window listeners for drag/pan movement and release
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current && containerRef.current) {
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
        containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
      }
      if (isDraggingGroupRef.current || isMarqueeDragging) {
        handleCanvasMouseUp();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isMarqueeDragging]);

  // Apply Strict Hierarchical Predecessor-Successor Order (Default Layout)
  const applyHierarchicalLayout = async () => {
    const hierarchical = computeHierarchicalOrder(devices);
    setPositions(hierarchical);
    const updates = (Object.entries(hierarchical) as [string, Point][]).map(([id, p]) => ({
      id,
      canvasX: p.x,
      canvasY: p.y,
    }));
    await networkService.updatePositions(updates);
    showToast('Arranged devices according to predecessor-successor hierarchy');
    onRefresh();
  };

  // Preset Star Radial Layout
  const applyStarLayout = async () => {
    const hub =
      devices.find((d) => d.deviceType === 'Core Switch') ||
      devices.find((d) => d.deviceType === 'Router') ||
      devices[0];

    if (!hub) return;

    const centerX = 750;
    const centerY = 450;
    const radius = 340;
    const others = devices.filter((d) => d.id !== hub.id);
    const nextPositions: Record<string, Point> = {
      [hub.id]: { x: centerX, y: centerY },
    };

    others.forEach((dev, idx) => {
      const angle = (idx / others.length) * 2 * Math.PI - Math.PI / 2;
      const x = Math.round((centerX + radius * Math.cos(angle)) / 20) * 20;
      const y = Math.round((centerY + radius * Math.sin(angle)) / 20) * 20;
      nextPositions[dev.id] = { x, y };
    });

    setPositions(nextPositions);
    const updates = (Object.entries(nextPositions) as [string, Point][]).map(([id, p]) => ({
      id,
      canvasX: p.x,
      canvasY: p.y,
    }));
    await networkService.updatePositions(updates);
    showToast('Applied Star & Radial Hub Topology Layout');
    onRefresh();
  };

  // Preset Grid Layout
  const applyGridLayout = async () => {
    const cols = 4;
    const spacingX = 290;
    const spacingY = 160;
    const startX = 80;
    const startY = 60;

    const nextPositions: Record<string, Point> = {};
    devices.forEach((dev, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      nextPositions[dev.id] = {
        x: startX + col * spacingX,
        y: startY + row * spacingY,
      };
    });

    setPositions(nextPositions);
    const updates = (Object.entries(nextPositions) as [string, Point][]).map(([id, p]) => ({
      id,
      canvasX: p.x,
      canvasY: p.y,
    }));
    await networkService.updatePositions(updates);
    showToast('Arranged nodes in structured grid');
    onRefresh();
  };

  // Bulk Alignment Tools for Selected Devices
  const handleAlignSelectedHorizontally = async () => {
    if (selectedDeviceIds.size <= 1) return;
    const selectedList = Array.from(selectedDeviceIds) as string[];
    const firstY = positions[selectedList[0]]?.y ?? 100;

    const next = { ...positions };
    const updates: { id: string; canvasX: number; canvasY: number }[] = [];

    selectedList.forEach((id: string) => {
      if (next[id]) {
        next[id] = { ...next[id], y: firstY };
        updates.push({ id, canvasX: next[id].x, canvasY: firstY });
      }
    });

    setPositions(next);
    await networkService.updatePositions(updates);
    showToast(`Aligned ${selectedDeviceIds.size} devices horizontally`);
  };

  const handleAlignSelectedVertically = async () => {
    if (selectedDeviceIds.size <= 1) return;
    const selectedList = Array.from(selectedDeviceIds) as string[];
    const firstX = positions[selectedList[0]]?.x ?? 100;

    const next = { ...positions };
    const updates: { id: string; canvasX: number; canvasY: number }[] = [];

    selectedList.forEach((id: string) => {
      if (next[id]) {
        next[id] = { ...next[id], x: firstX };
        updates.push({ id, canvasX: firstX, canvasY: next[id].y });
      }
    });

    setPositions(next);
    await networkService.updatePositions(updates);
    showToast(`Aligned ${selectedDeviceIds.size} devices vertically`);
  };

  const handleDistributeSelectedHorizontally = async () => {
    if (selectedDeviceIds.size <= 2) return;
    const selectedList = (Array.from(selectedDeviceIds) as string[]).sort(
      (a: string, b: string) => (positions[a]?.x || 0) - (positions[b]?.x || 0)
    );

    const firstX = positions[selectedList[0]]?.x || 100;
    const lastX = positions[selectedList[selectedList.length - 1]]?.x || 800;
    const step = (lastX - firstX) / (selectedList.length - 1);

    const next = { ...positions };
    const updates: { id: string; canvasX: number; canvasY: number }[] = [];

    selectedList.forEach((id: string, idx: number) => {
      if (next[id]) {
        const newX = Math.round((firstX + idx * step) / 20) * 20;
        next[id] = { ...next[id], x: newX };
        updates.push({ id, canvasX: newX, canvasY: next[id].y });
      }
    });

    setPositions(next);
    await networkService.updatePositions(updates);
    showToast(`Distributed ${selectedDeviceIds.size} devices evenly`);
  };

  const handleSelectAll = () => {
    setSelectedDeviceIds(new Set(devices.map((d) => d.id)));
  };

  const handleClearSelection = () => {
    setSelectedDeviceIds(new Set());
  };

  // Explicit Manual Save of Entire Topology Layout
  const handleManualSaveTopology = async () => {
    try {
      setIsSavingTopology(true);
      const updates = devices.map((d) => ({
        id: d.id,
        canvasX: positions[d.id]?.x ?? d.canvasX ?? 100,
        canvasY: positions[d.id]?.y ?? d.canvasY ?? 100,
      }));
      await networkService.updatePositions(updates);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedAt(timeStr);
      setHasUnsavedChanges(false);
      showToast(`Topology layout saved successfully at ${timeStr}`);
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast('Failed to save topology layout');
    } finally {
      setIsSavingTopology(false);
    }
  };

  // Export Topology snapshot as JSON
  const handleExportTopologyJson = () => {
    const exportData = {
      hospital: 'Hospital IT Operations & Maintenance System',
      exportedAt: new Date().toISOString(),
      topologyVersion: '1.0',
      totalDevices: devices.length,
      devices: devices.map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        ipAddress: d.ipAddress,
        macAddress: d.macAddress,
        location: d.location,
        status: d.status,
        predecessorId: d.predecessorId || d.uplinkDeviceId || null,
        successorIds: d.successorIds || [],
        connectionType: d.connectionType || 'Ethernet Cat6',
        portSpeed: d.portSpeed || '1 Gbps',
        canvasCoordinates: positions[d.id] || { x: d.canvasX, y: d.canvasY },
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `hospital-network-topology-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Topology configuration JSON snapshot exported');
  };

  // Collect All Physical / Logical Cable Edges with natural port endpoints
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
    }[] = [];

    devices.forEach((dev) => {
      const predId = dev.predecessorId || dev.uplinkDeviceId;
      if (predId && deviceMap.has(predId) && positions[predId] && positions[dev.id]) {
        const p1 = positions[predId];
        const p2 = positions[dev.id];
        const cableInfo = getBestCableEndpoints(p1, p2);

        list.push({
          id: `${predId}->${dev.id}`,
          sourceId: predId,
          targetId: dev.id,
          type: dev.connectionType || 'Ethernet Cat6',
          speed: dev.portSpeed || '1 Gbps',
          path: cableInfo.path,
          sourcePos: cableInfo.source,
          targetPos: cableInfo.target,
        });
      }
    });

    return list;
  }, [devices, positions, deviceMap]);

  // High-Resolution Direct Canvas Generator for PDF & JPEG Export
  const generateTopologyCanvas = useCallback((): HTMLCanvasElement => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    devices.forEach((d) => {
      const pos = positions[d.id] || { x: d.canvasX || 100, y: d.canvasY || 100 };
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + 240 > maxX) maxX = pos.x + 240;
      if (pos.y + 130 > maxY) maxY = pos.y + 130;
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 1200;
      maxY = 800;
    }

    const padding = 70;
    const headerHeight = 65;
    const footerHeight = 35;
    const contentW = Math.max(1200, maxX - minX + padding * 2);
    const contentH = Math.max(700, maxY - minY + padding * 2);
    const totalW = contentW;
    const totalH = contentH + headerHeight + footerHeight;

    const scale = 2; // 2x Retina resolution
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(totalW * scale);
    canvas.height = Math.round(totalH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    ctx.scale(scale, scale);

    // Deep Dark Canvas Background
    ctx.fillStyle = '#020617'; // slate-950
    ctx.fillRect(0, 0, totalW, totalH);

    // Subtle Dot Grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = 0; x < totalW; x += 24) {
      for (let y = headerHeight; y < totalH - footerHeight; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const offsetX = padding - minX;
    const offsetY = headerHeight + padding - minY;

    const roundRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    };

    // 1. Draw Network Cables (Edges)
    edges.forEach((edge) => {
      const p1 = positions[edge.sourceId] || { x: 100, y: 100 };
      const p2 = positions[edge.targetId] || { x: 100, y: 100 };

      const x1 = p1.x + 110 + offsetX;
      const y1 = p1.y + 55 + offsetY;
      const x2 = p2.x + 110 + offsetX;
      const y2 = p2.y + 55 + offsetY;

      const cfg = CABLE_CONFIGS[edge.type] || { stroke: '#38bdf8', strokeDash: 'none' };
      const strokeColor = cfg.stroke || '#38bdf8';

      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      if (cfg.strokeDash && cfg.strokeDash !== 'none') {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }

      // Smooth Bezier curve connecting nodes
      const midY = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2);
      ctx.stroke();

      // Directional arrow head
      const angle = Math.atan2(y2 - midY, x2 - x1);
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Cable Label Pill
      const labelX = (x1 + x2) / 2;
      const labelY = (y1 + y2) / 2;
      const labelText = `${edge.type} • ${edge.speed || '1 Gbps'}`;
      ctx.font = 'bold 8.5px monospace';
      const textMetrics = ctx.measureText(labelText);
      const pillW = textMetrics.width + 12;
      const pillH = 15;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      roundRect(ctx, labelX - pillW / 2, labelY - pillH / 2, pillW, pillH, 4);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelX, labelY);
      ctx.restore();
    });

    // 2. Draw Device Nodes
    devices.forEach((dev) => {
      const pos = positions[dev.id] || { x: dev.canvasX || 100, y: dev.canvasY || 100 };
      const nodeX = pos.x + offsetX;
      const nodeY = pos.y + offsetY;
      const nodeW = 220;
      const nodeH = 105;

      const isOnline = dev.status === 'Online' || dev.status === 'In Service';
      const isFailover = dev.status === 'Degraded' || dev.status === 'Failover';
      const statusColor = isOnline ? '#10b981' : isFailover ? '#f59e0b' : '#f43f5e';

      ctx.save();
      // Node background
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, nodeX, nodeY, nodeW, nodeH, 10);
      ctx.fill();

      // Node border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      roundRect(ctx, nodeX, nodeY, nodeW, nodeH, 10);
      ctx.stroke();

      // Header Bar
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, nodeX, nodeY, nodeW, 26, 10);
      ctx.fill();
      ctx.fillRect(nodeX, nodeY + 16, nodeW, 10);

      // Status indicator dot
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(nodeX + 12, nodeY + 13, 4, 0, Math.PI * 2);
      ctx.fill();

      // Device Type Text
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(dev.deviceType.toUpperCase(), nodeX + 22, nodeY + 13);

      // Status text right-aligned
      ctx.fillStyle = statusColor;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(dev.status.toUpperCase(), nodeX + nodeW - 8, nodeY + 13);

      // Device Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      const truncatedName = dev.deviceName.length > 24 ? dev.deviceName.slice(0, 22) + '...' : dev.deviceName;
      ctx.fillText(truncatedName, nodeX + 10, nodeY + 42);

      // IP Address
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(dev.ipAddress || 'DHCP Dynamic', nodeX + 10, nodeY + 58);

      // Location
      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      const locText = dev.location ? `Loc: ${dev.location.slice(0, 24)}` : 'Department: IT';
      ctx.fillText(locText, nodeX + 10, nodeY + 74);

      // Ports / MAC
      ctx.fillStyle = '#475569';
      ctx.font = '8.5px monospace';
      const portInfo = dev.portsCount ? `${dev.activePorts || 0}/${dev.portsCount} Ports` : (dev.macAddress || '');
      ctx.fillText(portInfo, nodeX + 10, nodeY + 89);

      ctx.restore();
    });

    // 3. Executive Header Bar
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, totalW, headerHeight);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(totalW, headerHeight);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOSPITAL IT OPERATIONS & NETWORK TOPOLOGY DIAGRAM', 24, 24);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    const dateStr = new Date().toLocaleString();
    const subText = `Generated: ${dateStr} | Hardware Nodes: ${devices.length} | Physical Links: ${edges.length} | Exported by: ${currentUser?.fullName || 'Super Administrator'}`;
    ctx.fillText(subText, 24, 46);

    // HITOMS Infrastructure Badge
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, totalW - 200, 16, 176, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HITOMS INFRASTRUCTURE', totalW - 112, 32);

    // 4. Executive Footer Bar
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, totalH - footerHeight, totalW, footerHeight);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, totalH - footerHeight);
    ctx.lineTo(totalW, totalH - footerHeight);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CONFIDENTIAL & PROPRIETARY — Hospital Infrastructure & Telemetry Management System (HITOMS) Offline-First Architecture', 24, totalH - footerHeight / 2);

    ctx.textAlign = 'right';
    ctx.fillText(`Verified by ${currentUser?.role || 'SUPER_ADMIN'} • Page 1 of 1`, totalW - 24, totalH - footerHeight / 2);

    ctx.restore();

    return canvas;
  }, [devices, positions, edges, currentUser]);

  // Export Topology as PDF Document (Super Admin / IT Unit)
  const handleExportPDF = async () => {
    setIsExporting('pdf');
    showToast('Generating Network Topology High-Resolution PDF...');
    try {
      const canvas = generateTopologyCanvas();
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 6;
      const availableW = pdfWidth - margin * 2;
      const availableH = pdfHeight - margin * 2;
      const canvasRatio = canvas.width / canvas.height;
      let renderW = availableW;
      let renderH = availableW / canvasRatio;

      if (renderH > availableH) {
        renderH = availableH;
        renderW = availableH * canvasRatio;
      }

      const xOffset = margin + (availableW - renderW) / 2;
      const yOffset = margin + (availableH - renderH) / 2;

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderW, renderH);

      const fileName = `hospital-network-topology-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
      showToast('Topology successfully downloaded as PDF document');
    } catch (err: any) {
      console.error('Failed to export topology PDF:', err);
      showToast('Failed to export PDF: ' + (err?.message || 'Error generating document'));
    } finally {
      setIsExporting(null);
    }
  };

  // Export Topology as High-Resolution JPEG Image (Super Admin / IT Unit)
  const handleExportJPEG = async () => {
    setIsExporting('jpeg');
    showToast('Generating Network Topology JPEG image...');
    try {
      const canvas = generateTopologyCanvas();
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', imgData);
      downloadAnchor.setAttribute(
        'download',
        `hospital-network-topology-${new Date().toISOString().slice(0, 10)}.jpeg`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Topology successfully downloaded as JPEG image');
    } catch (err: any) {
      console.error('Failed to export topology JPEG:', err);
      showToast('Failed to export JPEG: ' + (err?.message || 'Error generating image'));
    } finally {
      setIsExporting(null);
    }
  };

  // Interactive Cable Connection Workflow
  const handleStartConnect = (e: React.MouseEvent, sourceId: string) => {
    e.stopPropagation();
    setIsConnecting(true);
    setConnectingSourceId(sourceId);
    showToast(`Click any target device node to attach cable from ${deviceMap.get(sourceId)?.deviceName}`);
  };

  const handleTargetConnect = async (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (!isConnecting || !connectingSourceId || !currentUser) return;
    if (connectingSourceId === targetId) {
      showToast('Cannot connect device to itself');
      setIsConnecting(false);
      setConnectingSourceId(null);
      return;
    }

    try {
      const source = deviceMap.get(connectingSourceId);
      const cableType = source?.connectionType || 'Ethernet Cat6';
      await networkService.connectNodes(
        connectingSourceId,
        targetId,
        currentUser,
        cableType,
        CABLE_CONFIGS[cableType].speedDefault
      );
      showToast(
        `Connected cable: ${deviceMap.get(connectingSourceId)?.deviceName} ➔ ${deviceMap.get(targetId)?.deviceName}`
      );
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to link nodes');
    } finally {
      setIsConnecting(false);
      setConnectingSourceId(null);
    }
  };

  const cancelConnect = () => {
    setIsConnecting(false);
    setConnectingSourceId(null);
  };

  const handleDisconnectCable = async (sourceId: string, targetId: string) => {
    if (!currentUser) return;
    try {
      await networkService.disconnectNodes(sourceId, targetId, currentUser);
      setSelectedCable(null);
      showToast(`Disconnected cable between nodes`);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect');
    }
  };

  const handleChangeCableType = async (
    targetDevId: string,
    newType: NetworkConnectionType
  ) => {
    if (!currentUser) return;
    try {
      await networkService.updateDevice(
        targetDevId,
        {
          connectionType: newType,
          portSpeed: CABLE_CONFIGS[newType].speedDefault,
        },
        currentUser
      );
      if (selectedCable) {
        setSelectedCable({ ...selectedCable, type: newType, speed: CABLE_CONFIGS[newType].speedDefault });
      }
      showToast(`Cable medium updated to ${newType}`);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update cable');
    }
  };

  // Compute smooth curved cubic bezier path for rubberband connection
  const getLiveRubberbandPath = (sourcePos: Point, mouse: Point) => {
    const anchors = getNodeAnchors(sourcePos);
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

  const getDeviceIcon = (type: NetworkDevice['deviceType'], className = 'w-5 h-5') => {
    switch (type) {
      case 'Starlink Terminal':
        return <Radio className={className} />;
      case 'Router':
        return <Network className={className} />;
      case 'Core Switch':
      case 'Distribution Switch':
      case 'Switch':
        return <Layers className={className} />;
      case 'Server':
        return <Server className={className} />;
      case 'Access Point':
        return <Wifi className={className} />;
      case 'Firewall':
        return <Shield className={className} />;
      case 'Workstation':
        return <Monitor className={className} />;
      case 'Laptop':
        return <Laptop className={className} />;
      case 'Printer':
        return <Printer className={className} />;
      default:
        return <Cpu className={className} />;
    }
  };

  // Marquee Selection Box Calculations
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
      {/* Canvas Action Bar */}
      <div className="flex flex-wrap items-center justify-between p-3.5 bg-slate-900/90 border-b border-slate-800 gap-3 z-30">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tool Mode Selector: Pointer / Move & Pan, Hand Pan, Wire Cable, Marquee Selection */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTool('pointer')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'pointer'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Pointer Mode: Move nodes, or drag background to pan view"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Pointer & Move</span>
            </button>
            <button
              onClick={() => setActiveTool('pan')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'pan'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hand Tool: Click & drag anywhere to pan the canvas (Hold Spacebar as shortcut)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan Canvas</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('wire');
                if (!isConnecting && selectedDeviceIds.size === 1) {
                  const firstId = Array.from(selectedDeviceIds)[0];
                  setConnectingSourceId(firstId);
                  setIsConnecting(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'wire' || isConnecting
                  ? 'bg-amber-600 text-white shadow-xs animate-pulse'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Wire Tool: Click any part of Device A, then click any part of Device B to connect"
            >
              <Cable className="w-3.5 h-3.5" />
              <span>Wire Tool</span>
            </button>
            <button
              onClick={() => setActiveTool('marquee')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTool === 'marquee'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Box Marquee Selection Tool"
            >
              <BoxSelect className="w-3.5 h-3.5" />
              <span>Marquee Tool</span>
            </button>
          </div>

          {selectedDeviceIds.size > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-950/90 border border-sky-600 text-sky-300 rounded-xl text-xs font-bold animate-fade-in">
              <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>{selectedDeviceIds.size} selected</span>
              <button
                onClick={handleClearSelection}
                className="ml-1 p-0.5 hover:bg-sky-900 rounded text-sky-300 hover:text-white"
                title="Deselect All"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {isConnecting && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/80 border border-amber-600 rounded-xl text-amber-300 text-xs font-bold animate-pulse">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Wiring: Click any port or any device node to attach cable</span>
              <button
                onClick={cancelConnect}
                className="ml-1 p-0.5 hover:bg-amber-900 rounded text-amber-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Layout & Alignment Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-Selection Bulk Alignment Controls */}
          {selectedDeviceIds.size > 1 && (
            <div className="flex items-center bg-sky-950/80 border border-sky-700/80 p-0.5 rounded-xl gap-1 animate-fade-in">
              <button
                onClick={handleAlignSelectedHorizontally}
                className="px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-900 rounded-lg transition"
                title="Align all selected nodes along horizontal Y axis"
              >
                Align Row
              </button>
              <button
                onClick={handleAlignSelectedVertically}
                className="px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-900 rounded-lg transition"
                title="Align all selected nodes along vertical X axis"
              >
                Align Column
              </button>
              {selectedDeviceIds.size > 2 && (
                <button
                  onClick={handleDistributeSelectedHorizontally}
                  className="px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-900 rounded-lg transition"
                  title="Distribute selected nodes evenly along X axis"
                >
                  Distribute
                </button>
              )}
            </div>
          )}

          {/* Save Topology & Export Controls */}
          {canManage && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleManualSaveTopology}
                disabled={isSavingTopology}
                title="Save current layout positions and topology configuration to database"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 ${
                  hasUnsavedChanges
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                    : lastSavedAt
                    ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-800'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isSavingTopology ? (
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                ) : hasUnsavedChanges ? (
                  <Save className="w-3.5 h-3.5 animate-bounce" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>
                  {isSavingTopology
                    ? 'Saving...'
                    : hasUnsavedChanges
                    ? 'Save Topology (Unsaved)'
                    : lastSavedAt
                    ? `Topology Saved • ${lastSavedAt}`
                    : 'Save Topology'}
                </span>
              </button>

              <button
                onClick={handleExportPDF}
                disabled={isExporting !== null}
                title="Download Network Topology as High-Resolution PDF Document"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 text-rose-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {isExporting === 'pdf' ? (
                  <Activity className="w-3.5 h-3.5 animate-spin text-rose-300" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>{isExporting === 'pdf' ? 'Generating PDF...' : 'Download PDF'}</span>
              </button>

              <button
                onClick={handleExportJPEG}
                disabled={isExporting !== null}
                title="Download Network Topology as High-Resolution JPEG Image"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-700/80 text-amber-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {isExporting === 'jpeg' ? (
                  <Activity className="w-3.5 h-3.5 animate-spin text-amber-300" />
                ) : (
                  <Image className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{isExporting === 'jpeg' ? 'Generating JPEG...' : 'Download JPEG'}</span>
              </button>

              <button
                onClick={handleExportTopologyJson}
                title="Export Topology Snapshot (JSON)"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden md:inline">Export JSON</span>
              </button>
            </div>
          )}

          {/* Tier Architecture Guide Button */}
          <button
            onClick={() => setShowTierGuide(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 hover:text-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
            title="View Tier Guide (Where Computers, Laptops, Switches & Routers Belong)"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tier Guide</span>
          </button>

          {/* Center Viewport Button */}
          <button
            onClick={centerCanvasView}
            title="Center viewport on devices"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Center View</span>
          </button>

          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              title="Arrange according to Predecessor-Successor Hierarchy"
              onClick={applyHierarchicalLayout}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Hierarchical Tree</span>
            </button>
            <button
              title="Arrange in Radial Star Hub"
              onClick={applyStarLayout}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Star Hub</span>
            </button>
            <button
              title="Arrange in Grid Matrix"
              onClick={applyGridLayout}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          {/* Grid Snap Toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              snapToGrid
                ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={snapToGrid ? 'Snap-to-Grid: Active (20px)' : 'Snap-to-Grid: Disabled'}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">Snap {snapToGrid ? 'ON' : 'OFF'}</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800/90 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] font-mono text-slate-300 font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 1 && (
              <button
                onClick={() => setZoomLevel(1)}
                className="px-1.5 text-[10px] text-sky-400 hover:underline cursor-pointer"
              >
                100%
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tier 5 Architecture & Real-Time Hint Banner */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs z-20 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-600/70 text-emerald-300 font-bold text-[11px]">
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tier 5 Endpoints</span>
          </span>
          <span className="text-slate-300 text-xs">
            Computers, Laptops & Printers connect into <strong>Tier 4 Access Switches</strong> or <strong>Wi-Fi APs</strong>.
          </span>
          <button
            onClick={() => setShowTierGuide(true)}
            className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold text-[11px] cursor-pointer ml-1"
          >
            Tier Reference Guide →
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-xs">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-amber-300 font-bold px-2 py-0.5 bg-amber-950/80 border border-amber-700 rounded-lg animate-pulse text-[11px]">
              <Save className="w-3 h-3 text-amber-400" />
              <span>Unsaved layout changes</span>
            </span>
          )}
          {lastSavedAt && !hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/60 border border-emerald-800 rounded-lg text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Saved at {lastSavedAt}</span>
            </span>
          )}
        </div>
      </div>

      {/* Interactive Cable Legend Bar & Selection Hints */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-[11px] z-20 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Cable className="w-3.5 h-3.5 text-slate-400" />
            <span>Cable Links:</span>
          </span>

          {Object.entries(CABLE_CONFIGS).map(([typeKey, cfg]) => (
            <div key={typeKey} className="flex items-center gap-1.5">
              <span
                className="w-3 h-1 rounded-full shadow-xs"
                style={{ backgroundColor: cfg.stroke, boxShadow: `0 0 6px ${cfg.glow}` }}
              />
              <span className="text-slate-300 font-medium">{cfg.label}</span>
            </div>
          ))}
        </div>

        <div className="text-slate-400 text-[11px] flex items-center gap-3">
          <span>
            💡 <strong>Drag canvas</strong> to pan in all directions (left, right, top, bottom) • <strong>Click any part of device</strong> to wire
          </span>
          {selectedDeviceIds.size < devices.length && (
            <button
              onClick={handleSelectAll}
              className="text-sky-400 hover:text-sky-300 hover:underline font-semibold cursor-pointer"
            >
              Select All
            </button>
          )}
        </div>
      </div>

      {/* Main Draggable Viewport Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        data-canvas-bg="true"
        className={`relative w-full h-[760px] overflow-auto bg-slate-950 ${
          isPanning
            ? 'cursor-grabbing'
            : activeTool === 'pan' || isSpacePressed
            ? 'cursor-grab'
            : activeTool === 'marquee' || isMarqueeDragging
            ? 'cursor-crosshair'
            : activeTool === 'wire'
            ? 'cursor-crosshair'
            : 'cursor-grab'
        }`}
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)`,
          backgroundSize: `${20 * zoomLevel}px ${20 * zoomLevel}px`,
        }}
      >
        {/* Scaled Workspace Container */}
        <div
          data-canvas-bg="true"
          className="relative origin-top-left"
          style={{
            width: '3200px',
            height: '2400px',
            transform: `scale(${zoomLevel})`,
          }}
        >
          {/* SVG LAYER FOR CABLES, LINES, ARROWS, AND SIGNALS */}
          <svg
            data-canvas-bg="true"
            className="absolute inset-0 pointer-events-none w-full h-full z-10"
            style={{ width: '3200px', height: '2400px' }}
          >
            <defs>
              {/* Dynamic Arrow Markers */}
              {Object.entries(CABLE_CONFIGS).map(([key, cfg]) => (
                <marker
                  key={`arrow-${key}`}
                  id={`arrow-${key.replace(/[^a-zA-Z0-9]/g, '')}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill={cfg.stroke} />
                </marker>
              ))}

              {/* Glowing Filters */}
              <filter id="cable-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Render Static/Live Connected Cables */}
            {edges.map((edge) => {
              const cfg = CABLE_CONFIGS[edge.type] || CABLE_CONFIGS['Ethernet Cat6'];
              const pathD = edge.path;
              const markerId = `arrow-${edge.type.replace(/[^a-zA-Z0-9]/g, '')}`;
              const isSelected =
                selectedCable?.sourceId === edge.sourceId &&
                selectedCable?.targetId === edge.targetId;

              // Midpoint for badge / label
              const midX = (edge.sourcePos.x + edge.targetPos.x) / 2;
              const midY = (edge.sourcePos.y + edge.targetPos.y) / 2;

              return (
                <g key={edge.id} className="pointer-events-auto">
                  {/* Thick Invisible Hit Area for easier clicking/hovering */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="22"
                    className="cursor-pointer"
                    onClick={() =>
                      setSelectedCable({
                        sourceId: edge.sourceId,
                        targetId: edge.targetId,
                        type: edge.type,
                        speed: edge.speed,
                      })
                    }
                  />

                  {/* Outer Glowing Stroke */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={cfg.stroke}
                    strokeWidth={isSelected ? 5 : 3.5}
                    strokeOpacity={isSelected ? 0.9 : 0.65}
                    strokeDasharray={cfg.dash}
                    markerEnd={`url(#${markerId})`}
                    filter="url(#cable-glow)"
                    className="transition-all duration-300"
                  />

                  {/* Core High-Intensity Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1.2}
                    strokeOpacity={0.8}
                    strokeDasharray="4 16"
                    className="animate-[dash_1.5s_linear_infinite]"
                  />

                  {/* Flowing Traffic Pulse Animated Particle */}
                  <circle r="3.5" fill="#ffffff">
                    <animateMotion
                      dur="2.8s"
                      repeatCount="indefinite"
                      path={pathD}
                    />
                  </circle>

                  {/* Midpoint Interactive Cable Badge */}
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
                      x="-45"
                      y="-11"
                      width="90"
                      height="22"
                      rx="6"
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
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {edge.speed || cfg.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* LIVE RUBBERBAND CABLE (During Wire Connection Mode) */}
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
                        strokeWidth="3.5"
                        strokeDasharray="5 3"
                        className="animate-pulse"
                      />
                      <circle
                        cx={mousePos.x}
                        cy={mousePos.y}
                        r="6"
                        fill="#38bdf8"
                        className="animate-ping opacity-75"
                      />
                    </>
                  );
                })()}
              </g>
            )}
          </svg>

          {/* LIVE MARQUEE SELECTION RECTANGLE */}
          {marqueeBox && (
            <div
              className="absolute pointer-events-none z-40 border-2 border-dashed border-sky-400 bg-sky-500/15 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-none"
              style={{
                left: `${marqueeBox.x}px`,
                top: `${marqueeBox.y}px`,
                width: `${marqueeBox.width}px`,
                height: `${marqueeBox.height}px`,
              }}
            />
          )}

          {/* RENDER HARDWARE DEVICE NODES */}
          {devices.map((device) => {
            const pos = positions[device.id] || { x: 100, y: 100 };
            const isSelected = selectedDeviceIds.has(device.id);
            const isDraggingThis = isDraggingGroup && isSelected;
            const isSourceForWiring = connectingSourceId === device.id;
            const pred = device.predecessorId ? deviceMap.get(device.predecessorId) : null;
            const tierInfo = getDeviceTierInfo(device.deviceType);

            return (
              <div
                key={device.id}
                data-node-id="true"
                onMouseDown={(e) => handleNodeMouseDown(e, device.id)}
                onClick={(e) => {
                  if (isDragMovedRef.current) {
                    // Suppress click event if user was dragging/moving the node
                    return;
                  }
                  if (isConnecting) {
                    // ANY part of device can be clicked to complete connection
                    handleTargetConnect(e, device.id);
                  } else if (activeTool === 'wire' || e.altKey) {
                    // In Wire Tool mode or with Alt-click, ANY part of device starts connection
                    handleStartConnect(e, device.id);
                  } else {
                    // Select node on canvas without opening modal dialog
                    if (e.shiftKey || e.metaKey || e.ctrlKey) {
                      const next = new Set(selectedDeviceIds);
                      if (next.has(device.id)) next.delete(device.id);
                      else next.add(device.id);
                      setSelectedDeviceIds(next);
                    } else {
                      setSelectedDeviceIds(new Set([device.id]));
                    }
                  }
                }}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: `${NODE_WIDTH}px`,
                  minHeight: `${NODE_HEIGHT}px`,
                }}
                className={`absolute z-20 rounded-2xl p-3.5 transition-all border ${
                  isConnecting
                    ? isSourceForWiring
                      ? 'shadow-2xl ring-4 ring-amber-500/60 bg-slate-900 border-amber-400 animate-pulse'
                      : 'bg-slate-900/95 border-emerald-500/60 ring-2 ring-emerald-500/40 hover:ring-4 hover:ring-emerald-400 hover:border-emerald-300 hover:bg-slate-850 cursor-pointer scale-[1.01]'
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

                {/* Selection Checkbox Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 p-0.5 rounded bg-sky-500 text-slate-950 shadow-md z-20">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}

                {/* --- 4 MULTI-DIRECTIONAL PORT ANCHOR PINS (Top, Bottom, Left, Right) --- */}
                {/* 1. Top Port Pin */}
                <div
                  title="Top Port: Click to connect or snap cable"
                  onClick={(e) => {
                    if (isConnecting) handleTargetConnect(e, device.id);
                    else handleStartConnect(e, device.id);
                  }}
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-600 hover:border-emerald-400 hover:bg-emerald-950 flex items-center justify-center cursor-pointer transition shadow-md group z-30"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                </div>

                {/* 2. Bottom Port Pin */}
                <div
                  title="Bottom Port: Click to connect or snap cable"
                  onClick={(e) => {
                    if (isConnecting) handleTargetConnect(e, device.id);
                    else handleStartConnect(e, device.id);
                  }}
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-600 hover:border-emerald-400 hover:bg-emerald-950 flex items-center justify-center cursor-pointer transition shadow-md group z-30"
                >
                  <Plus className="w-3 h-3 text-slate-400 group-hover:text-emerald-300 transition" />
                </div>

                {/* 3. Left Port Pin */}
                <div
                  title="Left Port: Click to connect or snap cable"
                  onClick={(e) => {
                    if (isConnecting) handleTargetConnect(e, device.id);
                    else handleStartConnect(e, device.id);
                  }}
                  className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-600 hover:border-emerald-400 hover:bg-emerald-950 flex items-center justify-center cursor-pointer transition shadow-md group z-30"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                </div>

                {/* 4. Right Port Pin */}
                <div
                  title="Right Port: Click to connect or snap cable"
                  onClick={(e) => {
                    if (isConnecting) handleTargetConnect(e, device.id);
                    else handleStartConnect(e, device.id);
                  }}
                  className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-600 hover:border-emerald-400 hover:bg-emerald-950 flex items-center justify-center cursor-pointer transition shadow-md group z-30"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                </div>

                {/* Node Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 pr-4">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        device.deviceType === 'Starlink Terminal'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : device.deviceType === 'Router'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                          : ['Core Switch', 'Distribution Switch', 'Switch'].includes(device.deviceType)
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {getDeviceIcon(device.deviceType, 'w-4 h-4')}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate" title={device.deviceName}>
                        {device.deviceName}
                      </h4>
                      <div className="text-[10px] font-mono text-sky-400 font-semibold truncate">
                        {device.ipAddress}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${tierInfo.bg}`}>
                          {tierInfo.badge}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {!isSelected && (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        device.status === 'Online'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : device.status === 'Warning'
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                      title={`Status: ${device.status}`}
                    />
                  )}
                </div>

                {/* Node Metadata Badges */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span className="truncate max-w-[130px]" title={device.location}>
                    {device.location}
                  </span>
                  <span className="font-mono text-slate-500 text-[9px]">
                    {device.portsCount ? `${device.activePorts || 0}/${device.portsCount}p` : 'Port 1'}
                  </span>
                </div>

                {/* Action Hover Toolbar (Clone, Edit, Delete, Connect) */}
                {canManage && (
                  <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-xs">
                    <button
                      title="Clone / Duplicate this device"
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
                        title="Wire / Connect Cable to another node"
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
                        title="Inspect Device Details"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDevice(device);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 cursor-pointer"
                      >
                        <Info className="w-3 h-3" />
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

      {/* CABLE INSPECTION & MANAGEMENT DRAWER / MODAL */}
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
              <>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Switch Medium:</span>
                  <select
                    value={selectedCable.type}
                    onChange={(e) =>
                      handleChangeCableType(
                        selectedCable.targetId,
                        e.target.value as NetworkConnectionType
                      )
                    }
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                  >
                    {Object.keys(CABLE_CONFIGS).map((typeKey) => (
                      <option key={typeKey} value={typeKey}>
                        {typeKey}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() =>
                    handleDisconnectCable(selectedCable.sourceId, selectedCable.targetId)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Unlink2 className="w-3.5 h-3.5" />
                  <span>Sever Cable (Disconnect)</span>
                </button>
              </>
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

      {/* Network Tier Architecture Guide Modal */}
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
                    Hierarchical structure explaining node classification and tier placement.
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

            {/* Answer to User Query Highlight Box */}
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/80 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                <Monitor className="w-4 h-4 text-emerald-400" />
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>Where are Computers & Laptops positioned?</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Computers, Desktops, Laptops, Nurse Stations, Point-of-Care Handhelds, and Network Printers belong in <strong className="text-emerald-300">Tier 5 (Endpoint & User Station Layer)</strong>. They connect as <strong className="text-white">successor nodes</strong> to <strong className="text-sky-300">Tier 4 Access Switches</strong> (via Ethernet Cat6) or <strong className="text-purple-300">Wireless Access Points</strong> (via 5GHz/6GHz Wi-Fi).
              </p>
            </div>

            {/* 5-Tier Breakdown */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Hospital Network 5-Tier Breakdown
              </h4>

              {/* Tier 1 */}
              <div className="p-3 rounded-xl border border-amber-900/60 bg-amber-950/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span>Tier 1: Perimeter & WAN Gateway Layer</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-900/40 rounded">Top / Ingress</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>Hardware:</strong> Starlink Satellite Terminals, ISP Fiber Gateways, Perimeter Firewalls, Core Routers.
                </p>
                <p className="text-[10px] text-slate-400">
                  Provides internet breakout and WAN routing for the hospital campus.
                </p>
              </div>

              {/* Tier 2 */}
              <div className="p-3 rounded-xl border border-indigo-900/60 bg-indigo-950/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-indigo-400" />
                    <span>Tier 2: Core Network & Data Center Layer</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-900/40 rounded">High-Speed Core</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>Hardware:</strong> Core 10G/40G Switches, LHIMS Hospital Servers, PACS Medical Imaging Servers, File & Backup Servers.
                </p>
                <p className="text-[10px] text-slate-400">
                  High-speed switching backbone with redundant fiber links and mission-critical hospital databases.
                </p>
              </div>

              {/* Tier 3 */}
              <div className="p-3 rounded-xl border border-sky-900/60 bg-sky-950/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-sky-300">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span>Tier 3: Distribution / Aggregation Layer</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-sky-900/40 rounded">Building Backbones</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>Hardware:</strong> Distribution Switches (Admin Block, Maternity Ward, Surgical Center, Outpatient Block).
                </p>
                <p className="text-[10px] text-slate-400">
                  Aggregates traffic from floor switches before trunking to the Core Switch via fiber or 10G SFP+.
                </p>
              </div>

              {/* Tier 4 */}
              <div className="p-3 rounded-xl border border-purple-900/60 bg-purple-950/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-purple-400" />
                    <span>Tier 4: Access & PoE Layer</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-900/40 rounded">Department Ports</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>Hardware:</strong> Managed Access Switches (24/48 port PoE), Wireless Access Points (AP - OPD, AP - Emergency, AP - Wards).
                </p>
                <p className="text-[10px] text-slate-400">
                  Provides physical Ethernet wall jacks and Wi-Fi coverage for end devices.
                </p>
              </div>

              {/* Tier 5 */}
              <div className="p-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-emerald-400" />
                    <span>Tier 5: Endpoints & User Stations (Computers & Laptops)</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-900/40 rounded">User Edge</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  <strong>Hardware:</strong> Desktop PCs, Laptops, Nurses Station Terminals, Doctor Workstations, Clinical Diagnostic Monitors, Printers.
                </p>
                <p className="text-[10px] text-slate-400">
                  Direct end-user devices where hospital staff log into LHIMS, EHR, email, and diagnostic systems.
                </p>
              </div>
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

