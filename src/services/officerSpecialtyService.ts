import {
  type OfficerMonthlySpecialty,
  type TicketCategory,
  type User,
  type SystemSettings,
} from '../types';
import { getAllFromStore, putToStore } from './localDatabaseService';
import { settingsService } from './settingsService';
import { auditService } from './auditService';

export const ALL_SPECIALTY_CATEGORIES: TicketCategory[] = [
  'Network',
  'Internet',
  'Hardware',
  'Printer',
  'Software',
  'Hospital System',
  'Server',
  'Security',
  'Account/Login',
  'Email',
  'Other',
];

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // e.g. "2026-09"
}

export function formatMonthName(monthKey: string): string {
  try {
    const [year, month] = monthKey.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return monthKey;
  }
}

export function getDefaultSpecialtiesForMonth(monthKey: string): OfficerMonthlySpecialty[] {
  return [
    {
      id: `spec-${monthKey}-officer-003`,
      userId: 'usr-officer-003',
      userName: 'Daniel Owusu',
      month: monthKey,
      specialties: ['Network', 'Internet'],
      notes: 'Officer 1: Monthly Networking & Starlink Connectivity Lead',
      isActive: true,
    },
    {
      id: `spec-${monthKey}-itadmin-002`,
      userId: 'usr-itadmin-002',
      userName: 'Emmanuel Boateng',
      month: monthKey,
      specialties: ['Hardware', 'Printer'],
      notes: 'Monthly Hardware, Workstations & Thermal Printers Specialist',
      isActive: true,
    },
    {
      id: `spec-${monthKey}-admin-001`,
      userId: 'usr-admin-001',
      userName: 'Courage Kay',
      month: monthKey,
      specialties: ['Hospital System', 'Software', 'Server', 'Security'],
      notes: 'Super Admin: Clinical EMR / LHIMS, Server & Cyber Systems Lead',
      isActive: true,
    },
  ];
}

class OfficerSpecialtyService {
  /**
   * Get all configured monthly specialties across all months
   */
  public async getAllMonthlySpecialties(): Promise<OfficerMonthlySpecialty[]> {
    const settings = await settingsService.getSettings();
    if (settings.officerMonthlySpecialties && settings.officerMonthlySpecialties.length > 0) {
      return settings.officerMonthlySpecialties;
    }
    // Return default for current month
    const currentMonth = getCurrentMonthKey();
    const defaults = getDefaultSpecialtiesForMonth(currentMonth);
    return defaults;
  }

  /**
   * Get specialties configured for a specific month
   */
  public async getSpecialtiesForMonth(monthKey: string): Promise<OfficerMonthlySpecialty[]> {
    const all = await this.getAllMonthlySpecialties();
    const monthMatches = all.filter((s) => s.month === monthKey);
    if (monthMatches.length > 0) {
      return monthMatches;
    }
    // Return defaults initialized for this month
    return getDefaultSpecialtiesForMonth(monthKey);
  }

  /**
   * Save or update specialties for an officer in a month
   */
  public async saveMonthlySpecialties(
    newOrUpdatedSpecialties: OfficerMonthlySpecialty[],
    actor: User
  ): Promise<OfficerMonthlySpecialty[]> {
    const settings = await settingsService.getSettings();
    const existing = settings.officerMonthlySpecialties || [];

    // Merge or replace by ID or (userId + month)
    const mergedMap = new Map<string, OfficerMonthlySpecialty>();
    for (const item of existing) {
      mergedMap.set(`${item.userId}_${item.month}`, item);
    }
    for (const item of newOrUpdatedSpecialties) {
      mergedMap.set(`${item.userId}_${item.month}`, item);
    }

    const updatedList = Array.from(mergedMap.values());
    await settingsService.updateSettings(
      { officerMonthlySpecialties: updatedList },
      actor
    );

    await auditService.logAction(
      'UPDATE_OFFICER_MONTHLY_SPECIALTIES',
      'Administration',
      'ROSTER',
      null,
      {
        count: newOrUpdatedSpecialties.length,
        months: Array.from(new Set(newOrUpdatedSpecialties.map((s) => s.month))),
      }
    );

    return updatedList;
  }

  /**
   * Find the designated IT officer whose monthly specialty covers the ticket's category
   */
  public async findOfficerForTicketCategory(
    category: TicketCategory,
    targetMonth?: string
  ): Promise<{
    user: User;
    specialtyMatched: TicketCategory;
    month: string;
    specialtyNote?: string;
  } | null> {
    const month = targetMonth || getCurrentMonthKey();
    const allUsers = await getAllFromStore<User>('users');
    const itUsers = allUsers.filter(
      (u) =>
        u.status === 'Active' &&
        (u.role === 'SUPER_ADMIN' ||
          u.role === 'IT_ADMIN' ||
          u.role === 'IT_OFFICER' ||
          (u.department && u.department.toLowerCase().includes('it')))
    );

    if (itUsers.length === 0) return null;

    // 1. Check specialties configured for this month
    const monthlyList = await this.getSpecialtiesForMonth(month);
    const matchingAssignment = monthlyList.find(
      (s) => s.isActive && s.specialties.includes(category)
    );

    if (matchingAssignment) {
      // Find the corresponding user
      const assignedUser = itUsers.find(
        (u) =>
          u.id === matchingAssignment.userId ||
          u.fullName.toLowerCase() === matchingAssignment.userName.toLowerCase()
      );
      if (assignedUser) {
        return {
          user: assignedUser,
          specialtyMatched: category,
          month,
          specialtyNote: matchingAssignment.notes,
        };
      }
    }

    // 2. Fallback to any active monthly assignment matching category across recent months
    const allAssignments = await this.getAllMonthlySpecialties();
    const anyMatching = allAssignments.find(
      (s) => s.isActive && s.specialties.includes(category)
    );
    if (anyMatching) {
      const assignedUser = itUsers.find(
        (u) =>
          u.id === anyMatching.userId ||
          u.fullName.toLowerCase() === anyMatching.userName.toLowerCase()
      );
      if (assignedUser) {
        return {
          user: assignedUser,
          specialtyMatched: category,
          month: anyMatching.month,
          specialtyNote: anyMatching.notes,
        };
      }
    }

    // 3. Fallback based on conventional role / category mappings
    if (category === 'Network' || category === 'Internet') {
      const netOfficer =
        itUsers.find((u) => u.fullName.toLowerCase().includes('daniel') || u.jobTitle.toLowerCase().includes('support') || u.role === 'IT_OFFICER') ||
        itUsers.find((u) => u.role === 'IT_ADMIN');
      if (netOfficer) {
        return { user: netOfficer, specialtyMatched: category, month };
      }
    }

    return null;
  }
}

export const officerSpecialtyService = new OfficerSpecialtyService();
