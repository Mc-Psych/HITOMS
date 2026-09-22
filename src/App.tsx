import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  QrCode,
  ShieldCheck,
  Server,
  AlertTriangle,
  LifeBuoy,
  X,
} from 'lucide-react';
import {
  type User,
  type Ticket,
  type Asset,
  type MaintenanceRecord,
  type Incident,
  type InventoryItem,
  type NetworkDevice,
  type HospitalSystem,
  type AuditLog,
  type SyncQueueItem,
  type SystemSettings,
} from './types';
import { initializeSeedDataIfNeeded } from './services/seedData';
import { authService } from './services/authService';
import { syncService, type SyncStats } from './services/syncService';
import { ticketService } from './services/ticketService';
import { assetService } from './services/assetService';
import { maintenanceService } from './services/maintenanceService';
import { incidentService } from './services/incidentService';
import { inventoryService } from './services/inventoryService';
import { networkService } from './services/networkService';
import { auditService } from './services/auditService';
import { getAllFromStore, getFromStore } from './services/localDatabaseService';

// Component Views
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { TicketsView } from './components/TicketsView';
import { AssetsView } from './components/AssetsView';
import { MaintenanceView } from './components/MaintenanceView';
import { HospitalSystemsView } from './components/HospitalSystemsView';
import { NetworkView } from './components/NetworkView';
import { IncidentsView } from './components/IncidentsView';
import { InventoryView } from './components/InventoryView';
import { ProcurementView } from './components/ProcurementView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { ReportsView } from './components/ReportsView';
import { BackupsView } from './components/BackupsView';
import { SyncDashboardView, type SyncLog } from './components/SyncDashboardView';
import { AdministrationView } from './components/AdministrationView';
import { AuditLogsView } from './components/AuditLogsView';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [passwordChangeUser, setPasswordChangeUser] = useState<User | null>(null);

  // Core Data States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [hospitalSystems, setHospitalSystems] = useState<HospitalSystem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats>(syncService.getStats());
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // Quick ticket creation modal triggerable from anywhere
  const [quickTicketOpen, setQuickTicketOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickPriority, setQuickPriority] = useState<Ticket['priority']>('High');
  const [quickCategory, setQuickCategory] = useState<Ticket['category']>('Hardware');
  const [quickDept, setQuickDept] = useState('Emergency');

  // Load all local data from IndexedDB
  const refreshAllData = useCallback(async () => {
    try {
      const [
        loadedTickets,
        loadedAssets,
        loadedMaintenance,
        loadedIncidents,
        loadedInventory,
        loadedDevices,
        loadedSystems,
        loadedAudit,
        loadedQueue,
        loadedLogs,
        loadedUsers,
        loadedSettings,
      ] = await Promise.all([
        ticketService.getTickets(),
        assetService.getAssets(),
        maintenanceService.getMaintenanceRecords(),
        incidentService.getIncidents(),
        inventoryService.getItems(),
        networkService.getDevices(),
        getAllFromStore<HospitalSystem>('hospitalSystems'),
        auditService.getAuditLogs(),
        syncService.getPendingQueue(),
        syncService.getSyncLogs(),
        getAllFromStore<User>('users'),
        getFromStore<SystemSettings>('settings', 'main'),
      ]);

      setTickets(loadedTickets || []);
      setAssets(loadedAssets || []);
      setMaintenanceRecords(loadedMaintenance || []);
      setIncidents(loadedIncidents || []);
      setInventoryItems(loadedInventory || []);
      setNetworkDevices(loadedDevices || []);
      setHospitalSystems(loadedSystems || []);
      setAuditLogs(loadedAudit || []);
      setSyncQueue(loadedQueue || []);
      setSyncLogs(loadedLogs || []);
      setAllUsers(loadedUsers || []);
      setSystemSettings(loadedSettings || null);

      const user = authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    } catch (err) {
      console.error('Failed to load local hospital data:', err);
    }
  }, []);

  // System Bootstrapping
  useEffect(() => {
    let isMounted = true;
    const bootApp = async () => {
      try {
        await initializeSeedDataIfNeeded();
        const user = await authService.init();
        if (isMounted) {
          setCurrentUser(user);
          await refreshAllData();
          setInitialized(true);
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      }
    };

    bootApp();

    const unsubSync = syncService.subscribe((stats) => {
      setSyncStats(stats);
      // Auto-refresh queue count when sync runs
      syncService.getPendingQueue().then(setSyncQueue);
    });

    return () => {
      isMounted = false;
      unsubSync();
    };
  }, [refreshAllData]);

  // Handle switching users for multi-role QA
  const handleSwitchUser = async (userOrId: string | User) => {
    const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
    const newUser = await authService.loginAs(userId);
    if (newUser) {
      setCurrentUser(newUser);
      await refreshAllData();
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setLoginModalOpen(true);
  };

  const handleLoginSuccess = async (user: User, mustChangePassword: boolean) => {
    setCurrentUser(user);
    setLoginModalOpen(false);
    await refreshAllData();
    if (mustChangePassword) {
      setPasswordChangeUser(user);
      setChangePasswordModalOpen(true);
    }
  };

  // Quick ticket creation
  const handleQuickCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !currentUser) return;

    try {
      await ticketService.createTicket(
        {
          title: quickTitle.trim(),
          description: quickDesc.trim() || 'Rapid ticket logged from emergency floating action',
          priority: quickPriority,
          category: quickCategory,
          department: quickDept,
          location: `${quickDept} Station`,
        },
        currentUser
      );
      setQuickTicketOpen(false);
      setQuickTitle('');
      setQuickDesc('');
      await refreshAllData();
      setCurrentView('tickets');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickTicketOpen) setQuickTicketOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickTicketOpen]);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center font-black text-2xl animate-pulse shadow-lg mb-4">
          H
        </div>
        <h2 className="text-lg font-bold text-slate-100">HITOMS Local Server</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing local hospital storage & offline database...</p>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
          <Server className="w-3.5 h-3.5" />
          <span>http://hitoms.local:3000</span>
        </div>
      </div>
    );
  }

  const openTicketsCount = (tickets || []).filter((t) => t.status !== 'Closed' && t.status !== 'Resolved').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Application Header */}
      <Header
        currentUser={currentUser}
        allUsers={allUsers}
        systemSettings={systemSettings}
        onSwitchUser={handleSwitchUser}
        onNavigate={setCurrentView}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Offline Status Simulation Notice */}
      {syncStats.simulatedOffline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold">Simulated Hospital ISP Outage Active:</span>
            <span className="text-amber-200">
              External internet / Starlink disconnected. All tickets, assets, maintenance, and stock mutations are safely stored in local IndexedDB and queued for cloud sync.
            </span>
          </div>
          <button
            onClick={() => syncService.toggleSimulatedOffline()}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold transition cursor-pointer shrink-0"
          >
            Restore Connection
          </button>
        </div>
      )}

      {/* Mobile Top bar */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-white">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-xs font-bold capitalize text-slate-200">
          {currentView.replace(/([A-Z])/g, ' $1')}
        </div>
        <button
          onClick={() => setQuickTicketOpen(true)}
          className="p-1.5 rounded-lg bg-sky-600 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ticket</span>
        </button>
      </div>

      {/* Main Body Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          currentUser={currentUser}
          systemSettings={systemSettings}
          pendingSyncCount={syncQueue.length}
          openTicketCount={openTicketsCount}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Dynamic Content Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-100/70 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && (
              <DashboardView
                tickets={tickets}
                assets={assets}
                maintenance={maintenanceRecords}
                maintenanceRecords={maintenanceRecords}
                incidents={incidents}
                inventory={inventoryItems}
                inventoryItems={inventoryItems}
                networkDevices={networkDevices}
                systems={hospitalSystems}
                hospitalSystems={hospitalSystems}
                auditLogs={auditLogs}
                syncQueue={syncQueue}
                currentUser={currentUser}
                onNavigate={setCurrentView}
                onOpenCreateTicket={() => setQuickTicketOpen(true)}
              />
            )}

            {currentView === 'tickets' && (
              <TicketsView
                tickets={tickets}
                allUsers={allUsers}
                assets={assets}
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'assets' && (
              <AssetsView
                assets={assets}
                allUsers={allUsers}
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'maintenance' && (
              <MaintenanceView
                maintenance={maintenanceRecords}
                maintenanceRecords={maintenanceRecords}
                assets={assets}
                allUsers={allUsers}
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'systems' && (
              <HospitalSystemsView
                systems={hospitalSystems}
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'network' && (
              <NetworkView
                devices={networkDevices}
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'incidents' && (
              <IncidentsView
                incidents={incidents}
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'inventory' && (
              <InventoryView
                inventory={inventoryItems}
                items={inventoryItems}
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'procurement' && (
              <ProcurementView
                currentUser={currentUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'knowledge' && (
              <KnowledgeBaseView
                currentUser={currentUser}
              />
            )}

            {currentView === 'reports' && (
              <ReportsView
                tickets={tickets}
                assets={assets}
                maintenance={maintenanceRecords}
                incidents={incidents}
                inventory={inventoryItems}
              />
            )}

            {currentView === 'backups' && (
              <BackupsView
                currentUser={currentUser}
                onRefresh={refreshAllData}
                onRestoreSuccess={refreshAllData}
              />
            )}

            {currentView === 'sync' && (
              <SyncDashboardView
                isOnline={syncStats.connectionState === 'ONLINE'}
                isSyncing={syncStats.connectionState === 'SYNCING'}
                syncQueue={syncQueue}
                syncLogs={syncLogs}
                onTriggerSync={async () => {
                  await syncService.runAutomaticSync();
                  await refreshAllData();
                }}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'admin' && (
              <AdministrationView
                currentUser={currentUser}
                allUsers={allUsers}
                onUserSwitch={handleSwitchUser}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'audit' && (
              <AuditLogsView
                auditLogs={auditLogs}
                onRefresh={refreshAllData}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Quick Ticket Button */}
      <button
        onClick={() => setQuickTicketOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xl hover:shadow-2xl transition cursor-pointer border border-sky-400/40"
        title="Quick Log Incident / Ticket (Operates 100% Offline)"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Log IT Ticket</span>
      </button>

      {/* Quick Ticket Modal */}
      {quickTicketOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setQuickTicketOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-base">
                <LifeBuoy className="w-5 h-5 text-sky-600" />
                <span>Quick Log Hospital Ticket</span>
              </div>
              <button
                onClick={() => setQuickTicketOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateTicket} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Issue Summary *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICU Monitor 3 Starlink connection offline"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Priority</label>
                  <select
                    value={quickPriority}
                    onChange={(e) => setQuickPriority(e.target.value as Ticket['priority'])}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Emergency">Critical / Emergency</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Category</label>
                  <select
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value as Ticket['category'])}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="LHIMS">LHIMS Clinical</option>
                    <option value="Hardware">Hardware / PC</option>
                    <option value="Network">Network / Starlink</option>
                    <option value="Printer">Printer / Scanner</option>
                    <option value="Software">Clinical Software</option>
                    <option value="Power">UPS / Power</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Hospital Ward / Department</label>
                <select
                  value={quickDept}
                  onChange={(e) => setQuickDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                >
                  <option value="Emergency">Emergency (A&E)</option>
                  <option value="Intensive Care Unit">Intensive Care Unit (ICU)</option>
                  <option value="Operating Theatre">Operating Theatre</option>
                  <option value="Laboratory">Laboratory</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Outpatient">Outpatient (OPD)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Clinical Impact Details</label>
                <textarea
                  rows={2}
                  placeholder="Describe patient care or operational disruption..."
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickTicketOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                >
                  Log Ticket Locally
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hospital Staff Login Screen Modal */}
      <LoginModal
        isOpen={loginModalOpen || currentUser === null}
        onClose={() => {
          if (currentUser !== null) {
            setLoginModalOpen(false);
          }
        }}
        onLoginSuccess={handleLoginSuccess}
        allUsers={allUsers}
        systemSettings={systemSettings}
        allowClose={currentUser !== null}
      />

      {/* Mandatory / Self-Service Change Password Modal */}
      {passwordChangeUser && (
        <ChangePasswordModal
          isOpen={changePasswordModalOpen}
          user={passwordChangeUser}
          onClose={() => setChangePasswordModalOpen(false)}
          onSuccess={() => {
            setChangePasswordModalOpen(false);
            refreshAllData();
          }}
          systemSettings={systemSettings}
        />
      )}
    </div>
  );
}
