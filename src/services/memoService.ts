import {
  type HospitalMemo,
  type AiMemoRequest,
  type AiMemoResponse,
  type MemoStatus,
  type MemoType,
  type User,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  deleteFromStore,
  generateUUID,
} from './localDatabaseService';
import { auditService } from './auditService';

class MemoService {
  /**
   * Retrieve all saved memos from local IndexedDB
   */
  async getMemos(): Promise<HospitalMemo[]> {
    try {
      const items = await getAllFromStore<HospitalMemo>('memos');
      if (!items || items.length === 0) {
        return await this.seedInitialMemos();
      }
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.warn('[MemoService] Could not read from IndexedDB, falling back to initial seed:', err);
      return this.getInitialSeedMemos();
    }
  }

  /**
   * Retrieve single memo by ID
   */
  async getMemoById(id: string): Promise<HospitalMemo | null> {
    try {
      return await getFromStore<HospitalMemo>('memos', id);
    } catch (err) {
      console.error('[MemoService] Failed to load memo:', err);
      return null;
    }
  }

  /**
   * Save or update a memo
   */
  async saveMemo(memo: HospitalMemo, currentUser?: User | null): Promise<HospitalMemo> {
    const now = new Date().toISOString();
    const toSave: HospitalMemo = {
      ...memo,
      updatedAt: now,
      createdAt: memo.createdAt || now,
    };

    await putToStore('memos', toSave);

    if (currentUser) {
      await auditService.logAction(
        memo.createdAt === now ? 'CREATE_MEMO' : 'UPDATE_MEMO',
        'Hospital Memo',
        toSave.id,
        null,
        `${toSave.memoNumber}: ${toSave.title} (${toSave.status})`
      );
    }

    return toSave;
  }

  /**
   * Delete a memo
   */
  async deleteMemo(id: string, currentUser?: User | null): Promise<void> {
    const existing = await this.getMemoById(id);
    await deleteFromStore('memos', id);

    if (currentUser && existing) {
      await auditService.logAction(
        'DELETE_MEMO',
        'Hospital Memo',
        id,
        `${existing.memoNumber}: ${existing.title}`,
        null
      );
    }
  }

  /**
   * Update memo approval status
   */
  async updateMemoStatus(
    id: string,
    status: MemoStatus,
    currentUser: User,
    approvalNote?: string
  ): Promise<HospitalMemo> {
    const memo = await this.getMemoById(id);
    if (!memo) throw new Error('Memo not found');

    const oldStatus = memo.status;
    const now = new Date().toISOString();
    memo.status = status;
    memo.updatedAt = now;

    if (status === 'APPROVED' || status === 'PUBLISHED') {
      memo.approvedBy = {
        name: currentUser.fullName,
        title: currentUser.jobTitle || currentUser.role,
        approvedAt: now,
      };
    }

    await putToStore('memos', memo);

    await auditService.logAction(
      'MEMO_STATUS_CHANGE',
      'Hospital Memo',
      id,
      oldStatus,
      `Status changed to ${status}${approvalNote ? ` - Note: ${approvalNote}` : ''}`
    );

    return memo;
  }

  /**
   * Call AI Write-Up API endpoint (or offline fallback)
   */
  async generateAiMemo(request: AiMemoRequest): Promise<AiMemoResponse> {
    try {
      const response = await fetch('/api/ai/memo-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data && data.memo) {
        return data.memo;
      }
      throw new Error('Invalid response structure from AI write-up endpoint');
    } catch (err: any) {
      console.warn('[MemoService] AI Server call failed, using client-side fallback generator:', err);
      return this.generateOfflineFallbackMemo(request);
    }
  }

  /**
   * Client-side fallback generator for offline resilience
   */
  private generateOfflineFallbackMemo(request: AiMemoRequest): AiMemoResponse {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    const memoNum = `MEMO-${year}-${rand}`;
    const topic = request.topic || 'Hospital IT Operations & Systems Notice';
    const dept = request.department || 'Hospital IT Department';
    const hospitalName = request.hospitalName || 'St. Mary Theresa Catholic Hospital';
    const sender = request.senderName || 'Courage Kay';
    const title = request.senderTitle || 'Super Administrator & Head of IT';

    return {
      memoNumber: memoNum,
      title: `INTERNAL MEMORANDUM: ${topic.toUpperCase()}`,
      memoType: request.memoType,
      targetAudience: request.targetAudience || 'All Clinical Departments, Nursing Supervisors, and Medical Directorate',
      executiveSummary: `This memorandum outlines critical operational and technical guidance regarding ${topic} across ${hospitalName}. Prompt review and compliance is mandated for all unit heads.`,
      backgroundAndContext: `In accordance with hospital accreditation standards and IT operations protocols, this measure is enacted to protect continuous clinical service delivery. ${request.rawNotes ? `Focus points: ${request.rawNotes}` : ''}`,
      detailedFindingsOrBody: `### 1. Purpose & Clinical Scope
The IT Department and Hospital Directorate have established immediate operational guidelines regarding **${topic}**. Continuous patient safety, diagnostic record integrity, and electronic prescribing continuity remain our primary objectives.

### 2. Operational Procedures & Ward Instructions
- **Clinical Workstations:** Ensure all computers in Nursing Stations, OPD, ICU, and Pharmacy remain connected to designated IT surge protectors.
- **LHIMS EMR Record Keeping:** When operating under intermittent connectivity, utilize local offline buffering mode. Records will sync automatically once network links stabilize.
- **Support & Escalations:** Contact the IT Helpdesk immediately at Ext. 2101 if any ward terminal displays connectivity alerts.

### 3. Patient Data Confidentiality & Security
All clinical staff are reminded of patient privacy policies. Shared passwords and unauthorized flash drives are strictly prohibited on hospital care endpoints.`,
      actionRequiredOrChecklist: [
        'Ward In-Charges to brief all shift nurses during morning and evening handovers.',
        'Verify backup paper requisition slips are readily accessible in case of power or connectivity interruptions.',
        'Report any equipment malfunctions immediately via the HITOMS Ticket Portal.',
        'Department Heads to confirm operational compliance to the IT Administrator.',
      ],
      timelineOrDeadline: 'Effective immediately upon publication; active through the current operational cycle.',
      contactPersonOrExtension: `${sender} (${title}) — Ext: 2101 / Emergency On-Call: 2109`,
      recommendedDistribution: 'Circulate to Clinical Noticeboards, Ward In-Charges, Pharmacy Lead, Laboratory Head, and IT Archives',
      isFallback: true,
    };
  }

  /**
   * Seed initial realistic hospital memos
   */
  async seedInitialMemos(): Promise<HospitalMemo[]> {
    const seed = this.getInitialSeedMemos();
    for (const item of seed) {
      await putToStore('memos', item);
    }
    return seed;
  }

  getInitialSeedMemos(): HospitalMemo[] {
    return [
      {
        id: 'memo-001',
        memoNumber: 'MEMO-2026-001',
        title: 'INTERNAL MEMORANDUM: Deployment of Starlink WAN & Clinical Satellite Failover Protocols',
        memoType: 'EXECUTIVE_IT_MEMO',
        department: 'Hospital IT Department',
        targetAudience: 'All Clinical Heads of Department, Nursing Supervisors, Medical Directorate, and Pharmacy',
        targetRoles: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD', 'STAFF_USER'],
        fromSender: {
          uid: 'usr-courage-kay',
          name: 'Courage Kay',
          role: 'SUPER_ADMIN',
          title: 'Super Administrator & Head of IT Operations',
        },
        executiveSummary: 'This memorandum details the commissioning of our primary Starlink High-Speed Satellite terminal as an automated failover link to safeguard 100% EHR uptime across emergency, theater, and inpatient wards.',
        backgroundAndContext: 'Following recurrent fiber line cuts along the municipal highway that caused transient outages in our clinical electronic records (LHIMS), the hospital board authorized the procurement of a Starlink satellite link. This ensures uninterrupted diagnostic access even during regional telecommunication blackouts.',
        detailedFindingsOrBody: `### 1. Network Architecture Overview
The hospital core routing infrastructure in Datacenter Rack 1 has been configured with automated BGP dual-homing.
- **Primary WAN:** Fiber High-Speed Optical Link (300 Mbps).
- **Secondary Auto-Failover WAN:** Starlink Satellite Enterprise Terminal (220 Mbps).
- **Failover Delay:** Less than 4 seconds. All LHIMS EMR sessions, PACS imaging queries, and pharmacy dispenses will persist without session drops.

### 2. Ward Equipment Power Directives
The Starlink dishy and core switches are backed by a dedicated 6kVA Online Double-Conversion UPS and secondary hospital generator line 2. Under no circumstance should clinical staff unplug or tap auxiliary medical devices into the red-labeled IT sockets.

### 3. Monitoring & Incident Protocol
The IT Network Operations Center monitors latency and packet jitter 24/7. In the event of severe weather attenuation, the HITOMS system will sound the automated system notification ring on IT terminals.`,
        actionRequiredOrChecklist: [
          'All Ward Supervisors to verify that emergency workstation ethernet cables remain seated in wall port A.',
          'Biomedical engineers must not plug autoclave or suction pumps into red IT emergency power outlets.',
          'Clinical staff encountering slow load times in OPD should submit a Helpdesk ticket referencing Category: Internet.',
        ],
        timelineOrDeadline: 'Active with immediate effect; full testing validated on September 15, 2026.',
        contactPersonOrExtension: 'Courage Kay (Super Admin) — Ext. 2101 / Lead Network Admin Ext. 2102',
        recommendedDistribution: 'Clinical Directorate, All Inpatient Wards, Laboratory In-Charge, Finance Office',
        status: 'PUBLISHED',
        isAiGenerated: true,
        aiPromptContext: 'Starlink satellite failover implementation for hospital EHR continuity',
        tags: ['Network', 'Starlink', 'LHIMS', 'Continuity', 'Infrastructure'],
        createdAt: '2026-09-15T09:00:00Z',
        updatedAt: '2026-09-15T10:30:00Z',
        approvedBy: {
          name: 'Courage Kay',
          title: 'Super Administrator & CIO',
          approvedAt: '2026-09-15T10:30:00Z',
        },
      },
      {
        id: 'memo-002',
        memoNumber: 'MEMO-2026-002',
        title: 'CLINICAL ADVISORY: LHIMS Electronic Health Record Offline Operating & Paper Fallback Protocol',
        memoType: 'CLINICAL_ADVISORY',
        department: 'Clinical Operations & Health Informatics',
        targetAudience: 'Emergency Department, Outpatient Clinics, Intensive Care Unit, and Main Pharmacy',
        targetRoles: ['DEPARTMENT_HEAD', 'STAFF_USER', 'HOSPITAL_MANAGEMENT', 'IT_OFFICER'],
        fromSender: {
          uid: 'usr-sarah-mensah',
          name: 'Dr. Sarah Mensah',
          role: 'HOSPITAL_MANAGEMENT',
          title: 'Medical Director & Chief of Clinical Services',
        },
        executiveSummary: 'Mandatory clinical guideline outlining procedures for bedside documentation, electronic drug dispensing, and emergency patient admissions during scheduled or unexpected LHIMS server maintenance.',
        backgroundAndContext: 'Patient safety requires zero ambiguity during electronic system transitions. This advisory establishes the formal boundary conditions under which paper encounter forms must be initiated and subsequently digitized by medical records clerks.',
        detailedFindingsOrBody: `### 1. Identification of Downtime
A downtime event is declared when LHIMS displays the red offline banner or fails to retrieve patient charts for greater than 5 consecutive minutes across more than two clinical terminals.

### 2. Immediate Clinical Action Steps
- **Emergency Triage:** Triage nurses must immediately utilize the yellow Emergency Encounter Paper Triage binders located in the triage bay lockbox.
- **Medication Orders:** High-alert medications (e.g. Insulin, Heparin, Potassium IV, Opioids) must be hand-written on dual-signature carbon prescription pads.
- **Laboratory Orders:** Stat blood gases, troponin, and full blood counts must be stamped with emergency patient barcodes and physically walked to the main lab.

### 3. Recovery & Record Reconciliation
Once the IT Department issues the "LHIMS Normal Operations Restored" broadcast, nursing in-charges will coordinate with Health Information Management (HIM) staff to retroactively enter all paper records within 4 hours.`,
        actionRequiredOrChecklist: [
          'Confirm each ward nursing station has at least 50 blank paper clinical encounter forms on standby.',
          'Verify emergency red barcode stamp pads are functional at OPD and ER reception desks.',
          'Report any discrepancies between physical medication dispenses and digital ledger to Pharmacy Supervisor.',
        ],
        timelineOrDeadline: 'Mandatory hospital policy effective across all shifts.',
        contactPersonOrExtension: 'Dr. Sarah Mensah (Medical Director) — Ext. 1002 | IT Emergency Ring: Ext. 2101',
        recommendedDistribution: 'All Clinical Noticeboards, Doctors Common Room, Nursing Supervisors Office, Pharmacy',
        status: 'PUBLISHED',
        isAiGenerated: true,
        aiPromptContext: 'Standard operating procedure for LHIMS EMR downtime and clinical paper fallback',
        tags: ['Clinical', 'LHIMS', 'EMR', 'Patient Safety', 'Protocol'],
        createdAt: '2026-09-18T14:15:00Z',
        updatedAt: '2026-09-18T16:00:00Z',
        approvedBy: {
          name: 'Dr. Sarah Mensah',
          title: 'Medical Director',
          approvedAt: '2026-09-18T16:00:00Z',
        },
      },
      {
        id: 'memo-003',
        memoNumber: 'MEMO-2026-003',
        title: 'EXECUTIVE IT REPORT: August / September 2026 Operations Performance, SLA Compliance & Ward Audit',
        memoType: 'OPERATIONS_REPORT',
        department: 'Hospital IT Operations & Systems Administration',
        targetAudience: 'Hospital Executive Committee, Quality Assurance Board, and Department Heads',
        targetRoles: ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER', 'HOSPITAL_MANAGEMENT', 'DEPARTMENT_HEAD', 'PROCUREMENT_OFFICER', 'AUDITOR', 'STAFF_USER'],
        fromSender: {
          uid: 'usr-courage-kay',
          name: 'Courage Kay',
          role: 'SUPER_ADMIN',
          title: 'Super Administrator & Head of IT Operations',
        },
        executiveSummary: 'Comprehensive monthly operational review summarizing 148 logged helpdesk tickets, 98.6% SLA resolution adherence, zero hospital-wide downtime, and preventative maintenance audit findings.',
        backgroundAndContext: 'HITOMS continuously tracks clinical IT availability, equipment health, consumable burn rates, and response metrics. This debrief provides executive leadership with data-driven insights to guide capital allocation and ward technology investments.',
        detailedFindingsOrBody: `### 1. Key Performance Highlights
- **Total Logged Tickets:** 148 requests (Hardware: 38%, Network: 24%, LHIMS: 22%, Printer: 16%).
- **Average First Response Time:** 14 minutes (Target: < 30 minutes).
- **Critical SLA Resolution Rate:** 98.6% compliance (Critical issues resolved in < 2.5 hours).
- **System Uptime:** 99.94% for LHIMS Core Server; Starlink backup engaged twice seamlessly during local municipal power shifts.

### 2. Ward Equipment Maintenance Status
Preventive maintenance cycles were completed for 100% of Emergency, Maternity, and ICU workstations. Thermal paste replenishment, dust expulsion, and antivirus definitions were verified on all 68 active endpoints.

### 3. Vulnerabilities & Strategic Recommendations
- **OPD Printer Fatigue:** Thermal barcode printers in Pharmacy and OPD have exceeded their rated 500,000-cut lifecycle, resulting in recurring roller jams.
- **Server Room UPS Batteries:** Datacenter Rack 2 battery string exhibits internal resistance degradation; budget requisition has been submitted for immediate replacement.`,
        actionRequiredOrChecklist: [
          'Executive Board to review and approve Q4 IT Consumables & Battery procurement budget.',
          'Pharmacy Head to schedule thermal barcode printer maintenance window during low-traffic night shift.',
          'HR & IT to finalize onboarding credentials for new clinical rotations before the 1st of next month.',
        ],
        timelineOrDeadline: 'Review requested prior to the upcoming Board of Governors meeting on September 30, 2026.',
        contactPersonOrExtension: 'Courage Kay (Super Admin) — Ext. 2101 / IT Administration Desk',
        recommendedDistribution: 'Hospital Director, Medical Director, Director of Nursing, Head of Finance',
        status: 'APPROVED',
        isAiGenerated: true,
        aiPromptContext: 'Executive monthly IT operations performance and SLA audit report',
        tags: ['Executive', 'SLA', 'Performance', 'Audit', 'Monthly Report'],
        createdAt: '2026-09-20T11:00:00Z',
        updatedAt: '2026-09-20T15:20:00Z',
        approvedBy: {
          name: 'Courage Kay',
          title: 'Super Administrator & CIO',
          approvedAt: '2026-09-20T15:20:00Z',
        },
      },
      {
        id: 'memo-004',
        memoNumber: 'MEMO-2026-004',
        title: 'TECHNICAL JUSTIFICATION: Urgent Requisition for Datacenter UPS Replacement & Ward Barcode Scanners',
        memoType: 'EQUIPMENT_JUSTIFICATION',
        department: 'Hospital IT Department',
        targetAudience: 'Procurement Directorate, Finance Committee, and Hospital Administrator',
        fromSender: {
          uid: 'usr-emmanuel-boateng',
          name: 'Emmanuel Boateng',
          role: 'IT_ADMIN',
          title: 'Lead Systems & Hardware Administrator',
        },
        executiveSummary: 'Formal procurement and engineering justification for the emergency acquisition of eight (8) high-rate discharge UPS battery modules and six (6) 2D antimicrobial handheld clinical barcode scanners.',
        backgroundAndContext: 'During our recent quarterly power failover simulation, the secondary Datacenter UPS sustained only 6 minutes of backup power instead of the required 30-minute generator transition window. Failure to replace these cells risks abrupt shutdown of our primary EHR database during public grid surges.',
        detailedFindingsOrBody: `### 1. Engineering Assessment of Datacenter Battery Array
The APC Smart-UPS RT 10,000VA unit powering LHIMS Database Cluster has been in continuous service for 38 months. Float voltage measurements revealed cell swellings in Module 3 and 4, causing safety cutoff switches to trip prematurely.
- **Total Cost of Battery String:** $1,850 USD.
- **Risk of Non-Action:** Catastrophic database corruption or downtime during generator changeover.

### 2. Clinical Ward Barcode Scanner Requisition
Nursing staff in Female Ward and Pediatrics report intermittent USB disconnection when scanning patient wristband barcodes. Six units have suffered casing cracks following disinfectant wiping over the past 2 years.
- **Recommended Model:** Zebra DS2208-HC Medical Grade Antimicrobial Barcode Scanner.
- **Unit Cost:** $175 x 6 = $1,050 USD.
- **Clinical Benefit:** Accurate drug administration (Five Rights of Medication) and rapid specimen labeling at the bedside.`,
        actionRequiredOrChecklist: [
          'Procurement Officer to request immediate quotation from authorized regional healthcare IT vendors.',
          'Finance Directorate to authorize expedited disbursement under IT Emergency Maintenance allocation.',
          'IT Department to coordinate overnight installation upon delivery to avoid clinical disruption.',
        ],
        timelineOrDeadline: 'Approval requested within 5 business days to avert power safety risks.',
        contactPersonOrExtension: 'Emmanuel Boateng (Lead Systems Admin) / Courage Kay (Super Admin) — Ext. 2101',
        recommendedDistribution: 'Procurement Committee, Internal Auditor, Financial Controller',
        status: 'UNDER_REVIEW',
        isAiGenerated: true,
        aiPromptContext: 'Urgent technical procurement justification for datacenter UPS and ward barcode scanners',
        tags: ['Procurement', 'Hardware', 'UPS', 'Patient Safety', 'Justification'],
        createdAt: '2026-09-21T08:30:00Z',
        updatedAt: '2026-09-21T09:45:00Z',
      },
    ];
  }
}

export const memoService = new MemoService();
