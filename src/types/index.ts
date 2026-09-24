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
  username?: string; // Surname or custom handle
  email: string;
  phone: string;
  photoURL?: string;
  department: string;
  jobTitle: string;
  role: Role;
  specialties?: string[]; // Technical & clinical specializations (e.g., Network, Hardware, LHIMS, Servers, Database, etc.)
  specialtyNotes?: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  offlineAccessAllowed?: boolean;
  password?: string; // Direct password or initial default password
  passwordHash?: string; // Salted SHA-256 for offline auth
  passwordSalt?: string;
  mustChangePasswordOnFirstLogin?: boolean;
  lastPasswordChangeAt?: string;
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
  dataUrl?: string; // Base64 data for local offline storage
  data?: string; // Alias
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
    phone?: string;
    department?: string;
    autoAssignedBySpecialty?: boolean;
    specialtyMatched?: TicketCategory;
    month?: string;
  } | null;
  assetId?: string | null;
  attachments: Attachment[];
  comments: TicketComment[];
  resolution?: TicketResolution | null;
  isGeneralIssue?: boolean; // General hospital-wide issue reportable and confirmable by any staff
  confirmationRating?: {
    rating: number; // 1 to 5 satisfaction rating
    feedback?: string;
    confirmedBy: {
      uid: string;
      name: string;
      department: string;
    };
    confirmedAt: string;
  } | null;
  aiTriage?: {
    recommendedPriority: TicketPriority;
    patientCareImpact: string;
    suggestedCategory: TicketCategory;
    rootCauseHypothesis: string;
    immediateActionSteps: string[];
    riskSummary: string;
    analyzedAt: string;
  } | null;
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

export type SubscriptionCategory =
  | 'Antivirus & Endpoint Security'
  | 'Office & Productivity'
  | 'Hospital & Clinical (LHIMS)'
  | 'Network & Satellite (Starlink)'
  | 'Operating System & Server'
  | 'Backup & Cloud'
  | 'Communication & VoIP';

export type SubscriptionBillingCycle = 'Monthly' | 'Quarterly' | 'Annual' | 'Perpetual / One-Time';
export type SubscriptionStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Pending Renewal' | 'Cancelled';

export interface SoftwareSubscription extends SyncMetadata {
  id: string;
  subscriptionCode: string; // e.g. SUB-2026-001
  softwareName: string; // e.g. Kaspersky Endpoint Security, Microsoft 365 Business Standard
  category: SubscriptionCategory;
  vendor: string; // e.g. Kaspersky, Microsoft, Starlink, VMware
  licenseKey?: string;
  licenseType: 'Per User / Seat' | 'Per Device' | 'Site License (Unlimited)' | 'Server Core';
  totalSeats: number;
  allocatedSeats: number;
  purchaseDate: string;
  renewalDate: string;
  cost: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  status: SubscriptionStatus;
  autoRenew: boolean;
  assignedDepartment?: string;
  primaryAdminContact?: string;
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

export type SystemOperationalStatus = 'Operational' | 'Degraded' | 'Down' | 'Maintenance' | 'Offline';

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
  ipOrHost?: string;
  port?: number | string;
  uptimePercent?: number;
  lastChecked: string;
  latencyMs: number;
  uptimePercentage: number;
  maintenanceWindow?: string;
  statusMessage?: string;
  leadAdmin?: string;
  vendorSupportHotline?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type NetworkConnectionType = 'Fiber' | 'Ethernet Cat6' | 'Wireless 5GHz/6GHz' | 'Satellite RF' | 'SFP+ 10G';

export type NetworkDeviceType =
  | 'Starlink Terminal'
  | 'Router'
  | 'Firewall'
  | 'Core Switch'
  | 'Distribution Switch'
  | 'Switch'
  | 'Access Point'
  | 'Server'
  | 'Workstation'
  | 'Laptop'
  | 'Printer';

export interface NetworkDevice extends SyncMetadata {
  id: string;
  deviceName: string;
  deviceType: NetworkDeviceType;
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
  predecessorId?: string; // Upstream / Predecessor device ID
  successorIds?: string[]; // Downstream / Successor device IDs
  uplinkDeviceId?: string; // backward compatibility alias for predecessorId
  connectionType?: NetworkConnectionType;
  portSpeed?: string; // e.g. 1 Gbps, 10 Gbps, 100 Mbps
  canvasX?: number; // X coordinate on draggable topology canvas
  canvasY?: number; // Y coordinate on draggable topology canvas
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
  userId: string; // 'ALL' or specific uid or 'DEPT:DeptName'
  targetType?: 'ALL' | 'UNIT' | 'USER';
  targetUnit?: string;
  senderName?: string;
  senderRole?: string;
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

export interface OfficerMonthlySpecialty {
  id: string;
  userId: string;
  userName: string;
  month: string; // e.g. "2026-09" (YYYY-MM)
  specialties: TicketCategory[]; // e.g. ['Network', 'Internet']
  notes?: string;
  isActive: boolean;
}

export type MemoType =
  | 'EXECUTIVE_IT_MEMO'
  | 'INCIDENT_DEBRIEF'
  | 'OPERATIONS_REPORT'
  | 'EQUIPMENT_JUSTIFICATION'
  | 'CLINICAL_ADVISORY'
  | 'MAINTENANCE_DOWNTIME'
  | 'POLICY_CIRCULAR'
  | 'GENERAL_MEMO';

export type MemoStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface HospitalMemo {
  id: string;
  memoNumber: string;
  title: string;
  memoType: MemoType;
  department: string;
  targetAudience: string;
  targetRoles?: Role[];
  fromSender: {
    uid: string;
    name: string;
    role: Role | string;
    title?: string;
  };
  executiveSummary: string;
  backgroundAndContext: string;
  detailedFindingsOrBody: string;
  actionRequiredOrChecklist: string[];
  timelineOrDeadline?: string;
  contactPersonOrExtension?: string;
  recommendedDistribution?: string;
  status: MemoStatus;
  isAiGenerated: boolean;
  aiPromptContext?: string;
  tags?: string[];
  attachments?: Attachment[];
  archivedScanImage?: string; // Base64 data URL or photo/scan of physical paper memo
  archiveSource?: 'DIGITAL_DRAFT' | 'DEVICE_UPLOAD' | 'CAMERA_CAPTURE';
  physicalArchiveLocation?: string; // Physical file cabinet/rack/folder location
  confidentialityLevel?: 'STANDARD' | 'CONFIDENTIAL' | 'STRICTLY_RESTRICTED';
  originalFileName?: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  memoDate?: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: {
    name: string;
    title: string;
    approvedAt: string;
  };
}

export interface AiMemoRequest {
  memoType: MemoType;
  topic: string;
  targetAudience?: string;
  targetRoles?: Role[];
  department?: string;
  rawNotes: string;
  tone?: 'FORMAL' | 'URGENT' | 'CLINICAL_ADVISORY' | 'EXECUTIVE' | 'EDUCATIONAL';
  includeLiveData?: boolean;
  hospitalName?: string;
  senderName?: string;
  senderTitle?: string;
  refineInstruction?: string;
  existingDraft?: Partial<HospitalMemo>;
}

export interface AiMemoResponse {
  memoNumber: string;
  title: string;
  memoType: MemoType;
  targetAudience: string;
  targetRoles?: Role[];
  executiveSummary: string;
  backgroundAndContext: string;
  detailedFindingsOrBody: string;
  actionRequiredOrChecklist: string[];
  timelineOrDeadline?: string;
  contactPersonOrExtension?: string;
  recommendedDistribution?: string;
  isFallback?: boolean;
}

export type LetterheadMode = 'CUSTOM_BANNER' | 'DYNAMIC_HEADER' | 'HEADER_AND_BANNER';

export interface SystemSettings {
  id?: string;
  hospitalName: string;
  hospitalLogo?: string; // Base64 data URL or image path
  hospitalLetterheadImage?: string; // Base64 data URL for uploaded official letterhead header/banner
  letterheadSubTitle?: string; // e.g. "Department of Information Technology & Clinical Informatics"
  letterheadAddressLine?: string; // e.g. "104 Healthcare Boulevard, Ward 4 • Emergency: Ext 9911 / 222"
  letterheadFooterText?: string; // e.g. "CONFIDENTIAL & PROPRIETARY — HEALTHCARE INFORMATION TECHNOLOGY & OPERATIONS MANAGEMENT"
  letterheadMode?: LetterheadMode; // Layout style for memos and printed reports
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
  mandatoryPasswordChangeOnFirstLogin?: boolean;
  disableDemoLogin?: boolean; // When true, quick demo profiles on login modal are hidden (controlled by Super Admin Courage Kay)
  systemNotificationRingEnabled?: boolean; // Active notification ring for alerts & tickets even if app is closed
  reNotificationIntervalMinutes?: number; // How often recurring bell rings for unresolved tickets (e.g. 5, 10, 15, 30, 45, 60, 120 mins; default: 30)
  ringToneDurationSeconds?: number; // How long audible alarm/chime sounds (e.g. 3, 5, 10, 15, 30, 60 seconds; default: 5)
  emergencyReNotificationMinutes?: number; // How often emergency broadcasts re-alert unacknowledged terminals (default: 15)
  officerMonthlySpecialties?: OfficerMonthlySpecialty[]; // Auto-assignment specialty roster per month
  customTexts?: Record<string, string>;
  rolePermissionsOverrides?: Record<string, string[]>;
  userPermissionsOverrides?: Record<string, { granted?: string[]; revoked?: string[] }>;
}

export interface AiTriageResult {
  recommendedPriority: TicketPriority;
  patientCareImpact: string;
  suggestedCategory: TicketCategory;
  rootCauseHypothesis: string;
  immediateActionSteps: string[];
  riskSummary: string;
  analyzedAt: string;
}

export interface EmergencyBroadcastAlert {
  id: string;
  codeType: 'CODE_BLUE_IT' | 'CODE_RED_NETWORK' | 'EHR_DOWNTIME' | 'CYBER_LOCKDOWN' | 'GENERAL_EMERGENCY';
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING';
  targetUnits: string[]; // ['ALL'] or specific departments
  issuedBy: {
    uid: string;
    name: string;
    role: Role;
  };
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  acknowledgedByUsers?: string[];
}
