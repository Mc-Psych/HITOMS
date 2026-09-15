import React, { useState, useEffect } from 'react';
import {
  Activity,
  Wifi,
  WifiOff,
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
} from 'lucide-react';
import { syncService, type SyncStats } from '../services/syncService';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { type User, type AppNotification, type SystemSettings } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentUser: User | null;
  allUsers: User[];
  systemSettings?: SystemSettings | null;
  onSwitchUser: (userId: string) => void;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  systemSettings,
  onSwitchUser,
  onNavigate,
}) => {
  const [syncStats, setSyncStats] = useState<SyncStats>(syncService.getStats());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

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

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  const handleToggleOfflineSimulation = () => {
    syncService.toggleSimulatedOffline();
  };

  const handleSyncNow = async () => {
    await syncService.runAutomaticSync();
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Left: Brand + Hospital LAN Info */}
        <div className="flex items-center gap-3">
          {systemSettings?.hospitalLogo ? (
            <img
              src={systemSettings.hospitalLogo}
              alt="Facility Logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 shadow-sm border border-slate-700"
            />
          ) : (
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-600 text-white font-black text-base shadow-sm">
              H
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                {systemSettings?.hospitalName ? systemSettings.hospitalName : 'HITOMS'}
              </span>
              <span className="hidden md:inline-block text-[10px] font-semibold uppercase tracking-wider bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded-full">
                Offline-First Hospital Ops
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Server className="w-3 h-3 text-emerald-400" />
              <span className="font-mono text-emerald-300">http://hitoms.local</span>
              <span className="text-slate-600">|</span>
              <span className="hidden sm:inline">
                {systemSettings?.regionOrDistrict ? `${systemSettings.regionOrDistrict} Facility` : 'Hospital LAN Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Connectivity Indicator (Section 18) + Mode Toggle */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Permanent Connectivity Status Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
            {syncStats.connectionState === 'ONLINE' && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold">Online</span>
                <span className="hidden lg:inline text-slate-400">| Cloud Synced</span>
              </div>
            )}

            {syncStats.connectionState === 'OFFLINE' && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-semibold">Offline</span>
                <span className="text-xs text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                  {syncStats.pendingCount} pending sync
                </span>
              </div>
            )}

            {syncStats.connectionState === 'SYNCING' && (
              <div className="flex items-center gap-1.5 text-sky-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span className="font-semibold">Synchronizing...</span>
              </div>
            )}

            {syncStats.connectionState === 'SYNC_ERROR' && (
              <div className="flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold">Sync Error</span>
                <span className="text-xs text-rose-300 bg-rose-950 px-1 rounded">
                  {syncStats.failedCount} failed
                </span>
              </div>
            )}

            {/* Manual Sync Trigger */}
            <button
              id="sync-now-btn"
              onClick={handleSyncNow}
              disabled={syncStats.connectionState === 'OFFLINE' || syncStats.connectionState === 'SYNCING'}
              className="ml-1 text-slate-400 hover:text-white disabled:opacity-30 transition cursor-pointer p-0.5"
              title="Trigger Immediate Synchronization"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStats.connectionState === 'SYNCING' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Test Tool: Toggle Simulated Offline/Online */}
          <button
            id="toggle-offline-mode-btn"
            onClick={handleToggleOfflineSimulation}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              syncStats.simulatedOffline
                ? 'bg-amber-500/20 text-amber-300 border-amber-600 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Simulate complete hospital external internet failure to verify local-first operation"
          >
            {syncStats.simulatedOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Simulating Outage</span>
                <span className="md:hidden">Offline</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Simulate Outage</span>
                <span className="md:hidden">Simulate</span>
              </>
            )}
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Notifications Center */}
          <div className="relative">
            <button
              id="notifications-toggle-btn"
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Hospital IT Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 z-50 text-slate-200">
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

          {/* Quick User & Role Switcher for QA & Testing */}
          <div className="relative">
            <button
              id="user-role-switcher-btn"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-700 text-white flex items-center justify-center font-bold text-xs">
                {currentUser?.fullName.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block text-xs">
                <div className="font-semibold text-white leading-tight">{currentUser?.fullName}</div>
                <div className="text-[10px] text-sky-400 font-mono">{currentUser?.role.replace('_', ' ')}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Switch Hospital Role</p>
                  <p className="text-[11px] text-slate-500">Test multi-role permissions & workflows</p>
                </div>
                <div className="mt-1 max-h-72 overflow-y-auto space-y-1">
                  {allUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onSwitchUser(u.id);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                        currentUser?.id === u.id
                          ? 'bg-sky-900/60 text-sky-200 border border-sky-700'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{u.fullName}</div>
                        <div className="text-[10px] text-slate-400">{u.department} - <span className="text-sky-300">{u.role}</span></div>
                      </div>
                      {currentUser?.id === u.id && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
