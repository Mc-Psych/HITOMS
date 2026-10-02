import React, { useState, useEffect } from 'react';
import { Radio, AlertOctagon, Volume2, ShieldAlert, CheckCircle } from 'lucide-react';
import { type EmergencyBroadcastAlert, type User, type SystemSettings } from '../types';

interface EmergencyBroadcastBannerProps {
  alerts: EmergencyBroadcastAlert[];
  currentUser?: User | null;
  systemSettings?: SystemSettings | null;
  onRefresh?: () => void;
  onOpenEmergencyCenter?: () => void;
}

export const EmergencyBroadcastBanner: React.FC<EmergencyBroadcastBannerProps> = ({
  alerts,
  currentUser,
  systemSettings,
  onRefresh,
}) => {
  const [speedSeconds, setSpeedSeconds] = useState<number>(
    systemSettings?.emergencyBroadcastSpeedSeconds || 22
  );
  const [isResolving, setIsResolving] = useState(false);

  const isSuperAdminOrIT =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'IT_ADMIN' ||
    currentUser?.role === 'IT_OFFICER';

  useEffect(() => {
    if (systemSettings?.emergencyBroadcastSpeedSeconds) {
      setSpeedSeconds(systemSettings.emergencyBroadcastSpeedSeconds);
    }
  }, [systemSettings?.emergencyBroadcastSpeedSeconds]);

  // Listen to live system settings updates across app
  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SystemSettings>;
      if (customEvent.detail?.emergencyBroadcastSpeedSeconds) {
        setSpeedSeconds(customEvent.detail.emergencyBroadcastSpeedSeconds);
      }
    };
    window.addEventListener('hitoms_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('hitoms_settings_updated', handleSettingsUpdated);
    };
  }, []);

  const activeAlerts = alerts.filter((a) => a.isActive);
  if (activeAlerts.length === 0) return null;

  const currentAlert = activeAlerts[0];
  if (!currentAlert) return null;

  const handleResolve = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentAlert || !currentUser || !isSuperAdminOrIT || isResolving) return;
    setIsResolving(true);
    try {
      const { emergencyService } = await import('../services/emergencyService');
      await emergencyService.resolveBroadcast(currentAlert.id, currentUser);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to resolve broadcast from banner:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const codeColorMap: Record<string, { bg: string; border: string; text: string; badge: string; accent: string }> = {
    CODE_BLUE_IT: {
      bg: 'bg-rose-950/95 dark:bg-rose-950/95 text-rose-100',
      border: 'border-rose-600',
      text: 'text-rose-200',
      badge: 'bg-rose-600 text-white',
      accent: 'text-rose-400',
    },
    CODE_RED_NETWORK: {
      bg: 'bg-amber-950/95 dark:bg-amber-950/95 text-amber-100',
      border: 'border-amber-500',
      text: 'text-amber-200',
      badge: 'bg-amber-500 text-slate-950',
      accent: 'text-amber-400',
    },
    EHR_DOWNTIME: {
      bg: 'bg-sky-950/95 dark:bg-sky-950/95 text-sky-100',
      border: 'border-sky-500',
      text: 'text-sky-200',
      badge: 'bg-sky-500 text-white',
      accent: 'text-sky-400',
    },
    CYBER_LOCKDOWN: {
      bg: 'bg-purple-950/95 dark:bg-purple-950/95 text-purple-100',
      border: 'border-purple-600',
      text: 'text-purple-200',
      badge: 'bg-purple-600 text-white',
      accent: 'text-purple-400',
    },
    GENERAL_EMERGENCY: {
      bg: 'bg-red-950/95 dark:bg-red-950/95 text-red-100',
      border: 'border-red-600',
      text: 'text-red-200',
      badge: 'bg-red-600 text-white',
      accent: 'text-red-400',
    },
  };

  const styles = codeColorMap[currentAlert.codeType] || codeColorMap.GENERAL_EMERGENCY;
  const timeFormatted = new Date(currentAlert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Alert payload block with badge and text
  const renderAlertPayload = (key: number) => (
    <div key={key} className="inline-flex items-center gap-4 px-6 select-none shrink-0">
      {/* Code Badge */}
      <span className={`px-2.5 py-0.5 rounded-md font-black tracking-wider text-[11px] uppercase ${styles.badge} flex items-center gap-1.5 shadow-xs`}>
        <Radio className="w-3.5 h-3.5 animate-pulse" />
        <span>{currentAlert.codeType.replace('_', ' ')}</span>
      </span>

      {/* Broadcast Title */}
      <span className="font-extrabold text-white text-xs uppercase tracking-wide flex items-center gap-1.5">
        <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>{currentAlert.title}</span>
      </span>

      {/* Message */}
      <span className="text-white/90 text-xs font-semibold">
        {currentAlert.message}
      </span>

      {/* Timestamp */}
      <span className="text-[11px] font-mono text-white/70">
        [{timeFormatted}]
      </span>

      {/* Target units */}
      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 uppercase tracking-wider">
        Target: {currentAlert.targetUnits?.join(', ') || 'ALL HOSPITAL WARDS'}
      </span>

      {/* Flashing audio icon indicator */}
      <Volume2 className={`w-3.5 h-3.5 ${styles.accent} animate-bounce shrink-0`} />

      <span className="text-white/40 font-bold text-xs px-2">✦✦✦</span>
    </div>
  );

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`sticky top-0 z-40 w-full border-b ${styles.bg} ${styles.border} py-2 shadow-xl overflow-hidden select-none`}
    >
      <div className="relative w-full overflow-hidden flex items-center">
        {/* Static left icon pill (non-clickable) */}
        <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-xs border-r ${styles.border} text-white text-[11px] font-black uppercase tracking-wider shrink-0 z-10 shadow-md`}>
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>EMERGENCY BROADCAST</span>
        </div>

        {/* Looping motion from left to right track */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className="animate-broadcast-ltr flex items-center whitespace-nowrap"
            style={{ animationDuration: `${speedSeconds}s` }}
          >
            {renderAlertPayload(1)}
            {renderAlertPayload(2)}
            {renderAlertPayload(3)}
          </div>
        </div>

        {/* Right Actions & Status Pill */}
        <div className="flex items-center gap-2 pr-3 z-10 shrink-0">
          {isSuperAdminOrIT && (
            <button
              type="button"
              onClick={handleResolve}
              disabled={isResolving}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg shadow-md cursor-pointer transition disabled:opacity-50"
              title="Resolve this emergency alert hospital-wide"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{isResolving ? 'Resolving...' : 'Resolve Alert'}</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-xs border-l border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span>HOSPITAL-WIDE ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
