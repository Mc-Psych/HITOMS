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
  Sparkles,
  Camera,
  CheckCircle2,
  Lock,
  Unlock,
  Loader2,
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
  type EmergencyBroadcastAlert,
  type Department,
} from './types';
import { initializeSeedDataIfNeeded } from './services/seedData';
import { authService } from './services/authService';
import { integrityValidationService } from './services/integrityValidationService';
import { syncService, type SyncStats } from './services/syncService';
import { ticketService } from './services/ticketService';
import { assetService } from './services/assetService';
import { maintenanceService } from './services/maintenanceService';
import { incidentService } from './services/incidentService';
import { inventoryService } from './services/inventoryService';
import { networkService } from './services/networkService';
import { auditService } from './services/auditService';
import { emergencyService } from './services/emergencyService';
import { ticketSoundService } from './services/ticketSoundService';
import { settingsService } from './services/settingsService';
import { seedSnapshotService } from './services/seedSnapshotService';
import { departmentService } from './services/departmentService';
import { getAllFromStore, getFromStore } from './services/localDatabaseService';
import { aiTriageService } from './services/aiTriageService';
import { analyzeTicketPriority } from './utils/ticketPriorityAnalyzer';

function updateFavicon(logoSrc: string | null | undefined) {
  if (!logoSrc) return;
  try {
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logoSrc;
    
    // Also update apple-touch-icon if present
    let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (appleLink) {
      appleLink.href = logoSrc;
    }
  } catch (e) {
    console.warn('Failed to update favicon:', e);
  }
}

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
import { ScanQrToReportModal } from './components/ScanQrToReportModal';
import { EmergencyBroadcastBanner } from './components/EmergencyBroadcastBanner';
import { EmergencyProtocolCenterModal } from './components/EmergencyProtocolCenterModal';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [passwordChangeUser, setPasswordChangeUser] = useState<User | null>(null);

  // Global Scan QR to Report Modal state
  const [globalScanQrModalOpen, setGlobalScanQrModalOpen] = useState(false);
  const [preselectedAssetForTicket, setPreselectedAssetForTicket] = useState<Asset | null>(null);
  const [openTicketCreateModal, setOpenTicketCreateModal] = useState(false);

  // Core Data States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [hospitalSystems, setHospitalSystems] = useState<HospitalSystem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats>(syncService.getStats());
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // Super Admin flag
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Deduplicated and alphabetically sorted list of hospital departments
  const uniqueDepartments = React.useMemo(() => {
    if (!departments || departments.length === 0) return [];
    const map = new Map<string, Department>();
    for (const d of departments) {
      if (d.name && d.name.trim() && !map.has(d.name.trim())) {
        map.set(d.name.trim(), d);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [departments]);

  // Quick ticket creation modal triggerable from anywhere
  const [quickTicketOpen, setQuickTicketOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickPriority, setQuickPriority] = useState<Ticket['priority']>('High');
  const [quickCategory, setQuickCategory] = useState<Ticket['category']>('Hardware');
  const [quickDept, setQuickDept] = useState('Emergency');
  const [quickAssetTag, setQuickAssetTag] = useState('');
  const [isAiAnalyzingPriority, setIsAiAnalyzingPriority] = useState(false);
  const [aiPriorityAnalysis, setAiPriorityAnalysis] = useState<{
    priority: Ticket['priority'];
    reason: string;
    keywords?: string[];
  } | null>(null);
  const [allowPriorityOverride, setAllowPriorityOverride] = useState(false);
  const [isSubmittingQuickTicket, setIsSubmittingQuickTicket] = useState(false);
  const [quickTicketError, setQuickTicketError] = useState<string | null>(null);
  const [quickScanModalOpen, setQuickScanModalOpen] = useState(false);

  // Sync quickDept to available departments if not already matched
  useEffect(() => {
    if (uniqueDepartments.length > 0) {
      const exists = uniqueDepartments.some((d) => d.name === quickDept);
      if (!exists) {
        const defaultDept = uniqueDepartments.find(
          (d) =>
            d.name.toLowerCase().includes('emergency') ||
            d.name.toLowerCase().includes('opd') ||
            d.name.toLowerCase().includes('outpatient')
        );
        setQuickDept(defaultDept ? defaultDept.name : uniqueDepartments[0].name);
      }
    } else {
      setQuickDept('');
    }
  }, [uniqueDepartments]);

  // Emergency state
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyBroadcastAlert[]>([]);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  // Load all local data from IndexedDB
  const refreshAllData = useCallback(async () => {
    try {
      await authService.purgeOrphanedUserData();
      const [
        loadedTickets,
        loadedAssets,
        loadedMaintenance,
        loadedIncidents,
        loadedInventory,
        loadedDevices,
        loadedSystems,
        loadedDepartments,
        loadedAudit,
        loadedQueue,
        loadedLogs,
        loadedUsers,
        loadedSettings,
        loadedEmergency,
      ] = await Promise.all([
        ticketService.getTickets(),
        assetService.getAssets(),
        maintenanceService.getMaintenanceRecords(),
        incidentService.getIncidents(),
        inventoryService.getItems(),
        networkService.getDevices(),
        getAllFromStore<HospitalSystem>('hospitalSystems'),
        departmentService.getDepartments(),
        auditService.getAuditLogs(),
        syncService.getPendingQueue(),
        syncService.getSyncLogs(),
        getAllFromStore<User>('users'),
        settingsService.getSettings(),
        emergencyService.getActiveBroadcasts(),
      ]);

      setTickets(loadedTickets || []);
      setAssets(loadedAssets || []);
      setMaintenanceRecords(loadedMaintenance || []);
      setIncidents(loadedIncidents || []);
      setInventoryItems(loadedInventory || []);
      setNetworkDevices(loadedDevices || []);
      setHospitalSystems(loadedSystems || []);
      setDepartments(loadedDepartments || []);
      setAuditLogs(loadedAudit || []);
      setSyncQueue(loadedQueue || []);
      setSyncLogs(loadedLogs || []);
      setAllUsers(loadedUsers || []);
      setSystemSettings(loadedSettings || null);
      if (loadedSettings?.hospitalLogo) {
        updateFavicon(loadedSettings.hospitalLogo);
      }
      setEmergencyAlerts(loadedEmergency || []);

      const user = authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        // Check for 30-minute recurring ticket bell alerts for IT / Super Admin
        ticketSoundService.evaluateRecurring30MinAlerts(user).catch((e) => {
          console.warn('[App] Error evaluating ticket bell alerts:', e);
        });
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
        // Bi-directional sync with Firestore so fresh users, assets or updates from other users are fetched
        syncService.runAutomaticSync().catch((e) => console.warn('[App] Boot sync error:', e?.message));
      } catch (err) {
        console.error('Bootstrap error:', err);
      }
    };

    bootApp();

    // Start background periodic data integrity validation service
    integrityValidationService.startPeriodicValidation();

    // Start background 30-minute recurring ticket bell monitor for IT / Super Admin
    ticketSoundService.startRecurringBellMonitor(
      () => authService.getCurrentUser(),
      refreshAllData
    );

    const unsubSync = syncService.subscribe((stats) => {
      setSyncStats((prev) => {
        if (
          prev.connectionState === stats.connectionState &&
          prev.pendingCount === stats.pendingCount &&
          prev.failedCount === stats.failedCount &&
          prev.conflictsCount === stats.conflictsCount &&
          prev.simulatedOffline === stats.simulatedOffline
        ) {
          return prev;
        }
        return stats;
      });
      syncService.getPendingQueue().then((q) => {
        setSyncQueue((prev) => (prev.length === q.length ? prev : q));
      });
    });

    // Sync initial favicon update on startup from cached localStorage settings
    try {
      const cached = settingsService.getSettingsSync();
      if (cached?.hospitalLogo) {
        updateFavicon(cached.hospitalLogo);
      }
    } catch (e) {
      // ignore
    }

    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SystemSettings>;
      if (customEvent.detail) {
        setSystemSettings(customEvent.detail);
        if (customEvent.detail.hospitalLogo) {
          updateFavicon(customEvent.detail.hospitalLogo);
        }
      }
    };
    window.addEventListener('hitoms_settings_updated', handleSettingsUpdated);

    let refreshDebounce: any = null;
    const triggerDebouncedRefresh = () => {
      if (refreshDebounce) clearTimeout(refreshDebounce);
      refreshDebounce = setTimeout(() => {
        refreshAllData();
      }, 300);
    };

    const handleUsersSynced = () => {
      triggerDebouncedRefresh();
    };
    window.addEventListener('hitoms_users_synced', handleUsersSynced);

    const handleDataSynced = () => {
      triggerDebouncedRefresh();
    };
    window.addEventListener('hitoms_data_synced', handleDataSynced);

    const handleSystemsUpdated = () => {
      getAllFromStore<HospitalSystem>('hospitalSystems').then((sys) => {
        if (sys && sys.length > 0) {
          setHospitalSystems(sys);
        }
      });
      triggerDebouncedRefresh();
    };
    window.addEventListener('hitoms_systems_updated', handleSystemsUpdated);

    const handleDepartmentsUpdated = () => {
      departmentService.getDepartments().then((depts) => {
        setDepartments(depts || []);
      });
    };
    window.addEventListener('hitoms_departments_updated', handleDepartmentsUpdated);

    // Fast multi-tab & cross-user emergency broadcast listener
    const handleEmergencyUpdated = () => {
      emergencyService.getActiveBroadcasts().then((active) => {
        setEmergencyAlerts(active || []);
      });
    };
    window.addEventListener('hitoms_emergency_updated', handleEmergencyUpdated);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('hitoms_emergency_bus');
        bc.onmessage = () => {
          emergencyService.getActiveBroadcasts().then((active) => {
            setEmergencyAlerts(active || []);
          });
        };
      }
    } catch (e) {}

    // Background polling for hospital-wide emergency broadcasts across devices (stabilized)
    const emergencyInterval = setInterval(() => {
      emergencyService.getActiveBroadcasts().then((active) => {
        setEmergencyAlerts((prev) => {
          const prevAlerts = prev || [];
          const nextAlerts = active || [];
          if (prevAlerts.length !== nextAlerts.length) return nextAlerts;
          const prevKey = prevAlerts.map((a) => `${a.id}_${a.isActive}`).join(',');
          const nextKey = nextAlerts.map((a) => `${a.id}_${a.isActive}`).join(',');
          return prevKey === nextKey ? prev : nextAlerts;
        });
      }).catch(() => {});
    }, 6000);

    return () => {
      isMounted = false;
      if (refreshDebounce) clearTimeout(refreshDebounce);
      clearInterval(emergencyInterval);
      if (bc) bc.close();
      ticketSoundService.stopRecurringBellMonitor();
      unsubSync();
      window.removeEventListener('hitoms_settings_updated', handleSettingsUpdated);
      window.removeEventListener('hitoms_users_synced', handleUsersSynced);
      window.removeEventListener('hitoms_data_synced', handleDataSynced);
      window.removeEventListener('hitoms_systems_updated', handleSystemsUpdated);
      window.removeEventListener('hitoms_departments_updated', handleDepartmentsUpdated);
      window.removeEventListener('hitoms_emergency_updated', handleEmergencyUpdated);
    };
  }, [refreshAllData]);

  // Handle switching users for multi-role QA
  const handleSwitchUser = async (userOrId: string | User) => {
    const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
    const newUser = await authService.loginAs(userId);
    if (newUser) {
      setCurrentUser(newUser);
      const isSuperOrIT = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'].includes(newUser.role);
      if (!isSuperOrIT && ['admin', 'emergency', 'sync', 'backups'].includes(currentView)) {
        setCurrentView('dashboard');
      }
      if (isSuperOrIT) {
        ticketSoundService.requestNotificationPermission().catch(() => {});
      }
      await refreshAllData();
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentView('dashboard');
    setLoginModalOpen(true);
  };

  const handleLoginSuccess = async (user: User, mustChangePassword: boolean) => {
    setCurrentUser(user);
    const isSuperOrIT = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'].includes(user.role);
    if (!isSuperOrIT && ['admin', 'emergency', 'sync', 'backups'].includes(currentView)) {
      setCurrentView('dashboard');
    }
    if (isSuperOrIT) {
      ticketSoundService.requestNotificationPermission().catch(() => {});
    }
    setLoginModalOpen(false);
    await refreshAllData();
    if (mustChangePassword) {
      setPasswordChangeUser(user);
      setChangePasswordModalOpen(true);
    }
  };

  // Enforce role-based view guarding so logging in as staff resets restricted views
  useEffect(() => {
    if (!currentUser) {
      if (['admin', 'emergency', 'sync', 'backups'].includes(currentView)) {
        setCurrentView('dashboard');
      }
      return;
    }
    const isSuperOrIT = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'].includes(currentUser.role);
    if (!isSuperOrIT && ['admin', 'emergency', 'sync', 'backups'].includes(currentView)) {
      setCurrentView('dashboard');
    }
  }, [currentUser, currentView]);

  // Report issue directly for scanned or selected asset
  const handleReportIssueForAsset = (asset: Asset) => {
    setPreselectedAssetForTicket(asset);
    setCurrentView('tickets');
    setOpenTicketCreateModal(true);
  };

  // AI-Assisted Priority Assessment when user inputs Issue summary
  useEffect(() => {
    if (!quickTicketOpen) return;
    const titleTrimmed = quickTitle.trim();
    if (titleTrimmed.length < 3) {
      setAiPriorityAnalysis(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsAiAnalyzingPriority(true);
      try {
        // Immediate heuristic assessment for instant UI feedback
        const heuristic = analyzeTicketPriority(titleTrimmed, quickDesc, quickCategory);
        if (!isCancelled) {
          const heurPriority = (heuristic.priority === 'Critical' ? 'Critical' : heuristic.priority) as Ticket['priority'];
          setQuickPriority(heurPriority);
          setAiPriorityAnalysis({
            priority: heurPriority,
            reason: heuristic.reason,
            keywords: heuristic.matchedKeywords,
          });
        }

        // Server-side Gemini AI triage call for deep clinical urgency classification
        const aiRes = await aiTriageService.analyzeTicket({
          title: titleTrimmed,
          description: quickDesc,
          category: quickCategory,
          department: quickDept,
          assetTag: quickAssetTag,
        });

        if (!isCancelled && aiRes?.recommendedPriority) {
          const aiPriority = (aiRes.recommendedPriority === 'Critical' ? 'Critical' : aiRes.recommendedPriority) as Ticket['priority'];
          setQuickPriority(aiPriority);
          setAiPriorityAnalysis({
            priority: aiPriority,
            reason: aiRes.patientCareImpact || aiRes.riskSummary || heuristic.reason,
            keywords: heuristic.matchedKeywords,
          });
          if (
            aiRes.suggestedCategory &&
            ['LHIMS', 'Hardware', 'Network', 'Printer', 'Software', 'Power'].includes(aiRes.suggestedCategory)
          ) {
            setQuickCategory(aiRes.suggestedCategory as Ticket['category']);
          }
        }
      } catch (err) {
        console.warn('[QuickTicket] AI priority evaluation notice:', err);
      } finally {
        if (!isCancelled) {
          setIsAiAnalyzingPriority(false);
        }
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [quickTitle, quickCategory, quickDept, quickTicketOpen]);

  // Handler for QR / Barcode Scan inside Quick Log Modal
  const handleQuickScanAsset = async (asset: Asset, shouldLogImmediately: boolean = false) => {
    setQuickScanModalOpen(false);
    const summary = `Malfunction on ${asset.name} (${asset.assetTag})`;
    const dept = asset.department || quickDept || 'Outpatient';
    const cat = (['Hardware', 'Network', 'Printer', 'Software', 'Power', 'LHIMS'].includes(asset.assetType)
      ? asset.assetType
      : 'Hardware') as Ticket['category'];
    const desc = `Auto-identified via asset QR/Barcode scanner. Asset: ${asset.name} (${asset.assetTag}). Location: ${asset.location || dept}, Model: ${asset.model || 'Standard'}, Serial: ${asset.serialNumber || 'N/A'}`;

    setQuickTitle(summary);
    setQuickDept(dept);
    setQuickCategory(cat);
    setQuickDesc(desc);
    setQuickAssetTag(asset.assetTag);

    // AI assessment for priority
    const heuristic = analyzeTicketPriority(summary, desc, cat);
    let assignedPriority: Ticket['priority'] = heuristic.priority;
    let reason = heuristic.reason;

    try {
      const aiRes = await aiTriageService.analyzeTicket({
        title: summary,
        description: desc,
        category: cat,
        department: dept,
        assetTag: asset.assetTag,
      });
      if (aiRes?.recommendedPriority) {
        assignedPriority = (aiRes.recommendedPriority === 'Critical' ? 'Critical' : aiRes.recommendedPriority) as Ticket['priority'];
        reason = aiRes.patientCareImpact || aiRes.riskSummary || reason;
      }
    } catch (e) {}

    setQuickPriority(assignedPriority);
    setAiPriorityAnalysis({
      priority: assignedPriority,
      reason,
      keywords: heuristic.matchedKeywords,
    });

    if (shouldLogImmediately && currentUser) {
      try {
        await ticketService.createTicket(
          {
            title: summary,
            description: desc,
            priority: assignedPriority,
            category: cat,
            department: dept,
            location: asset.location || `${dept} Station`,
            assetId: asset.id,
          },
          currentUser
        );
        setQuickTicketOpen(false);
        setQuickTitle('');
        setQuickDesc('');
        setQuickAssetTag('');
        await refreshAllData();
        setCurrentView('tickets');
      } catch (err) {
        console.error('Failed to log scanned ticket immediately:', err);
      }
    }
  };

  // Quick ticket creation
  const handleQuickCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickTicketError(null);

    const titleTrimmed = quickTitle.trim();
    if (!titleTrimmed) {
      setQuickTicketError('Please enter an issue summary before submitting.');
      return;
    }

    // Determine active submitting user with local offline fallback
    let submitter = currentUser || authService.getCurrentUser();
    if (!submitter) {
      const activeFromAll = allUsers.find((u) => u.status === 'Active');
      if (activeFromAll) {
        submitter = activeFromAll;
      } else {
        submitter = {
          id: 'offline-duty-staff',
          fullName: 'Hospital Duty Staff',
          email: 'duty.staff@hospital.local',
          role: 'NURSE',
          department: quickDept || 'Emergency',
          status: 'Active',
          username: 'duty.staff',
          jobTitle: 'Station Duty Officer',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    setIsSubmittingQuickTicket(true);
    try {
      const matchedAsset = assets.find((a) => a.assetTag === quickAssetTag);
      const chosenDept = quickDept || (uniqueDepartments[0]?.name ?? 'Emergency');
      await ticketService.createTicket(
        {
          title: titleTrimmed,
          description: quickDesc.trim() || `Rapid ticket logged for ${chosenDept}`,
          priority: quickPriority,
          category: quickCategory,
          department: chosenDept,
          location: `${chosenDept} Station`,
          assetId: matchedAsset ? matchedAsset.id : null,
          aiTriage: aiPriorityAnalysis
            ? {
                recommendedPriority: aiPriorityAnalysis.priority,
                patientCareImpact: aiPriorityAnalysis.reason,
                suggestedCategory: quickCategory,
                riskSummary: aiPriorityAnalysis.reason,
                rootCauseHypothesis: 'Auto-triaged clinical issue report',
                immediateActionSteps: ['Dispatch to IT Technician on duty'],
                analyzedAt: new Date().toISOString(),
              }
            : null,
        },
        submitter
      );
      setQuickTicketOpen(false);
      setQuickTitle('');
      setQuickDesc('');
      setQuickAssetTag('');
      setAiPriorityAnalysis(null);
      setAllowPriorityOverride(false);
      await refreshAllData();
      setCurrentView('tickets');
    } catch (err: any) {
      console.error('Failed to log ticket locally:', err);
      setQuickTicketError(err?.message || 'Failed to submit ticket locally. Please try again.');
    } finally {
      setIsSubmittingQuickTicket(false);
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

  // Sync document title dynamically with system name & hospital name
  useEffect(() => {
    const sysName = systemSettings?.systemName || 'HITOMS';
    const hospName = systemSettings?.hospitalName || 'St. Mary Theresa Catholic Hospital';
    document.title = `${sysName} — ${hospName} | Hospital IT & Operations`;
  }, [systemSettings?.systemName, systemSettings?.hospitalName]);

  if (!initialized) {
    const cachedSettings = settingsService.getSettingsSync();
    const launchLogo = cachedSettings?.hospitalLogo;
    const sysName = cachedSettings?.systemName || 'HITOMS';
    const initial = sysName[0] || 'H';
    const lanUrl = cachedSettings?.hospitalLanUrl || `http://${sysName.toLowerCase()}.local:3000`;

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        {launchLogo ? (
          <img
            src={launchLogo}
            alt="Hospital Logo"
            className="w-16 h-16 object-contain rounded-2xl bg-white p-1.5 shadow-lg mb-4 animate-pulse"
          />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center font-black text-2xl animate-pulse shadow-lg mb-4">
            {initial}
          </div>
        )}
        <h2 className="text-lg font-bold text-slate-100">{sysName} Local Server</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing local hospital storage & offline database...</p>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
          <Server className="w-3.5 h-3.5" />
          <span>{lanUrl}</span>
        </div>
      </div>
    );
  }

  // Default page on load: Hospital Staff Login Screen when unauthenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 dark:bg-slate-950 text-slate-100 flex items-center justify-center p-4 antialiased">
        <LoginModal
          isOpen={true}
          onClose={() => {}}
          onLoginSuccess={handleLoginSuccess}
          allUsers={allUsers}
          systemSettings={systemSettings}
          allowClose={false}
        />
      </div>
    );
  }

  const openTicketsCount = (tickets || []).filter((t) => t.status !== 'Closed' && t.status !== 'Resolved').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased w-full max-w-full overflow-x-hidden">
      {/* Top Application Header */}
      <Header
        currentUser={currentUser}
        allUsers={allUsers}
        systemSettings={systemSettings}
        onSwitchUser={handleSwitchUser}
        onNavigate={setCurrentView}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenScanQrReport={() => setGlobalScanQrModalOpen(true)}
        onOpenEmergencyCenter={() => setEmergencyModalOpen(true)}
        onOpenChangePassword={() => setChangePasswordModalOpen(true)}
      />

      {/* Hospital Emergency Broadcast Banner */}
      <EmergencyBroadcastBanner
        alerts={emergencyAlerts}
        currentUser={currentUser}
        systemSettings={systemSettings}
        onRefresh={refreshAllData}
        onOpenEmergencyCenter={() => setEmergencyModalOpen(true)}
      />

      {/* Offline Status Simulation Notice */}
      {syncStats.simulatedOffline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 sm:px-4 py-2 text-xs text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="leading-snug">
              <span className="font-semibold">Simulated Outage Active: </span>
              <span className="text-amber-200">
                Operating 100% offline. All records are safely saved locally and will auto-sync once restored.
              </span>
            </div>
          </div>
          <button
            onClick={() => syncService.toggleSimulatedOffline()}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold transition cursor-pointer shrink-0 self-end sm:self-auto"
          >
            Restore Connection
          </button>
        </div>
      )}

      {/* Mobile Top bar */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between text-white w-full max-w-full">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-xs font-bold capitalize text-slate-200 truncate px-2">
          {currentView.replace(/([A-Z])/g, ' $1')}
        </div>
        <button
          onClick={() => setQuickTicketOpen(true)}
          className="p-1.5 rounded-lg bg-sky-600 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ticket</span>
        </button>
      </div>

      {/* Main Body Layout */}
      <div className="flex-1 flex overflow-hidden w-full max-w-full">
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
          onOpenChangePassword={() => setChangePasswordModalOpen(true)}
        />

        {/* Dynamic Content Canvas */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8 bg-slate-100/70 dark:bg-slate-950 w-full max-w-full">
          <div className="max-w-7xl mx-auto w-full">
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
                systemSettings={systemSettings}
                onNavigate={setCurrentView}
                onOpenCreateTicket={() => setQuickTicketOpen(true)}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'tickets' && (
              <TicketsView
                tickets={tickets}
                allUsers={allUsers}
                assets={assets}
                currentUser={currentUser}
                onRefresh={refreshAllData}
                openCreateModal={openTicketCreateModal}
                onCloseCreateModal={() => setOpenTicketCreateModal(false)}
                preselectedAssetForTicket={preselectedAssetForTicket}
                onClearPreselectedAsset={() => setPreselectedAssetForTicket(null)}
              />
            )}

            {currentView === 'assets' && (
              <AssetsView
                assets={assets}
                allUsers={allUsers}
                currentUser={currentUser}
                systemSettings={systemSettings}
                onRefresh={refreshAllData}
                onReportIssueForAsset={handleReportIssueForAsset}
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
                allUsers={allUsers}
                currentUser={currentUser}
                systemSettings={systemSettings}
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

            {(currentView === 'reports' || currentView === 'memos') && (
              <ReportsView
                tickets={tickets}
                assets={assets}
                maintenance={maintenanceRecords}
                incidents={incidents}
                inventory={inventoryItems}
                systemSettings={systemSettings}
                currentUser={currentUser}
                allUsers={allUsers}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'backups' && (
              <BackupsView
                currentUser={currentUser}
                systemSettings={systemSettings}
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
                systemSettings={systemSettings}
                onTriggerSync={async () => {
                  await syncService.runAutomaticSync();
                  await refreshAllData();
                }}
                onRefresh={refreshAllData}
              />
            )}

            {currentView === 'admin' && currentUser && ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'].includes(currentUser.role) && (
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
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-base">
                <LifeBuoy className="w-5 h-5 text-sky-600" />
                <span>Quick Log Hospital Ticket</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickScanModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-[11px] border border-purple-200 dark:border-purple-800 transition cursor-pointer"
                  title="Scan hardware asset QR code to auto-fill ticket details"
                >
                  <QrCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Scan Asset</span>
                </button>
                <button
                  onClick={() => setQuickTicketOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {quickTicketError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2 text-rose-800 dark:text-rose-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{quickTicketError}</div>
              </div>
            )}

            <form onSubmit={handleQuickCreateTicket} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-500 font-semibold">Issue Summary *</label>
                  {isAiAnalyzingPriority && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3 animate-spin text-amber-500" />
                      AI evaluating priority...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. ICU Monitor 3 Starlink connection offline"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                  />
                  {quickAssetTag && (
                    <span className="absolute right-2.5 top-2 px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-900/70 text-purple-800 dark:text-purple-200 text-[10px] font-mono font-bold">
                      Tag: {quickAssetTag}
                    </span>
                  )}
                </div>

                {/* AI Priority Live Intelligence Badge */}
                {aiPriorityAnalysis && (
                  <div className="mt-1.5 p-2 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 flex items-start gap-2 text-[11px] transition-all">
                    <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                    <div className="leading-tight flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-sky-900 dark:text-sky-200">
                          System AI Priority:
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wide ${
                            aiPriorityAnalysis.priority === 'Critical'
                              ? 'bg-rose-600 text-white'
                              : aiPriorityAnalysis.priority === 'High'
                              ? 'bg-amber-600 text-white'
                              : aiPriorityAnalysis.priority === 'Medium'
                              ? 'bg-sky-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {aiPriorityAnalysis.priority}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[10px] mt-1 font-medium">
                        {aiPriorityAnalysis.reason}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-500 font-semibold flex items-center gap-1">
                      <span>Priority</span>
                      {!allowPriorityOverride && (
                        <Lock className="w-3 h-3 text-slate-400" title="System determined - Locked" />
                      )}
                    </label>
                    {isSuperAdmin ? (
                      <button
                        type="button"
                        onClick={() => setAllowPriorityOverride((prev) => !prev)}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-0.5 cursor-pointer underline"
                        title="Super Admin Override: Click to enable manual editing of priority"
                      >
                        {allowPriorityOverride ? (
                          <>
                            <Unlock className="w-2.5 h-2.5 text-amber-600" />
                            <span>Unlock ON</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-2.5 h-2.5 text-slate-400" />
                            <span>Override</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> AI Locked
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={quickPriority}
                      disabled={!allowPriorityOverride}
                      onChange={(e) => setQuickPriority(e.target.value as Ticket['priority'])}
                      className={`w-full px-3 py-2 rounded-xl focus:outline-none transition ${
                        allowPriorityOverride
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 text-slate-900 dark:text-white cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed opacity-90'
                      }`}
                      title={
                        allowPriorityOverride
                          ? 'Super Admin Priority Override Active'
                          : 'Priority is determined automatically by the system and cannot be edited directly.'
                      }
                    >
                      <option value="Critical">Critical / Emergency</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-500 font-semibold">Hospital Ward / Department *</label>
                  <span className="text-[10px] text-slate-400">
                    {uniqueDepartments.length} Available
                  </span>
                </div>
                <select
                  value={quickDept}
                  onChange={(e) => setQuickDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  required
                >
                  {uniqueDepartments && uniqueDepartments.length > 0 ? (
                    uniqueDepartments.map((dept) => (
                      <option key={dept.id || dept.name} value={dept.name}>
                        {dept.name} {dept.code ? `(${dept.code})` : ''} {dept.floor ? `— Floor ${dept.floor}` : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Emergency / Casualty (A&E)">Emergency / Casualty (A&E)</option>
                      <option value="Intensive Care Unit (ICU)">Intensive Care Unit (ICU)</option>
                      <option value="Operating Theatre (OT)">Operating Theatre (OT)</option>
                      <option value="Laboratory (Pathology)">Laboratory (Pathology)</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Radiology / Imaging">Radiology / Imaging</option>
                      <option value="Pediatrics Ward">Pediatrics Ward</option>
                      <option value="Outpatient (OPD)">Outpatient (OPD)</option>
                      <option value="Internal Medicine / Male Ward">Internal Medicine / Male Ward</option>
                      <option value="Female Ward">Female Ward</option>
                      <option value="Maternity / Labour Ward">Maternity / Labour Ward</option>
                      <option value="Administration / Records">Administration / Records</option>
                    </>
                  )}
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
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickTicket}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold cursor-pointer transition shadow-xs text-xs flex items-center gap-2"
                >
                  {isSubmittingQuickTicket ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging Ticket...</span>
                    </>
                  ) : (
                    <span>Log Ticket Locally</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Ticket QR / Barcode Scanner Modal */}
      <ScanQrToReportModal
        isOpen={quickScanModalOpen}
        onClose={() => setQuickScanModalOpen(false)}
        assets={assets}
        onReportIssueForAsset={(asset) => handleQuickScanAsset(asset, false)}
      />

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
      {(passwordChangeUser || currentUser) && (
        <ChangePasswordModal
          isOpen={changePasswordModalOpen}
          user={passwordChangeUser || currentUser || undefined}
          onClose={() => setChangePasswordModalOpen(false)}
          onSuccess={() => {
            setChangePasswordModalOpen(false);
            refreshAllData();
          }}
          systemSettings={systemSettings}
        />
      )}

      {/* Global Scan QR to Report Modal */}
      <ScanQrToReportModal
        isOpen={globalScanQrModalOpen}
        onClose={() => setGlobalScanQrModalOpen(false)}
        assets={assets}
        onReportIssueForAsset={handleReportIssueForAsset}
      />

      {/* Emergency Protocol Center Modal */}
      <EmergencyProtocolCenterModal
        isOpen={emergencyModalOpen || currentView === 'emergency'}
        onClose={() => {
          setEmergencyModalOpen(false);
          if (currentView === 'emergency') setCurrentView('dashboard');
        }}
        currentUser={currentUser}
        alerts={emergencyAlerts}
        assets={assets}
        systemSettings={systemSettings}
        onRefresh={refreshAllData}
      />
    </div>
  );
}
