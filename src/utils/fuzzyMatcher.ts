/**
 * Fuzzy Value Validation & Safety Check Utility
 *
 * Detects and intercepts non-matching pre-populated values (Departments, Roles,
 * Asset Types, Conditions, Statuses) on uploaded templates. Prevents the creation
 * of duplicate or corrupt system entries. Flags issues, explains the divergence,
 * suggests the closest valid system option, and provides valid options for UI dropdowns.
 */

export type IssueCategory =
  | 'NON_MATCHING_DEPARTMENT'
  | 'NON_MATCHING_ROLE'
  | 'NON_MATCHING_ASSET_TYPE'
  | 'NON_MATCHING_CONDITION'
  | 'NON_MATCHING_STATUS';

export interface FieldMatchResult<T extends string = string> {
  rawValue: string;
  matchedValue: T;
  isExactMatch: boolean;
  issueType: IssueCategory | string | null;
  issueLabel: string | null; // e.g. 'Non-matching Department', 'Non-matching Role', 'Non-matching Asset Type', 'Non-matching Condition', 'Non-matching Status'
  issueDescription: string | null; // Explanatory flag message
  suggestedOptions: T[]; // Full sorted system dropdown options
}

/**
 * Common Aliases & Synonyms Dictionary for Hospital Domain
 */
const DEPARTMENT_ALIASES: Record<string, string> = {
  // Pharmacy
  pharmaci: 'Pharmacy',
  pharmacy: 'Pharmacy',
  'pharmacy unit': 'Pharmacy',
  'central pharmacy': 'Central Pharmacy',
  'drug store': 'Pharmacy',
  dispensary: 'Pharmacy',
  dispensary1: 'Pharmacy',
  'dispensing unit': 'Pharmacy',
  'pharm store': 'Pharmacy',
  'pharmacy store': 'Pharmacy',

  // Emergency / A&E
  emergency: 'Accident & Emergency (A&E)',
  'emergency ward': 'Accident & Emergency (A&E)',
  'emergency ward unit': 'Accident & Emergency (A&E)',
  'emergency & triage': 'Emergency & Triage',
  'accident & emergency': 'Accident & Emergency (A&E)',
  'accident & emergency (a&e)': 'Accident & Emergency (A&E)',
  'a&e': 'Accident & Emergency (A&E)',
  casualty: 'Accident & Emergency (A&E)',
  er: 'Accident & Emergency (A&E)',
  trauma: 'Accident & Emergency (A&E)',
  resus: 'Accident & Emergency (A&E)',
  triage: 'Emergency & Triage',

  // OPD
  opd: 'OPD (Outpatient Department)',
  'opd (outpatient)': 'OPD (Outpatient Department)',
  'opd (outpatient department)': 'OPD (Outpatient Department)',
  outpatient: 'OPD (Outpatient Department)',
  'outpatient department': 'OPD (Outpatient Department)',
  'consulting room': 'OPD (Outpatient Department)',
  'consulting room 1': 'OPD (Outpatient Department)',
  'consulting room 2': 'OPD (Outpatient Department)',
  'general opd': 'OPD (Outpatient Department)',
  'o.p.d': 'OPD (Outpatient Department)',

  // Surgical Theatre
  theatre: 'Main Surgical Theatre',
  'surgical theatre': 'Main Surgical Theatre',
  'main surgical theatre': 'Main Surgical Theatre',
  'operating theatre': 'Main Surgical Theatre',
  'operating room': 'Main Surgical Theatre',
  'theatre suite': 'Main Surgical Theatre',
  or: 'Main Surgical Theatre',
  surgery: 'Main Surgical Theatre',

  // ICU
  icu: 'Intensive Care Unit (ICU)',
  'intensive care': 'Intensive Care Unit (ICU)',
  'intensive care unit': 'Intensive Care Unit (ICU)',
  'intensive care unit (icu)': 'Intensive Care Unit (ICU)',
  'critical care': 'Intensive Care Unit (ICU)',
  nicu: 'Intensive Care Unit (ICU)',
  picu: 'Intensive Care Unit (ICU)',

  // Maternity & Neonatal
  maternity: 'Maternity & Neonatal',
  'maternity ward': 'Maternity & Neonatal',
  'maternity & neonatal': 'Maternity & Neonatal',
  'labour ward': 'Maternity & Neonatal',
  'labor ward': 'Maternity & Neonatal',
  'delivery room': 'Maternity & Neonatal',
  antenatal: 'Maternity & Neonatal',
  'antenatal /postnatal': 'Maternity & Neonatal',
  postnatal: 'Maternity & Neonatal',

  // Pediatrics
  pediatrics: "Children's Ward (Pediatrics)",
  paediatrics: "Children's Ward (Pediatrics)",
  "children's ward": "Children's Ward (Pediatrics)",
  "children's ward (pediatrics)": "Children's Ward (Pediatrics)",
  "children's warld": "Children's Ward (Pediatrics)",
  'pediatrics ward': "Children's Ward (Pediatrics)",
  'pediatric ward': "Children's Ward (Pediatrics)",
  child: "Children's Ward (Pediatrics)",

  // Laboratory
  lab: 'Diagnostic Laboratory',
  laboratory: 'Diagnostic Laboratory',
  'diagnostic laboratory': 'Diagnostic Laboratory',
  pathology: 'Diagnostic Laboratory',
  hematology: 'Diagnostic Laboratory',
  'blood bank': 'Diagnostic Laboratory',
  'clinical lab': 'Diagnostic Laboratory',

  // Radiology & Imaging
  radiology: 'Radiology & Imaging',
  'radiology & imaging': 'Radiology & Imaging',
  imaging: 'Radiology & Imaging',
  xray: 'Radiology & Imaging',
  'x-ray': 'Radiology & Imaging',
  scan: 'Radiology & Imaging',
  ultrasound: 'Radiology & Imaging',
  'ct scan': 'Radiology & Imaging',
  mri: 'Radiology & Imaging',

  // IT & Systems
  it: 'IT & Systems Administration',
  'it & systems administration': 'IT & Systems Administration',
  'it support': 'IT & Systems Administration',
  'it operations': 'IT & Systems Administration',
  'it & health informatics': 'IT & Systems Administration',
  ict: 'IT & Systems Administration',
  informatics: 'IT & Systems Administration',
  systems: 'IT & Systems Administration',
  helpdesk: 'IT & Systems Administration',

  // Biomedical Engineering
  biomed: 'Biomedical Engineering',
  'biomedical engineering': 'Biomedical Engineering',
  'clinical engineer': 'Biomedical Engineering',
  'estate manager': 'Biomedical Engineering',
  'estate manger': 'Biomedical Engineering',

  // Administration & HR
  admin: 'Hospital Administration & HR',
  administration: 'Hospital Administration & HR',
  'hospital administration & hr': 'Hospital Administration & HR',
  'hospital manager': 'Hospital Administration & HR',
  'hospital manaager': 'Hospital Administration & HR',
  'h.r': 'Hospital Administration & HR',
  hr: 'Hospital Administration & HR',
  secretariat: 'Hospital Administration & HR',
  'nurse manager': 'Hospital Administration & HR',
  'quality manager': 'Hospital Administration & HR',

  // Finance & Accounts
  finance: 'Finance & Accounts',
  accounts: 'Finance & Accounts',
  'finance & accounts': 'Finance & Accounts',
  accountant: 'Finance & Accounts',
  'account office': 'Finance & Accounts',
  'pay office': 'Finance & Accounts',
  claims: 'Finance & Accounts',
  'internal auditor': 'Finance & Accounts',
  billing: 'Finance & Accounts',

  // Procurement & Stores
  procurement: 'Procurement & Stores',
  'procurement & stores': 'Procurement & Stores',
  stores: 'Procurement & Stores',
  'supply chain': 'Procurement & Stores',
  storehouse: 'Procurement & Stores',
  inventory: 'Procurement & Stores',

  // Health Information & Records
  records: 'Health Information Management (LHIMS / Records)',
  'health information': 'Health Information Management (LHIMS / Records)',
  'health information management (lhims / records)': 'Health Information Management (LHIMS / Records)',
  lhims: 'Health Information Management (LHIMS / Records)',
  hims: 'Health Information Management (LHIMS / Records)',
  'medical records': 'Health Information Management (LHIMS / Records)',

  // Dental & Eye
  dental: 'Dental Clinic',
  'dental clinic': 'Dental Clinic',
  eye: 'Eye Clinic (Ophthalmology)',
  'eye clinic': 'Eye Clinic (Ophthalmology)',
  'eye clinic (ophthalmology)': 'Eye Clinic (Ophthalmology)',
  ophthalmology: 'Eye Clinic (Ophthalmology)',

  // Morgue
  mortuary: 'Morgue & Pathology',
  morgue: 'Morgue & Pathology',
  'morgue & pathology': 'Morgue & Pathology',

  // Medical Wards
  'male ward': 'Male Medical Ward',
  'male medical ward': 'Male Medical Ward',
  'male warld': 'Male Medical Ward',
  'female ward': 'Female Medical Ward',
  'female medical ward': 'Female Medical Ward',
  'female warld': 'Female Medical Ward',

  'public health': 'Public Health',
  'mental health': 'Mental Health',
  'e.n.t': 'E.N.T Clinic',
  ent: 'E.N.T Clinic',
  'c.s.s.d': 'C.S.S.D',
  cssd: 'C.S.S.D',
  physiotherapy: 'Physiotherapy & Rehabilitation',
};

const ROLE_ALIASES: Record<string, string> = {
  // Super Admin
  'super admin': 'SUPER_ADMIN',
  superadmin: 'SUPER_ADMIN',
  'super administrator': 'SUPER_ADMIN',
  'system owner': 'SUPER_ADMIN',
  root: 'SUPER_ADMIN',
  administrator: 'SUPER_ADMIN',

  // IT Admin
  'it admin': 'IT_ADMIN',
  'it lead': 'IT_ADMIN',
  'systems administrator': 'IT_ADMIN',
  'network administrator': 'IT_ADMIN',
  'it manager': 'IT_ADMIN',
  'lead technician': 'IT_ADMIN',
  system_admin: 'IT_ADMIN',
  'it administrator': 'IT_ADMIN',
  'systems lead': 'IT_ADMIN',

  // IT Officer
  'it officer': 'IT_OFFICER',
  'it support': 'IT_OFFICER',
  'help desk': 'IT_OFFICER',
  technician: 'IT_OFFICER',
  'hardware tech': 'IT_OFFICER',
  'it tech': 'IT_OFFICER',
  'network tech': 'IT_OFFICER',
  it: 'IT_OFFICER',
  'support tech': 'IT_OFFICER',

  // Department Head
  'department head': 'DEPARTMENT_HEAD',
  'dept head': 'DEPARTMENT_HEAD',
  hod: 'DEPARTMENT_HEAD',
  'clinical lead': 'DEPARTMENT_HEAD',
  matron: 'DEPARTMENT_HEAD',
  'head of department': 'DEPARTMENT_HEAD',
  'in-charge': 'DEPARTMENT_HEAD',
  'charge nurse': 'DEPARTMENT_HEAD',
  'unit lead': 'DEPARTMENT_HEAD',
  'ward in charge': 'DEPARTMENT_HEAD',

  // Hospital Management
  'hospital management': 'HOSPITAL_MANAGEMENT',
  director: 'HOSPITAL_MANAGEMENT',
  'medical director': 'HOSPITAL_MANAGEMENT',
  'hospital administrator': 'HOSPITAL_MANAGEMENT',
  executive: 'HOSPITAL_MANAGEMENT',
  'hospital manager': 'HOSPITAL_MANAGEMENT',
  superintendent: 'HOSPITAL_MANAGEMENT',
  management: 'HOSPITAL_MANAGEMENT',

  // Procurement Officer
  'procurement officer': 'PROCUREMENT_OFFICER',
  procurement: 'PROCUREMENT_OFFICER',
  storekeeper: 'PROCUREMENT_OFFICER',
  'stores manager': 'PROCUREMENT_OFFICER',
  'supply officer': 'PROCUREMENT_OFFICER',
  'inventory manager': 'PROCUREMENT_OFFICER',
  'stores officer': 'PROCUREMENT_OFFICER',

  // Auditor
  auditor: 'AUDITOR',
  audit: 'AUDITOR',
  'internal auditor': 'AUDITOR',
  qa: 'AUDITOR',
  compliance: 'AUDITOR',
  'quality manager': 'AUDITOR',
  'quality officer': 'AUDITOR',
  'quality assurance': 'AUDITOR',

  // Staff User
  'staff user': 'STAFF_USER',
  'clinical nurse': 'STAFF_USER',
  'staff nurse': 'STAFF_USER',
  nurse: 'STAFF_USER',
  doctor: 'STAFF_USER',
  physician: 'STAFF_USER',
  pharmacist: 'STAFF_USER',
  midwife: 'STAFF_USER',
  'lab technician': 'STAFF_USER',
  'records officer': 'STAFF_USER',
  user: 'STAFF_USER',
  staff: 'STAFF_USER',
  clinician: 'STAFF_USER',
  'general staff': 'STAFF_USER',
  officer: 'STAFF_USER',
};

const ASSET_TYPE_ALIASES: Record<string, string> = {
  // System Unit
  'system unit': 'System Unit',
  systemunit: 'System Unit',
  'system box': 'System Unit',
  'sys unit': 'System Unit',
  'cpu unit': 'System Unit',
  'base unit': 'System Unit',
  'pc unit': 'System Unit',

  // Monitor / Display
  monitor: 'Monitor',
  display: 'Monitor',
  screen: 'Monitor',
  'computer monitor': 'Monitor',
  'desktop monitor': 'Monitor',
  'lcd monitor': 'Monitor',
  'led monitor': 'Monitor',
  tft: 'Monitor',
  'computer screen': 'Monitor',
  'pc screen': 'Monitor',
  'flat panel': 'Monitor',
  'monitor / display': 'Monitor',
  'monitor/display': 'Monitor',

  // Desktop
  'desk computer': 'Desktop',
  'desktop pc': 'Desktop',
  pc: 'Desktop',
  tower: 'Desktop',
  cpu: 'Desktop',
  'all-in-one': 'Desktop',
  aio: 'Desktop',
  'computer set': 'Desktop',
  computer: 'Desktop',
  desktop: 'Desktop',

  // Workstation
  workstation: 'Workstation',
  'work station': 'Workstation',
  'precision workstation': 'Workstation',
  'cad workstation': 'Workstation',
  'tower workstation': 'Workstation',

  // Laptop
  laptop: 'Laptop',
  notebook: 'Laptop',
  'laptop pc': 'Laptop',
  macbook: 'Laptop',
  'portable pc': 'Laptop',
  'laptop computer': 'Laptop',
  thinkpad: 'Laptop',

  // Server
  server: 'Server',
  'rack server': 'Server',
  'blade server': 'Server',
  host: 'Server',
  'domain controller': 'Server',
  'server box': 'Server',
  'database server': 'Server',

  // Switch
  switch: 'Switch',
  'network switch': 'Switch',
  'poe switch': 'Switch',
  'cisco switch': 'Switch',
  'gigabit switch': 'Switch',
  'managed switch': 'Switch',

  // Router
  router: 'Router',
  'wifi router': 'Router',
  gateway: 'Router',
  'edge router': 'Router',
  'starlink router': 'Router',
  'broadband router': 'Router',

  // Firewall
  firewall: 'Firewall',
  'hardware firewall': 'Firewall',
  'edge firewall': 'Firewall',
  fortigate: 'Firewall',
  pfsense: 'Firewall',
  sophos: 'Firewall',

  // Access Point
  'access point': 'Access Point',
  ap: 'Access Point',
  'unifi ap': 'Access Point',
  'wifi ap': 'Access Point',
  'wireless ap': 'Access Point',
  wip: 'Access Point',
  accesspoint: 'Access Point',

  // Printer
  printer: 'Printer',
  'laser printer': 'Printer',
  'receipt printer': 'Printer',
  'thermal printer': 'Printer',
  laserjet: 'Printer',
  inkjet: 'Printer',
  print: 'Printer',
  photocopier: 'Printer',
  mfp: 'Printer',
  deskjet: 'Printer',
  officejet: 'Printer',

  // UPS
  ups: 'UPS',
  'ups backup box': 'UPS',
  'ups backup': 'UPS',
  'battery backup': 'UPS',
  inverter: 'UPS',
  'power backup': 'UPS',
  'uninterruptible power supply': 'UPS',
  'ups box': 'UPS',
  'surge protector': 'UPS',

  // Barcode Scanner
  'barcode scanner': 'Barcode Scanner',
  'barcode reader': 'Barcode Scanner',
  'bar code scanner': 'Barcode Scanner',
  'bar code reader': 'Barcode Scanner',
  'qr scanner': 'Barcode Scanner',
  'handheld scanner': 'Barcode Scanner',
  '2d scanner': 'Barcode Scanner',
  barcode: 'Barcode Scanner',

  // Document & Flatbed Scanner
  scanner: 'Scanner',
  'document scanner': 'Scanner',
  'flatbed scanner': 'Scanner',
  'sheetfed scanner': 'Scanner',
  'photo scanner': 'Scanner',

  // Tablet
  tablet: 'Tablet',
  ipad: 'Tablet',
  'android tablet': 'Tablet',
  tab: 'Tablet',
  'clinical tablet': 'Tablet',
  surface: 'Tablet',

  // Network Cable
  'network cable': 'Network Cable',
  'cat6 cable': 'Network Cable',
  'ethernet cable': 'Network Cable',
  'lan cable': 'Network Cable',
  'patch cord': 'Network Cable',
  cable: 'Network Cable',
  cat6: 'Network Cable',
  rj45: 'Network Cable',

  // Mouse
  mouse: 'Mouse',
  'optical mouse': 'Mouse',
  'wireless mouse': 'Mouse',
  'usb mouse': 'Mouse',

  // Keyboard
  keyboard: 'Keyboard',
  'usb keyboard': 'Keyboard',
  'qwerty keyboard': 'Keyboard',

  // Wi-Fi Adapter
  'wi-fi adapter': 'Wi-Fi Adapter',
  'wifi adapter': 'Wi-Fi Adapter',
  'wifi dongle': 'Wi-Fi Adapter',
  'wlan adapter': 'Wi-Fi Adapter',
  'wireless adapter': 'Wi-Fi Adapter',

  // Bluetooth Adapter
  'bluetooth adapter': 'Bluetooth Adapter',
  'bt dongle': 'Bluetooth Adapter',
  'bluetooth usb': 'Bluetooth Adapter',

  // Projector
  projector: 'Projector',
  'digital projector': 'Projector',
  'video projector': 'Projector',

  // IP Phone / VoIP Phone
  'ip phone': 'IP Phone',
  'voip phone': 'IP Phone',
  voip: 'IP Phone',
  'desk phone': 'IP Phone',
  'office phone': 'IP Phone',

  // Webcam
  webcam: 'Webcam',
  'web camera': 'Webcam',
  'usb webcam': 'Webcam',

  // CCTV Camera
  cctv: 'CCTV Camera',
  'cctv camera': 'CCTV Camera',
  'security camera': 'CCTV Camera',
  'surveillance camera': 'CCTV Camera',
  'ip camera': 'CCTV Camera',
};

const CONDITION_ALIASES: Record<string, string> = {
  excelent: 'Excellent',
  exellent: 'Excellent',
  excellent: 'Excellent',
  mint: 'Excellent',
  flawless: 'Excellent',
  'brand new': 'Excellent',
  perfect: 'Excellent',
  'like new': 'Excellent',

  good: 'Good',
  'fairly good': 'Good',
  working: 'Good',
  ok: 'Good',
  sound: 'Good',
  functional: 'Good',
  satisfactory: 'Good',
  operational: 'Good',

  fair: 'Fair',
  moderate: 'Fair',
  acceptable: 'Fair',
  usable: 'Fair',
  average: 'Fair',
  passable: 'Fair',

  poor: 'Poor',
  bad: 'Poor',
  worn: 'Poor',
  damaged: 'Poor',
  aged: 'Poor',
  critical: 'Poor',

  defective: 'Defective',
  faulty: 'Defective',
  broken: 'Defective',
  dead: 'Defective',
  'non-functional': 'Defective',
  'repair needed': 'Defective',
  'out of order': 'Defective',

  new: 'New',
  sealed: 'New',
  unopened: 'New',
  'in box': 'New',
  brandnew: 'New',
};

const STATUS_ALIASES: Record<string, string> = {
  'in-use': 'In Use',
  'in use': 'In Use',
  operating: 'In Use',
  running: 'In Use',
  deployed: 'In Use',
  operational: 'In Use',
  'active use': 'In Use',

  active: 'Active',
  online: 'Active',
  live: 'Active',
  enabled: 'Active',

  available: 'Available',
  ready: 'Available',
  free: 'Available',
  unassigned: 'Available',
  'in stock': 'Available',
  standby: 'Available',

  assigned: 'Assigned',
  allocated: 'Assigned',
  issued: 'Assigned',

  'in storage': 'In Storage',
  'in-storage': 'In Storage',
  storage: 'In Storage',
  store: 'In Storage',
  warehouse: 'In Storage',
  shelf: 'In Storage',

  'under repair': 'Under Repair',
  'in repair': 'Under Repair',
  repairing: 'Under Repair',
  'broken down': 'Under Repair',
  'at workshop': 'Under Repair',

  maintenance: 'Maintenance',
  'under maintenance': 'Maintenance',
  servicing: 'Maintenance',
  'routine check': 'Maintenance',

  retired: 'Retired',
  obsolete: 'Retired',
  eol: 'Retired',
  'end of life': 'Retired',

  decommissioned: 'Decommissioned',
  scrapped: 'Decommissioned',
  disassembled: 'Decommissioned',

  disposed: 'Disposed',
  'e-waste': 'Disposed',
  recycled: 'Disposed',
  trashed: 'Disposed',

  reserved: 'Reserved',
  held: 'Reserved',
  booking: 'Reserved',
};

/**
 * Calculates string similarity score between 0.0 and 1.0.
 * Combines exact token overlap, substring inclusion, character bi-grams, and edit distance.
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const s2 = str2.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;

  // Substring inclusion bonus
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.8 + 0.2 * (minLen / maxLen);
  }

  // Token set Jaccard similarity
  const tokens1 = new Set(s1.split(/\s+/).filter(Boolean));
  const tokens2 = new Set(s2.split(/\s+/).filter(Boolean));

  let tokenIntersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) tokenIntersection++;
  }
  const tokenUnion = new Set([...tokens1, ...tokens2]).size;
  const tokenScore = tokenUnion > 0 ? tokenIntersection / tokenUnion : 0;

  // Character Bigram Dice Coefficient
  const getBigrams = (s: string) => {
    const bg: string[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      bg.push(s.substring(i, i + 2));
    }
    return bg;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let bgIntersection = 0;
  const bgMap = new Map<string, number>();
  for (const b of bg1) bgMap.set(b, (bgMap.get(b) || 0) + 1);
  for (const b of bg2) {
    const count = bgMap.get(b) || 0;
    if (count > 0) {
      bgIntersection++;
      bgMap.set(b, count - 1);
    }
  }
  const bgScore = bg1.length + bg2.length > 0 ? (2 * bgIntersection) / (bg1.length + bg2.length) : 0;

  return Math.max(tokenScore, bgScore);
}

/**
 * Match a raw string against a list of valid pre-populated options.
 * Detects domain aliases (e.g. Pharmaci -> Pharmacy, Desk Computer -> Desktop,
 * Clinical Nurse -> STAFF_USER, Excelent -> Excellent, In-Use -> In Use).
 * Flags non-matching values, describes the issue type and explanation, and provides suggested options.
 */
export function matchOptionWithFallback<T extends string>(
  rawValue: string | undefined | null,
  validOptions: T[],
  defaultFallback: T,
  fieldName: 'Department' | 'Role' | 'Asset Type' | 'Condition' | 'Status' | string
): FieldMatchResult<T> {
  const cleanRaw = (rawValue || '').trim();

  // If blank/empty, default with exact match
  if (!cleanRaw) {
    return {
      rawValue: cleanRaw,
      matchedValue: defaultFallback,
      isExactMatch: true,
      issueType: null,
      issueLabel: null,
      issueDescription: null,
      suggestedOptions: validOptions,
    };
  }

  const normalizedLower = cleanRaw.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  const normalizedKey = cleanRaw.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Direct Exact Match (case-insensitive or whitespace/hyphen normalized)
  const exact = validOptions.find(
    (opt) =>
      opt.toLowerCase().trim() === cleanRaw.toLowerCase() ||
      opt.toLowerCase().trim().replace(/[\s_-]+/g, ' ') === normalizedLower ||
      opt.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey
  );
  if (exact) {
    return {
      rawValue: cleanRaw,
      matchedValue: exact,
      isExactMatch: true,
      issueType: null,
      issueLabel: null,
      issueDescription: null,
      suggestedOptions: validOptions,
    };
  }

  // 2. Domain-Specific Synonyms & Aliases
  let aliasTarget: string | null = null;
  const upperField = fieldName.toUpperCase();

  if (upperField.includes('DEPT') || upperField.includes('DEPARTMENT')) {
    aliasTarget =
      DEPARTMENT_ALIASES[normalizedLower] ||
      DEPARTMENT_ALIASES[normalizedKey] ||
      DEPARTMENT_ALIASES[cleanRaw.toLowerCase()] ||
      null;
  } else if (upperField.includes('ROLE')) {
    aliasTarget =
      ROLE_ALIASES[normalizedLower] ||
      ROLE_ALIASES[normalizedKey] ||
      ROLE_ALIASES[cleanRaw.toLowerCase()] ||
      null;
  } else if (upperField.includes('ASSET') || upperField.includes('TYPE')) {
    aliasTarget =
      ASSET_TYPE_ALIASES[normalizedLower] ||
      ASSET_TYPE_ALIASES[normalizedKey] ||
      ASSET_TYPE_ALIASES[cleanRaw.toLowerCase()] ||
      null;
  } else if (upperField.includes('COND')) {
    aliasTarget =
      CONDITION_ALIASES[normalizedLower] ||
      CONDITION_ALIASES[normalizedKey] ||
      CONDITION_ALIASES[cleanRaw.toLowerCase()] ||
      null;
  } else if (upperField.includes('STAT')) {
    aliasTarget =
      STATUS_ALIASES[normalizedLower] ||
      STATUS_ALIASES[normalizedKey] ||
      STATUS_ALIASES[cleanRaw.toLowerCase()] ||
      null;
  }

  // Determine standard issue label and type
  let issueCategory: IssueCategory;
  let issueLabel: string;
  if (upperField.includes('DEPT') || upperField.includes('DEPARTMENT')) {
    issueCategory = 'NON_MATCHING_DEPARTMENT';
    issueLabel = 'Non-matching Department';
  } else if (upperField.includes('ROLE')) {
    issueCategory = 'NON_MATCHING_ROLE';
    issueLabel = 'Non-matching Role';
  } else if (upperField.includes('ASSET') || upperField.includes('TYPE')) {
    issueCategory = 'NON_MATCHING_ASSET_TYPE';
    issueLabel = 'Non-matching Asset Type';
  } else if (upperField.includes('COND')) {
    issueCategory = 'NON_MATCHING_CONDITION';
    issueLabel = 'Non-matching Condition';
  } else {
    issueCategory = 'NON_MATCHING_STATUS';
    issueLabel = 'Non-matching Status';
  }

  if (aliasTarget) {
    // Look for aliasTarget in validOptions
    const matchedFromAlias = validOptions.find(
      (opt) =>
        opt.toLowerCase().trim() === aliasTarget!.toLowerCase().trim() ||
        opt.toLowerCase().includes(aliasTarget!.toLowerCase().trim()) ||
        aliasTarget!.toLowerCase().trim().includes(opt.toLowerCase().trim())
    );

    if (matchedFromAlias) {
      return {
        rawValue: cleanRaw,
        matchedValue: matchedFromAlias,
        isExactMatch: false,
        issueType: issueCategory,
        issueLabel,
        issueDescription: `${issueLabel}: "${cleanRaw}" (Mapped to closest: "${matchedFromAlias}")`,
        suggestedOptions: validOptions,
      };
    }
  }

  // 3. High-Confidence Fuzzy Matcher against validOptions
  let bestMatch: T = defaultFallback;
  let maxScore = -1;

  for (const opt of validOptions) {
    const score = calculateSimilarity(cleanRaw, opt);
    if (score > maxScore) {
      maxScore = score;
      bestMatch = opt;
    }
  }

  return {
    rawValue: cleanRaw,
    matchedValue: bestMatch,
    isExactMatch: false,
    issueType: issueCategory,
    issueLabel,
    issueDescription: `${issueLabel}: "${cleanRaw}" (Mapped to closest: "${bestMatch}")`,
    suggestedOptions: validOptions,
  };
}
