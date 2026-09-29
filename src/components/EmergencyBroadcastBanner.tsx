import React, { useState } from 'react';
import { ShieldAlert, Radio, Volume2, ShieldCheck, Lock } from 'lucide-react';
import { type EmergencyBroadcastAlert, type User } from '../types';
import { emergencyService } from '../services/emergencyService';
import { authService } from '../services/authService';

interface EmergencyBroadcastBannerProps {
  alerts: EmergencyBroadcastAlert[];
  currentUser: User | null;
  onRefresh: () => void;
  onOpenEmergencyCenter: () => void;
}

export const EmergencyBroadcastBanner: React.FC<EmergencyBroadcastBannerProps> = ({
  alerts,
  currentUser,
  onRefresh,
  onOpenEmergencyCenter,
}) => {
  const activeAlerts = alerts.filter((a) => a.isActive);
  const [dismissedLocally, setDismissedLocally] = useState<Record<string, boolean>>({});

  if (activeAlerts.length === 0) return null;

  // Super Admin and IT unit staff have authority to resolve the broadcast
  const isSuperAdminOrIT = authService.isSuperAdminOrIT(currentUser);

  // Staff cannot dismiss or close the broadcast banner locally
  const currentAlert = activeAlerts.find((a) => isSuperAdminOrIT ? !dismissedLocally[a.id] : true);
  if (!currentAlert) return null;

  const handleResolve = async () => {
    if (currentUser && isSuperAdminOrIT) {
      await emergencyService.resolveBroadcast(currentAlert.id, currentUser);
      onRefresh();
    }
  };

  const handleAcknowledgeITOnly = async () => {
    if (currentUser && isSuperAdminOrIT) {
      await emergencyService.acknowledgeAlert(currentAlert.id, currentUser.id);
      setDismissedLocally((prev) => ({ ...prev, [currentAlert.id]: true }));
      onRefresh();
    }
  };

  const codeColorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    CODE_BLUE_IT: {
      bg: 'bg-rose-950/95 dark:bg-rose-950/95 text-rose-100',
      border: 'border-rose-600',
      text: 'text-rose-200',
      badge: 'bg-rose-600 text-white animate-pulse',
    },
    CODE_RED_NETWORK: {
      bg: 'bg-amber-950/95 dark:bg-amber-950/95 text-amber-100',
      border: 'border-amber-500',
      text: 'text-amber-200',
      badge: 'bg-amber-500 text-slate-950 animate-pulse',
    },
    EHR_DOWNTIME: {
      bg: 'bg-sky-950/95 dark:bg-sky-950/95 text-sky-100',
      border: 'border-sky-500',
      text: 'text-sky-200',
      badge: 'bg-sky-500 text-white',
    },
    CYBER_LOCKDOWN: {
      bg: 'bg-purple-950/95 dark:bg-purple-950/95 text-purple-100',
      border: 'border-purple-600',
      text: 'text-purple-200',
      badge: 'bg-purple-600 text-white',
    },
    GENERAL_EMERGENCY: {
      bg: 'bg-red-950/95 dark:bg-red-950/95 text-red-100',
      border: 'border-red-600',
      text: 'text-red-200',
      badge: 'bg-red-600 text-white animate-pulse',
    },
  };

  const styles = codeColorMap[currentAlert.codeType] || codeColorMap.GENERAL_EMERGENCY;

  return (
    <div
      className={`sticky top-0 z-40 w-full border-b ${styles.bg} ${styles.border} px-4 py-2.5 shadow-xl transition-all animate-in slide-in-from-top-2 duration-200`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 rounded-md font-extrabold tracking-wider text-[10px] uppercase ${styles.badge} flex items-center gap-1`}>
              <Radio className="w-3 h-3" />
              {currentAlert.codeType.replace('_', ' ')}
            </span>
            <Volume2 className="w-4 h-4 text-rose-400 animate-bounce shrink-0" />
          </div>

          <div className="min-w-0">
            <div className="font-bold text-white text-xs truncate flex items-center gap-2">
              <span>{currentAlert.title}</span>
              <span className="text-[10px] opacity-75 font-normal">
                ({new Date(currentAlert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>
            <p className="text-[11px] opacity-90 truncate max-w-xl">{currentAlert.message}</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenEmergencyCenter}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-white/20"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Emergency IT Center</span>
          </button>

          {isSuperAdminOrIT ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResolve}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-sm border border-emerald-400/50"
                title="Mark Emergency Alert as Resolved (Ends Broadcast System-Wide)"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Resolve Alert</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-900/80 border border-rose-500/60 px-2.5 py-1 rounded-lg text-rose-100 text-[10px] font-bold shadow-xs">
              <Lock className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>MANDATORY BROADCAST — ACTIVE UNTIL IT RESOLUTION</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
