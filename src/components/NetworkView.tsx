import React, { useState, useMemo } from 'react';
import {
  Network,
  Plus,
  Wifi,
  Radio,
  Server,
  Shield,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  Terminal,
  Cpu,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Link2,
  Unlink2,
  GitBranch,
  Cable,
  Zap,
  Check,
  Search,
  Filter,
  Info,
  Copy,
  Move,
  Sparkles,
  Monitor,
  Laptop,
  Printer,
  Database,
  Download,
  Upload,
} from 'lucide-react';
import {
  type NetworkDevice,
  type NetworkIncident,
  type NetworkConnectionType,
  type User as UserType,
} from '../types';
import { networkService } from '../services/networkService';
import { NetworkCanvas } from './NetworkCanvas';
import { authService } from '../services/authService';
import { CiscoDeviceIcon } from './packet-tracer/CiscoTopologyIcons';

interface NetworkViewProps {
  devices: NetworkDevice[];
  currentUser: UserType | null;
  onRefresh: () => void;
}

const CONNECTION_TYPES: { label: string; value: NetworkConnectionType; color: string; bg: string }[] = [
  { label: 'Fiber OM3/OM4', value: 'Fiber', color: 'text-cyan-400', bg: 'bg-cyan-950/60 border-cyan-800' },
  { label: 'Ethernet Cat6', value: 'Ethernet Cat6', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-800' },
  { label: '10G SFP+ Trunk', value: 'SFP+ 10G', color: 'text-indigo-400', bg: 'bg-indigo-950/60 border-indigo-800' },
  { label: 'Wireless 5GHz/6GHz', value: 'Wireless 5GHz/6GHz', color: 'text-purple-400', bg: 'bg-purple-950/60 border-purple-800' },
  { label: 'Satellite RF Uplink', value: 'Satellite RF', color: 'text-amber-400', bg: 'bg-amber-950/60 border-amber-800' },
];

export const HOSPITAL_VLANS: { id: string; name: string; subnet: string; color: string; bg: string; badge: string }[] = [
  { id: '10', name: 'Clinical LHIMS & EMR', subnet: '192.168.10.0/24', color: 'text-sky-400', bg: 'bg-sky-950/60 border-sky-800', badge: 'VLAN 10: Clinical LHIMS' },
  { id: '20', name: 'Admin, Billing & NHIS', subnet: '192.168.20.0/24', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-800', badge: 'VLAN 20: Admin & NHIS' },
  { id: '30', name: 'Staff Wi-Fi & Mobile', subnet: '192.168.30.0/24', color: 'text-indigo-400', bg: 'bg-indigo-950/60 border-indigo-800', badge: 'VLAN 30: Staff Wi-Fi' },
  { id: '40', name: 'Patient & Public Guest', subnet: '192.168.40.0/24', color: 'text-amber-400', bg: 'bg-amber-950/60 border-amber-800', badge: 'VLAN 40: Public Guest' },
  { id: '50', name: 'CCTV & Medical IoT', subnet: '192.168.50.0/24', color: 'text-rose-400', bg: 'bg-rose-950/60 border-rose-800', badge: 'VLAN 50: CCTV & IoT' },
  { id: '99', name: 'IT Infrastructure Mgmt', subnet: '192.168.99.0/24', color: 'text-purple-400', bg: 'bg-purple-950/60 border-purple-800', badge: 'VLAN 99: Management' },
];

export const NetworkView: React.FC<NetworkViewProps> = ({
  devices,
  currentUser,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'TOPOLOGY' | 'DEVICES' | 'INCIDENTS'>('TOPOLOGY');
  const [topologySubView, setTopologySubView] = useState<'CANVAS' | 'MAP' | 'MATRIX' | 'CONNECT_TOOL' | 'IMPORT_EXPORT'>('CANVAS');

  // Import/Export States
  const [importPreview, setImportPreview] = useState<{ name: string; devices: NetworkDevice[] } | null>(null);
  const [importingStatus, setImportingStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);

  const handleExportTopology = () => {
    try {
      const dataStr = JSON.stringify(devices, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `HITOMS_Network_Topology_${new Date().toISOString().split('T')[0]}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      console.error('Failed to export topology:', err);
    }
  };

  const handleImportTopology = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      const targetFile = e.target.files[0];
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            setImportPreview({
              name: targetFile.name,
              devices: parsed as NetworkDevice[],
            });
            setImportStatusMsg(null);
            setImportingStatus('IDLE');
          } else {
            alert('Invalid backup format: root of JSON must be a device array.');
          }
        } catch (err) {
          alert('Failed to parse JSON file.');
        }
      };
      fileReader.readAsText(targetFile);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview || !currentUser) return;
    setImportingStatus('PENDING');
    try {
      await networkService.bulkImportTopology(importPreview.devices, currentUser);
      setImportingStatus('SUCCESS');
      setImportStatusMsg(`Success: Imported ${importPreview.devices.length} network devices and restored original interconnection wires.`);
      setTimeout(() => {
        setImportPreview(null);
        onRefresh();
      }, 3000);
    } catch (err: any) {
      setImportingStatus('IDLE');
      setImportStatusMsg(`Import failed: ${err?.message || 'Database error'}`);
    }
  };
  const [incidents, setIncidents] = useState<NetworkIncident[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Connect Tool states
  const [connectPredecessorId, setConnectPredecessorId] = useState('');
  const [connectSuccessorId, setConnectSuccessorId] = useState('');
  const [connectCableType, setConnectCableType] = useState<NetworkConnectionType>('Ethernet Cat6');
  const [connectSpeed, setConnectSpeed] = useState('1 Gbps');
  const [connectMessage, setConnectMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Add device modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<NetworkDevice['deviceType']>('Managed Switch');
  const [ipAddress, setIpAddress] = useState('192.168.1.');
  const [location, setLocation] = useState('Server Room Rack 1');
  const [macAddress, setMacAddress] = useState('');
  const [portsCount, setPortsCount] = useState(24);
  const [predecessorId, setPredecessorId] = useState<string>('');
  const [selectedPredecessors, setSelectedPredecessors] = useState<string[]>([]);
  const [selectedSuccessors, setSelectedSuccessors] = useState<string[]>([]);
  const [connectionType, setConnectionType] = useState<NetworkConnectionType>('Ethernet Cat6');
  const [portSpeed, setPortSpeed] = useState('1 Gbps');
  const [vlanEnabled, setVlanEnabled] = useState(true);
  const [selectedVlans, setSelectedVlans] = useState<string[]>(['10', '20', '30', '99']);
  const [apCoverageType, setApCoverageType] = useState<'Indoor' | 'Outdoor'>('Indoor');
  const [outdoorWeatherproofRating, setOutdoorWeatherproofRating] = useState('IP67 Weatherproof / Sun-Resistant');
  const [maxClients, setMaxClients] = useState(250);

  // Edit device modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<NetworkDevice['deviceType']>('Managed Switch');
  const [editIp, setEditIp] = useState('');
  const [editMac, setEditMac] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPorts, setEditPorts] = useState(24);
  const [editStatus, setEditStatus] = useState<'Online' | 'Offline' | 'Warning'>('Online');
  const [editFirmware, setEditFirmware] = useState('v4.2.1-LTS');
  const [editPredecessorId, setEditPredecessorId] = useState<string>('');
  const [editSelectedPredecessors, setEditSelectedPredecessors] = useState<string[]>([]);
  const [editSuccessors, setEditSuccessors] = useState<string[]>([]);
  const [editConnectionType, setEditConnectionType] = useState<NetworkConnectionType>('Ethernet Cat6');
  const [editPortSpeed, setEditPortSpeed] = useState('1 Gbps');
  const [editVlanEnabled, setEditVlanEnabled] = useState(true);
  const [editSelectedVlans, setEditSelectedVlans] = useState<string[]>(['10', '20', '30', '99']);
  const [editApCoverageType, setEditApCoverageType] = useState<'Indoor' | 'Outdoor'>('Indoor');
  const [editOutdoorWeatherproofRating, setEditOutdoorWeatherproofRating] = useState('IP67 Weatherproof');
  const [editMaxClients, setEditMaxClients] = useState(250);

  // Clone device modal state
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloningSource, setCloningSource] = useState<NetworkDevice | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneIp, setCloneIp] = useState('');
  const [cloneLocation, setCloneLocation] = useState('');
  const [clonePredecessorId, setClonePredecessorId] = useState('');
  const [cloneConnectionType, setCloneConnectionType] = useState<NetworkConnectionType>('Ethernet Cat6');

  // Delete device confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Ping test simulator state
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<{ id: string; ms: number; status: string } | null>(null);

  const isAuthorized = authService.canAccessNetwork(currentUser);
  const canManageNetwork = isAuthorized;
  const canPing = authService.canRunPingTest(currentUser);

  // Map of device by ID for instant O(1) lookups
  const deviceMap = useMemo(() => {
    const map = new Map<string, NetworkDevice>();
    devices.forEach((d) => map.set(d.id, d));
    return map;
  }, [devices]);

  React.useEffect(() => {
    const loadIncidents = async () => {
      const data = await networkService.getNetworkIncidents();
      setIncidents(data);
    };
    loadIncidents();
  }, [activeTab]);

  // Keep selectedDevice in sync when devices update
  React.useEffect(() => {
    if (selectedDevice) {
      const updated = devices.find((d) => d.id === selectedDevice.id);
      if (updated) setSelectedDevice(updated);
    }
  }, [devices]);

  const handlePing = async (device: NetworkDevice) => {
    setPingingId(device.id);
    setPingResult(null);
    await new Promise((r) => setTimeout(r, 600));
    const latency = Math.floor(Math.random() * 4) + 1;
    setPingResult({ id: device.id, ms: latency, status: 'Success (0% packet loss)' });
    setPingingId(null);
    if (currentUser) {
      await networkService.updateDeviceStatus(device.id, 'Online', currentUser);
      onRefresh();
    }
  };

  // Quick inline uplink & AP switch connection state in inspector
  const [inlineAddUplinkId, setInlineAddUplinkId] = useState<string>('');
  const [isAddingInlineUplink, setIsAddingInlineUplink] = useState(false);
  const [quickAPSwitchId, setQuickAPSwitchId] = useState<string>('');

  const handleAddInlineUplink = async (newParentId: string) => {
    if (!selectedDevice || !currentUser || !newParentId) return;
    try {
      const res = await networkService.connectNodes(
        newParentId,
        selectedDevice.id,
        currentUser,
        selectedDevice.connectionType || 'Ethernet Cat6',
        selectedDevice.portSpeed || '1 Gbps'
      );
      setSelectedDevice(res.successor);
      setInlineAddUplinkId('');
      setIsAddingInlineUplink(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectAPToSwitch = async (switchId: string) => {
    if (!selectedDevice || !currentUser || !switchId) return;
    try {
      if (selectedDevice.predecessorId && selectedDevice.predecessorId !== switchId) {
        await networkService.disconnectNodes(selectedDevice.predecessorId, selectedDevice.id, currentUser);
      }
      const res = await networkService.connectNodes(
        switchId,
        selectedDevice.id,
        currentUser,
        'Ethernet Cat6',
        'PoE+ Gigabit (Wi-Fi 6)'
      );
      setSelectedDevice(res.successor);
      setQuickAPSwitchId('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || !currentUser) return;

    try {
      const preds = selectedPredecessors.length > 0
        ? selectedPredecessors
        : predecessorId
        ? [predecessorId]
        : [];

      await networkService.addDevice(
        {
          deviceName: deviceName.trim(),
          deviceType,
          manufacturer: deviceType.includes('Access Point') ? 'Ubiquiti UniFi Pro' : 'Cisco Catalyst / Edge',
          model: deviceType.includes('Access Point') ? 'Hospital Enterprise AP' : 'Enterprise Managed Hardware Node',
          serialNumber: 'SN-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
          department: 'IT Infrastructure',
          ipAddress: ipAddress.trim(),
          macAddress: macAddress.trim() || '00:1B:44:11:3A:B7',
          location: location.trim() || 'Server Room Rack 1',
          portsCount,
          activePorts: Math.min(portsCount, 8),
          firmware: 'v4.2.1-LTS',
          installationDate: new Date().toISOString().split('T')[0],
          lastMaintenance: new Date().toISOString().split('T')[0],
          status: 'Online',
          predecessorId: preds[0] || undefined,
          predecessorIds: preds,
          successorIds: selectedSuccessors,
          connectionType,
          portSpeed,
          vlanEnabled: ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(deviceType) ? vlanEnabled : undefined,
          vlans: ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(deviceType) ? selectedVlans : undefined,
          apCoverageType: deviceType.includes('Access Point') ? apCoverageType : undefined,
          outdoorWeatherproofRating: deviceType === 'Access Point (Outdoor)' ? outdoorWeatherproofRating : undefined,
          maxClients: deviceType.includes('Access Point') ? maxClients : undefined,
        },
        currentUser
      );

      setAddModalOpen(false);
      resetAddForm();
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const resetAddForm = () => {
    setDeviceName('');
    setDeviceType('Managed Switch');
    setIpAddress('192.168.1.');
    setLocation('Server Room Rack 1');
    setMacAddress('');
    setPortsCount(24);
    setPredecessorId('');
    setSelectedPredecessors([]);
    setSelectedSuccessors([]);
    setConnectionType('Ethernet Cat6');
    setPortSpeed('1 Gbps');
    setVlanEnabled(true);
    setSelectedVlans(['10', '20', '30', '99']);
    setApCoverageType('Indoor');
    setOutdoorWeatherproofRating('IP67 Weatherproof / Sun-Resistant');
    setMaxClients(250);
  };

  const openEditModal = (device: NetworkDevice) => {
    setEditingDevice(device);
    setEditName(device.deviceName);
    setEditType(device.deviceType);
    setEditIp(device.ipAddress);
    setEditMac(device.macAddress || '');
    setEditLocation(device.location);
    setEditPorts(device.portsCount || 24);
    setEditStatus(device.status);
    setEditFirmware(device.firmware || 'v4.2.1-LTS');
    const preds = device.predecessorIds || (device.predecessorId ? [device.predecessorId] : []);
    setEditPredecessorId(device.predecessorId || device.uplinkDeviceId || '');
    setEditSelectedPredecessors(preds);
    setEditSuccessors(device.successorIds || []);
    setEditConnectionType(device.connectionType || 'Ethernet Cat6');
    setEditPortSpeed(device.portSpeed || '1 Gbps');
    setEditVlanEnabled(device.vlanEnabled ?? true);
    setEditSelectedVlans(device.vlans || ['10', '20', '30', '99']);
    setEditApCoverageType(device.apCoverageType || (device.deviceType === 'Access Point (Outdoor)' ? 'Outdoor' : 'Indoor'));
    setEditOutdoorWeatherproofRating(device.outdoorWeatherproofRating || 'IP67 Weatherproof');
    setEditMaxClients(device.maxClients || 250);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !currentUser) return;

    try {
      const preds = editSelectedPredecessors.length > 0
        ? editSelectedPredecessors
        : editPredecessorId
        ? [editPredecessorId]
        : [];

      const updated = await networkService.updateDevice(
        editingDevice.id,
        {
          deviceName: editName.trim(),
          deviceType: editType,
          ipAddress: editIp.trim(),
          macAddress: editMac.trim(),
          location: editLocation.trim(),
          portsCount: editPorts,
          status: editStatus,
          firmware: editFirmware.trim(),
          predecessorId: preds[0] || undefined,
          predecessorIds: preds,
          successorIds: editSuccessors,
          connectionType: editConnectionType,
          portSpeed: editPortSpeed,
          vlanEnabled: ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(editType) ? editVlanEnabled : undefined,
          vlans: ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(editType) ? editSelectedVlans : undefined,
          apCoverageType: editType.includes('Access Point') ? editApCoverageType : undefined,
          outdoorWeatherproofRating: editType === 'Access Point (Outdoor)' ? editOutdoorWeatherproofRating : undefined,
          maxClients: editType.includes('Access Point') ? editMaxClients : undefined,
        },
        currentUser
      );

      setEditModalOpen(false);
      setEditingDevice(null);
      if (selectedDevice?.id === updated.id) {
        setSelectedDevice(updated);
      }
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const openCloneModal = (device: NetworkDevice) => {
    setCloningSource(device);
    setCloneName(`${device.deviceName} (Copy)`);

    // Propose an incremented IP
    let nextIp = '192.168.1.120';
    if (device.ipAddress) {
      const parts = device.ipAddress.split('.');
      if (parts.length === 4) {
        const last = parseInt(parts[3], 10);
        if (!isNaN(last)) {
          parts[3] = String((last + Math.floor(Math.random() * 10) + 1) % 254 || 125);
          nextIp = parts.join('.');
        }
      }
    }
    setCloneIp(nextIp);
    setCloneLocation(device.location);
    setClonePredecessorId(device.predecessorId || device.uplinkDeviceId || '');
    setCloneConnectionType(device.connectionType || 'Ethernet Cat6');
    setCloneModalOpen(true);
  };

  const handleConfirmClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloningSource || !currentUser) return;

    try {
      const cloned = await networkService.cloneDevice(cloningSource.id, currentUser, {
        deviceName: cloneName.trim(),
        ipAddress: cloneIp.trim(),
        location: cloneLocation.trim(),
        predecessorId: clonePredecessorId || undefined,
        uplinkDeviceId: clonePredecessorId || undefined,
        connectionType: cloneConnectionType,
      });

      setCloneModalOpen(false);
      setCloningSource(null);
      onRefresh();
      setSelectedDevice(cloned);
    } catch (err: any) {
      console.error('Clone failed:', err);
    }
  };

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectPredecessorId || !connectSuccessorId || !currentUser) return;
    if (connectPredecessorId === connectSuccessorId) {
      setConnectMessage({ text: 'A device cannot be connected to itself.', type: 'error' });
      return;
    }

    try {
      await networkService.connectNodes(
        connectPredecessorId,
        connectSuccessorId,
        currentUser,
        connectCableType,
        connectSpeed
      );
      setConnectMessage({
        text: `Successfully linked ${deviceMap.get(connectPredecessorId)?.deviceName} → ${deviceMap.get(connectSuccessorId)?.deviceName}`,
        type: 'success',
      });
      setConnectPredecessorId('');
      setConnectSuccessorId('');
      onRefresh();
      setTimeout(() => setConnectMessage(null), 4000);
    } catch (err: any) {
      setConnectMessage({ text: err.message || 'Failed to connect devices', type: 'error' });
    }
  };

  const handleDisconnect = async (parentDeviceId: string, childDeviceId: string) => {
    if (!currentUser) return;
    try {
      await networkService.disconnectNodes(parentDeviceId, childDeviceId, currentUser);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!currentUser) return;
    try {
      await networkService.deleteDevice(id, currentUser);
      setDeleteConfirmId(null);
      if (selectedDevice?.id === id) {
        setSelectedDevice(null);
      }
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to get device icon (Cisco Packet Tracer topology icons)
  const getDeviceIcon = (type: NetworkDevice['deviceType'], _className = 'w-5 h-5') => {
    return <CiscoDeviceIcon type={type} size={28} />;
  };

  // Layer Categorization for Structured Hierarchical View
  const layer1Gateways = useMemo(() => {
    return devices.filter((d) => (!d.predecessorId && !d.uplinkDeviceId && (!d.predecessorIds || d.predecessorIds.length === 0)) || d.deviceType === 'Starlink Terminal');
  }, [devices]);

  const layer2Routers = useMemo(() => {
    return devices.filter((d) => d.deviceType === 'Router' || (d.predecessorId && layer1Gateways.some(p => p.id === d.predecessorId) && d.deviceType !== 'Starlink Terminal'));
  }, [devices, layer1Gateways]);

  const layer3Switches = useMemo(() => {
    return devices.filter((d) => ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch', 'Firewall'].includes(d.deviceType));
  }, [devices]);

  const layer4Endpoints = useMemo(() => {
    return devices.filter((d) => ['Access Point (Indoor)', 'Access Point (Outdoor)', 'Access Point', 'Server', 'Workstation', 'Laptop', 'Printer'].includes(d.deviceType));
  }, [devices]);

  // Highlight check helper
  const isHighlighted = (deviceId: string) => {
    if (!hoveredDeviceId && !selectedDevice) return false;
    const targetId = hoveredDeviceId || selectedDevice?.id;
    if (!targetId) return false;
    if (deviceId === targetId) return true;
    const target = deviceMap.get(targetId);
    if (!target) return false;
    // Check if target's predecessor
    if (target.predecessorId === deviceId || target.uplinkDeviceId === deviceId) return true;
    // Check if target's successor
    if (target.successorIds?.includes(deviceId)) return true;
    return false;
  };

  // Filtered devices for table/matrix view
  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter(
      (d) =>
        d.deviceName.toLowerCase().includes(q) ||
        d.ipAddress.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.deviceType.toLowerCase().includes(q)
    );
  }, [devices, searchQuery]);

  if (!isAuthorized) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-8 text-center my-8 max-w-xl mx-auto shadow-sm">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200">Access Restricted: Network & Topology</h2>
        <p className="text-sm text-rose-700 dark:text-rose-300 mt-2 leading-relaxed">
          Active network topology, Starlink failover nodes, and infrastructure wiring controls are strictly restricted to Super Administrators and IT Unit Staff members.
        </p>
        <div className="mt-4 text-xs text-rose-600 dark:text-rose-400 font-medium">
          If you require network diagram audit access, please contact the Hospital Super Administrator or IT Operations Unit.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-sky-600" />
            <span>Hospital Network Topology & Connections</span>
          </h1>
          <p className="text-xs text-slate-500">
            End-to-end device interconnectivity map, predecessor/successor routing paths, VLAN backbones, and hardware administration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('TOPOLOGY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'TOPOLOGY'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Connected Topology
            </button>
            <button
              onClick={() => setActiveTab('DEVICES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'DEVICES'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              All Devices ({devices.length})
            </button>
            <button
              onClick={() => setActiveTab('INCIDENTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'INCIDENTS'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Outage Logs
            </button>
          </div>

          {canManageNetwork && (
            <button
              onClick={() => {
                resetAddForm();
                setAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Node</span>
            </button>
          )}
        </div>
      </div>

      {/* TOPOLOGY TAB */}
      {activeTab === 'TOPOLOGY' && (
        <div className="space-y-4">
          {/* Sub-navigation bar inside Topology */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl shadow-2xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setTopologySubView('CANVAS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  topologySubView === 'CANVAS'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>Cisco Packet Tracer Canvas</span>
              </button>
              <button
                onClick={() => setTopologySubView('MAP')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  topologySubView === 'MAP'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Tiered Overview Map</span>
              </button>
              <button
                onClick={() => setTopologySubView('MATRIX')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  topologySubView === 'MATRIX'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Cable className="w-3.5 h-3.5" />
                <span>Predecessor / Successor Matrix</span>
              </button>
              {canManageNetwork && (
                <>
                  <button
                    onClick={() => setTopologySubView('CONNECT_TOOL')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      topologySubView === 'CONNECT_TOOL'
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Quick Cable Patcher</span>
                  </button>

                  <button
                    onClick={() => setTopologySubView('IMPORT_EXPORT')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      topologySubView === 'IMPORT_EXPORT'
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Import / Export Topology</span>
                  </button>
                </>
              )}
            </div>

            {/* Topology stats summary badges */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <strong>{devices.filter((d) => d.status === 'Online').length}</strong> / {devices.length} Online
              </span>
              <span className="hidden md:flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                Backbone: 10G SFP+ / 1G LACP
              </span>
            </div>
          </div>

          {/* SUBVIEW 0: INTERACTIVE DRAGGABLE 2D CABLE CANVAS */}
          {topologySubView === 'CANVAS' && (
            <NetworkCanvas
              devices={devices}
              currentUser={currentUser}
              onSelectDevice={(device) => setSelectedDevice(device)}
              onEditDevice={(device) => openEditModal(device)}
              onCloneDevice={(device) => openCloneModal(device)}
              onDeleteDevice={(device) => setDeleteConfirmId(device.id)}
              onRefresh={onRefresh}
              onAddDevice={() => {
                resetAddForm();
                setAddModalOpen(true);
              }}
            />
          )}

          {/* SUBVIEW 1: INTERCONNECT VISUAL MAP */}
          {topologySubView === 'MAP' && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-8 relative overflow-hidden">
              {/* Grid Background Pattern */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Topology Top Legend */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-3 relative z-10">
                <div>
                  <h2 className="text-sm font-bold tracking-wider uppercase text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-400" />
                    <span>Active Predecessor-to-Successor Network Topology</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click any node to inspect upstream feeds (Predecessor) and downstream connected branches (Successors).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1 text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Fiber / 10G SFP+
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Cat6 Gigabit
                  </span>
                  <span className="flex items-center gap-1 text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Satellite WAN
                  </span>
                </div>
              </div>

              {/* HIERARCHICAL CONNECTED GRAPH TIERS */}
              <div className="space-y-8 relative z-10">
                {/* TIER 1: WAN & SATELLITE GATEWAYS */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tier 1: External Satellite WAN & Primary Gateways</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {layer1Gateways.map((dev) => {
                      const isSel = selectedDevice?.id === dev.id;
                      const isHov = hoveredDeviceId === dev.id;
                      const hasSuccessors = (dev.successorIds?.length || 0) > 0;

                      return (
                        <div
                          key={dev.id}
                          onClick={() => setSelectedDevice(dev)}
                          onMouseEnter={() => setHoveredDeviceId(dev.id)}
                          onMouseLeave={() => setHoveredDeviceId(null)}
                          className={`group relative p-4 rounded-xl flex items-center gap-3 w-72 shadow-lg cursor-pointer transition-all duration-200 ${
                            isSel
                              ? 'bg-slate-900 border-2 border-sky-400 ring-4 ring-sky-950'
                              : isHov
                              ? 'bg-slate-900 border border-sky-400 scale-[1.02]'
                              : 'bg-slate-900/90 border border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            {getDeviceIcon(dev.deviceType, 'w-6 h-6')}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{dev.deviceName}</div>
                            <div className="text-[10px] font-mono text-amber-400 font-semibold">{dev.ipAddress}</div>
                            <div className="text-[10px] text-slate-400 truncate">{dev.location}</div>
                            {dev.portSpeed && (
                              <div className="text-[9px] text-slate-500 font-mono truncate mt-0.5">
                                {dev.portSpeed}
                              </div>
                            )}
                          </div>

                          {hasSuccessors && (
                            <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-[10px] font-mono text-emerald-300" title={`${dev.successorIds?.length} downstream connected devices`}>
                              <ArrowDown className="w-3 h-3" />
                              <span>{dev.successorIds?.length}</span>
                            </div>
                          )}

                          {canManageNetwork && (
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 flex items-center gap-1 transition bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-md">
                              <button
                                title="Edit Device"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(dev);
                                }}
                                className="p-1 rounded hover:bg-sky-600 text-slate-300 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                title="Delete Device"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(dev.id);
                                }}
                                className="p-1 rounded hover:bg-rose-600 text-slate-300 hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Connecting Line to Tier 2 */}
                  <div className="flex flex-col items-center my-2">
                    <div className="w-0.5 h-6 bg-gradient-to-b from-amber-500 to-sky-500 animate-pulse" />
                    <div className="text-[9px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      WAN Routing Link
                    </div>
                    <div className="w-0.5 h-4 bg-sky-500" />
                  </div>
                </div>

                {/* TIER 2: CORE EDGE ROUTERS */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-sky-400" />
                    <span>Tier 2: Core Edge Routers & Gateway Routing</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {layer2Routers.map((dev) => {
                      const isSel = selectedDevice?.id === dev.id;
                      const isHov = hoveredDeviceId === dev.id;
                      const pred = dev.predecessorId ? deviceMap.get(dev.predecessorId) : null;

                      return (
                        <div
                          key={dev.id}
                          onClick={() => setSelectedDevice(dev)}
                          onMouseEnter={() => setHoveredDeviceId(dev.id)}
                          onMouseLeave={() => setHoveredDeviceId(null)}
                          className={`group relative p-4 rounded-xl flex items-center gap-3 w-72 shadow-lg cursor-pointer transition-all duration-200 ${
                            isSel
                              ? 'bg-slate-900 border-2 border-sky-400 ring-4 ring-sky-950'
                              : isHov
                              ? 'bg-slate-900 border border-sky-400 scale-[1.02]'
                              : 'bg-slate-900/90 border border-sky-900/60 hover:border-sky-500'
                          }`}
                        >
                          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                            {getDeviceIcon(dev.deviceType, 'w-6 h-6')}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{dev.deviceName}</div>
                            <div className="text-[10px] font-mono text-sky-300 font-semibold">{dev.ipAddress}</div>
                            {pred && (
                              <div className="text-[9px] text-amber-300/80 font-mono truncate flex items-center gap-1 mt-0.5">
                                <ArrowUp className="w-2.5 h-2.5 text-amber-400" />
                                <span>Feed: {pred.deviceName}</span>
                              </div>
                            )}
                          </div>

                          {dev.successorIds && dev.successorIds.length > 0 && (
                            <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-[10px] font-mono text-emerald-300" title={`${dev.successorIds.length} downstream devices`}>
                              <ArrowDown className="w-3 h-3" />
                              <span>{dev.successorIds.length}</span>
                            </div>
                          )}

                          {canManageNetwork && (
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 flex items-center gap-1 transition bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-md">
                              <button
                                title="Edit Device"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(dev);
                                }}
                                className="p-1 rounded hover:bg-sky-600 text-slate-300 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                title="Delete Device"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(dev.id);
                                }}
                                className="p-1 rounded hover:bg-rose-600 text-slate-300 hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Connecting Line to Tier 3 */}
                  <div className="flex flex-col items-center my-2">
                    <div className="w-0.5 h-6 bg-gradient-to-b from-sky-500 to-indigo-500 animate-pulse" />
                    <div className="text-[9px] font-mono text-indigo-300 bg-slate-900 px-2.5 py-0.5 rounded border border-indigo-900/60">
                      10G SFP+ Core Trunk
                    </div>
                    <div className="w-0.5 h-4 bg-indigo-500" />
                  </div>
                </div>

                {/* TIER 3: CORE & DISTRIBUTION SWITCHES */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Tier 3: Core & Distribution Switching Infrastructure</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
                    {layer3Switches.map((dev) => {
                      const isSel = selectedDevice?.id === dev.id;
                      const isHov = hoveredDeviceId === dev.id;
                      const pred = dev.predecessorId ? deviceMap.get(dev.predecessorId) : null;
                      const isHighlightedNode = isHighlighted(dev.id);

                      return (
                        <div
                          key={dev.id}
                          onClick={() => setSelectedDevice(dev)}
                          onMouseEnter={() => setHoveredDeviceId(dev.id)}
                          onMouseLeave={() => setHoveredDeviceId(null)}
                          className={`group relative p-3.5 rounded-xl flex items-center gap-3 shadow-lg cursor-pointer transition-all duration-200 ${
                            isSel
                              ? 'bg-slate-900 border-2 border-indigo-400 ring-4 ring-indigo-950'
                              : isHighlightedNode
                              ? 'bg-slate-900 border border-indigo-400'
                              : 'bg-slate-900/85 border border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                            {getDeviceIcon(dev.deviceType, 'w-5 h-5')}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{dev.deviceName}</div>
                            <div className="text-[10px] font-mono text-emerald-400 font-semibold">{dev.ipAddress}</div>
                            <div className="text-[10px] text-slate-400 truncate">{dev.location}</div>

                            {/* Predecessor Tag */}
                            {pred && (
                              <div className="text-[9px] text-sky-400 font-mono truncate flex items-center gap-1 mt-1">
                                <ArrowUp className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                <span className="truncate">Predecessor: {pred.deviceName}</span>
                              </div>
                            )}

                            {/* Successor Badges */}
                            {dev.successorIds && dev.successorIds.length > 0 && (
                              <div className="text-[9px] text-emerald-400 font-mono truncate flex items-center gap-1 mt-0.5">
                                <ArrowDown className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                <span>{dev.successorIds.length} Successor{dev.successorIds.length > 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>

                          {canManageNetwork && (
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 flex items-center gap-1 transition bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-md">
                              <button
                                title="Edit Switch"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(dev);
                                }}
                                className="p-1 rounded hover:bg-sky-600 text-slate-300 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                title="Delete Switch"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(dev.id);
                                }}
                                className="p-1 rounded hover:bg-rose-600 text-slate-300 hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Connecting Line to Tier 4 */}
                  <div className="flex flex-col items-center my-2">
                    <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500 to-emerald-500 animate-pulse" />
                    <div className="text-[9px] font-mono text-emerald-300 bg-slate-900 px-2.5 py-0.5 rounded border border-emerald-900/60">
                      Ward Fiber & Gigabit PoE Drops
                    </div>
                    <div className="w-0.5 h-4 bg-emerald-500" />
                  </div>
                </div>

                {/* TIER 4: CLINICAL ENDPOINTS, SERVERS & ACCESS POINTS */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tier 4: Clinical Servers, Wi-Fi 6 Access Points & Wards</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                    {layer4Endpoints.map((dev) => {
                      const isSel = selectedDevice?.id === dev.id;
                      const isHov = hoveredDeviceId === dev.id;
                      const pred = dev.predecessorId ? deviceMap.get(dev.predecessorId) : null;
                      const isHighlightedNode = isHighlighted(dev.id);

                      return (
                        <div
                          key={dev.id}
                          onClick={() => setSelectedDevice(dev)}
                          onMouseEnter={() => setHoveredDeviceId(dev.id)}
                          onMouseLeave={() => setHoveredDeviceId(null)}
                          className={`group relative p-3 rounded-xl flex items-center gap-3 shadow-md cursor-pointer transition-all duration-200 ${
                            isSel
                              ? 'bg-slate-900 border-2 border-emerald-400 ring-4 ring-emerald-950'
                              : isHighlightedNode
                              ? 'bg-slate-900 border border-emerald-400'
                              : 'bg-slate-900/80 border border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${
                            dev.deviceType === 'Server'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {getDeviceIcon(dev.deviceType, 'w-4 h-4')}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{dev.deviceName}</div>
                            <div className="text-[10px] font-mono text-emerald-300 font-semibold">{dev.ipAddress}</div>
                            <div className="text-[10px] text-slate-400 truncate">{dev.location}</div>

                            {/* Upstream Predecessor Link */}
                            {pred ? (
                              <div className="text-[9px] text-indigo-400 font-mono truncate flex items-center gap-1 mt-1" title={`Upstream connection from ${pred.deviceName}`}>
                                <ArrowUp className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                                <span className="truncate">Feed: {pred.deviceName}</span>
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-500 font-mono mt-1">Direct Node</div>
                            )}
                          </div>

                          {canManageNetwork && (
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 flex items-center gap-1 transition bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-md">
                              <button
                                title="Edit Endpoint"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(dev);
                                }}
                                className="p-1 rounded hover:bg-sky-600 text-slate-300 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                title="Delete Endpoint"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(dev.id);
                                }}
                                className="p-1 rounded hover:bg-rose-600 text-slate-300 hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUBVIEW 2: PREDECESSOR / SUCCESSOR MATRIX */}
          {topologySubView === 'MATRIX' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Cable className="w-4 h-4 text-sky-600" />
                    <span>Hardware Hop-by-Hop Routing & Connection Matrix</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive overview of every hardware node's upstream feed (Predecessor) and downstream feeds (Successors).
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search node by name / IP..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Hardware Node</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Upstream (Predecessor)</th>
                      <th className="px-4 py-3">Downstream (Successors)</th>
                      <th className="px-4 py-3">Link Medium & Speed</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDevices.map((dev) => {
                      const pred = dev.predecessorId ? deviceMap.get(dev.predecessorId) : null;
                      const successors = (dev.successorIds || [])
                        .map((id) => deviceMap.get(id))
                        .filter(Boolean) as NetworkDevice[];

                      return (
                        <tr key={dev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3">
                            <div
                              onClick={() => setSelectedDevice(dev)}
                              className="font-bold text-slate-900 dark:text-white cursor-pointer hover:text-sky-600 flex items-center gap-2"
                            >
                              {getDeviceIcon(dev.deviceType, 'w-4 h-4 text-sky-600 shrink-0')}
                              <div>
                                <div>{dev.deviceName}</div>
                                <div className="text-[10px] font-mono text-slate-400 font-normal">{dev.ipAddress}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                            {dev.deviceType}
                          </td>

                          {/* Predecessor Column */}
                          <td className="px-4 py-3">
                            {pred ? (
                              <button
                                onClick={() => setSelectedDevice(pred)}
                                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:border-sky-400 transition cursor-pointer text-left"
                              >
                                <ArrowUp className="w-3 h-3 text-sky-600 shrink-0" />
                                <div className="truncate max-w-[140px]">
                                  <div className="font-bold truncate text-[11px]">{pred.deviceName}</div>
                                  <div className="text-[9px] font-mono opacity-80">{pred.ipAddress}</div>
                                </div>
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-400 italic">
                                Primary WAN Feed (None)
                              </span>
                            )}
                          </td>

                          {/* Successors Column */}
                          <td className="px-4 py-3">
                            {successors.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {successors.map((succ) => (
                                  <button
                                    key={succ.id}
                                    onClick={() => setSelectedDevice(succ)}
                                    className="group flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400 transition cursor-pointer text-[10px]"
                                  >
                                    <ArrowDown className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span className="font-semibold truncate max-w-[110px]">{succ.deviceName}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-400">Endpoint / Leaf Node</span>
                            )}
                          </td>

                          {/* Link Medium & Speed */}
                          <td className="px-4 py-3">
                            <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                              {dev.connectionType || 'Ethernet Cat6'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {dev.portSpeed || '1 Gbps'}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              dev.status === 'Online'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : dev.status === 'Warning'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                dev.status === 'Online' ? 'bg-emerald-500' : dev.status === 'Warning' ? 'bg-amber-500' : 'bg-rose-500'
                              }`} />
                              {dev.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handlePing(dev)}
                                disabled={pingingId === dev.id}
                                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold text-[10px] cursor-pointer"
                              >
                                {pingingId === dev.id ? 'Ping...' : 'Ping'}
                              </button>

                              {canManageNetwork && (
                                <>
                                  <button
                                    onClick={() => openEditModal(dev)}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 text-slate-600 hover:text-sky-600 cursor-pointer"
                                    title="Edit Device & Connections"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(dev.id)}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 text-slate-600 hover:text-rose-600 cursor-pointer"
                                    title="Delete Device"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBVIEW 3: QUICK CABLE PATCHER / CONNECT TOOL */}
          {topologySubView === 'CONNECT_TOOL' && canManageNetwork && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-sky-600" />
                    <span>Quick Network Cable Patching & Interconnect Tool</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Instantly establish a predecessor-to-successor hardware connection between any two nodes.
                  </p>
                </div>
              </div>

              {connectMessage && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  connectMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}>
                  {connectMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{connectMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleQuickConnect} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Upstream Predecessor Selection */}
                  <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 space-y-2">
                    <label className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                      <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                      <span>Step 1: Select Upstream Source (Predecessor Node) *</span>
                    </label>
                    <select
                      required
                      value={connectPredecessorId}
                      onChange={(e) => setConnectPredecessorId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
                    >
                      <option value="">-- Choose Upstream Predecessor --</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      This device will supply network connectivity and traffic routing.
                    </p>
                  </div>

                  {/* Downstream Successor Selection */}
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                    <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Step 2: Select Downstream Target (Successor Node) *</span>
                    </label>
                    <select
                      required
                      value={connectSuccessorId}
                      onChange={(e) => setConnectSuccessorId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
                    >
                      <option value="">-- Choose Downstream Successor --</option>
                      {devices
                        .filter((d) => d.id !== connectPredecessorId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                          </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      This device will receive uplink traffic from the selected predecessor.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Connection Medium / Cable Type
                    </label>
                    <select
                      value={connectCableType}
                      onChange={(e) => setConnectCableType(e.target.value as NetworkConnectionType)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                    >
                      {CONNECTION_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Link Speed & Duplex
                    </label>
                    <input
                      type="text"
                      value={connectSpeed}
                      onChange={(e) => setConnectSpeed(e.target.value)}
                      placeholder="e.g. 10 Gbps SFP+ or 1 Gbps"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={!connectPredecessorId || !connectSuccessorId}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Establish Interconnect Link</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUBVIEW 4: IMPORT / EXPORT TO GENERATE / PARSE TOPOLOGY JSON */}
          {topologySubView === 'IMPORT_EXPORT' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-600" />
                  <span>Import / Export Network Topology JSON</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Backup your active network design, Cisco node coordinates, VLAN tags, and device connection routing, or restore a previously saved topology backup file.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Export Network Architecture</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Download a fully self-contained JSON configuration backup containing all <strong>{devices.length} network devices</strong>, coordinate positions, and routing feeds.
                    </p>
                  </div>
                  <button
                    onClick={handleExportTopology}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Topology Config (.json)</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Restore Topology Configuration</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Upload a previously exported <code>.json</code> network configuration file. This will restore coordinates, device settings, and patch cables.
                    </p>
                  </div>
                  
                  {canManageNetwork ? (
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportTopology}
                        className="hidden"
                        id="topology-import-input"
                      />
                      <label
                        htmlFor="topology-import-input"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer text-center"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Topology Config (.json)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-slate-400 p-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      Restricted to Super Administrators / IT personnel
                    </div>
                  )}
                </div>
              </div>

              {/* Preview of Imported Devices */}
              {importPreview && (
                <div className="space-y-4 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/60 animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                        Parsed Backup File: {importPreview.name}
                      </h4>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                        Contains {importPreview.devices.length} devices. Verify below before restoring.
                      </p>
                    </div>
                    <button
                      onClick={() => setImportPreview(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="border border-indigo-100 dark:border-indigo-900/40 rounded-xl overflow-hidden max-h-44 overflow-y-auto bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300">
                    <table className="w-full text-left font-mono">
                      <thead className="bg-indigo-50/50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 font-semibold text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-left">Hardware Node</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">IP Address</th>
                          <th className="px-3 py-2 text-left">Location</th>
                          <th className="px-3 py-2 text-left">Uplink Pred</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {importPreview.devices.map((d, index) => (
                          <tr key={d.id || index}>
                            <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                              {d.deviceName}
                            </td>
                            <td className="px-3 py-2">{d.deviceType}</td>
                            <td className="px-3 py-2">{d.ipAddress}</td>
                            <td className="px-3 py-2">{d.location}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {d.predecessorId || 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importStatusMsg && (
                    <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-300 font-medium">
                      {importStatusMsg}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setImportPreview(null)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCommitImport}
                      disabled={importingStatus === 'PENDING'}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition animate-pulse"
                    >
                      {importingStatus === 'PENDING' ? 'Restoring Topology...' : 'Confirm Restore Topology Backup'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ALL DEVICES TAB */}
      {activeTab === 'DEVICES' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Device Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Ports</th>
                  <th className="px-4 py-3">Predecessor (Upstream)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions & Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {devices.map((device) => {
                  const pred = device.predecessorId ? deviceMap.get(device.predecessorId) : null;

                  return (
                    <tr key={device.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td
                        onClick={() => setSelectedDevice(device)}
                        className="px-4 py-3 font-semibold text-slate-900 dark:text-white cursor-pointer hover:text-sky-600 flex items-center gap-2"
                      >
                        {getDeviceIcon(device.deviceType, 'w-4 h-4 text-sky-600 shrink-0')}
                        <span>{device.deviceName}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {device.deviceType}
                      </td>
                      <td className="px-4 py-3 font-mono text-sky-600 font-semibold">
                        {device.ipAddress}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {device.location}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {device.portsCount ? `${device.portsCount} Ports` : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {pred ? (
                          <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                            <ArrowUp className="w-2.5 h-2.5" />
                            {pred.deviceName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Root Node</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          device.status === 'Online'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : device.status === 'Warning'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            device.status === 'Online' ? 'bg-emerald-500' : device.status === 'Warning' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {device.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePing(device)}
                            disabled={pingingId === device.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
                          >
                            {pingingId === device.id ? 'Pinging ICMP...' : 'Ping'}
                          </button>

                          {canManageNetwork && (
                            <>
                              <button
                                onClick={() => openCloneModal(device)}
                                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 text-slate-600 hover:text-sky-600 cursor-pointer"
                                title="Clone / Duplicate Node"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(device)}
                                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 text-slate-600 hover:text-sky-600 cursor-pointer"
                                title="Edit Node"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(device.id)}
                                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 text-slate-600 hover:text-rose-600 cursor-pointer"
                                title="Delete Node"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INCIDENTS TAB */}
      {activeTab === 'INCIDENTS' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Network Outages & Cable Fault Logs</h3>
            <span className="text-xs text-slate-500">{incidents.length} recorded</span>
          </div>

          {incidents.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No network incidents logged.</p>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div key={inc.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-rose-600">{inc.type} - {inc.deviceName}</span>
                    <span className="text-slate-400">{new Date(inc.startTime).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300"><strong>Root Cause:</strong> {inc.cause}</p>
                  <p className="text-slate-700 dark:text-slate-300"><strong>Action Taken:</strong> {inc.actionTaken}</p>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Technician: {inc.technician} | Downtime: {inc.downtimeMinutes} mins
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Device Inspector Drawer / Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600">
                  {getDeviceIcon(selectedDevice.deviceType, 'w-6 h-6')}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{selectedDevice.deviceName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedDevice.status === 'Online'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : selectedDevice.status === 'Warning'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>
                      {selectedDevice.status}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">{selectedDevice.ipAddress}</span>
                </div>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TOPOLOGY RELATIONSHIPS SECTION */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Network Interconnection Architecture
              </h4>

              {/* UPSTREAM MULTI-UPLINK FEEDS CARD */}
              <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                    <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                    <span>Upstream Feeds / Uplinks</span>
                    {selectedDevice.predecessorIds && selectedDevice.predecessorIds.length > 1 && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                        {selectedDevice.predecessorIds.length} Active Trunks
                      </span>
                    )}
                  </div>
                  {canManageNetwork && ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(selectedDevice.deviceType) && !isAddingInlineUplink && (
                    <button
                      onClick={() => setIsAddingInlineUplink(true)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-600 text-white hover:bg-sky-500 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Add another upstream uplink to this switch"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Uplink</span>
                    </button>
                  )}
                </div>

                {/* Inline Add Uplink form for Managed Switches */}
                {isAddingInlineUplink && canManageNetwork && (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700 space-y-2">
                    <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Add Uplink Feed (Managed switches support multiple uplinks):</span>
                      <button
                        onClick={() => {
                          setIsAddingInlineUplink(false);
                          setInlineAddUplinkId('');
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={inlineAddUplinkId}
                        onChange={(e) => setInlineAddUplinkId(e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      >
                        <option value="">Select upstream device...</option>
                        {devices
                          .filter(
                            (d) =>
                              d.id !== selectedDevice.id &&
                              !(selectedDevice.predecessorIds || [selectedDevice.predecessorId]).includes(d.id)
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={!inlineAddUplinkId}
                        onClick={() => handleAddInlineUplink(inlineAddUplinkId)}
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                      >
                        Link
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Switch connection for APs */}
                {selectedDevice.deviceType.includes('Access Point') && canManageNetwork && (
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5">
                    <div className="text-[10px] font-bold text-purple-800 dark:text-purple-300 flex items-center justify-between">
                      <span>Connect AP to Any Switch:</span>
                      <span className="text-[9px] text-purple-600 dark:text-purple-400 font-mono">PoE+ Multi-SSID</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={quickAPSwitchId}
                        onChange={(e) => setQuickAPSwitchId(e.target.value)}
                        className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg text-xs"
                      >
                        <option value="">Choose target switch...</option>
                        {devices
                          .filter((d) =>
                            ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(d.deviceType)
                          )
                          .map((sw) => (
                            <option key={sw.id} value={sw.id}>
                              {sw.deviceName} ({sw.ipAddress}) - {sw.deviceType} {sw.vlanEnabled ? '[VLANs Active]' : ''}
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={!quickAPSwitchId}
                        onClick={() => handleConnectAPToSwitch(quickAPSwitchId)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer shrink-0"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                )}

                {(() => {
                  const rawPreds: string[] =
                    selectedDevice.predecessorIds && selectedDevice.predecessorIds.length > 0
                      ? selectedDevice.predecessorIds
                      : selectedDevice.predecessorId
                      ? [selectedDevice.predecessorId]
                      : [];
                  const predIds: string[] = Array.from(new Set(rawPreds));

                  if (predIds.length === 0) {
                    return (
                      <p className="text-[11px] text-slate-500 italic">
                        This is a root gateway device with no upstream predecessor.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-1.5">
                      {predIds.map((predId) => {
                        const parent = deviceMap.get(predId);
                        if (!parent) return null;
                        return (
                          <div
                            key={predId}
                            onClick={() => setSelectedDevice(parent)}
                            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 flex items-center justify-between cursor-pointer hover:border-sky-400 transition"
                          >
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(parent.deviceType, 'w-4 h-4 text-sky-600')}
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{parent.deviceName}</span>
                                  {(parent.deviceType === 'Managed Switch' || parent.vlanEnabled) && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700">
                                      VLAN Trunk
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">{parent.ipAddress} • {parent.deviceType}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="text-[10px] font-mono text-sky-600 font-semibold block">
                                  {selectedDevice.connectionType || 'Cat6'} ({selectedDevice.portSpeed || '1G'})
                                </span>
                              </div>
                              {canManageNetwork && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDisconnect(predId, selectedDevice.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                  title="Disconnect this uplink"
                                >
                                  <Unlink2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* VLAN & TRUNKING STATUS FOR SWITCHES */}
              {(selectedDevice.vlanEnabled || (selectedDevice.vlans && selectedDevice.vlans.length > 0) || ['Managed Switch', 'Core Switch', 'Distribution Switch'].includes(selectedDevice.deviceType)) && (
                <div className="p-3.5 rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/50 dark:bg-cyan-950/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-600" />
                      <span>802.1Q Virtual LANs (VLANs) Active</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-200 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-bold">
                      Trunking Active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedDevice.vlans || ['10', '20', '30', '99']).map((vId) => {
                      const vObj = HOSPITAL_VLANS.find((v) => v.id === vId);
                      return (
                        <span
                          key={vId}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 shadow-2xs"
                        >
                          {vObj ? vObj.badge : `VLAN ${vId}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AP WIRELESS SPECIFICATIONS */}
              {(selectedDevice.deviceType.includes('Access Point') || selectedDevice.apCoverageType) && (
                <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-purple-600" />
                      <span>Wireless AP Deployment Profile</span>
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      selectedDevice.deviceType === 'Access Point (Outdoor)' || selectedDevice.apCoverageType === 'Outdoor'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    }`}>
                      {selectedDevice.deviceType === 'Access Point (Outdoor)' || selectedDevice.apCoverageType === 'Outdoor' ? 'Outdoor (IP67 Rated)' : 'Indoor Ceiling / Wall Mount'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 block">Coverage Scope:</span>
                      <span className="font-semibold">{selectedDevice.apCoverageType || (selectedDevice.deviceType === 'Access Point (Outdoor)' ? 'Outdoor Compound / Bay' : 'Indoor Department')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Max Clients:</span>
                      <span className="font-semibold">{selectedDevice.maxClients || 250} Concurrent</span>
                    </div>
                  </div>
                </div>
              )}

              {/* DOWNSTREAM SUCCESSORS CARD */}
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Downstream Connected Branches (Successor Nodes)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">
                    {selectedDevice.successorIds?.length || 0} Connected
                  </span>
                </div>

                {selectedDevice.successorIds && selectedDevice.successorIds.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedDevice.successorIds.map((succId) => {
                      const child = deviceMap.get(succId);
                      if (!child) return null;
                      return (
                        <div
                          key={succId}
                          onClick={() => setSelectedDevice(child)}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between cursor-pointer hover:border-emerald-400 transition"
                        >
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(child.deviceType, 'w-4 h-4 text-emerald-600')}
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">{child.deviceName}</div>
                              <div className="text-[10px] font-mono text-slate-400">{child.ipAddress} • {child.location}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                              {child.connectionType || 'Cat6'}
                            </span>
                            {canManageNetwork && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDisconnect(selectedDevice.id, child.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Disconnect successor"
                              >
                                <Unlink2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    No downstream successor devices attached to this node.
                  </p>
                )}
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Device Type</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedDevice.deviceType}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Physical Location</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedDevice.location}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">MAC Address</span>
                <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{selectedDevice.macAddress || '00:1B:44:11:3A:B7'}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Port Capacity</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedDevice.portsCount || 24} Total / {selectedDevice.activePorts || 8} Active
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Firmware</span>
                <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{selectedDevice.firmware || 'v4.2.1-LTS'}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Connection Medium</span>
                <div className="font-bold text-sky-600 mt-0.5">
                  {selectedDevice.connectionType || 'Ethernet Cat6'} ({selectedDevice.portSpeed || '1 Gbps'})
                </div>
              </div>
            </div>

            {/* Ping Simulator Feedback */}
            {pingResult && pingResult.id === selectedDevice.id && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 font-mono text-[11px] flex items-center justify-between">
                <span>ICMP Echo Reply: {pingResult.ms}ms ({pingResult.status})</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            )}

            {/* Diagnostic Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => handlePing(selectedDevice)}
                disabled={pingingId === selectedDevice.id}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
              >
                <Terminal className="w-4 h-4 text-sky-600" />
                <span>{pingingId === selectedDevice.id ? 'Testing ICMP...' : 'Run Ping Test'}</span>
              </button>

              <div className="flex items-center gap-2">
                {canManageNetwork && (
                  <>
                    <button
                      onClick={() => {
                        const dev = selectedDevice;
                        openCloneModal(dev);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-300 hover:bg-sky-900 font-bold cursor-pointer"
                      title="Clone / Duplicate this device"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Clone Node</span>
                    </button>
                    <button
                      onClick={() => {
                        const dev = selectedDevice;
                        setSelectedDevice(null);
                        openEditModal(dev);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Node</span>
                    </button>
                    <button
                      onClick={() => {
                        const id = selectedDevice.id;
                        setDeleteConfirmId(id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clone Device Modal */}
      {cloneModalOpen && cloningSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-sky-600" />
                <span>Clone & Duplicate Network Device</span>
              </h3>
              <button
                onClick={() => setCloneModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-500">
              Create an exact duplicate of <strong>{cloningSource.deviceName}</strong> ({cloningSource.deviceType}) with customizable IP, name, and connection routing.
            </p>

            <form onSubmit={handleConfirmClone} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Cloned Device Name *</label>
                <input
                  type="text"
                  required
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Target LAN IP Address *</label>
                  <input
                    type="text"
                    required
                    value={cloneIp}
                    onChange={(e) => setCloneIp(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Physical Location *</label>
                  <input
                    type="text"
                    required
                    value={cloneLocation}
                    onChange={(e) => setCloneLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Predecessor Feed */}
              <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1">
                <label className="block text-sky-800 dark:text-sky-300 font-bold mb-1 flex items-center gap-1">
                  <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                  <span>Upstream Feed (Predecessor Node)</span>
                </label>
                <select
                  value={clonePredecessorId}
                  onChange={(e) => setClonePredecessorId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-xs"
                >
                  <option value="">None (Standalone Gateway)</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Connection Medium</label>
                <select
                  value={cloneConnectionType}
                  onChange={(e) => setCloneConnectionType(e.target.value as NetworkConnectionType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                >
                  {CONNECTION_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCloneModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Confirm Clone</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {editModalOpen && editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-600" />
                <span>Edit Topology Hardware Node</span>
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Device Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Device Type *</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Managed Switch">Managed Switch (VLANs & Several Uplinks)</option>
                    <option value="Core Switch">Core Switch (Backbone)</option>
                    <option value="Distribution Switch">Distribution Switch</option>
                    <option value="Access Switch">Access Switch (PoE Edge)</option>
                    <option value="Switch">Switch (Generic)</option>
                    <option value="Access Point (Indoor)">Access Point (Indoor Ceiling / Wall)</option>
                    <option value="Access Point (Outdoor)">Access Point (Outdoor Weatherproof IP67)</option>
                    <option value="Access Point">Access Point (General Wi-Fi)</option>
                    <option value="Router">Core Gateway / Router</option>
                    <option value="Firewall">Hardware Security Firewall</option>
                    <option value="Starlink Terminal">Starlink Terminal (Satellite WAN)</option>
                    <option value="Server">Edge Hospital Server</option>
                    <option value="Workstation">Desktop Computer / Workstation</option>
                    <option value="Laptop">Laptop / Portable Computer</option>
                    <option value="Printer">Network Printer / Scanner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Operational Status *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Online">Online</option>
                    <option value="Warning">Warning</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>

              {/* 1. If SWITCH: Support Several Upstream Uplinks and VLANs Configuration */}
              {['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(editType) ? (
                <div className="space-y-3">
                  {/* Multi-Uplink Configuration */}
                  <div className="p-3 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sky-800 dark:text-sky-300 font-bold flex items-center gap-1.5 text-xs">
                        <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                        <span>Upstream Feeds / Uplinks (Supports Several Uplinks)</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
                        {editSelectedPredecessors.length} active uplink{editSelectedPredecessors.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Managed switches with VLANs activated can connect to multiple upstream switches or routers for redundant trunking and LACP feeds.
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      {devices
                        .filter((d) => d.id !== editingDevice.id)
                        .map((d) => {
                          const isChecked = editSelectedPredecessors.includes(d.id);
                          return (
                            <label
                              key={d.id}
                              className="flex items-center justify-between p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditSelectedPredecessors([...editSelectedPredecessors, d.id]);
                                    } else {
                                      setEditSelectedPredecessors(editSelectedPredecessors.filter((id) => id !== d.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{d.deviceName}</span>
                                <span className="text-[10px] font-mono text-slate-400">({d.ipAddress})</span>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                                {d.deviceType}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  {/* 802.1Q Virtual LANs (VLANs) Configuration */}
                  <div className="p-3 bg-cyan-50/70 dark:bg-cyan-950/40 rounded-xl border border-cyan-200 dark:border-cyan-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-cyan-800 dark:text-cyan-300 font-bold flex items-center gap-1.5 text-xs">
                        <Layers className="w-3.5 h-3.5 text-cyan-600" />
                        <span>802.1Q Virtual LANs (VLANs)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editVlanEnabled}
                          onChange={(e) => setEditVlanEnabled(e.target.checked)}
                          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                          {editVlanEnabled ? 'VLANs Activated' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    {editVlanEnabled && (
                      <div className="space-y-1.5 pt-1 border-t border-cyan-200 dark:border-cyan-900/60">
                        <div className="text-[10px] text-cyan-700 dark:text-cyan-400 font-medium">
                          Select VLAN tags to carry across upstream trunks and downstream ports:
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {HOSPITAL_VLANS.map((vlan) => {
                            const isVlanChecked = editSelectedVlans.includes(vlan.id);
                            return (
                              <label
                                key={vlan.id}
                                className="flex items-center gap-2 p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer text-[11px]"
                              >
                                <input
                                  type="checkbox"
                                  checked={isVlanChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditSelectedVlans([...editSelectedVlans, vlan.id]);
                                    } else {
                                      setEditSelectedVlans(editSelectedVlans.filter((v) => v !== vlan.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{vlan.badge}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : editType.includes('Access Point') ? (
                /* 2. If ACCESS POINT: Connect to ANY switch & AP Deployment Profile */
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
                    <label className="block text-purple-800 dark:text-purple-300 font-bold flex items-center gap-1.5 text-xs">
                      <Network className="w-3.5 h-3.5 text-purple-600" />
                      <span>Connected Upstream Switch (APs can connect to ANY switch)</span>
                    </label>
                    <select
                      value={editPredecessorId}
                      onChange={(e) => {
                        setEditPredecessorId(e.target.value);
                        setEditSelectedPredecessors(e.target.value ? [e.target.value] : []);
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl focus:outline-none text-xs"
                    >
                      <option value="">Select Target Switch...</option>
                      <optgroup label="Switches Available (Core, Dist, Managed, Access)">
                        {devices
                          .filter((d) =>
                            ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(d.deviceType) &&
                            d.id !== editingDevice.id
                          )
                          .map((sw) => (
                            <option key={sw.id} value={sw.id}>
                              ⚡ {sw.deviceName} ({sw.ipAddress}) - {sw.deviceType} {sw.vlanEnabled ? '[VLAN Trunk]' : ''}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Other Network Nodes (Routers / Gateways)">
                        {devices
                          .filter(
                            (d) =>
                              !['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(d.deviceType) &&
                              d.id !== editingDevice.id
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-purple-700 dark:text-purple-300">
                      Indoor and Outdoor APs can link into any switch port with 802.3af/at PoE+ power and multi-SSID VLAN trunking.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                        <Wifi className="w-3.5 h-3.5 text-sky-500" />
                        <span>AP Wireless Coverage & Enclosure</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Wi-Fi 6 (802.11ax)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 text-[10px] font-semibold mb-1">Coverage Scope</label>
                        <select
                          value={editApCoverageType}
                          onChange={(e) => setEditApCoverageType(e.target.value as 'Indoor' | 'Outdoor')}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        >
                          <option value="Indoor">Indoor (Ceiling / Wall Mount)</option>
                          <option value="Outdoor">Outdoor (Perimeter / Ambulance Bay)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 text-[10px] font-semibold mb-1">Max Concurrent Clients</label>
                        <input
                          type="number"
                          value={editMaxClients}
                          onChange={(e) => setEditMaxClients(parseInt(e.target.value) || 250)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    {(editApCoverageType === 'Outdoor' || editType === 'Access Point (Outdoor)') && (
                      <div>
                        <label className="block text-slate-500 text-[10px] font-semibold mb-1">Weatherproof Rating</label>
                        <input
                          type="text"
                          value={editOutdoorWeatherproofRating}
                          onChange={(e) => setEditOutdoorWeatherproofRating(e.target.value)}
                          placeholder="e.g. IP67 Weatherproof / UV-Resistant Pole Mount"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 3. Other Devices: Standard Predecessor Selector */
                <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1">
                  <label className="block text-sky-800 dark:text-sky-300 font-bold mb-1 flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                    <span>Upstream Feed (Predecessor Device)</span>
                  </label>
                  <select
                    value={editPredecessorId}
                    onChange={(e) => {
                      setEditPredecessorId(e.target.value);
                      setEditSelectedPredecessors(e.target.value ? [e.target.value] : []);
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-xs"
                  >
                    <option value="">None (Top-Level Root Gateway)</option>
                    {devices
                      .filter((d) => d.id !== editingDevice.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Select which hardware node supplies network access to this device.
                  </p>
                </div>
              )}

              {/* Successors Multi-Selection */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <label className="block text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Downstream Connections (Successor Devices)</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600">
                    {editSuccessors.length} selected
                  </span>
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {devices
                    .filter((d) => d.id !== editingDevice.id && d.id !== editPredecessorId)
                    .map((d) => {
                      const isChecked = editSuccessors.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditSuccessors([...editSuccessors, d.id]);
                              } else {
                                setEditSuccessors(editSuccessors.filter((id) => id !== d.id));
                              }
                            }}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span className="font-semibold">{d.deviceName}</span>
                          <span className="text-[10px] font-mono text-slate-400">({d.ipAddress})</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Connection Medium</label>
                  <select
                    value={editConnectionType}
                    onChange={(e) => setEditConnectionType(e.target.value as NetworkConnectionType)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    {CONNECTION_TYPES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Port Link Speed</label>
                  <input
                    type="text"
                    value={editPortSpeed}
                    onChange={(e) => setEditPortSpeed(e.target.value)}
                    placeholder="e.g. 1 Gbps or 10 Gbps SFP+"
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">LAN IP Address *</label>
                  <input
                    type="text"
                    required
                    value={editIp}
                    onChange={(e) => setEditIp(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Ports Count</label>
                  <input
                    type="number"
                    value={editPorts}
                    onChange={(e) => setEditPorts(parseInt(e.target.value) || 24)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Physical Location *</label>
                <input
                  type="text"
                  required
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">MAC Address</label>
                  <input
                    type="text"
                    value={editMac}
                    onChange={(e) => setEditMac(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Firmware</label>
                  <input
                    type="text"
                    value={editFirmware}
                    onChange={(e) => setEditFirmware(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-xs text-slate-800 dark:text-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Topology Deletion</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete this hardware device from the hospital network topology? Any predecessor or successor links connected to it will be automatically safely unlinked.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDevice(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                Delete Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-sky-600" />
                <span>Add Network Hardware Node</span>
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Device Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SW-OPD-DISTR-01"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Device Type *</label>
                  <select
                    value={deviceType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setDeviceType(newType);
                      if (newType === 'Access Point (Outdoor)') {
                        setApCoverageType('Outdoor');
                      } else if (newType === 'Access Point (Indoor)') {
                        setApCoverageType('Indoor');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Managed Switch">Managed Switch (VLANs & Several Uplinks)</option>
                    <option value="Core Switch">Core Switch (Backbone)</option>
                    <option value="Distribution Switch">Distribution Switch</option>
                    <option value="Access Switch">Access Switch (PoE Edge)</option>
                    <option value="Switch">Switch (Generic)</option>
                    <option value="Access Point (Indoor)">Access Point (Indoor Ceiling / Wall)</option>
                    <option value="Access Point (Outdoor)">Access Point (Outdoor Weatherproof IP67)</option>
                    <option value="Access Point">Access Point (General Wi-Fi)</option>
                    <option value="Router">Core Gateway / Router</option>
                    <option value="Firewall">Hardware Security Firewall</option>
                    <option value="Starlink Terminal">Starlink Terminal (Satellite WAN)</option>
                    <option value="Server">Edge Hospital Server</option>
                    <option value="Workstation">Desktop Computer / Workstation</option>
                    <option value="Laptop">Laptop / Portable Computer</option>
                    <option value="Printer">Network Printer / Scanner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Ports Count</label>
                  <input
                    type="number"
                    value={portsCount}
                    onChange={(e) => setPortsCount(parseInt(e.target.value) || 24)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* 1. If SWITCH: Support Several Upstream Uplinks and VLANs Configuration */}
              {['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(deviceType) ? (
                <div className="space-y-3">
                  {/* Multi-Uplink Configuration */}
                  <div className="p-3 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sky-800 dark:text-sky-300 font-bold flex items-center gap-1.5 text-xs">
                        <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                        <span>Upstream Feeds / Uplinks (Supports Several Uplinks)</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
                        {selectedPredecessors.length} active uplink{selectedPredecessors.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Managed switches with VLANs activated can connect to multiple upstream switches or routers for redundant trunking and LACP feeds.
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      {devices.map((d) => {
                        const isChecked = selectedPredecessors.includes(d.id);
                        return (
                          <label
                            key={d.id}
                            className="flex items-center justify-between p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPredecessors([...selectedPredecessors, d.id]);
                                  } else {
                                    setSelectedPredecessors(selectedPredecessors.filter((id) => id !== d.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{d.deviceName}</span>
                              <span className="text-[10px] font-mono text-slate-400">({d.ipAddress})</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                              {d.deviceType}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 802.1Q Virtual LANs (VLANs) Configuration */}
                  <div className="p-3 bg-cyan-50/70 dark:bg-cyan-950/40 rounded-xl border border-cyan-200 dark:border-cyan-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-cyan-800 dark:text-cyan-300 font-bold flex items-center gap-1.5 text-xs">
                        <Layers className="w-3.5 h-3.5 text-cyan-600" />
                        <span>802.1Q Virtual LANs (VLANs)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vlanEnabled}
                          onChange={(e) => setVlanEnabled(e.target.checked)}
                          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                          {vlanEnabled ? 'VLANs Activated' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    {vlanEnabled && (
                      <div className="space-y-1.5 pt-1 border-t border-cyan-200 dark:border-cyan-900/60">
                        <div className="text-[10px] text-cyan-700 dark:text-cyan-400 font-medium">
                          Select VLAN tags to carry across upstream trunks and downstream ports:
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {HOSPITAL_VLANS.map((vlan) => {
                            const isVlanChecked = selectedVlans.includes(vlan.id);
                            return (
                              <label
                                key={vlan.id}
                                className="flex items-center gap-2 p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer text-[11px]"
                              >
                                <input
                                  type="checkbox"
                                  checked={isVlanChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVlans([...selectedVlans, vlan.id]);
                                    } else {
                                      setSelectedVlans(selectedVlans.filter((v) => v !== vlan.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{vlan.badge}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : deviceType.includes('Access Point') ? (
                /* 2. If ACCESS POINT: Connect to ANY switch & AP Deployment Profile */
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
                    <label className="block text-purple-800 dark:text-purple-300 font-bold flex items-center gap-1.5 text-xs">
                      <Network className="w-3.5 h-3.5 text-purple-600" />
                      <span>Connected Upstream Switch (APs can connect to ANY switch)</span>
                    </label>
                    <select
                      value={predecessorId}
                      onChange={(e) => {
                        setPredecessorId(e.target.value);
                        setSelectedPredecessors(e.target.value ? [e.target.value] : []);
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl focus:outline-none text-xs"
                    >
                      <option value="">Select Target Switch...</option>
                      <optgroup label="Switches Available (Core, Dist, Managed, Access)">
                        {devices
                          .filter((d) =>
                            ['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(d.deviceType)
                          )
                          .map((sw) => (
                            <option key={sw.id} value={sw.id}>
                              ⚡ {sw.deviceName} ({sw.ipAddress}) - {sw.deviceType} {sw.vlanEnabled ? '[VLAN Trunk]' : ''}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Other Network Nodes (Routers / Gateways)">
                        {devices
                          .filter(
                            (d) =>
                              !['Managed Switch', 'Core Switch', 'Distribution Switch', 'Access Switch', 'Switch'].includes(d.deviceType)
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-purple-700 dark:text-purple-300">
                      Indoor and Outdoor APs can link into any switch port with 802.3af/at PoE+ power and multi-SSID VLAN trunking.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                        <Wifi className="w-3.5 h-3.5 text-sky-500" />
                        <span>AP Wireless Coverage & Enclosure</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Wi-Fi 6 (802.11ax)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 text-[10px] font-semibold mb-1">Coverage Scope</label>
                        <select
                          value={apCoverageType}
                          onChange={(e) => setApCoverageType(e.target.value as 'Indoor' | 'Outdoor')}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        >
                          <option value="Indoor">Indoor (Ceiling / Wall Mount)</option>
                          <option value="Outdoor">Outdoor (Perimeter / Ambulance Bay)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 text-[10px] font-semibold mb-1">Max Concurrent Clients</label>
                        <input
                          type="number"
                          value={maxClients}
                          onChange={(e) => setMaxClients(parseInt(e.target.value) || 250)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    {(apCoverageType === 'Outdoor' || deviceType === 'Access Point (Outdoor)') && (
                      <div>
                        <label className="block text-slate-500 text-[10px] font-semibold mb-1">Weatherproof Rating</label>
                        <input
                          type="text"
                          value={outdoorWeatherproofRating}
                          onChange={(e) => setOutdoorWeatherproofRating(e.target.value)}
                          placeholder="e.g. IP67 Weatherproof / UV-Resistant Pole Mount"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 3. Other Devices: Standard Predecessor Selector */
                <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1">
                  <label className="block text-sky-800 dark:text-sky-300 font-bold mb-1 flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                    <span>Upstream Feed (Predecessor Device)</span>
                  </label>
                  <select
                    value={predecessorId}
                    onChange={(e) => {
                      setPredecessorId(e.target.value);
                      setSelectedPredecessors(e.target.value ? [e.target.value] : []);
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-xs"
                  >
                    <option value="">None (Top-Level Root Gateway)</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.deviceName} ({d.ipAddress}) - {d.deviceType}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Choose which switch, router, or gateway supplies connectivity to this node.
                  </p>
                </div>
              )}

              {/* Successors Multi-Selection in Add Modal */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <label className="block text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Downstream Connected Branches (Successor Devices)</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600">
                    {selectedSuccessors.length} selected
                  </span>
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {devices.map((d) => {
                    const isChecked = selectedSuccessors.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSuccessors([...selectedSuccessors, d.id]);
                            } else {
                              setSelectedSuccessors(selectedSuccessors.filter((id) => id !== d.id));
                            }
                          }}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="font-semibold">{d.deviceName}</span>
                        <span className="text-[10px] font-mono text-slate-400">({d.ipAddress})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Connection Medium</label>
                  <select
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value as NetworkConnectionType)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    {CONNECTION_TYPES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Port Link Speed</label>
                  <input
                    type="text"
                    value={portSpeed}
                    onChange={(e) => setPortSpeed(e.target.value)}
                    placeholder="e.g. 1 Gbps Full-Duplex"
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">LAN IP Address *</label>
                  <input
                    type="text"
                    required
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Physical Location *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                >
                  Save Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
