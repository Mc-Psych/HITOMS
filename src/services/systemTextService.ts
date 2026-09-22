import { getFromStore, putToStore } from './localDatabaseService';
import { type SystemSettings } from '../types';

export interface SystemTextItem {
  key: string;
  label: string;
  category: 'Branding & Header' | 'Dashboard' | 'Help Desk / Tickets' | 'Systems & Network' | 'Assets & Maintenance' | 'Admin & General';
  defaultValue: string;
  description: string;
}

export const SYSTEM_TEXT_CATALOG: SystemTextItem[] = [
  // Branding & Header
  {
    key: 'hospital_name',
    label: 'Hospital Name',
    category: 'Branding & Header',
    defaultValue: 'St. Mary Theresa Catholic Hospital',
    description: 'Primary facility display name in header and system banners',
  },
  {
    key: 'hospital_tagline',
    label: 'Hospital Tagline / Header Badge',
    category: 'Branding & Header',
    defaultValue: 'Offline-First Hospital Ops',
    description: 'Subtitle tag appearing in the top navigation bar',
  },
  {
    key: 'hospital_lan_url',
    label: 'LAN Hostname / Address',
    category: 'Branding & Header',
    defaultValue: 'http://hitoms.local',
    description: 'Local intranet server address label shown in header',
  },
  {
    key: 'hospital_district_label',
    label: 'Region / District Facility Label',
    category: 'Branding & Header',
    defaultValue: 'Highland Medical District Facility',
    description: 'District and facility identity text',
  },

  // Dashboard
  {
    key: 'dash_welcome_title',
    label: 'Operations Center Banner Title',
    category: 'Dashboard',
    defaultValue: 'Hospital IT Operations Center',
    description: 'Main heading on the Operations Dashboard',
  },
  {
    key: 'dash_welcome_subtitle',
    label: 'Operations Center Banner Subtitle',
    category: 'Dashboard',
    defaultValue: 'Real-time local node telemetry for St. Mary Theresa Catholic Hospital. All services operating locally on LAN.',
    description: 'Descriptive subtitle beneath the dashboard heading',
  },
  {
    key: 'dash_systems_header',
    label: 'Core Hospital Systems Section Title',
    category: 'Dashboard',
    defaultValue: 'Core Hospital Systems Telemetry',
    description: 'Header for the LHIMS, PACS, and Starlink telemetry row',
  },

  // Help Desk / Tickets
  {
    key: 'tickets_page_title',
    label: 'Help Desk Page Title',
    category: 'Help Desk / Tickets',
    defaultValue: 'Hospital IT Help Desk',
    description: 'Header on the main ticket tracking view',
  },
  {
    key: 'tickets_page_subtitle',
    label: 'Help Desk Page Subtitle',
    category: 'Help Desk / Tickets',
    defaultValue: 'Offline-first issue tracking. Tickets are committed locally to IndexedDB and queue automatically.',
    description: 'Explanation of offline queuing under Help Desk title',
  },
  {
    key: 'quick_ticket_button_label',
    label: 'Floating Ticket Button Label',
    category: 'Help Desk / Tickets',
    defaultValue: 'Log IT Ticket',
    description: 'Text on the persistent floating action button',
  },
  {
    key: 'ticket_confirmation_instruction',
    label: 'Confirmation Prompt for Closed Tickets',
    category: 'Help Desk / Tickets',
    defaultValue: 'Verify resolution satisfaction. Reporting unit staff must confirm and rate IT handling before this ticket is archived.',
    description: 'Instruction displayed when rating and confirming resolved tickets',
  },
  {
    key: 'ticket_general_issue_label',
    label: 'General Issue Toggle Label',
    category: 'Help Desk / Tickets',
    defaultValue: 'Hospital-Wide / General Issue (Any department staff may verify resolution)',
    description: 'Label on the checkbox allowing general ticket reporting',
  },

  // Systems & Network
  {
    key: 'systems_page_title',
    label: 'Hospital Systems Page Title',
    category: 'Systems & Network',
    defaultValue: 'Core Hospital Systems & Telemetry',
    description: 'Title for the systems monitoring page',
  },
  {
    key: 'systems_page_subtitle',
    label: 'Hospital Systems Subtitle',
    category: 'Systems & Network',
    defaultValue: 'Real-time latency, availability, and clinical service operational tracking for St. Mary Theresa Catholic Hospital.',
    description: 'Subtitle for hospital systems page',
  },
  {
    key: 'systems_staff_notice',
    label: 'Staff Monitoring Telemetry Notice',
    category: 'Systems & Network',
    defaultValue: 'Hospital systems are actively monitored by IT Operations. Diagnostic ping triggers are reserved for authorized IT specialists.',
    description: 'Notice shown to staff users regarding ping test restrictions',
  },
  {
    key: 'network_page_title',
    label: 'Network Topology Page Title',
    category: 'Systems & Network',
    defaultValue: 'Hospital Network Infrastructure Topology',
    description: 'Title on the network view',
  },

  // Assets & Maintenance
  {
    key: 'assets_page_title',
    label: 'Asset Registry Page Title',
    category: 'Assets & Maintenance',
    defaultValue: 'Hospital IT Asset Registry',
    description: 'Title on the IT Assets registry view',
  },
  {
    key: 'maintenance_page_title',
    label: 'Preventive Maintenance Title',
    category: 'Assets & Maintenance',
    defaultValue: 'Preventive Maintenance Schedules',
    description: 'Title on the Maintenance view',
  },

  // Admin & General
  {
    key: 'admin_page_title',
    label: 'Administration View Title',
    category: 'Admin & General',
    defaultValue: 'Hospital Administration & Security Controls',
    description: 'Title of the Administration dashboard',
  },
  {
    key: 'broadcast_announcement_title',
    label: 'IT Broadcast Center Title',
    category: 'Admin & General',
    defaultValue: 'Hospital IT Communication & Broadcasts',
    description: 'Title on the IT messaging module',
  },
  {
    key: 'first_login_password_prompt',
    label: 'Mandatory First Login Password Change Notice',
    category: 'Admin & General',
    defaultValue: 'Super Admin requires all staff to set a personal password upon first logging in with their default surname credentials.',
    description: 'Explanation shown on first-time login modal',
  },
];

const LOCAL_STORAGE_KEY = 'hitoms_custom_system_texts';

class SystemTextService {
  private cache: Record<string, string> = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        this.cache = JSON.parse(raw);
      }
    } catch {
      this.cache = {};
    }
  }

  public getText(key: string, fallback?: string): string {
    if (this.cache[key] !== undefined && this.cache[key] !== '') {
      return this.cache[key];
    }
    const def = SYSTEM_TEXT_CATALOG.find((item) => item.key === key);
    return def ? def.defaultValue : (fallback || key);
  }

  public getAllTexts(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const item of SYSTEM_TEXT_CATALOG) {
      result[item.key] = this.cache[item.key] !== undefined ? this.cache[item.key] : item.defaultValue;
    }
    // Include custom dynamic keys if any
    for (const k of Object.keys(this.cache)) {
      if (!(k in result)) {
        result[k] = this.cache[k];
      }
    }
    return result;
  }

  public async setTexts(updates: Record<string, string>): Promise<void> {
    this.cache = { ...this.cache, ...updates };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.cache));

    // Also persist into IndexedDB settings
    try {
      const settings = await getFromStore<SystemSettings>('settings', 'main');
      if (settings) {
        settings.customTexts = this.cache;
        await putToStore('settings', settings);
      }
    } catch (e) {
      console.warn('Could not sync custom texts to settings store:', e);
    }
  }

  public async resetToDefaults(): Promise<void> {
    this.cache = {};
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    try {
      const settings = await getFromStore<SystemSettings>('settings', 'main');
      if (settings) {
        settings.customTexts = {};
        await putToStore('settings', settings);
      }
    } catch (e) {
      console.warn('Could not reset settings store texts:', e);
    }
  }
}

export const systemTextService = new SystemTextService();
