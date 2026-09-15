import React, { useState } from 'react';
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
  ExternalLink,
  Edit2,
  Trash2,
  RefreshCw,
  Terminal,
  Cpu,
  Sliders,
} from 'lucide-react';
import {
  type NetworkDevice,
  type NetworkIncident,
  type User as UserType,
} from '../types';
import { networkService } from '../services/networkService';
import { authService } from '../services/authService';

interface NetworkViewProps {
  devices: NetworkDevice[];
  currentUser: UserType | null;
  onRefresh: () => void;
}

export const NetworkView: React.FC<NetworkViewProps> = ({
  devices,
  currentUser,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'TOPOLOGY' | 'DEVICES' | 'INCIDENTS'>('TOPOLOGY');
  const [incidents, setIncidents] = useState<NetworkIncident[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);

  // Add device modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<NetworkDevice['deviceType']>('Switch');
  const [ipAddress, setIpAddress] = useState('192.168.1.');
  const [location, setLocation] = useState('Server Room Rack 1');
  const [macAddress, setMacAddress] = useState('');
  const [portsCount, setPortsCount] = useState(24);

  // Edit device modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<NetworkDevice['deviceType']>('Switch');
  const [editIp, setEditIp] = useState('');
  const [editMac, setEditMac] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPorts, setEditPorts] = useState(24);
  const [editStatus, setEditStatus] = useState<'Online' | 'Offline' | 'Warning'>('Online');
  const [editFirmware, setEditFirmware] = useState('v4.2.1-LTS');

  // Delete device confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Ping test simulator state
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<{ id: string; ms: number; status: string } | null>(null);

  const canManageNetwork = currentUser && ['SUPER_ADMIN', 'IT_ADMIN'].includes(currentUser.role);

  React.useEffect(() => {
    const loadIncidents = async () => {
      const data = await networkService.getNetworkIncidents();
      setIncidents(data);
    };
    loadIncidents();
  }, [activeTab]);

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

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || !currentUser) return;

    try {
      await networkService.addDevice(
        {
          deviceName: deviceName.trim(),
          deviceType,
          manufacturer: 'Cisco / Ubiquiti Edge',
          model: 'Enterprise Switch / AP',
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
        },
        currentUser
      );

      setAddModalOpen(false);
      setDeviceName('');
      setIpAddress('192.168.1.');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
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
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !currentUser) return;

    try {
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

  // Organize topology nodes
  const routers = devices.filter((d) => d.deviceType === 'Router');
  const firewalls = devices.filter((d) => d.deviceType === 'Firewall');
  const switches = devices.filter((d) => d.deviceType === 'Switch');
  const aps = devices.filter((d) => d.deviceType === 'Access Point');
  const servers = devices.filter((d) => d.deviceType === 'Server');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-sky-600" />
            <span>Hospital Network Topology & Infrastructure</span>
          </h1>
          <p className="text-xs text-slate-500">
            Real-time topology diagram, core switches, VLAN segmentation, and hardware node administration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('TOPOLOGY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'TOPOLOGY'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Interactive Topology
            </button>
            <button
              onClick={() => setActiveTab('DEVICES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'DEVICES'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Devices ({devices.length})
            </button>
            <button
              onClick={() => setActiveTab('INCIDENTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'INCIDENTS'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Network Incidents
            </button>
          </div>

          {canManageNetwork && (
            <button
              onClick={() => setAddModalOpen(true)}
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
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-slate-300">
                Hospital Network Hierarchy & Interconnect Map
              </h2>
              <p className="text-xs text-slate-400">
                Hierarchical tree routing traffic through core security and distribution switches to clinical wards
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LAN 1 Gbps Backbone
              </span>
              {canManageNetwork && (
                <span className="text-[11px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-md font-sans font-semibold">
                  Admin Edit/Delete Enabled
                </span>
              )}
            </div>
          </div>

          {/* Level 1: Internet & Gateway */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">
              Layer 1: External Uplink & Core Gateway
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl flex items-center gap-3 w-64 shadow-md">
                <Radio className="w-6 h-6 text-sky-400" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-white">Starlink Terminal</div>
                  <div className="text-[10px] font-mono text-emerald-400">102.164.21.1 (WAN Uplink)</div>
                  <div className="text-[10px] text-slate-400">Auto Failover to Local Node</div>
                </div>
              </div>

              {routers.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedDevice(r)}
                  className="group relative bg-slate-900 border border-sky-800 p-3.5 rounded-xl flex items-center gap-3 w-64 shadow-md cursor-pointer hover:border-sky-500 transition"
                >
                  <Network className="w-6 h-6 text-sky-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{r.deviceName}</div>
                    <div className="text-[10px] font-mono text-sky-300">{r.ipAddress}</div>
                    <div className="text-[10px] text-slate-400 truncate">{r.location}</div>
                  </div>

                  {canManageNetwork && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        title="Edit Device"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(r);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Device"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(r.id);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Vertical connector line */}
            <div className="w-0.5 h-6 bg-slate-700 my-1" />
          </div>

          {/* Level 2: Core Distribution Switches */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">
              Layer 2: Core & Distribution Switching
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {switches.map((sw) => (
                <div
                  key={sw.id}
                  onClick={() => setSelectedDevice(sw)}
                  className="group relative bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3 w-64 shadow-md cursor-pointer hover:border-emerald-500 transition"
                >
                  <Layers className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{sw.deviceName}</div>
                    <div className="text-[10px] font-mono text-emerald-300">{sw.ipAddress}</div>
                    <div className="text-[10px] text-slate-400 truncate">{sw.location}</div>
                  </div>

                  {canManageNetwork && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        title="Edit Switch"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(sw);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Switch"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(sw.id);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Vertical connector line */}
            <div className="w-0.5 h-6 bg-slate-700 my-1" />
          </div>

          {/* Level 3: Access Points & Department Local Workstations */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">
              Layer 3: Clinical Edge, Wi-Fi & Local Server Nodes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {/* Local Server Node */}
              {servers.map((srv) => (
                <div
                  key={srv.id}
                  onClick={() => setSelectedDevice(srv)}
                  className="group relative bg-sky-950/40 border border-sky-700 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:border-sky-400 transition"
                >
                  <Server className="w-5 h-5 text-sky-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{srv.deviceName}</div>
                    <div className="text-[10px] font-mono text-sky-300">{srv.ipAddress}</div>
                    <div className="text-[10px] text-slate-400 truncate">HITOMS Local Server</div>
                  </div>

                  {canManageNetwork && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        title="Edit Server"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(srv);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Server"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(srv.id);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Wi-Fi APs */}
              {aps.map((ap) => (
                <div
                  key={ap.id}
                  onClick={() => setSelectedDevice(ap)}
                  className="group relative bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:border-sky-500 transition"
                >
                  <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{ap.deviceName}</div>
                    <div className="text-[10px] font-mono text-slate-300">{ap.ipAddress}</div>
                    <div className="text-[10px] text-slate-400 truncate">{ap.location}</div>
                  </div>

                  {canManageNetwork && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        title="Edit AP"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(ap);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete AP"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(ap.id);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions & Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td
                      onClick={() => setSelectedDevice(device)}
                      className="px-4 py-3 font-semibold text-slate-900 dark:text-white cursor-pointer hover:text-sky-600"
                    >
                      {device.deviceName}
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
                ))}
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
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDevice.deviceName}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">{selectedDevice.ipAddress}</span>
                </div>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
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
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedDevice.portsCount || 24} Total / {selectedDevice.activePorts || 8} Active</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Firmware</span>
                <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{selectedDevice.firmware || 'v4.2.1-LTS'}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Operational Status</span>
                <div className="font-bold text-emerald-600 mt-0.5">{selectedDevice.status}</div>
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

      {/* Edit Device Modal */}
      {editModalOpen && editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
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
                    <option value="Switch">Managed Switch</option>
                    <option value="Router">Core Router</option>
                    <option value="Access Point">Access Point</option>
                    <option value="Server">Local Server</option>
                    <option value="Firewall">Hardware Firewall</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Status *</label>
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
                <label className="block text-slate-500 font-semibold mb-1">Physical Location / Rack Position *</label>
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
              Are you sure you want to permanently delete this hardware device from the hospital network topology? This will remove all associated port mappings and ping monitoring.
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
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
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
                    onChange={(e) => setDeviceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Switch">Managed Switch</option>
                    <option value="Router">Core Router</option>
                    <option value="Access Point">Access Point</option>
                    <option value="Server">Local Server</option>
                    <option value="Firewall">Hardware Firewall</option>
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
