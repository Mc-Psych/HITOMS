import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  Copy,
  Check,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  X,
  Sparkles,
  Layers,
  Building,
  Calendar,
  RefreshCw,
  Server,
  Cloud,
  ExternalLink,
} from 'lucide-react';
import {
  type SoftwareSubscription,
  type SubscriptionCategory,
  type SubscriptionBillingCycle,
  type SubscriptionStatus,
  type User as UserType,
} from '../types';
import { assetService } from '../services/assetService';
import { authService } from '../services/authService';
import { departmentService } from '../services/departmentService';

interface SoftwareSubscriptionsTabProps {
  currentUser: UserType | null;
  onRefreshParent?: () => void;
}

const CATEGORIES: { label: string; value: SubscriptionCategory | 'ALL'; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'All Software & Licenses', value: 'ALL', icon: Layers },
  { label: 'Antivirus & Security', value: 'Antivirus & Endpoint Security', icon: Shield },
  { label: 'Office & Productivity (M365)', value: 'Office & Productivity', icon: Users },
  { label: 'Clinical & Hospital (LHIMS)', value: 'Hospital & Clinical (LHIMS)', icon: Building },
  { label: 'Network & Satellite (Starlink)', value: 'Network & Satellite (Starlink)', icon: Cloud },
  { label: 'Server OS & Hypervisor', value: 'Operating System & Server', icon: Server },
  { label: 'Backup & Cloud', value: 'Backup & Cloud', icon: RefreshCw },
];

export const SoftwareSubscriptionsTab: React.FC<SoftwareSubscriptionsTabProps> = ({
  currentUser,
  onRefreshParent,
}) => {
  const [subscriptions, setSubscriptions] = useState<SoftwareSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SubscriptionCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubscriptionStatus>('ALL');

  // Key Visibility toggles (by subscription ID)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SoftwareSubscription | null>(null);

  // Form Fields
  const [softwareName, setSoftwareName] = useState('');
  const [category, setCategory] = useState<SubscriptionCategory>('Antivirus & Endpoint Security');
  const [vendor, setVendor] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseType, setLicenseType] = useState<SoftwareSubscription['licenseType']>('Per Device');
  const [totalSeats, setTotalSeats] = useState(50);
  const [allocatedSeats, setAllocatedSeats] = useState(1);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [renewalDate, setRenewalDate] = useState(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split('T')[0]
  );
  const [cost, setCost] = useState(1200);
  const [currency, setCurrency] = useState('GH₵');
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>('Annual');
  const [status, setStatus] = useState<SubscriptionStatus>('Active');
  const [autoRenew, setAutoRenew] = useState(true);
  const [assignedDepartment, setAssignedDepartment] = useState('');
  const [primaryAdminContact, setPrimaryAdminContact] = useState('');
  const [notes, setNotes] = useState('');
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);

  // Delete Confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Permission check: strictly Super Admin and IT unit staff can edit/add subscriptions
  const canManage = authService.canManageAssets(currentUser);
  const isReadOnly = authService.isReadOnlyAuditorOrManagement(currentUser);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const [data, depts] = await Promise.all([
        assetService.getSubscriptions(),
        departmentService.getStandardDepartmentNames().catch(() => []),
      ]);
      setSubscriptions(data);
      setDepartmentsList(depts || []);
    } catch (err) {
      console.error('Failed to load software subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingSub(null);
    setSoftwareName('');
    setCategory('Antivirus & Endpoint Security');
    setVendor('');
    setLicenseKey('');
    setLicenseType('Per Device');
    setTotalSeats(50);
    setAllocatedSeats(1);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setRenewalDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split('T')[0]);
    setCost(1200);
    setCurrency('GH₵');
    setBillingCycle('Annual');
    setStatus('Active');
    setAutoRenew(true);
    setAssignedDepartment('Hospital-Wide IT & Clinical');
    setPrimaryAdminContact(currentUser?.fullName || '');
    setNotes('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (sub: SoftwareSubscription) => {
    setEditingSub(sub);
    setSoftwareName(sub.softwareName);
    setCategory(sub.category);
    setVendor(sub.vendor);
    setLicenseKey(sub.licenseKey || '');
    setLicenseType(sub.licenseType);
    setTotalSeats(sub.totalSeats);
    setAllocatedSeats(sub.allocatedSeats);
    setPurchaseDate(sub.purchaseDate);
    setRenewalDate(sub.renewalDate);
    setCost(sub.cost);
    setCurrency(sub.currency);
    setBillingCycle(sub.billingCycle);
    setStatus(sub.status);
    setAutoRenew(sub.autoRenew);
    setAssignedDepartment(sub.assignedDepartment || '');
    setPrimaryAdminContact(sub.primaryAdminContact || '');
    setNotes(sub.notes || '');
    setModalOpen(true);
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!softwareName.trim() || !vendor.trim() || !currentUser) return;

    try {
      if (editingSub) {
        await assetService.updateSubscription(
          editingSub.id,
          {
            softwareName: softwareName.trim(),
            category,
            vendor: vendor.trim(),
            licenseKey: licenseKey.trim() || undefined,
            licenseType,
            totalSeats: Number(totalSeats) || 1,
            allocatedSeats: Math.min(Number(allocatedSeats) || 0, Number(totalSeats) || 1),
            purchaseDate,
            renewalDate,
            cost: Number(cost) || 0,
            currency,
            billingCycle,
            status,
            autoRenew,
            assignedDepartment: assignedDepartment.trim() || undefined,
            primaryAdminContact: primaryAdminContact.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          currentUser
        );
      } else {
        await assetService.createSubscription(
          {
            softwareName: softwareName.trim(),
            category,
            vendor: vendor.trim(),
            licenseKey: licenseKey.trim() || undefined,
            licenseType,
            totalSeats: Number(totalSeats) || 1,
            allocatedSeats: Math.min(Number(allocatedSeats) || 0, Number(totalSeats) || 1),
            purchaseDate,
            renewalDate,
            cost: Number(cost) || 0,
            currency,
            billingCycle,
            status,
            autoRenew,
            assignedDepartment: assignedDepartment.trim() || undefined,
            primaryAdminContact: primaryAdminContact.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          currentUser
        );
      }

      setModalOpen(false);
      await loadSubscriptions();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!currentUser) return;
    try {
      await assetService.deleteSubscription(id, currentUser);
      setDeleteConfirmId(null);
      await loadSubscriptions();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustSeats = async (sub: SoftwareSubscription, delta: number) => {
    if (!currentUser || !canManage) return;
    const newAllocated = Math.max(0, Math.min(sub.totalSeats, sub.allocatedSeats + delta));
    if (newAllocated === sub.allocatedSeats) return;

    try {
      await assetService.updateSubscription(
        sub.id,
        { allocatedSeats: newAllocated },
        currentUser
      );
      await loadSubscriptions();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyKey = (id: string, keyText: string) => {
    if (!keyText) return;
    navigator.clipboard.writeText(keyText);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Quick preset loader
  const handleApplyPreset = (preset: 'KASPERSKY' | 'M365' | 'LHIMS' | 'STARLINK' | 'VMWARE' | 'SOPHOS') => {
    if (preset === 'KASPERSKY') {
      setSoftwareName('Kaspersky Endpoint Security Cloud Plus');
      setCategory('Antivirus & Endpoint Security');
      setVendor('Kaspersky Lab');
      setLicenseType('Per Device');
      setTotalSeats(100);
      setAllocatedSeats(85);
      setCost(2400);
      setBillingCycle('Annual');
      setNotes('Hospital antivirus protection, ransomware shield, and removable media control.');
    } else if (preset === 'M365') {
      setSoftwareName('Microsoft 365 Business Standard');
      setCategory('Office & Productivity');
      setVendor('Microsoft Corporation');
      setLicenseType('Per User / Seat');
      setTotalSeats(50);
      setAllocatedSeats(48);
      setCost(7500);
      setBillingCycle('Annual');
      setNotes('Exchange hospital email, Word, Excel, Teams, and OneDrive cloud.');
    } else if (preset === 'LHIMS') {
      setSoftwareName('LHIMS Clinical EHR Institutional License');
      setCategory('Hospital & Clinical (LHIMS)');
      setVendor('Ministry of Health');
      setLicenseType('Site License (Unlimited)');
      setTotalSeats(300);
      setAllocatedSeats(280);
      setCost(5000);
      setBillingCycle('Annual');
      setNotes('Primary electronic health records, OPD queueing, and pharmacy management.');
    } else if (preset === 'STARLINK') {
      setSoftwareName('Starlink Priority 1TB WAN Uplink');
      setCategory('Network & Satellite (Starlink)');
      setVendor('SpaceX Starlink');
      setLicenseType('Per Device');
      setTotalSeats(1);
      setAllocatedSeats(1);
      setCost(3000);
      setBillingCycle('Annual');
      setNotes('High throughput low-latency satellite internet for hospital cloud sync.');
    } else if (preset === 'VMWARE') {
      setSoftwareName('VMware vSphere 8 Standard');
      setCategory('Operating System & Server');
      setVendor('Broadcom / VMware');
      setLicenseType('Server Core');
      setTotalSeats(8);
      setAllocatedSeats(8);
      setCost(3200);
      setBillingCycle('Annual');
      setNotes('Virtual machine hypervisors for hospital PACS and LHIMS database.');
    } else if (preset === 'SOPHOS') {
      setSoftwareName('Sophos Intercept X Endpoint Advanced');
      setCategory('Antivirus & Endpoint Security');
      setVendor('Sophos Security');
      setLicenseType('Per Device');
      setTotalSeats(80);
      setAllocatedSeats(65);
      setCost(2100);
      setBillingCycle('Annual');
      setNotes('Next-gen endpoint detection and response with anti-exploit engine.');
    }
  };

  // Filter Subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesQuery =
      sub.softwareName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.subscriptionCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.licenseKey && sub.licenseKey.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sub.assignedDepartment && sub.assignedDepartment.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = categoryFilter === 'ALL' || sub.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;

    return matchesQuery && matchesCat && matchesStatus;
  });

  // Calculate high level metrics
  const totalActive = subscriptions.filter((s) => s.status === 'Active').length;
  const totalCostAnnual = subscriptions.reduce((acc, s) => {
    if (s.billingCycle === 'Annual') return acc + s.cost;
    if (s.billingCycle === 'Monthly') return acc + s.cost * 12;
    if (s.billingCycle === 'Quarterly') return acc + s.cost * 4;
    return acc;
  }, 0);
  const totalAllocatedSeats = subscriptions.reduce((acc, s) => acc + s.allocatedSeats, 0);
  const totalCapacitySeats = subscriptions.reduce((acc, s) => acc + s.totalSeats, 0);
  const expiringSoonCount = subscriptions.filter((s) => {
    const renewal = new Date(s.renewalDate).getTime();
    const now = Date.now();
    const daysLeft = (renewal - now) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 60;
  }).length;

  return (
    <div className="space-y-6">
      {/* Heading & Top Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-sky-600" />
            <span>Software Licenses & Cloud Subscriptions</span>
          </h2>
          <p className="text-xs text-slate-500">
            Enterprise software licenses, antivirus endpoint seats, Microsoft 365 subscriptions, LHIMS clinical modules, and satellite WAN contracts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManage ? (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Software Subscription</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700">
              Audit / Management View Only
            </span>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Active Subscriptions</div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {totalActive} <span className="text-xs font-normal text-slate-400">/ {subscriptions.length} total</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Seat Utilization</div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {totalAllocatedSeats} <span className="text-xs font-normal text-slate-400">/ {totalCapacitySeats} seats</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Renewals Due &le; 60 Days</div>
            <div className="text-lg font-black text-amber-600">
              {expiringSoonCount} <span className="text-xs font-normal text-slate-400">licenses</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Annual Software Budget</div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              GH₵{totalCostAnnual.toLocaleString()} <span className="text-[10px] font-mono text-slate-400">/yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search software, vendor, license key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="ALL">All Renewal Statuses</option>
              <option value="Active">Active & Compliant</option>
              <option value="Expiring Soon">Expiring Soon (&le; 60 Days)</option>
              <option value="Expired">Expired</option>
              <option value="Pending Renewal">Pending Renewal Approval</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscriptions Grid Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredSubscriptions.length === 0 ? (
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            No software licenses or subscriptions found matching filters.
          </div>
        ) : (
          filteredSubscriptions.map((sub) => {
            const utilizationPct = Math.round((sub.allocatedSeats / (sub.totalSeats || 1)) * 100);
            const isExpiring = sub.status === 'Expiring Soon';
            const isExpired = sub.status === 'Expired';
            const isKeyVisible = visibleKeys[sub.id];

            return (
              <div
                key={sub.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4 hover:border-sky-300 dark:hover:border-sky-800 transition"
              >
                {/* Header: Name + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-sky-600 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md">
                        {sub.subscriptionCode}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">{sub.vendor}</span>
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                      {sub.softwareName}
                    </h3>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isExpired
                          ? 'bg-rose-100 text-rose-800'
                          : isExpiring
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {sub.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sub.billingCycle}
                    </span>
                  </div>
                </div>

                {/* License Key Reveal & Copy */}
                {sub.licenseKey && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Key className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="text-slate-400 text-[11px]">Key / Account:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 truncate font-semibold">
                        {isKeyVisible ? sub.licenseKey : '••••-••••-••••-' + sub.licenseKey.slice(-4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(sub.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={isKeyVisible ? 'Hide Key' : 'Reveal Key'}
                      >
                        {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyKey(sub.id, sub.licenseKey || '')}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Copy Key to Clipboard"
                      >
                        {copiedKeyId === sub.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Seat Allocation Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Seat / License Allocation:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {sub.allocatedSeats} / {sub.totalSeats} seats ({utilizationPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        utilizationPct >= 95
                          ? 'bg-rose-500'
                          : utilizationPct >= 80
                          ? 'bg-amber-500'
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(100, utilizationPct)}%` }}
                    />
                  </div>
                </div>

                {/* Metadata Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Renewal Due Date:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(sub.renewalDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Contract Cost:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-0.5 mt-0.5">
                      GH₵{sub.cost.toLocaleString()}
                    </span>
                  </div>

                  {sub.assignedDepartment && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Assigned Coverage:</span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium line-clamp-1">
                        {sub.assignedDepartment}
                      </span>
                    </div>
                  )}

                  {sub.notes && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Clinical / IT Scope:</span>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                        {sub.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 mr-1">Allocate:</span>
                      <button
                        type="button"
                        onClick={() => handleAdjustSeats(sub, -1)}
                        disabled={sub.allocatedSeats <= 0}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs disabled:opacity-30 cursor-pointer"
                        title="Release 1 Seat"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustSeats(sub, 1)}
                        disabled={sub.allocatedSeats >= sub.totalSeats}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs disabled:opacity-30 cursor-pointer"
                        title="Assign 1 Seat"
                      >
                        +1
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">Protected Audit Log</span>
                  )}

                  <div className="flex items-center gap-2">
                    {canManage && (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(sub)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {deleteConfirmId === sub.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteSubscription(sub.id)}
                              className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(sub.id)}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs cursor-pointer"
                            title="Delete Subscription"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add / Edit Subscription */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-sky-600" />
                <span>{editingSub ? 'Edit Software Subscription' : 'Register Software License / Subscription'}</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSubscription} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Quick Template Presets for fast entry */}
              {!editingSub && (
                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quick Fill Hospital Presets</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('KASPERSKY')}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-sky-100 cursor-pointer"
                    >
                      🛡️ Kaspersky Antivirus
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('SOPHOS')}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-sky-100 cursor-pointer"
                    >
                      🛡️ Sophos Endpoint
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('M365')}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-sky-100 cursor-pointer"
                    >
                      📧 Microsoft 365
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('LHIMS')}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-sky-100 cursor-pointer"
                    >
                      🏥 LHIMS Clinical
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('STARLINK')}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-sky-100 cursor-pointer"
                    >
                      🛰️ Starlink WAN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('VMWARE')}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-sky-100 cursor-pointer"
                    >
                      💻 VMware Server
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Software / Package Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kaspersky Endpoint Security Plus"
                    value={softwareName}
                    onChange={(e) => setSoftwareName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Software Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SubscriptionCategory)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Antivirus & Endpoint Security">Antivirus & Endpoint Security</option>
                    <option value="Office & Productivity">Office & Productivity (M365)</option>
                    <option value="Hospital & Clinical (LHIMS)">Hospital & Clinical (LHIMS)</option>
                    <option value="Network & Satellite (Starlink)">Network & Satellite (Starlink)</option>
                    <option value="Operating System & Server">Operating System & Server</option>
                    <option value="Backup & Cloud">Backup & Cloud</option>
                    <option value="Communication & VoIP">Communication & VoIP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Vendor / Publisher *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kaspersky Labs, Microsoft, SpaceX"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">License Model</label>
                  <select
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Per Device">Per Device (Endpoints/PCs)</option>
                    <option value="Per User / Seat">Per User / Named Seat</option>
                    <option value="Site License (Unlimited)">Site License (Hospital Unlimited)</option>
                    <option value="Server Core">Server Core License</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">License Key / Account Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. KASP-XXXX-YYYY-ZZZZ or MS365-TENANT-ID"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Total Seats *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Assigned Seats</label>
                  <input
                    type="number"
                    min={0}
                    max={totalSeats}
                    value={allocatedSeats}
                    onChange={(e) => setAllocatedSeats(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Cost (GH₵)</label>
                  <input
                    type="number"
                    min={0}
                    value={cost}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Billing Cycle</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as SubscriptionBillingCycle)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Annual">Annual</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Perpetual / One-Time">Perpetual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Purchase / Activation Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Renewal Due Date *</label>
                  <input
                    type="date"
                    required
                    value={renewalDate}
                    onChange={(e) => setRenewalDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Subscription Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                    <option value="Pending Renewal">Pending Renewal</option>
                    <option value="Expired">Expired</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Assigned Department / Scope</label>
                  <select
                    value={assignedDepartment}
                    onChange={(e) => setAssignedDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">
                      {departmentsList.length === 0 ? '-- No Departments Uploaded Yet --' : '-- Select Department / Scope --'}
                    </option>
                    <option value="Hospital-Wide IT & Clinical">Hospital-Wide IT & Clinical</option>
                    {departmentsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    {assignedDepartment && assignedDepartment !== 'Hospital-Wide IT & Clinical' && !departmentsList.includes(assignedDepartment) && (
                      <option value={assignedDepartment}>{assignedDepartment}</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Notes & Clinical Scope</label>
                <textarea
                  rows={2}
                  placeholder="Additional licensing rules, support portal links, or vendor contracts..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              {/* Submit & Cancel */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                >
                  {editingSub ? 'Save Changes' : 'Register Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
