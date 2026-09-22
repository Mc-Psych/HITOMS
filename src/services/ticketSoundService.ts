import { type Ticket, type User } from '../types';
import { notificationService } from './notificationService';
import { ticketService } from './ticketService';

const MUTE_KEY = 'hitoms_ticket_bell_muted';
const LAST_RING_MAP_KEY = 'hitoms_ticket_bell_last_rings';
const BROADCAST_CHANNEL_NAME = 'hitoms_ticket_bell_channel';

class TicketSoundService {
  private broadcastChannel: BroadcastChannel | null = null;
  private intervalId: number | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'RING_TICKET_BELL') {
            this.handleRemoteRingEvent(event.data.ticketNumber, event.data.title, event.data.reason);
          }
        };
      }
    }
  }

  /**
   * Check if user is Super Admin or IT Unit staff
   */
  public isItOrSuperAdmin(user: User | null): boolean {
    if (!user) return false;
    const role = user.role;
    if (role === 'SUPER_ADMIN' || role === 'IT_ADMIN' || role === 'IT_OFFICER') {
      return true;
    }
    const dept = (user.department || '').toLowerCase();
    return dept.includes('it') || dept.includes('information technology') || dept.includes('tech support');
  }

  /**
   * Check if bell audio is muted
   */
  public isMuted(): boolean {
    return localStorage.getItem(MUTE_KEY) === 'true';
  }

  /**
   * Toggle bell mute state
   */
  public setMuted(muted: boolean): void {
    localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
  }

  /**
   * Play realistic helpdesk bell chime tone on PC/Phone via Web Audio API
   */
  public async playBellRingtone(isCritical: boolean = false): Promise<void> {
    if (this.isMuted()) return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const repetitions = isCritical ? 4 : 3;

      for (let i = 0; i < repetitions; i++) {
        const startTime = now + i * 0.45;

        // Fundamental Bell Pitch (C6 = 1046.5Hz) & Harmonic (E6 = 1318.5Hz)
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(isCritical ? 1174.66 : 1046.5, startTime); // D6 or C6

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(isCritical ? 1567.98 : 1318.5, startTime); // G6 or E6

        // Bell strike envelope (fast attack, natural exponential ring decay)
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.6, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + 0.42);
        osc2.stop(startTime + 0.42);
      }

      // Haptic feedback for mobile phones
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(isCritical ? [200, 100, 200, 100, 500] : [200, 100, 300]);
      }

      // Native browser desktop/mobile popup notification if granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 HITOMS Helpdesk Bell Alert', {
          body: isCritical ? 'CRITICAL IT Ticket Requires Immediate Attention!' : 'New / Unresolved Helpdesk Ticket Needs Action!',
          icon: '/icon.svg',
          tag: 'hitoms-ticket-alert',
        });
      }
    } catch (err) {
      console.warn('[TicketSoundService] Audio playback hindered by browser autoplay policy:', err);
    }
  }

  /**
   * Request native browser notification permissions for phone/PC
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const result = await Notification.requestPermission();
        return result === 'granted';
      }
    }
    return false;
  }

  /**
   * Trigger bell ring when a new ticket is submitted or updated
   */
  public async ringNewTicketAlert(ticket: Ticket, currentUser: User | null): Promise<void> {
    // Record initial ring timestamp
    this.updateTicketLastRingTime(ticket.id);

    // Broadcast across tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'RING_TICKET_BELL',
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        reason: 'NEW_TICKET',
      });
    }

    // If current user is IT / Super Admin, play sound immediately
    if (this.isItOrSuperAdmin(currentUser)) {
      await this.playBellRingtone(ticket.priority === 'Critical');
    }
  }

  /**
   * Check all active unclosed tickets and ring the 30-minute recurring reminder
   */
  public async evaluateRecurring30MinAlerts(currentUser: User | null): Promise<{
    ringTriggered: boolean;
    unclosedCount: number;
    unclosedTickets: Ticket[];
  }> {
    if (!this.isItOrSuperAdmin(currentUser)) {
      return { ringTriggered: false, unclosedCount: 0, unclosedTickets: [] };
    }

    const allTickets = await ticketService.getTickets();
    // Unclosed tickets = status NOT 'Closed' and NOT 'Resolved'
    const unclosedTickets = allTickets.filter(
      (t) => t.status !== 'Closed' && t.status !== 'Resolved'
    );

    const now = Date.now();
    const thirtyMinMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    const lastRings = this.getLastRingsMap();
    let shouldRing = false;
    let criticalFound = false;
    const dueTickets: Ticket[] = [];

    for (const ticket of unclosedTickets) {
      const ticketCreatedTime = new Date(ticket.createdAt).getTime();
      const lastRingTime = lastRings[ticket.id] || ticketCreatedTime;

      // If ticket has been unclosed for at least 30 minutes since last bell ring
      if (now - lastRingTime >= thirtyMinMs) {
        shouldRing = true;
        dueTickets.push(ticket);
        if (ticket.priority === 'Critical') {
          criticalFound = true;
        }
        // Update last ring timestamp
        lastRings[ticket.id] = now;
      }
    }

    if (shouldRing) {
      this.saveLastRingsMap(lastRings);

      // Play bell ringtone
      await this.playBellRingtone(criticalFound);

      // Post in-app recurring notification alert for IT staff
      const ticketListStr = dueTickets.slice(0, 3).map((t) => `#${t.ticketNumber}`).join(', ');
      const extraCount = dueTickets.length > 3 ? ` +${dueTickets.length - 3} more` : '';

      await notificationService.notify(
        `🔔 30-Min Unresolved Ticket Alert (${dueTickets.length})`,
        `The following ticket(s) have been open for over 30 minutes without being worked on and closed: ${ticketListStr}${extraCount}. Please review!`,
        criticalFound ? 'error' : 'warning',
        'Tickets',
        'ALL'
      );
    }

    return {
      ringTriggered: shouldRing,
      unclosedCount: unclosedTickets.length,
      unclosedTickets,
    };
  }

  /**
   * Start 30-minute background checking loop
   */
  public startRecurringBellMonitor(getCurrentUser: () => User | null, onRefresh?: () => void): void {
    if (this.intervalId !== null) return;

    // Check every 30 seconds for tickets crossing the 30-min threshold
    this.intervalId = window.setInterval(async () => {
      const user = getCurrentUser();
      if (this.isItOrSuperAdmin(user)) {
        const res = await this.evaluateRecurring30MinAlerts(user);
        if (res.ringTriggered && onRefresh) {
          onRefresh();
        }
      }
    }, 30000); // 30s evaluation interval
  }

  /**
   * Stop background checking loop
   */
  public stopRecurringBellMonitor(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Test bell sound (and unlock AudioContext)
   */
  public async testBellSound(): Promise<void> {
    await this.requestNotificationPermission();
    await this.playBellRingtone(true);
  }

  private handleRemoteRingEvent(ticketNumber: string, title: string, reason: string): void {
    console.log(`[TicketSoundService] Remote bell event received: ${ticketNumber} (${reason})`);
    this.playBellRingtone(false);
  }

  private updateTicketLastRingTime(ticketId: string): void {
    const map = this.getLastRingsMap();
    map[ticketId] = Date.now();
    this.saveLastRingsMap(map);
  }

  private getLastRingsMap(): Record<string, number> {
    try {
      const raw = localStorage.getItem(LAST_RING_MAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveLastRingsMap(map: Record<string, number>): void {
    try {
      localStorage.setItem(LAST_RING_MAP_KEY, JSON.stringify(map));
    } catch (err) {
      console.warn('[TicketSoundService] Failed to save last rings map:', err);
    }
  }
}

export const ticketSoundService = new TicketSoundService();
