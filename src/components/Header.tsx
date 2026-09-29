import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  RefreshCw,
  AlertCircle,
  Bell,
  CheckCircle2,
  Server,
  UserCheck,
  ChevronDown,
  ShieldCheck,
  Building,
  HelpCircle,
  LogIn,
  LogOut,
  KeyRound,
  Lock,
  QrCode,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { syncService, type SyncStats } from '../services/syncService';
import { authService, getUserInitials } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { ticketSoundService } from '../services/ticketSoundService';
import { type User, type AppNotification, type SystemSettings } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentUser: User | null;
  allUsers: User[];
  systemSettings?: SystemSettings | null;
  onSwitchUser: (userId: string) => void;
  onNavigate: (view: string) => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onOpenScanQrReport?: () => void;
  onOpenEmergencyCenter?: () => void;
  onOpenChangePassword?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  systemSettings,
  onSwitchUser,
  onNavigate,
  onOpenLoginModal,
  onLogout,
  onOpenScanQrReport,
  onOpenEmergencyCenter,
  onOpenChangePassword,
}) => {
  const [syncStats, setSyncStats] = useState<SyncStats>(syncService.getStats());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(ticketSoundService.isMuted());

  const handleToggleMute = () => {
    const nextMute = !isAudioMuted;
    ticketSoundService.setMuted(nextMute);
    setIsAudioMuted(nextMute);
    if (!nextMute) {
      ticketSoundService.playBellRingtone(false, 2);
    }
  };

  const isSuperAdminOrIT = authService.isSuperAdminOrIT(currentUser);

  const notifsRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = syncService.subscribe((stats) => {
      setSyncStats(stats);
    });

    const loadNotifs = async () => {
      const items = await notificationService.getNotifications(currentUser?.id);
      setNotifications(items || []);
    };
    loadNotifs();

    return () => unsub();
  }, [currentUser]);

  // Click outside to close notifications and role menu dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifs(false);
        setShowRoleMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  const handleSyncNow = async () => {
    await syncService.runAutomaticSync();
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-md w-full max-w-full overflow-visible">
      <div className="flex items-center justify-between px-2.5 sm:px-4 md:px-6 py-2 gap-2 sm:gap-4 w-full">
        {/* Left: Brand + Hospital LAN Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          {systemSettings?.hospitalLogo ? (
            <img
              src={systemSettings.hospitalLogo}
              alt="Facility Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-white p-0.5 shadow-sm border border-slate-700 shrink-0"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-600 text-white font-black text-sm sm:text-base shadow-sm shrink-0">
              {(systemSettings?.systemName || 'HITOMS')[0]}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-xs sm:text-sm md:text-base tracking-wide text-white truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none">
                {systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital'}
              </span>
              <span className="hidden lg:inline-block text-[10px] font-semibold uppercase tracking-wider bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded-full shrink-0">
                Offline-First Ops
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
              <Server className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="font-mono text-emerald-300 text-[10px] sm:text-[11px]">
                {systemSettings?.hospitalLanUrl
                  ? systemSettings.hospitalLanUrl.replace(/^https?:\/\//, '')
                  : `${(systemSettings?.systemName || 'hitoms').toLowerCase()}.local`}
              </span>
              <span className="text-slate-600">|</span>
              <span className="hidden md:inline truncate">
                {systemSettings?.regionOrDistrict ? `${systemSettings.regionOrDistrict} Facility` : 'Hospital LAN Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Connectivity Indicator + Notifications + User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Connectivity Status Bar */}
          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs shrink-0">
            {syncStats.connectionState === 'ONLINE' && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-[11px] sm:text-xs">Online</span>
                <span className="hidden xl:inline text-slate-400">| Synced</span>
              </div>
            )}

            {syncStats.connectionState === 'OFFLINE' && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-semibold text-[11px] sm:text-xs">Offline</span>
                {syncStats.pendingCount > 0 && (
                  <span className="text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/60">
                    {syncStats.pendingCount}
                  </span>
                )}
              </div>
            )}

            {syncStats.connectionState === 'SYNCING' && (
              <div className="flex items-center gap-1.5 text-sky-400">
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin text-sky-400" />
                <span className="font-semibold text-[11px] sm:text-xs">Syncing</span>
              </div>
            )}

            {syncStats.connectionState === 'SYNC_ERROR' && (
              <div className="flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400" />
                <span className="font-semibold text-[11px] sm:text-xs">Error</span>
              </div>
            )}

            {/* Manual Sync Trigger */}
            <button
              id="sync-now-btn"
              onClick={handleSyncNow}
              disabled={syncStats.connectionState === 'OFFLINE' || syncStats.connectionState === 'SYNCING'}
              className="ml-0.5 text-slate-400 hover:text-white disabled:opacity-30 transition cursor-pointer p-0.5"
              title="Trigger Immediate Synchronization"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${syncStats.connectionState === 'SYNCING' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* PWA Install Button */}
          <div className="shrink-0">
            <PWAInstallButton />
          </div>

          {/* Scan QR to Report Button */}
          {onOpenScanQrReport && (
            <button
              id="scan-qr-report-btn"
              onClick={onOpenScanQrReport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm hover:shadow"
              title="Scan QR Code to Report Asset Issue"
            >
              <QrCode className="w-4 h-4 text-white" />
              <span className="hidden md:inline">Scan QR</span>
            </button>
          )}

          {/* Emergency IT Protocol Center Button - IT Unit & Super Admin only */}
          {onOpenEmergencyCenter && isSuperAdminOrIT && (
            <button
              id="emergency-center-btn"
              onClick={onOpenEmergencyCenter}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm hover:shadow border border-rose-500/50"
              title="Hospital IT Emergency & Disaster Protocol Center"
            >
              <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
              <span className="hidden lg:inline">Emergency IT</span>
            </button>
          )}

          {/* Notifications Center */}
          <div className="relative shrink-0" ref={notifsRef}>
            <button
              id="notifications-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowNotifs((prev) => !prev);
              }}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer text-xs font-semibold"
              title="Hospital IT Notifications"
            >
              <Bell className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-72 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3 sm:p-4 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">
                    Notifications ({notifications.length})
                  </span>
                  {notifications.length > 0 && (
                    <button
                      onClick={async () => {
                        await notificationService.clearAll();
                        setNotifications([]);
                      }}
                      className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="mt-2 max-h-72 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          await notificationService.markAsRead(n.id);
                          setNotifications(await notificationService.getNotifications(currentUser?.id));
                          if (n.module === 'Tickets' && n.linkId) onNavigate('tickets');
                          if (n.module === 'Maintenance' && n.linkId) onNavigate('maintenance');
                          if (n.module === 'Incidents' && n.linkId) onNavigate('incidents');
                        }}
                        className={`p-2.5 rounded-xl text-xs border transition cursor-pointer ${
                          n.isRead
                            ? 'bg-slate-800/40 border-slate-800 text-slate-400'
                            : 'bg-slate-800 border-slate-700 text-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sky-300">{n.title}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-300 leading-snug">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Audio Bell Sound Toggle Button */}
          <button
            id="bell-mute-toggle-btn"
            onClick={handleToggleMute}
            className={`flex items-center justify-center p-2.5 rounded-xl border transition cursor-pointer text-xs font-semibold shrink-0 ${
              isAudioMuted
                ? 'bg-rose-950/40 border-rose-900/60 text-rose-400 hover:bg-rose-900/40'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title={isAudioMuted ? "Ringtone Muted (Click to Unmute Notification Bell)" : "Ringtone Active (Click to Mute Notification Bell)"}
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            )}
          </button>

          {/* User Profile & Role Switcher */}
          <div className="relative shrink-0" ref={roleMenuRef}>
            <button
              id="user-role-switcher-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowRoleMenu((prev) => !prev);
              }}
              className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
              title={`Logged in as ${currentUser?.fullName || 'Staff'} (${currentUser?.role?.replace('_', ' ') || ''})`}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-700 text-white flex items-center justify-center font-bold text-xs tracking-wider shrink-0">
                {getUserInitials(currentUser?.fullName || '')}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[90vw] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Profile Card (Switch Hospital Role is Disabled) */}
                <div className="px-3 py-2.5 border-b border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">User Profile & Role</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      Switching Disabled
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                      {getUserInitials(currentUser?.fullName || '')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-white truncate">{currentUser?.fullName}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {currentUser?.department} • <span className="text-sky-300 font-semibold">{currentUser?.role?.replace('_', ' ')}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        @{currentUser?.username || ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password & Sign Out Footer */}
                <div className="pt-2 mt-1 space-y-1">
                  {onOpenChangePassword && currentUser && (
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        onOpenChangePassword();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:bg-amber-950/60 hover:text-amber-200 transition cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Change My Password</span>
                    </button>
                  )}

                  {onLogout && (
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Lock & Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
