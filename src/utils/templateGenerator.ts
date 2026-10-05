import * as XLSX from 'xlsx';
import { settingsService } from '../services/settingsService';
import { type Department, type Asset, type User } from '../types';

export interface TemplateOptions {
  hospitalName?: string;
  facilityTitle?: string;
}

/**
 * Returns active hospital name from settings
 */
export function getActiveHospitalName(customName?: string): string {
  if (customName && customName.trim()) return customName.trim();
  try {
    const settings = settingsService.getSettingsSync();
    if (settings?.hospitalName && settings.hospitalName.trim()) {
      return settings.hospitalName.trim();
    }
  } catch (e) {}
  return 'St. Mary Theresa Catholic Hospital (SMTCH)';
}

/**
 * Generates and downloads a beautifully formatted Excel (.xlsx) template for Departments
 * Uses actual active hospital departments if available; otherwise falls back to sample rows.
 */
export function downloadDepartmentTemplateExcel(
  customHospitalName?: string,
  existingDepartments: Department[] = []
): void {
  const hospital = getActiveHospitalName(customHospitalName).toUpperCase();
  const wb = XLSX.utils.book_new();

  // 1. Department Template Data
  const sheetData: any[][] = [
    // Banner Header Row 1: Hospital Name
    [`🏥 ${hospital}`, '', '', '', '', '', '', ''],
    // Banner Header Row 2: Template Name
    ['OFFICIAL HOSPITAL DEPARTMENT REGISTRY BULK IMPORT TEMPLATE', '', '', '', '', '', '', ''],
    // Instructions Banner Row 3
    [
      'INSTRUCTIONS: Fill in your official hospital departments/wards below. Required columns are marked with (*). For isEmergency, specify TRUE or FALSE. Do not rename header columns in row 4.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    // Table Column Headers (Row 4)
    [
      'code',
      'name',
      'building',
      'floor',
      'locationDescription',
      'headOfDepartment',
      'phone',
      'isEmergency',
    ],
  ];

  if (existingDepartments && existingDepartments.length > 0) {
    // Populate with actual hospital departments
    existingDepartments.forEach((d) => {
      sheetData.push([
        d.code || '',
        d.name || '',
        d.building || '',
        d.floor || '',
        d.locationDescription || '',
        d.headOfDepartment || '',
        d.phone || '',
        d.isEmergency ? 'TRUE' : 'FALSE',
      ]);
    });
  } else {
    // Sample fallback data rows only when registry is empty
    const sampleRows = [
      [
        'A&E',
        'Accident & Emergency (A&E)',
        'Emergency Complex',
        'Ground Floor',
        'Emergency Complex, Ground Floor Ambulance Bay',
        'Dr. Kwame Mensah',
        'Ext. 101',
        'TRUE',
      ],
      [
        'ICU',
        'Intensive Care Unit (ICU)',
        'Main Clinical Block',
        '1st Floor',
        'Main Clinical Block, 1st Floor Critical Care Wing',
        'Dr. Sarah Owusu',
        'Ext. 102',
        'TRUE',
      ],
      [
        'OPD',
        'OPD (Outpatient Department)',
        'Main Hospital Atrium',
        'Ground Floor',
        'Central OPD Consultation Suites 1-8',
        'Mrs. Grace Mensah',
        'Ext. 103',
        'FALSE',
      ],
      [
        'THEATRE',
        'Main Surgical Theatre',
        'Surgical Wing',
        '2nd Floor',
        'Surgical Wing, Operating Suites 1-4 & Recovery',
        'Dr. Alex Osei',
        'Ext. 104',
        'TRUE',
      ],
      [
        'MAT',
        'Maternity & Neonatal',
        'Maternity Pavilion',
        'Ground Floor',
        'Maternity Pavilion, Labor & Delivery Suites',
        'Dr. Joyce Antwi',
        'Ext. 105',
        'TRUE',
      ],
      [
        'LAB',
        'Diagnostic Laboratory',
        'Diagnostic Center',
        'Ground Floor',
        'Diagnostic Center, Pathology & Hematology Wing',
        'Mr. David Boateng',
        'Ext. 106',
        'FALSE',
      ],
      [
        'PHARM',
        'Central Pharmacy',
        'Main Hospital Complex',
        'Ground Floor',
        'Central Dispensary Counter & Inpatient Stores',
        'Pharm. Esther Darko',
        'Ext. 107',
        'FALSE',
      ],
      [
        'RAD',
        'Radiology & Imaging',
        'Diagnostic Center',
        'Ground Floor',
        'Diagnostic Center, Digital X-Ray & Ultrasound Suite',
        'Dr. Patrick Koomson',
        'Ext. 108',
        'FALSE',
      ],
      [
        'PED',
        "Children's Ward (Pediatrics)",
        'Pediatric Block',
        '1st Floor',
        "Children's Ward, Pediatric Inpatient Wing",
        'Dr. Comfort Agyei',
        'Ext. 109',
        'FALSE',
      ],
      [
        'IT',
        'IT & Systems Administration',
        'Administration Block',
        '1st Floor',
        'IT Operations Center & Main Server Room',
        'Courage Kekesi',
        'Ext. 2101',
        'FALSE',
      ],
    ];
    sampleRows.forEach((r) => sheetData.push(r));
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set merged headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Hospital Name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Template Title
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }, // Instructions
  ];

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // code
    { wch: 34 }, // name
    { wch: 24 }, // building
    { wch: 16 }, // floor
    { wch: 45 }, // locationDescription
    { wch: 24 }, // headOfDepartment
    { wch: 16 }, // phone
    { wch: 22 }, // isEmergency (TRUE / FALSE)
  ];

  // Set row heights
  ws['!rows'] = [
    { hpt: 28 }, // Hospital Name
    { hpt: 22 }, // Template Name
    { hpt: 30 }, // Instructions
    { hpt: 24 }, // Headers
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Departments Template');

  // 2. Reference & Dropdown Guide Sheet
  const refData: any[][] = [
    ['REFERENCE & DROPDOWN VALUE GUIDE', '', ''],
    ['Field Name', 'Allowed Values / Format', 'Description & Clinical Context'],
    [
      'isEmergency',
      'TRUE',
      'Critical / Emergency units (A&E, ICU, Theatre, Maternity, Neonatal, Trauma). Triggers emergency ticket priorities.',
    ],
    [
      'isEmergency',
      'FALSE',
      'Standard clinical wards, diagnostic centers, and administrative departments.',
    ],
    [
      'code',
      'A&E, ICU, OPD, THEATRE, MAT, LAB, PHARM, RAD, PED, IT, ADMIN, FIN',
      'Standard unique hospital abbreviation (2 to 7 uppercase alphanumeric characters).',
    ],
    [
      'building',
      'Emergency Complex, Main Clinical Block, Surgical Wing, Maternity Pavilion, Diagnostic Center, Administration Block',
      'Designated hospital building or wing structure.',
    ],
    [
      'floor',
      'Ground Floor, 1st Floor, 2nd Floor, 3rd Floor, Basement',
      'Vertical elevation level within the hospital complex.',
    ],
  ];

  const wsRef = XLSX.utils.aoa_to_sheet(refData);
  wsRef['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  wsRef['!cols'] = [{ wch: 18 }, { wch: 35 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Reference Guide');

  const fileName = `${hospital.replace(/[^A-Za-z0-9]/g, '_')}_Departments_Template.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generates and downloads a beautifully formatted Excel (.xlsx) template for Hardware Assets
 * Uses actual active hospital assets if available; otherwise falls back to sample rows.
 */
export function downloadAssetTemplateExcel(
  customHospitalName?: string,
  validAssetTypes: string[] = [],
  validDepartments: string[] = [],
  existingAssets: Asset[] = []
): void {
  const hospital = getActiveHospitalName(customHospitalName).toUpperCase();
  const wb = XLSX.utils.book_new();

  const typesList = validAssetTypes.length > 0 ? validAssetTypes : [
    'Desktop',
    'System Unit',
    'Monitor',
    'Monitor / Display',
    'Laptop',
    'Workstation',
    'Server',
    'Network Switch',
    'Wi-Fi Access Point',
    'Network Router',
    'Printer',
    'UPS',
    'Barcode Scanner',
    'Scanner',
    'Tablet',
    'Projector',
    'Webcam',
    'IP Phone',
    'CCTV Camera',
  ];

  const deptsList = validDepartments.length > 0 ? validDepartments : [
    'Accident & Emergency (A&E)',
    'Intensive Care Unit (ICU)',
    'OPD (Outpatient Department)',
    'Main Surgical Theatre',
    'Diagnostic Laboratory',
    'Central Pharmacy',
    'Radiology & Imaging',
    'Maternity & Neonatal',
    'IT & Systems Administration',
  ];

  const sheetData: any[][] = [
    // Header Banner
    [`🖥️ ${hospital}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['OFFICIAL HARDWARE ASSET REGISTRY BULK IMPORT TEMPLATE', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [
      'INSTRUCTIONS: Fill in hardware assets below. Required columns marked (*). Use standard values from the Reference Guide sheet for assetType, condition, and status. Asset Tag is optional (auto-assigned if left blank).',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    // Table Headers (Row 4)
    [
      'assetTag',
      'assetType',
      'manufacturer',
      'model',
      'serialNumber',
      'department',
      'location',
      'assignedUser',
      'condition',
      'status',
      'operatingSystem',
      'ipAddress',
      'macAddress',
      'purchasePrice',
      'specifications',
      'notes',
    ],
  ];

  if (existingAssets && existingAssets.length > 0) {
    // Populate with actual hospital assets
    existingAssets.forEach((a) => {
      sheetData.push([
        a.assetTag || '',
        a.assetType || (a as any).type || 'Desktop',
        a.manufacturer || '',
        a.model || '',
        a.serialNumber || '',
        a.department || '',
        a.location || '',
        a.assignedUser || '',
        a.condition || 'Good',
        a.status || 'Active',
        a.operatingSystem || '',
        a.ipAddress || '',
        a.macAddress || '',
        a.purchasePrice ? String(a.purchasePrice) : '',
        a.specifications || '',
        a.notes || '',
      ]);
    });
  } else {
    // Sample fallback rows
    const sampleRows = [
      [
        'AST-SMTCH-00101',
        'Desktop',
        'Dell',
        'OptiPlex 7090 Micro',
        'DEL7090SN4412',
        'Accident & Emergency (A&E)',
        'Triage Desk 1',
        'Dr. Kwame Mensah',
        'Good',
        'Assigned',
        'Windows 11 Pro',
        '10.10.16.42',
        '00:1A:2B:3C:4D:5E',
        '850.00',
        'Intel Core i5-11500, 16GB RAM, 512GB NVMe SSD',
        'Emergency triage intake workstation',
      ],
      [
        'AST-SMTCH-00102',
        'Desktop',
        'HP',
        'ProDesk 400 G7 SFF',
        'HP400G7SN8891',
        'Diagnostic Laboratory',
        'Hematology Bench 2',
        'Mr. David Boateng',
        'New',
        'Assigned',
        'Windows 10 Pro',
        '10.10.16.55',
        '00:1A:2B:3C:4D:6F',
        '920.00',
        'Intel Core i7-10700, 32GB RAM, 1TB SSD',
        'Connected to Sysmex hematology analyzer',
      ],
      [
        'AST-SMTCH-00103',
        'Laptop',
        'Lenovo',
        'ThinkPad T14 Gen 3',
        'LENT14SN9930',
        'Main Surgical Theatre',
        'Theatre Recovery Desk',
        'Dr. Alex Osei',
        'Good',
        'Assigned',
        'Windows 11 Pro',
        '10.10.16.71',
        '00:1A:2B:3C:4D:7A',
        '1250.00',
        'AMD Ryzen 7 PRO, 16GB RAM, 512GB SSD',
        'Mobile ward round and surgical log terminal',
      ],
      [
        'AST-SMTCH-00104',
        'Printer',
        'Zebra',
        'ZD421 Healthcare Thermal',
        'ZEB421SN1120',
        'OPD (Outpatient Department)',
        'OPD Records Counter',
        '',
        'Good',
        'Available',
        'Firmware v8.4',
        '10.10.16.88',
        '00:1A:2B:3C:4D:8B',
        '450.00',
        'Direct Thermal, Antimicrobial casing, USB/Ethernet',
        'Patient wristband and specimen barcode printer',
      ],
      [
        'AST-SMTCH-00105',
        'Network Switch',
        'Cisco',
        'Catalyst 2960X-48FPS-L',
        'CIS2960SN3390',
        'IT & Systems Administration',
        'Core Server Room Rack 1',
        'Courage Kekesi',
        'Good',
        'Assigned',
        'Cisco IOS 15.2',
        '10.10.16.1',
        '00:1A:2B:3C:4D:9C',
        '1800.00',
        '48-Port PoE+ Gigabit, 4x 1G SFP uplinks',
        'Distribution core switch for clinical LAN',
      ],
    ];
    sampleRows.forEach((r) => sheetData.push(r));
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 15 } },
  ];

  ws['!cols'] = [
    { wch: 18 }, // assetTag
    { wch: 22 }, // assetType
    { wch: 18 }, // manufacturer
    { wch: 24 }, // model
    { wch: 22 }, // serialNumber
    { wch: 32 }, // department
    { wch: 26 }, // location
    { wch: 22 }, // assignedUser
    { wch: 16 }, // condition
    { wch: 16 }, // status
    { wch: 18 }, // operatingSystem
    { wch: 16 }, // ipAddress
    { wch: 20 }, // macAddress
    { wch: 14 }, // purchasePrice
    { wch: 38 }, // specifications
    { wch: 34 }, // notes
  ];

  ws['!rows'] = [
    { hpt: 28 },
    { hpt: 22 },
    { hpt: 30 },
    { hpt: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Assets Template');

  // Reference sheet with all dropdown options
  const maxRows = Math.max(typesList.length, deptsList.length, 5);
  const refRows: any[][] = [
    ['DROPDOWN REFERENCE OPTIONS', '', '', ''],
    ['Valid Asset Types', 'Valid Conditions', 'Valid Statuses', 'Valid Hospital Departments'],
  ];

  const conditions = ['New', 'Good', 'Fair', 'Poor', 'Damaged'];
  const statuses = ['Available', 'Assigned', 'Maintenance', 'Retired'];

  for (let i = 0; i < maxRows; i++) {
    refRows.push([
      typesList[i] || '',
      conditions[i] || '',
      statuses[i] || '',
      deptsList[i] || '',
    ]);
  }

  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  wsRef['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  wsRef['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Dropdown Reference');

  const fileName = `${hospital.replace(/[^A-Za-z0-9]/g, '_')}_Hardware_Assets_Template.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generates and downloads a beautifully formatted Excel (.xlsx) template for Hospital Staff Roster
 * Uses actual active hospital users if available; otherwise falls back to sample rows.
 */
export function downloadStaffTemplateExcel(
  customHospitalName?: string,
  validDepartments: string[] = [],
  existingUsers: User[] = []
): void {
  const hospital = getActiveHospitalName(customHospitalName).toUpperCase();
  const wb = XLSX.utils.book_new();

  const deptsList = validDepartments.length > 0 ? validDepartments : [
    'Accident & Emergency (A&E)',
    'Intensive Care Unit (ICU)',
    'OPD (Outpatient Department)',
    'Main Surgical Theatre',
    'Diagnostic Laboratory',
    'Central Pharmacy',
    'Radiology & Imaging',
    'Maternity & Neonatal',
    'IT & Systems Administration',
    'Hospital Administration & HR',
  ];

  const sheetData: any[][] = [
    [`👥 ${hospital}`, '', '', '', '', ''],
    ['OFFICIAL STAFF DIRECTORY & ACCOUNTS BULK IMPORT TEMPLATE', '', '', '', '', ''],
    [
      'INSTRUCTIONS: Fill in staff members below. Full Name is required (*). Role must match one of the standard hospital roles on the Reference sheet. Initial passwords will be generated automatically based on surname.',
      '',
      '',
      '',
      '',
      '',
    ],
    // Table Headers
    ['fullName', 'department', 'role', 'jobTitle', 'phone', 'email'],
  ];

  const staffToExport = (existingUsers || []).filter(
    (u) => u.role !== 'SUPER_ADMIN' && u.username?.toLowerCase() !== 'admin' && u.id !== 'usr-admin-001'
  );

  const finalUsersList = staffToExport.length > 0 ? staffToExport : (existingUsers || []);

  if (finalUsersList && finalUsersList.length > 0) {
    // Populate with actual hospital staff users
    finalUsersList.forEach((u) => {
      sheetData.push([
        u.fullName || u.username || '',
        u.department || '',
        u.role || 'STAFF_USER',
        u.jobTitle || '',
        u.phone || '',
        u.email || '',
      ]);
    });
  } else {
    // Sample fallback rows
    const sampleRows = [
      [
        'Dr. Kwame Mensah',
        'Accident & Emergency (A&E)',
        'STAFF_USER',
        'Consultant Emergency Physician',
        '+233 24 100 2001',
        'kwame.mensah@hospital.local',
      ],
      [
        'Dr. Sarah Owusu',
        'Intensive Care Unit (ICU)',
        'STAFF_USER',
        'Head of Critical Care Medicine',
        '+233 24 100 2002',
        'sarah.owusu@hospital.local',
      ],
      [
        'Pharm. Esther Darko',
        'Central Pharmacy',
        'PHARMACY_DISPENSER',
        'Chief Clinical Pharmacist',
        '+233 24 100 2003',
        'esther.darko@hospital.local',
      ],
      [
        'Mr. David Boateng',
        'Diagnostic Laboratory',
        'LAB_TECHNICIAN',
        'Senior Medical Laboratory Scientist',
        '+233 24 100 2004',
        'david.boateng@hospital.local',
      ],
      [
        'Mrs. Grace Mensah',
        'OPD (Outpatient Department)',
        'NURSE_MANAGER',
        'Principal Nursing Officer & In-Charge',
        '+233 24 100 2005',
        'grace.mensah@hospital.local',
      ],
      [
        'Mr. Samuel Annan',
        'Health Information Management (LHIMS / Records)',
        'RECORDS_CLERK',
        'Senior Health Records Officer',
        '+233 24 100 2006',
        'samuel.annan@hospital.local',
      ],
      [
        'Ing. Emmanuel Tetteh',
        'Biomedical Engineering',
        'CLINICAL_ENGINEER',
        'Lead Biomedical & Clinical Engineer',
        '+233 24 100 2007',
        'emmanuel.tetteh@hospital.local',
      ],
      [
        'Courage Kekesi',
        'IT & Systems Administration',
        'SUPER_ADMIN',
        'Senior IT Manager & Super Administrator',
        '+233 24 174 4004',
        'courage.kay@hospital.local',
      ],
    ];
    sampleRows.forEach((r) => sheetData.push(r));
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
  ];

  ws['!cols'] = [
    { wch: 28 }, // fullName
    { wch: 36 }, // department
    { wch: 24 }, // role
    { wch: 34 }, // jobTitle
    { wch: 20 }, // phone
    { wch: 32 }, // email
  ];

  ws['!rows'] = [
    { hpt: 28 },
    { hpt: 22 },
    { hpt: 30 },
    { hpt: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Staff Roster Template');

  // Roles reference sheet
  const rolesGuide = [
    ['ROLES & ACCESS PERMISSIONS REFERENCE', '', ''],
    ['Standard Role Identifier', 'Access Level & Typical Clinical Role', 'Hospital Departments'],
    ['STAFF_USER', 'Standard clinical & ward staff (Doctors, Nurses, Ward Clerks)', deptsList[0] || ''],
    ['NURSE_MANAGER', 'Ward in-charge, sister-in-charge, nurse supervisors', deptsList[1] || ''],
    ['PHARMACY_DISPENSER', 'Dispensary & pharmacy staff managing prescription fulfillment', deptsList[2] || ''],
    ['LAB_TECHNICIAN', 'Laboratory technologists & diagnostic scientists', deptsList[3] || ''],
    ['RECORDS_CLERK', 'LHIMS medical records and patient reception officers', deptsList[4] || ''],
    ['CLINICAL_ENGINEER', 'Biomedical engineers managing medical equipment telemetry', deptsList[5] || ''],
    ['IT_OFFICER', 'IT support officers managing hardware, tickets, and network', deptsList[6] || ''],
    ['IT_ADMIN', 'Senior IT administrators with configuration privileges', deptsList[7] || ''],
    ['HOSPITAL_MANAGEMENT', 'Medical Director, Hospital Administrator, Nursing Director', deptsList[8] || ''],
    ['SUPER_ADMIN', 'Full system control, user access, and disaster recovery', deptsList[9] || ''],
  ];

  const wsRoles = XLSX.utils.aoa_to_sheet(rolesGuide);
  wsRoles['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  wsRoles['!cols'] = [{ wch: 24 }, { wch: 55 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsRoles, 'Roles Reference');

  const fileName = `${hospital.replace(/[^A-Za-z0-9]/g, '_')}_Staff_Directory_Template.xlsx`;
  XLSX.writeFile(wb, fileName);
}
