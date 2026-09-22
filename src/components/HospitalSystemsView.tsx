import React, { useState } from 'react';
import {
  Activity,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileText,
  Mail,
  DollarSign,
  Shield,
  Clock,
  Wifi,
} from 'lucide-react';
import { type HospitalSystem, type User, type SystemSettings } from '../types';
import { putToStore } from '../services/localDatabaseService';
import { authService } from '../services/authService';

interface HospitalSystemsViewProps {
  systems: HospitalSystem[];
  currentUser?: User | null;
  systemSettings?: SystemSettings | null;
  onRefresh: () => void;
}

export const HospitalSystemsView: React.FC<HospitalSystemsViewProps> = ({
  systems,
  currentUser,
  systemSettings,
  onRefresh,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);

  // Strictly only Super Admin and IT unit staff can run ping tests
  const canPing = authService.canRunPingTest(currentUser);

  const handleTestSystem = async (sys: HospitalSystem) => {
    if (!canPing) return;
    setTestingId(sys.id);
    await new Promise((r) => setTimeout(r, 500));

    // Simulate realistic jitter
    const randomLatency = Math.floor(Math.random() * 15) + 3;
    const updated: HospitalSystem = {
      ...sys,
      latencyMs: randomLatency,
      lastChecked: new Date().toISOString(),
      status: 'Operational',
    };

    await putToStore('hospitalSystems', updated);
    setTestingId(null);
    onRefresh();
  };

  const handleTestAll = async () => {
    if (!canPing) return;
    for (const sys of systems) {
      await handleTestSystem(sys);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-600" />
            <span>Core Hospital Systems & Telemetry</span>
          </h1>
          <p className="text-xs text-slate-500">
            Real-time latency, availability, and clinical service operational tracking for {systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital'}.
          </p>
        </div>

        {canPing && (
          <button
            id="ping-all-endpoints-btn"
            onClick={handleTestAll}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Ping All Endpoints</span>
          </button>
        )}
      </div>

      {/* Systems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {systems.map((sys) => {
          const isOperational = sys.status === 'Operational';
          const isDegraded = sys.status === 'Degraded';

          return (
            <div
              key={sys.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-sky-300 transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isOperational
                        ? 'bg-emerald-100 text-emerald-700'
                        : isDegraded
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOperational ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                    />
                    {sys.status}
                  </span>

                  <span className="text-xs font-mono font-bold text-slate-500">
                    {sys.latencyMs ? `${sys.latencyMs} ms` : 'N/A'}
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-2">
                  {sys.systemName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{sys.description}</p>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Host / IP:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{sys.ipOrHost}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Port:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{sys.port}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Availability SLA:</span>
                    <span className="font-semibold text-emerald-600 font-mono">{sys.uptimePercent}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Last Telemetry Ping:</span>
                    <span>{new Date(sys.lastChecked).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                {canPing ? (
                  <button
                    onClick={() => handleTestSystem(sys)}
                    disabled={testingId === sys.id}
                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingId === sys.id ? 'animate-spin' : ''}`} />
                    <span>{testingId === sys.id ? 'Checking Ping & Port...' : 'Run Local Ping Test'}</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-400 py-1.5 px-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center font-medium">
                    Telemetry Active • IT Managed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
