export type Role =
  | 'SUPER_ADMIN'
  | 'IT_ADMIN'
  | 'IT_OFFICER'
  | 'HOSPITAL_MANAGEMENT'
  | 'DEPARTMENT_HEAD'
  | 'STAFF_USER'
  | 'PROCUREMENT_OFFICER'
  | 'AUDITOR';

export type AccountStatus = 'Active' | 'Suspended' | 'Disabled';

export type SyncStatus = 'LOCAL_ONLY' | 'PENDING_SYNC' | 'SYNCED' | 'SYNC_FAILED' | 'CONFLICT';

export interface SyncMetadata {
  _syncStatus: SyncStatus;
  _syncVersion: number;
  _lastSyncedAt: string | null;
  _deviceId: string;
  _operationId?: string;
}

export interface User extends SyncMetadata {
  id: string; // UUID or Firebase UID
  fullName: string;
  email: string;
  phone: string;
  photoURL?: string;
  department: string;
  jobTitle: string;
  role: Role;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  offlineAccessAllowed?: boolean;
  passwordHash?: string; // Salted SHA-256 for offline auth
  passwordSalt?: string;
}

export interface Department extends SyncMetadata {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: string;
  headOfDepartment: string;
  phone: string;
  isEmergency: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationItem extends SyncMetadata {
  id: string;
  building: string;
  block: string;
  floor: string;
  wardOrOffice: string;
  roomNumber: string;
  notes?: string;
}

export type TicketCategory =
  | 'Hardware'
  | 'Software'
  | 'Network'
  | 'Internet'
  | 'Printer'
  | 'Server'
  | 'Hospital System'
  | 'Email'
  | 'Security'
  | 'Account/Login'
  | 'Other';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TicketStatus =
  | 'New'
  | 'Assigned'
  | 'In Progress'
  | 'Pending'
  | 'Resolved'
  | 'Closed'
  | 'Reopened';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string; // Base64 data for local offline storage
  uploadedBy: string;
  createdAt: string;
  syncedToCloud?: boolean;
}

export interface TicketComment {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  comment: string;
  createdAt: string;
  attachment?: Attachment;
}

export interface TicketResolution {
  description: string;
  workPerformed: string;
  resolvedBy: string;
  resolvedAt: string;
  preventiveRecommendation?: string;
}

export interface SlaInfo {
  responseDue: string;
  resolutionDue: string;
  isBreached: boolean;
  responseTimeMinutes?: number;
  resolutionTimeMinutes?: number;
}

export interface Ticket extends SyncMetadata {
  id: string; // Internal UUID
  ticketNumber: string; // E.g. HIT-2026-000001
  title: string;
  description: string;
  category: TicketCategory;
  subcategory?: string;
  priority: TicketPriority;
  status: TicketStatus;
  department: string;
  location: string;
  reportedBy: {
    uid: string;
    name: string;
    email: string;
    phone?: string;
    department?: string;
  };
  assignedTo?: {
    uid: string;
    name: string;
    email: string;
  } | null;
  assetId?: string | null;
  attachments: Attachment[];
  comments: TicketComment[];
  resolution?: TicketResolution | null;
  sla: SlaInfo;
  createdAt: string;
  updatedAt: string;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenedAt?: string | null;
}

export type AssetCondition = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export type AssetStatus =
  | 'Available'
  | 'Assigned'
  | 'In Repair'
  | 'Under Maintenance'
  | 'Retired'
  | 'Lost'
  | 'Damaged'
  | 'Disposed';

export interface AssetHistoryEntry {
  id: string;
  assetId: string;
  action: 'Created' | 'Assigned' | 'Transferred' | 'Repaired' | 'Maintenance' | 'StatusChanged' | 'Retired' | 'Disposed';
  details: string;
  performedBy: string;
  timestamp: string;
}

export interface Asset extends SyncMetadata {
  id: string;
  assetTag: string; // e.g. AST-HOSP-00104
  assetType: string; // Desktop, Laptop, Printer, Server, Switch, Router, AP, UPS, Scanner
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  location: string;
  assignedUser?: string;
  purchaseDate: string;
  purchasePrice: number;
  supplier: string;
  warrantyStart: string;
  warrantyEnd: string;
  condition: AssetCondition;
  status: AssetStatus;
  operatingSystem?: string;
  ipAddress?: string;
  macAddress?: string;
  specifications: string;
  qrCodeData: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MaintenanceFrequency = 'Weekly' | 'Monthly' | 'Quarterly' | 'Bi-Annual' | 'Annual' | 'One-off';

export type MaintenanceStatus = 'Scheduled' | 'Due' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';

export interface ChecklistItem {
  id: string;
  item: string;
  completed: boolean;
}

export interface PartUsed {
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface MaintenanceRecord extends SyncMetadata {
  id: string;
  maintenanceNumber: string; // e.g. MN-2026-001
  assetId: string;
  assetTag: string;
  assetName: string;
  department: string;
  maintenanceType: string;
  frequency: MaintenanceFrequency;
  scheduledDate: string;
  assignedTechnician: string;
  status: MaintenanceStatus;
  checklist: ChecklistItem[];
  findings?: string;
  actionsTaken?: string;
  partsUsed: PartUsed[];
  cost: number;
  nextMaintenanceDate?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type IncidentSeverity = 'Minor' | 'Major' | 'Critical';

export type IncidentStatus = 'Active' | 'Investigating' | 'Mitigating' | 'Resolved' | 'Closed';

export interface IncidentTimelineEvent {
  timestamp: string;
  message: string;
  user: string;
}

export interface RootCauseAnalysis {
  immediateCause: string;
  rootCause: string;
  contributingFactors: string;
  correctiveAction: string;
  preventiveAction: string;
  lessonsLearned: string;
  responsiblePerson: string;
  targetDate: string;
}

export interface Incident extends SyncMetadata {
  id: string;
  incidentNumber: string; // INC-2026-001
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedSystems: string[];
  affectedDepartments: string[];
  startTime: string;
  detectedBy: string;
  assignedTeam: string;
  status: IncidentStatus;
  actionsTaken: string[];
  rootCauseAnalysis?: RootCauseAnalysis;
  impact: string;
  resolution?: string;
  resolvedAt?: string;
  postIncidentReport?: string;
  timeline: IncidentTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export type SystemOperationalStatus = 'Operational' | 'Degraded' | 'Down' | 'Maintenance';

export interface HospitalSystem extends SyncMetadata {
  id: string;
  systemName: string; // LHIMS, QuickBooks, Claim IT, Quixmo, Starlink, Local Email, File Server, Backup
  description: string;
  owner: string;
  vendor: string;
  status: SystemOperationalStatus;
  criticality: 'Low' | 'Medium' | 'High' | 'Critical';
  url: string;
  server: string;
  database: string;
  lastChecked: string;
  latencyMs: number;
  uptimePercentage: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkDevice extends SyncMetadata {
  id: string;
  deviceName: string;
  deviceType: 'Router' | 'Core Switch' | 'Distribution Switch' | 'Access Point' | 'Server' | 'Firewall' | 'Starlink Terminal';
  manufacturer: string;
  model: string;
  serialNumber: string;
  ipAddress: string;
  macAddress: string;
  location: string;
  department: string;
  status: 'Online' | 'Offline' | 'Warning';
  firmware: string;
  installationDate: string;
  lastMaintenance: string;
  uplinkDeviceId?: string; // for topology hierarchy
  notes?: string;
  portsCount?: number;
  activePorts?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkIncident extends SyncMetadata {
  id: string;
  deviceId: string;
  deviceName: string;
  type: string;
  startTime: string;
  endTime?: string;
  cause: string;
  actionTaken: string;
  technician: string;
  resolution?: string;
  downtimeMinutes: number;
  createdAt: string;
}

export interface InventoryItem extends SyncMetadata {
  id: string;
  itemCode: string;
  itemName: string;
  category: 'Cabling' | 'Connectors' | 'Printing' | 'Peripherals' | 'Tools' | 'Power/UPS' | 'Storage/RAM' | 'Other';
  unit: string; // meters, rolls, pcs, cartridges, boxes
  quantity: number;
  minimumStock: number;
  maximumStock: number;
  supplier: string;
  unitCost: number;
  storageLocation: string;
  lastUpdated: string;
  createdAt: string;
}

export interface InventoryTransaction extends SyncMetadata {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  transactionType: 'Stock Received' | 'Stock Issued' | 'Stock Returned' | 'Stock Adjustment' | 'Damaged Stock' | 'Expired Stock';
  reason: string;
  department?: string;
  performedBy: string;
  date: string;
  reference: string;
  createdAt: string;
}

export type ProcurementPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type ProcurementStatus =
  | 'Draft'
  | 'Submitted'
  | 'Department Approval'
  | 'IT Review'
  | 'Procurement'
  | 'Ordered'
  | 'Received'
  | 'Completed'
  | 'Rejected';

export interface ProcurementRequest extends SyncMetadata {
  id: string;
  requestNumber: string; // PR-2026-001
  requestedBy: string;
  department: string;
  item: string;
  quantity: number;
  justification: string;
  estimatedCost: number;
  priority: ProcurementPriority;
  status: ProcurementStatus;
  approvedBy?: string;
  procurementStatus?: string;
  vendorNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupRecord extends SyncMetadata {
  id: string;
  system: string;
  backupType: 'Full Database' | 'System Configuration' | 'Audit Logs' | 'Local Attachments';
  frequency: 'Hourly' | 'Daily' | 'Weekly' | 'Manual';
  destination: string; // e.g. /var/backups/hitoms or Local NAS
  lastBackup: string;
  status: 'Successful' | 'Failed' | 'Warning' | 'Not Verified';
  size: string;
  verified: boolean;
  verificationDate: string;
  performedBy: string;
  notes?: string;
  createdAt: string;
}

export interface KnowledgeArticle extends SyncMetadata {
  id: string;
  articleId: string; // KB-001
  title: string;
  category: string;
  problem: string;
  problemDescription?: string;
  symptoms: string[];
  tags?: string[];
  solution: string;
  steps: string[];
  views: number;
  author?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string; // 'ALL' or specific uid
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  module: string;
  linkId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  user: string;
  userName?: string;
  userEmail: string;
  userRole: Role;
  action: string;
  module: string;
  entityName?: string;
  recordId: string;
  entityId?: string;
  oldValue?: any;
  oldValues?: any;
  newValue?: any;
  newValues?: any;
  timestamp: string;
  ipOrDevice: string;
  deviceId?: string;
  isOfflineAction?: boolean;
}

export interface SyncQueueItem {
  operationId: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  retryCount: number;
  status: 'PENDING' | 'RETRYING' | 'FAILED' | 'RESOLVED';
  lastError?: string;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localValue: any;
  remoteValue: any;
  originalValue?: any;
  conflictTime: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionChoice?: 'LOCAL' | 'REMOTE' | 'MERGE';
}

export interface OfflineSecurityPolicy {
  allowOfflineLogin: boolean;
  maxOfflineHours: number;
  allowOfflineTicketCreation: boolean;
  allowOfflineAssetModification: boolean;
  allowOfflineInventoryTx: boolean;
  allowOfflineAdmin: boolean;
}

export interface SlaRule {
  priority: TicketPriority;
  responseHours: number;
  resolutionHours: number;
}

export interface SystemSettings {
  id?: string;
  hospitalName: string;
  hospitalLogo?: string; // Base64 data URL or image path
  hospitalLanUrl: string;
  contactEmail?: string;
  contactPhone?: string;
  emergencyExtension?: string;
  address?: string;
  regionOrDistrict?: string;
  bedCapacity?: number;
  cloudSyncEnabled: boolean;
  autoSyncIntervalSec: number;
  offlinePolicy: OfflineSecurityPolicy;
  slaRules: Record<TicketPriority, SlaRule>;
  lastSuccessfulSync: string | null;
}
