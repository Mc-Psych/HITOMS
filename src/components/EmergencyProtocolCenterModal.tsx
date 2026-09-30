import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Radio,
  X,
  Volume2,
  Printer,
  FileText,
  AlertTriangle,
  PhoneCall,
  CheckCircle2,
  Users,
  HardDrive,
  Activity,
  Send,
  Lock,
  Flame,
  ShieldCheck,
  Edit3,
  Settings,
  Server,
  Gauge,
  Zap,
} from 'lucide-react';
import { type EmergencyBroadcastAlert, type User, type Asset, type SystemSettings } from '../types';
import { emergencyService, type QuickTriggerPreset, DEFAULT_QUICK_TRIGGERS } from '../services/emergencyService';
import { authService } from '../services/authService';
import { settingsService } from '../services/settingsService';
import { EditQuickTriggerModal } from './EditQuickTriggerModal';

interface EmergencyProtocolCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  alerts: EmergencyBroadcastAlert[];
  assets?: Asset[];
  systemSettings?: SystemSettings | null;
  onRefresh: () => void;
}

export const EmergencyProtocolCenterModal: React.FC<EmergencyProtocolCenterModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  alerts,
  assets = [],
  systemSettings,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'TRIGGERS' | 'BROADCAST' | 'SPEED_SETTINGS' | 'PRINT_PACK'>('TRIGGERS');

  // Quick Triggers Preset State
  const [quickTriggers, setQuickTriggers] = useState<QuickTriggerPreset[]>(DEFAULT_QUICK_TRIGGERS);
  const [editingTrigger, setEditingTrigger] = useState<QuickTriggerPreset | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Marquee Speed State (Controlled by Super Admin / IT)
  const [broadcastSpeed, setBroadcastSpeed] = useState<number>(
    systemSettings?.emergencyBroadcastSpeedSeconds || 22
  );
  const [speedSavedSuccess, setSpeedSavedSuccess] = useState(false);

  const isSuperAdminOrIT = authService.isSuperAdminOrIT(currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const loadQuickTriggers = async () => {
    const loaded = await emergencyService.getQuickTriggers();
    setQuickTriggers(loaded);
  };

  useEffect(() => {
    if (isOpen) {
      loadQuickTriggers();
      if (systemSettings?.emergencyBroadcastSpeedSeconds) {
        setBroadcastSpeed(systemSettings.emergencyBroadcastSpeedSeconds);
      }
    }
  }, [isOpen, systemSettings]);

  // Save Broadcast Marquee Speed
  const handleSaveSpeed = async (newSpeed: number) => {
    setBroadcastSpeed(newSpeed);
    if (!currentUser) return;
    try {
      await settingsService.updateSettings(
        { emergencyBroadcastSpeedSeconds: newSpeed },
        currentUser
      );
      setSpeedSavedSuccess(true);
      setTimeout(() => setSpeedSavedSuccess(false), 2500);
      onRefresh();
    } catch (e) {
      console.error('Failed to update emergency broadcast speed:', e);
    }
  };

  // Custom Broadcast Form State
  const [codeType, setCodeType] = useState<EmergencyBroadcastAlert['codeType']>('CODE_BLUE_IT');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'WARNING'>('CRITICAL');
  const [targetUnit, setTargetUnit] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const activeAlerts = alerts.filter((a) => a.isActive);

  // Trigger quick broadcast with immediate system downtime integration
  const handleQuickTrigger = async (trig: QuickTriggerPreset) => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await emergencyService.createBroadcast(
        {
          codeType: trig.codeType,
          title: trig.defaultTitle,
          message: trig.defaultMessage,
          severity: trig.severity,
          targetUnits: [targetUnit],
          targetSystemId: trig.targetSystemId,
          targetSystemName: trig.targetSystemName,
          autoSetSystemStatus: trig.autoSetSystemStatus || 'Down',
        },
        currentUser
      );
      onRefresh();
      setActiveTab('BROADCAST');
    } catch (err) {
      console.error('Failed to trigger emergency alert:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title || !message) return;
    setIsSubmitting(true);
    try {
      await emergencyService.createBroadcast(
        {
          codeType,
          title,
          message,
          severity,
          targetUnits: [targetUnit],
        },
        currentUser
      );
      setTitle('');
      setMessage('');
      onRefresh();
      setActiveTab('BROADCAST');
    } catch (err) {
      console.error('Failed to send custom broadcast:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    if (!currentUser) return;
    await emergencyService.resolveBroadcast(alertId, currentUser);
    onRefresh();
  };

  // Generate Emergency Print Pack
  const handlePrintEmergencyPack = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const criticalAssets = assets.filter(
      (a) => a.assetType === 'Server' || a.assetType === 'Switch' || a.assetType === 'Router' || a.department === 'ICU' || a.department === 'ER'
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>HOSPITAL IT EMERGENCY DISASTER RECOVERY PACKET</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; line-height: 1.4; font-size: 12px; }
            .header { border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
            .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
            .badge { background: #e11d48; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; text-transform: uppercase; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 14px; font-weight: 700; background: #f1f5f9; padding: 6px 10px; border-left: 4px solid #0284c7; margin-bottom: 10px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f8fafc; font-weight: bold; }
            .alert-box { background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; padding: 10px; border-radius: 8px; font-weight: 600; margin-bottom: 16px; }
            .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">HOSPITAL IT DISASTER RECOVERY & EMERGENCY PACKET</h1>
              <div class="subtitle">Official Hospital IT Operations Contingency Document • Printed ${new Date().toLocaleString()}</div>
            </div>
            <div class="badge">CONFIDENTIAL / IT EMERGENCY USE ONLY</div>
          </div>

          <div class="alert-box">
            🚨 EMERGENCY DOWNTIME PROTOCOL: In case of major EMR, Network, or Server outage, follow paper logging procedures below and notify IT Emergency Command Center immediately.
          </div>

          <div class="section">
            <div class="section-title">1. Hospital IT Emergency Extension & Command Directory</div>
            <table>
              <thead>
                <tr>
                  <th>Role / Unit</th>
                  <th>Primary Contact</th>
                  <th>Emergency Extension</th>
                  <th>Secondary Backup Line</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>IT Emergency Helpdesk Hotline</td>
                  <td>IT Command Center</td>
                  <td><strong>Ext. 9911</strong></td>
                  <td>+1 (555) 019-9911</td>
                </tr>
                <tr>
                  <td>On-Call Lead Network Engineer</td>
                  <td>Duty Network Lead</td>
                  <td>Ext. 4401</td>
                  <td>+1 (555) 019-4401</td>
                </tr>
                <tr>
                  <td>EMR & Database Administrator</td>
                  <td>Clinical Systems Lead</td>
                  <td>Ext. 4402</td>
                  <td>+1 (555) 019-4402</td>
                </tr>
                <tr>
                  <td>ICU & Emergency IT Specialist</td>
                  <td>On-Call Ward Specialist</td>
                  <td>Ext. 4403</td>
                  <td>+1 (555) 019-4403</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">2. Critical Hospital Infrastructure & Gateway Assets</div>
            <table>
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Device / Model</th>
                  <th>Department / Location</th>
                  <th>IP Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${
                  criticalAssets.length > 0
                    ? criticalAssets
                        .map(
                          (a) => `
                    <tr>
                      <td><strong>${a.assetTag}</strong></td>
                      <td>${a.manufacturer} ${a.model} (${a.assetType})</td>
                      <td>${a.department} - ${a.location}</td>
                      <td>${a.ipAddress || 'Dynamic / DHCP'}</td>
                      <td>${a.status}</td>
                    </tr>
                  `
                        )
                        .join('')
                    : `
                    <tr>
                      <td colspan="5" style="text-align:center; color:#64748b;">All core servers and switches logged in system active directory.</td>
                    </tr>
                  `
                }
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">3. EHR / PACS Downtime Paper Logging Checklist</div>
            <ol style="margin-top: 4px; padding-left: 20px;">
              <li><strong>Activate Manual Patient Chart Logs:</strong> Clinical nursing staff must initiate physical downtime paper charts for all incoming patient admissions.</li>
              <li><strong>PACS Emergency Imaging Routine:</strong> Radiologists switch portable X-ray/Ultrasound units to direct USB local storage mode.</li>
              <li><strong>Pharmacy Medication Dispensing:</strong> Activate emergency automated dispensing cabinet manual override keys under Pharmacist Supervisor supervision.</li>
              <li><strong>Network Isolation Verification:</strong> Verify core firewall switch LEDs and verify backup satellite / LTE gateway status.</li>
            </ol>
          </div>

          <div class="footer">
            ${systemSettings?.systemName || 'HITOMS'} Emergency Command System • Generated by ${currentUser?.fullName || 'IT Command'} (${currentUser?.role || 'IT Admin'})
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-rose-950/80 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Hospital IT Emergency & Disaster Protocol Center
                {activeAlerts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] animate-pulse">
                    {activeAlerts.length} ACTIVE EMERGENCY
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Hospital-wide IT Code Blue dispatches, EHR downtime protocols, broadcast alerts, and offline disaster recovery
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-6 bg-slate-950/80 border-b border-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('TRIGGERS')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'TRIGGERS' ? 'border-rose-500 text-rose-400 bg-rose-950/20' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-rose-400" />
            <span>Emergency Quick Triggers</span>
          </button>

          <button
            onClick={() => setActiveTab('BROADCAST')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'BROADCAST' ? 'border-amber-500 text-amber-400 bg-amber-950/20' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>Active Hospital Broadcasts ({activeAlerts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PRINT_PACK')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'PRINT_PACK' ? 'border-sky-500 text-sky-400 bg-sky-950/20' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>Offline Disaster Recovery Pack</span>
          </button>

          {isSuperAdminOrIT && (
            <button
              onClick={() => setActiveTab('SPEED_SETTINGS')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'SPEED_SETTINGS' ? 'border-purple-500 text-purple-400 bg-purple-950/20' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Gauge className="w-4 h-4 text-purple-400" />
              <span>Badge Text Speed</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'TRIGGERS' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-rose-200">Emergency Protocol Execution Policy</h4>
                  <p className="text-slate-300 leading-relaxed">
                    Triggering an Emergency Protocol immediately dispatches high-priority notifications across all hospital workstations, records an unalterable HIPAA audit log, and notifies On-Call IT leads.
                  </p>
                </div>
              </div>

              {/* Grid of Emergency Trigger Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickTriggers.map((trig) => {
                  const isBlue = trig.codeType === 'CODE_BLUE_IT';
                  const isSky = trig.codeType === 'EHR_DOWNTIME';
                  const isAmber = trig.codeType === 'CODE_RED_NETWORK';
                  const isPurple = trig.codeType === 'CYBER_LOCKDOWN';

                  const colorStyles = isBlue
                    ? {
                        border: 'border-rose-500/40 hover:border-rose-500',
                        badge: 'bg-rose-600 text-white',
                        text: 'text-rose-300',
                        btn: 'bg-rose-600 hover:bg-rose-500',
                        icon: <Flame className="w-4 h-4" />,
                      }
                    : isSky
                    ? {
                        border: 'border-sky-500/40 hover:border-sky-500',
                        badge: 'bg-sky-600 text-white',
                        text: 'text-sky-300',
                        btn: 'bg-sky-600 hover:bg-sky-500',
                        icon: <FileText className="w-4 h-4" />,
                      }
                    : isAmber
                    ? {
                        border: 'border-amber-500/40 hover:border-amber-500',
                        badge: 'bg-amber-600 text-white',
                        text: 'text-amber-300',
                        btn: 'bg-amber-600 hover:bg-amber-500',
                        icon: <Activity className="w-4 h-4" />,
                      }
                    : {
                        border: 'border-purple-500/40 hover:border-purple-500',
                        badge: 'bg-purple-600 text-white',
                        text: 'text-purple-300',
                        btn: 'bg-purple-600 hover:bg-purple-500',
                        icon: <Lock className="w-4 h-4" />,
                      };

                  return (
                    <div
                      key={trig.id}
                      className={`p-5 rounded-2xl bg-slate-800/80 border ${colorStyles.border} transition space-y-3 relative`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 py-1 rounded-xl ${colorStyles.badge} font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-md`}
                          >
                            {colorStyles.icon}
                            <span>{trig.badgeTitle}</span>
                          </div>
                          <span className={`text-xs font-bold ${colorStyles.text}`}>
                            {trig.subTitle}
                          </span>
                        </div>

                        {isSuperAdminOrIT && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTrigger(trig);
                              setIsEditModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-700/80 hover:bg-sky-600 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-[11px] font-bold border border-slate-600"
                            title="Edit Quick Emergency Trigger Preset Configuration"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                            <span>Edit Preset</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{trig.description}</p>

                      {/* Tied Hospital System info */}
                      {trig.targetSystemName ? (
                        <div className="flex items-center justify-between text-[11px] bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg">
                          <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                            <Server className="w-3.5 h-3.5 text-sky-400" />
                            <span>Tied System:</span>
                          </span>
                          <span className="font-extrabold text-sky-300 flex items-center gap-1.5">
                            <span>{trig.targetSystemName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-600/30 text-rose-300 border border-rose-500/40 uppercase">
                              Sets &rarr; {trig.autoSetSystemStatus || 'Down'}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] bg-slate-900/60 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Server className="w-3.5 h-3.5 text-slate-500" />
                            <span>Tied System:</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">None configured</span>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleQuickTrigger(trig)}
                        className={`w-full py-2.5 px-4 ${colorStyles.btn} disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg`}
                      >
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span>Dispatch {trig.badgeTitle} Alert</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'BROADCAST' && (
            <div className="space-y-6">
              {/* Custom Broadcast Creator */}
              <form onSubmit={handleCustomBroadcast} className="p-5 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Issue Custom Hospital Broadcast Alert</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">Code Type</label>
                    <select
                      value={codeType}
                      onChange={(e: any) => setCodeType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="CODE_BLUE_IT">Code Blue IT (Rapid Response)</option>
                      <option value="EHR_DOWNTIME">EHR Downtime Protocol</option>
                      <option value="CODE_RED_NETWORK">Network / PACS Outage</option>
                      <option value="CYBER_LOCKDOWN">Cyber Isolation Lockdown</option>
                      <option value="GENERAL_EMERGENCY">General Emergency Broadcast</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">Severity Level</label>
                    <select
                      value={severity}
                      onChange={(e: any) => setSeverity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="CRITICAL">🔴 Critical (Hospital Wide Banner)</option>
                      <option value="HIGH">🟧 High Urgency</option>
                      <option value="WARNING">🟨 Operational Advisory</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">Target Department / Unit</label>
                    <select
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="ALL">All Hospital Wards & Units</option>
                      <option value="ICU">Intensive Care Unit (ICU)</option>
                      <option value="ER">Emergency Room (ER)</option>
                      <option value="Radiology">Radiology & Imaging</option>
                      <option value="Operating Theater">Operating Theaters (OT)</option>
                      <option value="Pharmacy">Hospital Pharmacy</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] font-semibold mb-1">Broadcast Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g., Emergency Maintenance on Core Switch SW-ICU-01"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] font-semibold mb-1">Message Body *</label>
                  <textarea
                    required
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide clear operational instructions for clinical staff..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="text-right">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition"
                  >
                    Send Emergency Broadcast
                  </button>
                </div>
              </form>

              {/* Active Broadcasts List */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider">Active Broadcast Alerts ({activeAlerts.length})</h3>
                {activeAlerts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-800/40 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                    No active emergency broadcasts. Hospital IT systems running nominal.
                  </div>
                ) : (
                  activeAlerts.map((a) => (
                    <div key={a.id} className="p-4 rounded-xl bg-slate-800/90 border border-rose-500/50 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold uppercase">{a.codeType}</span>
                          <span className="font-bold text-white text-xs">{a.title}</span>
                          <span className="text-[10px] text-slate-400">
                            ({new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{a.message}</p>
                        <div className="text-[10px] text-slate-400">
                          Issued by {a.issuedBy.name} ({a.issuedBy.role}) • Target: {a.targetUnits.join(', ')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleResolveAlert(a.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Resolve Alert</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'PRINT_PACK' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-sky-950/40 border border-sky-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sky-200 text-sm">Emergency Offline Disaster Recovery Packet</h3>
                    <p className="text-xs text-sky-300/80">
                      Printable physical document containing emergency hotline extensions, critical gateway device IPs, and paper downtime SOPs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintEmergencyPack}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-lg transition"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Generate & Print Pack</span>
                  </button>
                </div>
              </div>

              {/* Preview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-rose-400" />
                    <span>1. Emergency IT Hotline Directory</span>
                  </div>
                  <ul className="text-slate-300 space-y-1 text-[11px] pl-2 border-l border-slate-700">
                    <li>IT Command Hotline: <strong>Ext. 9911</strong></li>
                    <li>On-Call Lead Network Engineer: Ext. 4401</li>
                    <li>EMR Database Administrator: Ext. 4402</li>
                    <li>ICU/ER IT On-Call Specialist: Ext. 4403</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>2. Core Gateway Devices Logged ({assets.length})</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Includes static IP addresses, rack locations, and serial numbers of all registered core switches, routers, and PACS servers for manual console restoration.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SPEED_SETTINGS' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-800/80 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Emergency Broadcast Badge Text Motion Speed</h3>
                    <p className="text-xs text-purple-200/80">
                      Super Admin Master Control: Adjust how fast the emergency ticker text loops from left to right across ward workstations and hospital monitors.
                    </p>
                  </div>
                </div>

                {/* Active speed indicator */}
                <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700/80 p-3 rounded-xl">
                  <span className="text-xs text-slate-300 font-semibold">Active Marquee Duration:</span>
                  <span className="px-3 py-1 rounded-lg bg-purple-600 text-white text-xs font-mono font-bold">
                    {broadcastSpeed}s per loop {broadcastSpeed <= 10 ? '(Rapid)' : broadcastSpeed <= 18 ? '(Fast)' : broadcastSpeed <= 28 ? '(Normal)' : '(Slow)'}
                  </span>
                </div>

                {/* Speed Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Pacing Presets</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: 'Rapid (8s)', val: 8 },
                      { label: 'Fast (14s)', val: 14 },
                      { label: 'Normal (22s)', val: 22 },
                      { label: 'Slow (32s)', val: 32 },
                      { label: 'Relaxed (45s)', val: 45 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => handleSaveSpeed(p.val)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer flex flex-col items-center gap-0.5 ${
                          broadcastSpeed === p.val
                            ? 'bg-purple-600 text-white shadow-md border border-purple-400'
                            : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Range Slider */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Live Speed Slider:</span>
                    <span className="font-mono text-purple-300 font-bold">{broadcastSpeed} seconds</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="60"
                    step="1"
                    value={broadcastSpeed}
                    onChange={(e) => handleSaveSpeed(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>4s (Extremely Fast)</span>
                    <span>22s (Standard Default)</span>
                    <span>60s (Slow Motion)</span>
                  </div>
                </div>

                {speedSavedSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Emergency broadcast marquee speed updated and broadcasted to all client screens!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-rose-400" />
            <span>Active Duty Officer: <strong>{currentUser?.fullName}</strong> ({currentUser?.role})</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Close Emergency Center
          </button>
        </div>
      </div>

      {/* Edit Quick Emergency Trigger Preset Modal */}
      <EditQuickTriggerModal
        preset={editingTrigger}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTrigger(null);
        }}
        currentUser={currentUser}
        onSaveSuccess={async () => {
          await loadQuickTriggers();
          onRefresh();
        }}
      />
    </div>
  );
};
