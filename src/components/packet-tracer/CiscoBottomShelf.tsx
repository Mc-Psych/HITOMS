import React, { useState } from 'react';
import {
  Cable,
  Zap,
  Radio,
  Network,
  Layers,
  Server,
  Monitor,
  Laptop,
  Printer,
  Shield,
  Wifi,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  CiscoRouterIcon,
  CiscoSwitchIcon,
  CiscoMultilayerSwitchIcon,
  CiscoFirewallIcon,
  CiscoAPIndoorIcon,
  CiscoAPOutdoorIcon,
  CiscoServerIcon,
  CiscoPCIcon,
  CiscoLaptopIcon,
  CiscoPrinterIcon,
  CiscoSatelliteIcon,
} from './CiscoTopologyIcons';
import { type NetworkDeviceType, type NetworkConnectionType } from '../../types';

export type MainCategory = 'NETWORK_DEVICES' | 'END_DEVICES' | 'CONNECTIONS';
export type SubCategory = 'ROUTERS' | 'SWITCHES' | 'WIRELESS' | 'SECURITY' | 'WAN' | 'COMPUTERS';

export interface DeviceTemplate {
  name: string;
  model: string;
  type: NetworkDeviceType;
  icon: React.ReactNode;
  defaultPorts?: number;
  vlanEnabled?: boolean;
}

export interface CableTemplate {
  name: string;
  type: NetworkConnectionType;
  color: string;
  dash?: string;
  description: string;
}

interface CiscoBottomShelfProps {
  onSelectDeviceTemplate: (template: DeviceTemplate) => void;
  onSelectCableType: (cableType: NetworkConnectionType) => void;
  selectedDeviceTemplate: DeviceTemplate | null;
  selectedCableType: NetworkConnectionType | null;
  activeTool: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const CABLE_TEMPLATES: CableTemplate[] = [
  {
    name: 'Automatically Choose Connection Type',
    type: 'Ethernet Cat6',
    color: '#34d399',
    description: 'Auto-negotiates optimal cable medium',
  },
  {
    name: 'Copper Straight-Through (Cat6)',
    type: 'Ethernet Cat6',
    color: '#10b981',
    description: 'Connects dissimilar devices (e.g. PC to Switch, Switch to Router)',
  },
  {
    name: 'Copper Cross-Over (Cat6)',
    type: 'Ethernet Cat6',
    color: '#059669',
    dash: '4 4',
    description: 'Connects similar devices (e.g. Switch to Switch, Router to Router)',
  },
  {
    name: 'Fiber OM3/OM4 (1G/10G)',
    type: 'Fiber',
    color: '#ea580c',
    description: 'High-speed optical fiber backbone links',
  },
  {
    name: '10G SFP+ Trunk',
    type: 'SFP+ 10G',
    color: '#818cf8',
    description: '10 Gigabit Ethernet optical/DAC trunk for core distribution',
  },
  {
    name: 'Wireless 5GHz / 6GHz',
    type: 'Wireless 5GHz/6GHz',
    color: '#c084fc',
    dash: '6 4',
    description: 'Wi-Fi 6 wireless transmission medium',
  },
  {
    name: 'Satellite RF Microwave',
    type: 'Satellite RF',
    color: '#fbbf24',
    dash: '8 4',
    description: 'Starlink Low-Earth Orbit microwave RF carrier',
  },
];

export const CiscoBottomShelf: React.FC<CiscoBottomShelfProps> = ({
  onSelectDeviceTemplate,
  onSelectCableType,
  selectedDeviceTemplate,
  selectedCableType,
  activeTool,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [mainCat, setMainCat] = useState<MainCategory>('NETWORK_DEVICES');
  const [subCat, setSubCat] = useState<SubCategory>('SWITCHES');

  // Sub-device list based on chosen category
  const deviceList = React.useMemo<DeviceTemplate[]>(() => {
    if (mainCat === 'NETWORK_DEVICES') {
      switch (subCat) {
        case 'ROUTERS':
          return [
            {
              name: 'Router 2911',
              model: 'Cisco 2911/K9 ISR',
              type: 'Router',
              icon: <CiscoRouterIcon size={34} />,
              defaultPorts: 3,
            },
            {
              name: 'Router 4321',
              model: 'Cisco 4321 ISR 4000',
              type: 'Router',
              icon: <CiscoRouterIcon size={34} />,
              defaultPorts: 4,
            },
            {
              name: 'Router-PT',
              model: 'Generic Packet Tracer Router',
              type: 'Router',
              icon: <CiscoRouterIcon size={34} />,
              defaultPorts: 4,
            },
          ];
        case 'SWITCHES':
          return [
            {
              name: '2960-24TT',
              model: 'Catalyst 2960-24TT-L',
              type: 'Switch',
              icon: <CiscoSwitchIcon size={36} />,
              defaultPorts: 26,
            },
            {
              name: 'Managed Switch (VLANs)',
              model: 'Catalyst 2960-X Managed',
              type: 'Managed Switch',
              icon: <CiscoSwitchIcon size={36} />,
              defaultPorts: 28,
              vlanEnabled: true,
            },
            {
              name: '3560-24PS (L3)',
              model: 'Catalyst 3560-24PS PoE Multilayer',
              type: 'Core Switch',
              icon: <CiscoMultilayerSwitchIcon size={36} />,
              defaultPorts: 24,
              vlanEnabled: true,
            },
            {
              name: 'Distribution Switch',
              model: 'Catalyst 3650 Distribution',
              type: 'Distribution Switch',
              icon: <CiscoMultilayerSwitchIcon size={36} />,
              defaultPorts: 24,
              vlanEnabled: true,
            },
            {
              name: 'Access Switch',
              model: 'Catalyst 1000 Access Switch',
              type: 'Access Switch',
              icon: <CiscoSwitchIcon size={36} />,
              defaultPorts: 24,
            },
          ];
        case 'WIRELESS':
          return [
            {
              name: 'Indoor AP (LAP)',
              model: 'Cisco Aironet 3702i',
              type: 'Access Point (Indoor)',
              icon: <CiscoAPIndoorIcon size={36} />,
              defaultPorts: 1,
            },
            {
              name: 'Outdoor AP (IP67)',
              model: 'Cisco Catalyst 1562E Rugged',
              type: 'Access Point (Outdoor)',
              icon: <CiscoAPOutdoorIcon size={36} />,
              defaultPorts: 2,
            },
            {
              name: 'Access Point',
              model: 'Cisco Business 240AC',
              type: 'Access Point',
              icon: <CiscoAPIndoorIcon size={36} />,
              defaultPorts: 1,
            },
          ];
        case 'SECURITY':
          return [
            {
              name: 'ASA 5506-X',
              model: 'Cisco ASA 5506-X with FirePOWER',
              type: 'Firewall',
              icon: <CiscoFirewallIcon size={34} />,
              defaultPorts: 8,
            },
          ];
        case 'WAN':
          return [
            {
              name: 'Starlink Terminal',
              model: 'SpaceX Starlink Standard V4 / High Performance',
              type: 'Starlink Terminal',
              icon: <CiscoSatelliteIcon size={34} />,
              defaultPorts: 1,
            },
          ];
        default:
          return [];
      }
    } else if (mainCat === 'END_DEVICES') {
      return [
        {
          name: 'PC-PT',
          model: 'Standard Desktop Workstation',
          type: 'Workstation',
          icon: <CiscoPCIcon size={34} />,
          defaultPorts: 1,
        },
        {
          name: 'Laptop-PT',
          model: 'Enterprise Laptop Computer',
          type: 'Laptop',
          icon: <CiscoLaptopIcon size={34} />,
          defaultPorts: 1,
        },
        {
          name: 'Server-PT',
          model: 'Cisco UCS C220 M5 Rack Server',
          type: 'Server',
          icon: <CiscoServerIcon size={34} />,
          defaultPorts: 4,
        },
        {
          name: 'Printer-PT',
          model: 'Network Laser Multifunction Printer',
          type: 'Printer',
          icon: <CiscoPrinterIcon size={34} />,
          defaultPorts: 1,
        },
      ];
    }
    return [];
  }, [mainCat, subCat]);

  return (
    <div className="bg-slate-900 border-t border-slate-700 select-none shadow-2xl relative z-30 transition-all">
      {/* Shelf Header Bar with Collapse Toggle & Active Instruction */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              title={isCollapsed ? 'Expand Packet Tracer Device Shelf' : 'Collapse Shelf'}
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-bold text-slate-200 text-[11px] tracking-wide uppercase font-mono">
              Packet Tracer Device Palette
            </span>
          </div>

          {selectedDeviceTemplate && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-950 border border-sky-600 text-sky-300 text-[10px] animate-pulse">
              <span>Ready to place: <strong>{selectedDeviceTemplate.name}</strong></span>
              <span className="text-slate-400">· Click on canvas to drop device</span>
            </div>
          )}

          {activeTool === 'wire' && selectedCableType && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] animate-pulse">
              <span>Cable tool: <strong>{selectedCableType}</strong></span>
              <span className="text-slate-400">· Click source device, then target device</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>Click device model below to stamp onto topology</span>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col md:flex-row items-stretch divide-y md:divide-y-0 md:divide-x divide-slate-800 p-1.5 bg-slate-900/95">
          {/* Section 1: Main Category Icons (Left Column) */}
          <div className="flex md:flex-col items-center justify-center gap-1 p-1 bg-slate-950/80 rounded-lg shrink-0">
            {/* 1. Network Devices */}
            <button
              onClick={() => {
                setMainCat('NETWORK_DEVICES');
                if (subCat === 'COMPUTERS') setSubCat('SWITCHES');
              }}
              className={`flex items-center md:flex-col gap-1 p-1.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                mainCat === 'NETWORK_DEVICES'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Network Devices (Routers, Switches, Wireless, Security, WAN)"
            >
              <Network className="w-4 h-4 text-sky-300" />
              <span className="text-[9px]">Devices</span>
            </button>

            {/* 2. End Devices */}
            <button
              onClick={() => {
                setMainCat('END_DEVICES');
              }}
              className={`flex items-center md:flex-col gap-1 p-1.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                mainCat === 'END_DEVICES'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="End Devices (PC, Laptop, Server, Printer)"
            >
              <Monitor className="w-4 h-4 text-emerald-300" />
              <span className="text-[9px]">Endpoints</span>
            </button>

            {/* 3. Connections */}
            <button
              onClick={() => {
                setMainCat('CONNECTIONS');
              }}
              className={`flex items-center md:flex-col gap-1 p-1.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                mainCat === 'CONNECTIONS'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Connections & Cables (Straight-Through, Cross-Over, Fiber, Serial)"
            >
              <Cable className="w-4 h-4 text-amber-300" />
              <span className="text-[9px]">Cables</span>
            </button>
          </div>

          {/* Section 2: Sub-Categories (when Network Devices is chosen) */}
          {mainCat === 'NETWORK_DEVICES' && (
            <div className="flex md:flex-col items-center justify-center gap-1 p-1 bg-slate-950/40 rounded-lg shrink-0">
              <button
                onClick={() => setSubCat('ROUTERS')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer w-full text-left ${
                  subCat === 'ROUTERS'
                    ? 'bg-slate-800 text-sky-300 border border-sky-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Network className="w-3 h-3 text-sky-400" />
                <span>Routers</span>
              </button>

              <button
                onClick={() => setSubCat('SWITCHES')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer w-full text-left ${
                  subCat === 'SWITCHES'
                    ? 'bg-slate-800 text-sky-300 border border-sky-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3 text-indigo-400" />
                <span>Switches</span>
              </button>

              <button
                onClick={() => setSubCat('WIRELESS')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer w-full text-left ${
                  subCat === 'WIRELESS'
                    ? 'bg-slate-800 text-sky-300 border border-sky-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wifi className="w-3 h-3 text-purple-400" />
                <span>Wireless AP</span>
              </button>

              <button
                onClick={() => setSubCat('SECURITY')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer w-full text-left ${
                  subCat === 'SECURITY'
                    ? 'bg-slate-800 text-sky-300 border border-sky-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3 h-3 text-rose-400" />
                <span>Security</span>
              </button>

              <button
                onClick={() => setSubCat('WAN')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer w-full text-left ${
                  subCat === 'WAN'
                    ? 'bg-slate-800 text-sky-300 border border-sky-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3 h-3 text-amber-400" />
                <span>WAN / Starlink</span>
              </button>
            </div>
          )}

          {/* Section 3: Device Models / Cable Items (Scrollable Horizontal Row) */}
          <div className="flex-1 overflow-x-auto py-1 px-2 flex items-center gap-2">
            {mainCat !== 'CONNECTIONS' ? (
              deviceList.map((dev) => {
                const isSelected = selectedDeviceTemplate?.name === dev.name;
                return (
                  <button
                    key={dev.name}
                    onClick={() => onSelectDeviceTemplate(dev)}
                    className={`flex flex-col items-center justify-between p-2 rounded-xl transition cursor-pointer shrink-0 min-w-[76px] h-[78px] border ${
                      isSelected
                        ? 'bg-sky-950 border-sky-400 ring-2 ring-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-600 hover:bg-slate-800/80'
                    }`}
                    title={`${dev.name} (${dev.model}) - Click to place on canvas`}
                  >
                    <div className="flex items-center justify-center h-8">
                      {dev.icon}
                    </div>
                    <div className="text-center w-full">
                      <div className="text-[10px] font-bold text-slate-200 truncate w-full">
                        {dev.name}
                      </div>
                      <div className="text-[8px] font-mono text-slate-400 truncate w-full">
                        {dev.type}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              CABLE_TEMPLATES.map((cable) => {
                const isSelected = activeTool === 'wire' && selectedCableType === cable.type;
                return (
                  <button
                    key={cable.name}
                    onClick={() => onSelectCableType(cable.type)}
                    className={`flex flex-col items-center justify-between p-2 rounded-xl transition cursor-pointer shrink-0 min-w-[110px] h-[78px] border text-center ${
                      isSelected
                        ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-600 hover:bg-slate-800/80'
                    }`}
                    title={cable.description}
                  >
                    <div className="flex items-center justify-center h-6 w-full pt-1">
                      {/* Cable visual glyph */}
                      <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                        <line
                          x1="2"
                          y1="6"
                          x2="38"
                          y2="6"
                          stroke={cable.color}
                          strokeWidth="3"
                          strokeDasharray={cable.dash}
                          strokeLinecap="round"
                        />
                        <circle cx="4" cy="6" r="2.5" fill="#ffffff" />
                        <circle cx="36" cy="6" r="2.5" fill="#ffffff" />
                      </svg>
                    </div>

                    <div className="text-center w-full">
                      <div className="text-[9.5px] font-bold text-slate-200 leading-tight line-clamp-2">
                        {cable.name.replace('Automatically Choose Connection Type', 'Auto Connect')}
                      </div>
                      <div className="text-[8px] font-mono text-emerald-400 truncate mt-0.5">
                        {cable.type}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
