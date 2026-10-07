import React, { useState } from 'react';
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
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
  KeyRound,
} from 'lucide-react';
import { type Role, type User, type SystemSettings } from '../types';
import { authService, getUserInitials } from '../services/authService';
import { PWAInstallButton } from './PWAInstallButton';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenChangePassword?: () => void;
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
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
  onOpenChangePassword,
}) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalIsCollapsed(!internalIsCollapsed);
    }
  };

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
      label: 'Hospital Systems',
      icon: Activity,
    },
    {
      id: 'network',
      label: 'Network & Topology',
      icon: Network,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'],
    },
    {
      id: 'incidents',
      label: 'Major Incidents & RCA',
      icon: Flame,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'AUDITOR'],
    },
    {
      id: 'emergency',
      label: 'Emergency Protocols & Alerts',
      icon: ShieldAlert,
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'],
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
      rolesAllowed: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD', 'PROCUREMENT_OFFICER', 'AUDITOR'],
    },
    {
      id: 'knowledge',
      label: 'Basic & Troubleshooting',
      icon: BookOpen,
    },
    {
      id: 'reports',
      label:
        role === 'SUPER_ADMIN' || role === 'IT_ADMIN' || role === 'IT_OFFICER'
          ? 'Memos & Reports'
          : 'Operations & Data Reports',
      icon: FileBarChart2,
      rolesAllowed: [
        'SUPER_ADMIN',
        'IT_ADMIN',
        'IT_OFFICER',
        'HOSPITAL_MANAGEMENT',
        'DEPARTMENT_HEAD',
        'PROCUREMENT_OFFICER',
        'AUDITOR',
      ],
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
    <div
      className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-200 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Collapse / Expand Header Bar */}
      <div className="p-2.5 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2 pl-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              {systemSettings?.systemName || 'HITOMS'} Ops
            </span>
          </div>
        )}
        <button
          onClick={handleToggle}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronsRight className="w-4 h-4 text-sky-400" />
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
              <ChevronsLeft className="w-4 h-4" />
            </div>
          )}
        </button>
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
              title={isCollapsed ? item.label : undefined}
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center rounded-xl text-xs font-medium transition cursor-pointer relative ${
                isCollapsed
                  ? 'justify-center p-2.5'
                  : 'justify-between px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>

              {item.badgeCount !== undefined && (
                isCollapsed ? (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                ) : (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isActive
                        ? 'bg-white text-sky-700'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      {/* PWA Install Banner */}
      {!isCollapsed && (
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/80">
          <PWAInstallButton variant="sidebar" />
        </div>
      )}

      {/* User Status Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        {isCollapsed ? (
          <div
            onClick={onOpenChangePassword}
            className="w-8 h-8 mx-auto rounded-lg bg-sky-700 hover:bg-sky-600 text-white flex items-center justify-center font-bold text-xs tracking-wider cursor-pointer shadow-sm transition"
            title={`${currentUser?.fullName} (${currentUser?.role}) - Click to Change Password`}
          >
            {getUserInitials(currentUser?.fullName || '')}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0 tracking-wider">
                {getUserInitials(currentUser?.fullName || '')}
              </div>
              <div className="min-w-0 flex-1 text-[11px]">
                <div className="font-semibold text-slate-200 truncate">{currentUser?.fullName}</div>
                <div className="text-sky-400 font-mono text-[10px] truncate">{currentUser?.department}</div>
              </div>
            </div>

            {onOpenChangePassword && (
              <button
                type="button"
                onClick={onOpenChangePassword}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 transition cursor-pointer shrink-0"
                title="Change My Password"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
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
