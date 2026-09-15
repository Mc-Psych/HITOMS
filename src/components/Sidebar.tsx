import React from 'react';
import {
  LayoutDashboard,
  LifeBuoy,
  HardDrive,
  CalendarCheck,
  Network,
  Activity,
  Flame,
  Package,
  ShoppingCart,
  DatabaseBackup,
  BookOpen,
  FileBarChart2,
  Settings,
  ShieldAlert,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { type Role, type User, type SystemSettings } from '../types';
import { authService } from '../services/authService';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  rolesAllowed?: Role[];
  badgeCount?: number;
}

interface SidebarProps {
  currentView: string;
  onNavigate: (viewId: string) => void;
  currentUser: User | null;
  systemSettings?: SystemSettings | null;
  pendingSyncCount?: number;
  openTicketCount?: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  systemSettings,
  pendingSyncCount = 0,
  openTicketCount = 0,
  mobileOpen,
  onCloseMobile,
}) => {
  const role = currentUser?.role || 'STAFF_USER';

  // Navigation Items mapped to roles
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Operations Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'tickets',
      label: 'Help Desk / Tickets',
      icon: LifeBuoy,
      badgeCount: openTicketCount,
    },
    {
      id: 'assets',
      label: 'IT Assets & QR',
      icon: HardDrive,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD', 'PROCUREMENT_OFFICER', 'AUDITOR'],
    },
    {
      id: 'maintenance',
      label: 'Preventive Maintenance',
      icon: CalendarCheck,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'AUDITOR'],
    },
    {
      id: 'systems',
      label: 'Hospital Systems (LHIMS)',
      icon: Activity,
    },
    {
      id: 'network',
      label: 'Network & Topology',
      icon: Network,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'AUDITOR'],
    },
    {
      id: 'incidents',
      label: 'Major Incidents & RCA',
      icon: Flame,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'AUDITOR'],
    },
    {
      id: 'inventory',
      label: 'Consumables Inventory',
      icon: Package,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'PROCUREMENT_OFFICER', 'AUDITOR'],
    },
    {
      id: 'procurement',
      label: 'IT Procurement',
      icon: ShoppingCart,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD', 'PROCUREMENT_OFFICER', 'AUDITOR'],
    },
    {
      id: 'knowledge',
      label: 'Knowledge Base',
      icon: BookOpen,
    },
    {
      id: 'reports',
      label: 'Local Reports & Export',
      icon: FileBarChart2,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD', 'PROCUREMENT_OFFICER', 'AUDITOR'],
    },
    {
      id: 'backups',
      label: 'Local Backups & Restore',
      icon: DatabaseBackup,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN'],
    },
    {
      id: 'sync',
      label: 'Sync Dashboard',
      icon: RefreshCw,
      badgeCount: pendingSyncCount > 0 ? pendingSyncCount : undefined,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'],
    },
    {
      id: 'admin',
      label: 'Administration & RBAC',
      icon: Settings,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN'],
    },
    {
      id: 'audit',
      label: 'System Audit Logs',
      icon: ShieldAlert,
      rolesAllowed: ['SUPER_ADMIN', 'AUDITOR'],
    },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.rolesAllowed) return true;
    return item.rolesAllowed.includes(role);
  });

  const content = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-64 text-slate-300">
      {/* Hospital Identity Header inside Sidebar */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        {systemSettings?.hospitalLogo ? (
          <img
            src={systemSettings.hospitalLogo}
            alt="Hospital Logo"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-700 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-black text-sm shrink-0">
            H
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hospital Facility</div>
          <div className="text-xs font-extrabold text-white mt-0.5 truncate">
            {systemSettings?.hospitalName || 'St. Jude General Hospital'}
          </div>
          <div className="text-[10px] text-sky-400 mt-0.5 flex items-center gap-1.5 font-medium truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0"></span>
            <span className="truncate">{systemSettings?.regionOrDistrict || 'Local Node: HITOMS-01'}</span>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badgeCount !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-white text-sky-700'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Status Footer */}
      <div className="p-3 border-t border-slate-800 text-[11px] bg-slate-950/50">
        <div className="text-slate-400">Signed In As</div>
        <div className="font-semibold text-slate-200 truncate">{currentUser?.fullName}</div>
        <div className="text-sky-400 font-mono text-[10px] mt-0.5">{currentUser?.department}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block shrink-0">{content}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
};
