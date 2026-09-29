import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Power,
  Terminal,
  Settings,
  Cpu,
  Monitor,
  Globe,
  HardDrive,
  Check,
  RotateCcw,
  Zap,
  Layers,
  Network,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Save,
  Send,
  HelpCircle,
} from 'lucide-react';
import { type NetworkDevice, type NetworkDeviceType } from '../../types';
import { CiscoDeviceIcon } from './CiscoTopologyIcons';
import { HOSPITAL_VLANS } from '../NetworkView';

interface CiscoDeviceModalProps {
  device: NetworkDevice;
  allDevices: NetworkDevice[];
  onClose: () => void;
  onUpdateDevice: (updated: NetworkDevice) => void;
}

type TabType = 'PHYSICAL' | 'CONFIG' | 'CLI' | 'DESKTOP';

export const CiscoDeviceModal: React.FC<CiscoDeviceModalProps> = ({
  device,
  allDevices,
  onClose,
  onUpdateDevice,
}) => {
  const isEndDevice = ['Workstation', 'Laptop', 'Server', 'Printer'].includes(device.deviceType);
  const [activeTab, setActiveTab] = useState<TabType>(isEndDevice ? 'DESKTOP' : 'CLI');
  const [isPowerOn, setIsPowerOn] = useState<boolean>(device.status !== 'Offline');

  // Physical Tab State
  const [physicalZoom, setPhysicalZoom] = useState<number>(1);

  // Config Tab State
  const [configSubSection, setConfigSubSection] = useState<'GLOBAL' | 'VLANS' | 'INTERFACES'>('GLOBAL');
  const [editName, setEditName] = useState(device.deviceName);
  const [editIp, setEditIp] = useState(device.ipAddress);
  const [selectedInterface, setSelectedInterface] = useState<string>('FastEthernet0/1');
  const [interfaceStatus, setInterfaceStatus] = useState<Record<string, { on: boolean; vlan: string; ip: string }>>({
    'FastEthernet0/1': { on: true, vlan: '10', ip: device.ipAddress },
    'FastEthernet0/2': { on: true, vlan: '20', ip: '192.168.20.1' },
    'FastEthernet0/3': { on: true, vlan: '30', ip: '192.168.30.1' },
    'GigabitEthernet0/1': { on: true, vlan: 'Trunk (All)', ip: '192.168.1.1' },
    'GigabitEthernet0/2': { on: true, vlan: 'Trunk (All)', ip: '192.168.1.2' },
  });

  // Desktop App State (for Endpoints)
  const [desktopApp, setDesktopApp] = useState<'NONE' | 'IP_CONFIG' | 'CMD' | 'BROWSER'>('NONE');
  const [browserUrl, setBrowserUrl] = useState('http://192.168.10.10');
  const [browserLoaded, setBrowserLoaded] = useState(false);

  // CLI State
  const [cliHistory, setCliHistory] = useState<string[]>([
    `Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4, RELEASE SOFTWARE (fc1)`,
    `Technical Support: http://www.cisco.com/techsupport`,
    `Copyright (c) 1986-2026 by Cisco Systems, Inc.`,
    `Compiled Mon 09-Feb-26 14:20 by hitoms-eng`,
    ``,
    `Press RETURN to get started!`,
    ``,
    `${device.deviceName}>`,
  ]);
  const [cliInput, setCliInput] = useState('');
  const [cliMode, setCliMode] = useState<'USER' | 'PRIVILEGED' | 'CONFIG' | 'INTERFACE'>('USER');
  const cliScrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll CLI to bottom
  useEffect(() => {
    if (cliScrollRef.current) {
      cliScrollRef.current.scrollTop = cliScrollRef.current.scrollHeight;
    }
  }, [cliHistory]);

  // Handle Cisco IOS Commands
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) {
      // Empty enter
      const prompt =
        cliMode === 'USER'
          ? `${editName}>`
          : cliMode === 'PRIVILEGED'
          ? `${editName}#`
          : cliMode === 'CONFIG'
          ? `${editName}(config)#`
          : `${editName}(config-if)#`;
      setCliHistory((prev) => [...prev, prompt]);
      setCliInput('');
      return;
    }

    const currentPrompt =
      cliMode === 'USER'
        ? `${editName}>`
        : cliMode === 'PRIVILEGED'
        ? `${editName}#`
        : cliMode === 'CONFIG'
        ? `${editName}(config)#`
        : `${editName}(config-if)#`;

    const lower = cmd.toLowerCase();
    const responses: string[] = [`${currentPrompt} ${cmd}`];

    if (!isPowerOn) {
      responses.push(`% Device is currently powered OFF. Flip power switch in Physical tab to boot IOS.`);
    } else if (lower === 'enable' || lower === 'en') {
      setCliMode('PRIVILEGED');
      responses.push(``);
    } else if (lower === 'disable') {
      setCliMode('USER');
    } else if (lower === 'configure terminal' || lower === 'conf t') {
      if (cliMode === 'USER') {
        responses.push(`% Privilege level too low. Type 'enable' first.`);
      } else {
        setCliMode('CONFIG');
        responses.push(`Enter configuration commands, one per line. End with CNTL/Z.`);
      }
    } else if (lower.startsWith('hostname ')) {
      const newName = cmd.split(' ')[1];
      if (newName) {
        setEditName(newName);
        responses.push(`% Hostname changed to ${newName}`);
      }
    } else if (lower.startsWith('interface ') || lower.startsWith('int ')) {
      if (cliMode === 'CONFIG') {
        setCliMode('INTERFACE');
        responses.push(``);
      } else {
        responses.push(`% Configure terminal required.`);
      }
    } else if (lower === 'exit') {
      if (cliMode === 'INTERFACE') setCliMode('CONFIG');
      else if (cliMode === 'CONFIG') setCliMode('PRIVILEGED');
      else if (cliMode === 'PRIVILEGED') setCliMode('USER');
    } else if (lower === 'show ip interface brief' || lower === 'sh ip int br') {
      responses.push(
        `Interface              IP-Address      OK? Method Status                Protocol`,
        `FastEthernet0/1        ${device.ipAddress}    YES manual up                    up`,
        `FastEthernet0/2        unassigned      YES unset  up                    up`,
        `FastEthernet0/3        unassigned      YES unset  up                    up`,
        `GigabitEthernet0/1     10.0.0.1        YES manual up                    up`,
        `Vlan1                  192.168.1.254   YES NVRAM  up                    up`,
        `Vlan10 (Clinical)      192.168.10.1    YES NVRAM  up                    up`,
        `Vlan99 (Management)    192.168.99.1    YES NVRAM  up                    up`
      );
    } else if (lower === 'show vlan brief' || lower === 'sh vlan br') {
      responses.push(
        `VLAN Name                             Status    Ports`,
        `---- -------------------------------- --------- -------------------------------`,
        `1    default                          active    Fa0/4, Fa0/5, Fa0/6`,
        `10   Clinical_LHIMS_EMR               active    Fa0/1, Gi0/1 (Trunk)`,
        `20   Admin_Billing_NHIS               active    Fa0/2, Gi0/1 (Trunk)`,
        `30   Staff_WiFi_Mobile                active    Fa0/3, Gi0/1 (Trunk)`,
        `50   CCTV_Medical_IoT                 active    Fa0/7, Gi0/1 (Trunk)`,
        `99   IT_Management                    active    Fa0/24, Gi0/2 (Trunk)`
      );
    } else if (lower === 'show run' || lower === 'show running-config' || lower === 'sh run') {
      responses.push(
        `Building configuration...`,
        `Current configuration : 1842 bytes`,
        `!`,
        `version 15.0`,
        `no service timestamps log datetime msec`,
        `no service password-encryption`,
        `!`,
        `hostname ${editName}`,
        `!`,
        `vlan 10`,
        ` name Clinical_LHIMS_EMR`,
        `vlan 20`,
        ` name Admin_Billing_NHIS`,
        `vlan 30`,
        ` name Staff_WiFi_Mobile`,
        `vlan 99`,
        ` name IT_Management`,
        `!`,
        `interface GigabitEthernet0/1`,
        ` switchport mode trunk`,
        ` switchport trunk allowed vlan 10,20,30,50,99`,
        `!`,
        `interface FastEthernet0/1`,
        ` switchport mode access`,
        ` switchport access vlan 10`,
        `!`,
        `ip default-gateway 192.168.1.1`,
        `end`
      );
    } else if (lower.startsWith('ping ')) {
      const target = cmd.split(' ')[1] || '192.168.1.1';
      responses.push(
        `Type escape sequence to abort.`,
        `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`,
        `!!!!!`,
        `Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`
      );
    } else if (lower === 'show version' || lower === 'sh ver') {
      responses.push(
        `Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4`,
        `ROM: Bootstrap program is C2960 boot loader`,
        `System uptime is 42 days, 16 hours, 24 minutes`,
        `System image file is "flash:c2960-lanbasek9-mz.150-2.SE4.bin"`,
        `Cisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory.`,
        `24 FastEthernet interfaces`,
        `2 Gigabit Ethernet interfaces`,
        `Model number: WS-C2960-24TT-L`
      );
    } else if (lower === '?' || lower === 'help') {
      responses.push(
        `Exec commands:`,
        `  enable             Turn on privileged commands`,
        `  disable            Turn off privileged commands`,
        `  configure terminal Enter configuration mode`,
        `  ping <ip>          Send ICMP echo request`,
        `  show ip int brief  Display IP interface status`,
        `  show vlan brief    Display VLAN information`,
        `  show run           Display current operating configuration`,
        `  show version       Display system hardware and software status`,
        `  exit               Exit from current CLI mode`
      );
    } else {
      responses.push(`% Unknown command or bad parameter: "${cmd}". Type '?' for help.`);
    }

    setCliHistory((prev) => [...prev, ...responses]);
    setCliInput('');
  };

  const handleSaveConfig = () => {
    onUpdateDevice({
      ...device,
      deviceName: editName,
      ipAddress: editIp,
      status: isPowerOn ? 'Online' : 'Offline',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Packet Tracer Window Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded bg-slate-800 border border-slate-700">
              <CiscoDeviceIcon type={device.deviceType} size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{device.deviceName}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-950/80 border border-sky-700 text-sky-300">
                  {device.model || device.deviceType}
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isPowerOn ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'
                  }`}
                  title={isPowerOn ? 'Power: ON' : 'Power: OFF'}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {device.ipAddress} • MAC: {device.macAddress || '00:1C:58:AA:BC:01'} • Loc: {device.location}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveConfig}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
              title="Apply Changes"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cisco Packet Tracer Window Navigation Tabs */}
        <div className="flex items-center px-4 bg-slate-950 border-b border-slate-800 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('PHYSICAL')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
              activeTab === 'PHYSICAL'
                ? 'border-sky-500 text-sky-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Physical</span>
          </button>

          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
              activeTab === 'CONFIG'
                ? 'border-sky-500 text-sky-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Config</span>
          </button>

          {!isEndDevice ? (
            <button
              onClick={() => setActiveTab('CLI')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
                activeTab === 'CLI'
                  ? 'border-sky-500 text-sky-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>CLI (Cisco IOS)</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('DESKTOP')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
                activeTab === 'DESKTOP'
                  ? 'border-sky-500 text-sky-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
          )}
        </div>

        {/* Tab Content Panes */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-900/90 min-h-[420px] flex flex-col">
          {/* TAB 1: PHYSICAL (Hardware rack faceplate view with Power switch) */}
          {activeTab === 'PHYSICAL' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPowerOn(!isPowerOn)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-md ${
                      isPowerOn
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400'
                        : 'bg-rose-950 border border-rose-700 text-rose-300'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    <span>Power Switch: {isPowerOn ? 'ON (I)' : 'OFF (O)'}</span>
                  </button>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Status LED:</span>
                    <span
                      className={`w-3 h-3 rounded-full ${
                        isPowerOn ? 'bg-emerald-400 shadow-[0_0_10px_#22c55e]' : 'bg-rose-600'
                      }`}
                    />
                    <span className="font-mono text-slate-300">{isPowerOn ? 'SYST: OK' : 'POWER OFF'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPhysicalZoom((z) => Math.max(0.8, z - 0.1))}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono text-slate-400">{Math.round(physicalZoom * 100)}%</span>
                  <button
                    onClick={() => setPhysicalZoom((z) => Math.min(1.4, z + 0.1))}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Realistic Packet Tracer Hardware Chassis View */}
              <div
                className="bg-slate-950 border-2 border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center transition-all overflow-x-auto shadow-inner"
                style={{ transform: `scale(${physicalZoom})`, transformOrigin: 'top center' }}
              >
                <div className="w-full max-w-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-2 border-slate-600 rounded-lg p-3 shadow-2xl relative">
                  {/* Chassis Screws */}
                  <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-slate-500 border border-slate-950" />
                  <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-slate-500 border border-slate-950" />
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-500 border border-slate-950" />
                  <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-slate-500 border border-slate-950" />

                  {/* Header / Brand label */}
                  <div className="flex items-center justify-between border-b border-slate-600 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-sky-400 font-mono tracking-wider">CISCO SYSTEMS</span>
                      <span className="text-[10px] text-slate-300 font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {device.model || 'Catalyst 2960 Series 24-Port 10/100 + 2 T/SFP'}
                      </span>
                    </div>

                    {/* Physical I/O Rocker Switch */}
                    <div
                      onClick={() => setIsPowerOn(!isPowerOn)}
                      className={`w-12 h-6 rounded flex items-center px-1 border-2 cursor-pointer transition ${
                        isPowerOn
                          ? 'bg-slate-900 border-emerald-500 justify-end'
                          : 'bg-slate-900 border-rose-600 justify-start'
                      }`}
                      title="Toggle Power Switch"
                    >
                      <div
                        className={`w-4 h-4 rounded ${
                          isPowerOn ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Port Matrix Faceplate (24 FastEthernet Ports + 2 SFP Uplinks) */}
                  <div className="bg-slate-900 border border-slate-700 rounded p-2.5 flex items-center justify-between gap-4">
                    {/* Console Port */}
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-mono text-cyan-400 font-bold">CONSOLE</span>
                      <div className="w-6 h-5 rounded bg-cyan-950 border border-cyan-600 flex items-center justify-center">
                        <div className="w-3 h-2 bg-slate-950 rounded-xs" />
                      </div>
                    </div>

                    {/* 24 FastEthernet RJ-45 Ports (Upper & Lower Row of 12) */}
                    <div className="flex-1 flex flex-col gap-1">
                      {/* Upper row 1 to 23 (odd) */}
                      <div className="flex items-center justify-between gap-1">
                        {Array.from({ length: 12 }).map((_, i) => {
                          const portNum = i * 2 + 1;
                          const isLinkActive = isPowerOn && i < 4;
                          return (
                            <div key={`port-top-${i}`} className="flex flex-col items-center">
                              <span
                                className={`w-1.5 h-1.5 rounded-full mb-0.5 ${
                                  isLinkActive ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]' : 'bg-slate-700'
                                }`}
                              />
                              <div className="w-5 h-4 bg-slate-950 border border-slate-700 rounded-xs flex items-center justify-center">
                                <div className="w-2.5 h-1.5 bg-slate-800 rounded-xs" />
                              </div>
                              <span className="text-[7px] font-mono text-slate-500">{portNum}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Lower row 2 to 24 (even) */}
                      <div className="flex items-center justify-between gap-1">
                        {Array.from({ length: 12 }).map((_, i) => {
                          const portNum = (i + 1) * 2;
                          const isLinkActive = isPowerOn && i < 3;
                          return (
                            <div key={`port-btm-${i}`} className="flex flex-col items-center">
                              <div className="w-5 h-4 bg-slate-950 border border-slate-700 rounded-xs flex items-center justify-center">
                                <div className="w-2.5 h-1.5 bg-slate-800 rounded-xs" />
                              </div>
                              <span
                                className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                                  isLinkActive ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]' : 'bg-slate-700'
                                }`}
                              />
                              <span className="text-[7px] font-mono text-slate-500">{portNum}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2 SFP/Gigabit Uplink Ports */}
                    <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-mono text-amber-400 font-bold">G0/1 (SFP)</span>
                        <div className="w-6 h-9 rounded bg-slate-950 border border-amber-500 flex flex-col items-center justify-center">
                          <span
                            className={`w-2 h-2 rounded-full mb-1 ${
                              isPowerOn ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-700'
                            }`}
                          />
                          <div className="w-3.5 h-4 bg-amber-950 border border-amber-600 rounded-xs" />
                        </div>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-mono text-amber-400 font-bold">G0/2 (SFP)</span>
                        <div className="w-6 h-9 rounded bg-slate-950 border border-amber-500 flex flex-col items-center justify-center">
                          <span
                            className={`w-2 h-2 rounded-full mb-1 ${
                              isPowerOn ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-700'
                            }`}
                          />
                          <div className="w-3.5 h-4 bg-amber-950 border border-amber-600 rounded-xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-4 text-center">
                  Cisco Packet Tracer Physical Hardware Rack View • Power state toggles live IOS execution.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIG (Global Settings, VLAN Database, Interfaces) */}
          {activeTab === 'CONFIG' && (
            <div className="flex-1 flex flex-col md:flex-row gap-4">
              {/* Left Config Navigation Menu */}
              <div className="w-full md:w-56 bg-slate-950 border border-slate-800 rounded-xl p-2 shrink-0 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Global Configuration
                </div>
                <button
                  onClick={() => setConfigSubSection('GLOBAL')}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                    configSubSection === 'GLOBAL'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Settings / Hostname</span>
                </button>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 pt-3">
                  Routing & Switching
                </div>
                <button
                  onClick={() => setConfigSubSection('VLANS')}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                    configSubSection === 'VLANS'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>VLAN Database (802.1Q)</span>
                </button>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 pt-3">
                  Interfaces (Ports)
                </div>
                <button
                  onClick={() => setConfigSubSection('INTERFACES')}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                    configSubSection === 'INTERFACES'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Network className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Port Configurations</span>
                </button>
              </div>

              {/* Right Configuration Inspector */}
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4">
                {configSubSection === 'GLOBAL' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                      Global Device Parameters
                    </h3>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Display Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Hostname (IOS)</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Primary IP Address</label>
                      <input
                        type="text"
                        value={editIp}
                        onChange={(e) => setEditIp(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Default Gateway</label>
                      <input
                        type="text"
                        defaultValue="192.168.1.1"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">DNS Server</label>
                      <input
                        type="text"
                        defaultValue="1.1.1.1"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}

                {configSubSection === 'VLANS' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                      802.1Q Virtual Local Area Networks (VLAN Database)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Standard hospital subnets configured on Catalyst switches:
                    </p>

                    <div className="space-y-2">
                      {HOSPITAL_VLANS.map((vlan) => (
                        <div
                          key={vlan.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                              VLAN {vlan.id}
                            </span>
                            <span className="font-semibold text-slate-200">{vlan.name}</span>
                          </div>
                          <span className="font-mono text-slate-400 text-[11px]">{vlan.subnet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {configSubSection === 'INTERFACES' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-bold text-white">Interface Configuration</h3>
                      <select
                        value={selectedInterface}
                        onChange={(e) => setSelectedInterface(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1 focus:outline-hidden"
                      >
                        <option value="FastEthernet0/1">FastEthernet0/1</option>
                        <option value="FastEthernet0/2">FastEthernet0/2</option>
                        <option value="FastEthernet0/3">FastEthernet0/3</option>
                        <option value="GigabitEthernet0/1">GigabitEthernet0/1 (SFP Trunk)</option>
                        <option value="GigabitEthernet0/2">GigabitEthernet0/2 (SFP Trunk)</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div>
                          <div className="text-xs font-bold text-white">Port Status</div>
                          <div className="text-[11px] text-slate-400">Administratively enable or disable port</div>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={true}
                          className="w-4 h-4 accent-sky-500 rounded"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Bandwidth</label>
                        <input
                          type="text"
                          defaultValue={selectedInterface.startsWith('Gi') ? '1000 Mbps' : '100 Mbps'}
                          disabled
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Duplex Mode</label>
                        <select className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5">
                          <option>Full-Duplex</option>
                          <option>Half-Duplex</option>
                          <option>Auto</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">VLAN Membership</label>
                        <select className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5">
                          <option>VLAN 10 (Clinical LHIMS & EMR)</option>
                          <option>VLAN 20 (Admin & Billing)</option>
                          <option>VLAN 30 (Staff Wi-Fi)</option>
                          <option>VLAN 50 (CCTV & Medical IoT)</option>
                          <option>VLAN 99 (IT Infrastructure Mgmt)</option>
                          <option>Trunk (All VLANs 1-4094)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLI (Cisco IOS Terminal) */}
          {activeTab === 'CLI' && (
            <div className="flex-1 flex flex-col bg-black border border-slate-800 rounded-xl p-3 font-mono text-xs shadow-inner">
              {/* Terminal Content Screen */}
              <div
                ref={cliScrollRef}
                className="flex-1 overflow-y-auto space-y-0.5 text-emerald-400 select-text pr-1"
                style={{ maxHeight: '380px', minHeight: '280px' }}
              >
                {cliHistory.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>

              {/* Command Input Prompt Form */}
              <form onSubmit={handleCliSubmit} className="flex items-center gap-1.5 pt-2 border-t border-slate-800 mt-2">
                <span className="text-emerald-300 font-bold shrink-0">
                  {cliMode === 'USER'
                    ? `${editName}>`
                    : cliMode === 'PRIVILEGED'
                    ? `${editName}#`
                    : cliMode === 'CONFIG'
                    ? `${editName}(config)#`
                    : `${editName}(config-if)#`}
                </span>
                <input
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder="Type Cisco command (e.g. enable, show ip int br, show vlan br, ping 192.168.1.1, ?)"
                  className="flex-1 bg-transparent text-white focus:outline-hidden font-mono text-xs placeholder:text-slate-600"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>

              {/* Quick Command Suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 mt-1 border-t border-slate-900 text-[10px]">
                <span className="text-slate-500 font-sans">Quick Commands:</span>
                {[
                  'enable',
                  'show ip interface brief',
                  'show vlan brief',
                  'show run',
                  'ping 192.168.1.1',
                  'show version',
                  'conf t',
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCliInput(c);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-600 cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DESKTOP (For PC, Laptop, Server Endpoints) */}
          {activeTab === 'DESKTOP' && (
            <div className="flex-1 flex flex-col">
              {desktopApp === 'NONE' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
                  {/* 1. IP Configuration */}
                  <button
                    onClick={() => setDesktopApp('IP_CONFIG')}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-sky-500 hover:bg-slate-850 transition cursor-pointer group shadow-lg"
                  >
                    <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition">
                      <Settings className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold text-white mt-2">IP Configuration</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">Static / DHCP</span>
                  </button>

                  {/* 2. Command Prompt */}
                  <button
                    onClick={() => setDesktopApp('CMD')}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500 hover:bg-slate-850 transition cursor-pointer group shadow-lg"
                  >
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition">
                      <Terminal className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold text-white mt-2">Command Prompt</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">ping, ipconfig, tracert</span>
                  </button>

                  {/* 3. Web Browser */}
                  <button
                    onClick={() => setDesktopApp('BROWSER')}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500 hover:bg-slate-850 transition cursor-pointer group shadow-lg"
                  >
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition">
                      <Globe className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold text-white mt-2">Web Browser</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">Hospital LHIMS Portal</span>
                  </button>

                  {/* 4. Terminal (Serial) */}
                  <button
                    onClick={() => setActiveTab('CLI')}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500 hover:bg-slate-850 transition cursor-pointer group shadow-lg"
                  >
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition">
                      <Cpu className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold text-white mt-2">Console Terminal</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">Serial Console Link</span>
                  </button>
                </div>
              ) : desktopApp === 'IP_CONFIG' ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-sky-400" />
                      <span>IP Configuration</span>
                    </h4>
                    <button
                      onClick={() => setDesktopApp('NONE')}
                      className="text-xs text-sky-400 hover:underline cursor-pointer"
                    >
                      ← Back to Desktop
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="ipmode" defaultChecked />
                      <span>Static</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="ipmode" />
                      <span>DHCP</span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">IPv4 Address</label>
                      <input
                        type="text"
                        value={editIp}
                        onChange={(e) => setEditIp(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">Subnet Mask</label>
                      <input
                        type="text"
                        defaultValue="255.255.255.0"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">Default Gateway</label>
                      <input
                        type="text"
                        defaultValue="192.168.1.1"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">DNS Server</label>
                      <input
                        type="text"
                        defaultValue="1.1.1.1"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : desktopApp === 'CMD' ? (
                <div className="flex-1 flex flex-col bg-black border border-slate-800 rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <span className="text-slate-300 font-bold">Command Prompt — Microsoft Windows [Version 10.0.19045]</span>
                    <button
                      onClick={() => setDesktopApp('NONE')}
                      className="text-xs text-sky-400 hover:underline cursor-pointer"
                    >
                      ← Back
                    </button>
                  </div>
                  <div className="flex-1 space-y-1 text-slate-200">
                    <div>C:\Users\HITOMS_Staff&gt; ipconfig</div>
                    <div className="text-slate-400 pl-4">
                      Ethernet adapter Local Area Connection:<br />
                      &nbsp;&nbsp;IPv4 Address. . . . . . . . . . . : {editIp}<br />
                      &nbsp;&nbsp;Subnet Mask . . . . . . . . . . . : 255.255.255.0<br />
                      &nbsp;&nbsp;Default Gateway . . . . . . . . . : 192.168.1.1
                    </div>
                    <div className="pt-2">C:\Users\HITOMS_Staff&gt; ping 192.168.1.1</div>
                    <div className="text-emerald-400 pl-4">
                      Pinging 192.168.1.1 with 32 bytes of data:<br />
                      Reply from 192.168.1.1: bytes=32 time=1ms TTL=64<br />
                      Reply from 192.168.1.1: bytes=32 time=1ms TTL=64<br />
                      Reply from 192.168.1.1: bytes=32 time=2ms TTL=64<br />
                      Reply from 192.168.1.1: bytes=32 time=1ms TTL=64<br />
                      Ping statistics: Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)
                    </div>
                  </div>
                </div>
              ) : (
                /* Web Browser app */
                <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-800">
                    <button
                      onClick={() => setDesktopApp('NONE')}
                      className="text-xs text-sky-400 hover:underline cursor-pointer px-2"
                    >
                      ← Back
                    </button>
                    <span className="text-xs text-slate-400">URL:</span>
                    <input
                      type="text"
                      value={browserUrl}
                      onChange={(e) => setBrowserUrl(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:border-sky-500 focus:outline-hidden"
                    />
                    <button
                      onClick={() => setBrowserLoaded(true)}
                      className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition cursor-pointer"
                    >
                      Go
                    </button>
                  </div>

                  <div className="flex-1 p-6 bg-slate-900 flex flex-col items-center justify-center text-center">
                    <div className="max-w-md p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center mx-auto">
                        <Globe className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-bold text-white">Hospital LHIMS Clinical Web Portal</h4>
                      <p className="text-xs text-slate-400">
                        Connected to Local Edge Server via <strong>{editIp}</strong>
                      </p>
                      <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-mono">
                        HTTP/1.1 200 OK • Latency: 1.2ms • Edge Cache: HIT
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
