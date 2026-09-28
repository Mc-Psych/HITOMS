import { type Ticket, type User } from '../types';
import { notificationService } from './notificationService';
import { ticketService } from './ticketService';
import { settingsService } from './settingsService';

const MUTE_KEY = 'hitoms_ticket_bell_muted';
const LAST_RING_MAP_KEY = 'hitoms_ticket_bell_last_rings';
const BROADCAST_CHANNEL_NAME = 'hitoms_ticket_bell_channel';
const REMOTE_STORAGE_RING_KEY = 'hitoms_remote_ticket_ring';

class SystemNotificationRingService {
  private broadcastChannel: BroadcastChannel | null = null;
  private intervalId: number | null = null;
  private audioCtx: AudioContext | null = null;
  private isAudioUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. BroadcastChannel across same-origin tabs
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'RING_TICKET_BELL') {
              this.handleRemoteRingEvent(
                event.data.ticketNumber,
                event.data.title,
                event.data.priority,
                event.data.reason
              );
            } else if (event.data?.type === 'RING_EMERGENCY_ALERT') {
              this.playEmergencyAlertTone();
            }
          };
        } catch (e) {
          console.warn('[TicketSoundService] BroadcastChannel unavailable:', e);
        }
      }

      // 2. Cross-tab storage event listener fallback
      window.addEventListener('storage', (e) => {
        if (e.key === REMOTE_STORAGE_RING_KEY && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.handleRemoteRingEvent(data.ticketNumber, data.title, data.priority, 'STORAGE_SYNC');
          } catch {
            // ignore
          }
        }
      });

      // 3. User interaction listener to unlock AudioContext autoplay
      this.initUserGestureUnlock();
    }
  }

  /**
   * Unlock Web Audio API context on first user gesture
   */
  private initUserGestureUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = async () => {
      if (this.isAudioUnlocked) return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          if (!this.audioCtx || this.audioCtx.state === 'closed') {
            this.audioCtx = new AudioContextClass();
          }
          if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
          }
          this.isAudioUnlocked = true;
        }
      } catch {
        // ignore
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
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
    return (
      dept.includes('it') ||
      dept.includes('information technology') ||
      dept.includes('tech support') ||
      dept.includes('biomedical')
    );
  }

  /**
   * Check if bell / notification audio is muted
   */
  public isMuted(): boolean {
    return localStorage.getItem(MUTE_KEY) === 'true';
  }

  /**
   * Toggle bell / notification audio mute state
   */
  public setMuted(muted: boolean): void {
    localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
  }

  /**
   * Get configured ring tone duration in seconds (default: 5s)
   */
  public getConfiguredRingDurationSeconds(): number {
    try {
      const s = settingsService.getSettingsSync();
      return Math.max(2, Math.min(120, s.ringToneDurationSeconds || 5));
    } catch {
      return 5;
    }
  }

  /**
   * Get configured re-notification interval in minutes (default: 30m)
   */
  public getConfiguredReNotificationMinutes(): number {
    try {
      const s = settingsService.getSettingsSync();
      return Math.max(1, Math.min(1440, s.reNotificationIntervalMinutes || 30));
    } catch {
      return 30;
    }
  }

  /**
   * Play realistic helpdesk bell chime tone on PC/Phone via Web Audio API
   */
  public async playBellRingtone(isCritical: boolean = false, customDurationSec?: number): Promise<void> {
    if (this.isMuted()) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const durationSec =
        customDurationSec !== undefined ? customDurationSec : this.getConfiguredRingDurationSeconds();
      const pulseInterval = isCritical ? 0.35 : 0.45;
      const repetitions = Math.max(2, Math.round(durationSec / pulseInterval));
      const now = this.audioCtx.currentTime;

      for (let i = 0; i < repetitions; i++) {
        const startTime = now + i * pulseInterval;

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
        gain.gain.exponentialRampToValueAtTime(0.65, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + pulseInterval * 0.9);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + pulseInterval);
        osc2.stop(startTime + pulseInterval);
      }

      // Haptic feedback for mobile phones
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const pattern: number[] = [];
        for (let i = 0; i < Math.min(repetitions, 8); i++) {
          pattern.push(isCritical ? 150 : 200, 100);
        }
        navigator.vibrate(pattern);
      }
    } catch (err) {
      console.warn('[TicketSoundService] Audio playback hindered by browser policy:', err);
    }
  }

  /**
   * Play urgent emergency hospital siren / alarm ringtone
   */
  public async playEmergencyAlertTone(customDurationSec?: number): Promise<void> {
    if (this.isMuted()) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const durationSec =
        customDurationSec !== undefined ? customDurationSec : this.getConfiguredRingDurationSeconds();
      const cycleLength = 0.45;
      const repetitions = Math.max(3, Math.round(durationSec / cycleLength));
      const now = this.audioCtx.currentTime;

      // Two-tone alternating emergency siren
      for (let i = 0; i < repetitions; i++) {
        const startTime = now + i * cycleLength;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        const freq = i % 2 === 0 ? 880 : 1200; // Alternating 880Hz / 1200Hz
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.01, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.01, startTime + cycleLength * 0.9);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + cycleLength);
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([400, 150, 400, 150, 800]);
      }
    } catch (err) {
      console.warn('[TicketSoundService] Emergency audio error:', err);
    }
  }

  /**
   * Show OS-level System Notification that rings & persists even when app is closed / backgrounded
   */
  public async showSystemNotification(
    title: string,
    options: {
      body: string;
      tag?: string;
      icon?: string;
      badge?: string;
      requireInteraction?: boolean;
      vibrate?: number[];
      data?: Record<string, unknown>;
    }
  ): Promise<void> {
    if (typeof window === 'undefined') return;

    // Request notification permission if not yet decided
    await this.requestNotificationPermission();

    const notifOptions: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
      body: options.body,
      icon: options.icon || '/icon.svg',
      badge: options.badge || '/icon.svg',
      tag: options.tag || `hitoms-${Date.now()}`,
      requireInteraction: options.requireInteraction ?? true,
      vibrate: options.vibrate || [300, 100, 300, 100, 600],
      data: options.data || { url: '/' },
    };

    // 1. ServiceWorker showNotification for background & closed-app delivery
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notifOptions);
          return;
        }
      } catch (err) {
        console.warn('[SystemNotificationRing] SW showNotification error:', err);
      }
    }

    // 2. Fallback to Window Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, notifOptions);
      } catch (err) {
        console.warn('[SystemNotificationRing] Window Notification error:', err);
      }
    }
  }

  /**
   * Request native browser notification permissions for phone/PC
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        try {
          const result = await Notification.requestPermission();
          return result === 'granted';
        } catch {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Trigger bell ring alert and notification when an assigned staff / user writes a comment on a ticket
   */
  public async ringTicketCommentAlert(
    ticket: Ticket,
    commentText: string,
    author: User
  ): Promise<void> {
    // 1. Play bell chime sound tone
    await this.playBellRingtone(ticket.priority === 'Critical', 3);

    // 2. Identify target recipients (reporter who logged ticket + assigned technician)
    const notificationTitle = `💬 Comment on Ticket #${ticket.ticketNumber}`;
    const snippet = commentText.length > 90 ? commentText.slice(0, 90) + '...' : commentText;
    const notificationBody = `${author.fullName}: "${snippet}"`;

    // Notify ticket reporter (staff user who logged the ticket)
    if (ticket.reportedBy?.uid && ticket.reportedBy.uid !== author.id) {
      await notificationService.notify(
        notificationTitle,
        notificationBody,
        'info',
        'Tickets',
        ticket.reportedBy.uid,
        ticket.id
      );
    }

    // Notify assigned officer if different from author
    if (ticket.assignedTo?.uid && ticket.assignedTo.uid !== author.id) {
      await notificationService.notify(
        notificationTitle,
        notificationBody,
        'info',
        'Tickets',
        ticket.assignedTo.uid,
        ticket.id
      );
    }

    // If author is general staff, also broadcast notification to IT team
    if (author.role === 'STAFF_USER' || author.role === 'DEPARTMENT_HEAD') {
      await notificationService.notify(
        notificationTitle,
        notificationBody,
        'info',
        'Tickets',
        'ALL',
        ticket.id
      );
    }

    // 3. Trigger native OS System Notification (rings bell/vibrates even if app is minimized)
    await this.showSystemNotification(`💬 Ticket #${ticket.ticketNumber} Comment`, {
      body: `${author.fullName}: "${snippet}"`,
      tag: `ticket-comment-${ticket.id}-${Date.now()}`,
      requireInteraction: false,
      vibrate: [200, 100, 200],
    });

    // 4. Broadcast across open tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'RING_TICKET_BELL',
          ticketNumber: ticket.ticketNumber,
          title: `Comment by ${author.fullName}`,
          priority: ticket.priority,
          reason: 'COMMENT_ADDED',
        });
      } catch (e) {
        console.warn('[TicketSoundService] Broadcast error:', e);
      }
    }
  }

  /**
   * Trigger notification ring when a new ticket is submitted or updated
   */
  public async ringNewTicketAlert(ticket: Ticket, currentUser: User | null): Promise<void> {
    // Record initial ring timestamp
    this.updateTicketLastRingTime(ticket.id);

    // 1. Broadcast across open tabs via BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'RING_TICKET_BELL',
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          priority: ticket.priority,
          reason: 'NEW_TICKET',
        });
      } catch (e) {
        console.warn('[TicketSoundService] Broadcast error:', e);
      }
    }

    // 2. Broadcast via storage event for other windows
    try {
      localStorage.setItem(
        REMOTE_STORAGE_RING_KEY,
        JSON.stringify({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          priority: ticket.priority,
          department: ticket.department,
          timestamp: Date.now(),
        })
      );
    } catch {
      // ignore
    }

    // 3. Play audible ringtone immediately
    await this.playBellRingtone(ticket.priority === 'Critical');

    // 4. Deliver OS system notification even if app is backgrounded or minimized
    await this.showSystemNotification(`🔔 Ticket #${ticket.ticketNumber} Logged`, {
      body: `${ticket.title} [${ticket.category} - ${ticket.priority} Priority] reported in ${ticket.department}`,
      tag: `ticket-${ticket.id}`,
      requireInteraction: ticket.priority === 'Critical',
      vibrate: ticket.priority === 'Critical' ? [400, 150, 400, 150, 800] : [300, 100, 300],
    });
  }

  /**
   * Trigger notification ring for Hospital Emergency Broadcasts (Code Blue IT, Code Red Network, etc.)
   */
  public async ringEmergencyAlert(
    title: string,
    message: string,
    severity: 'CRITICAL' | 'HIGH' | 'WARNING' = 'CRITICAL'
  ): Promise<void> {
    // Broadcast across open tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'RING_EMERGENCY_ALERT',
          title,
          severity,
        });
      } catch {
        // ignore
      }
    }

    // Play emergency siren audio
    await this.playEmergencyAlertTone();

    // Deliver persistent OS notification even if app is closed
    await this.showSystemNotification(`🚨 HOSPITAL IT ALERT: ${title}`, {
      body: message,
      tag: `emergency-${Date.now()}`,
      requireInteraction: true,
      vibrate: [500, 150, 500, 150, 1000],
    });
  }

  /**
   * Check all active unclosed tickets and ring the recurring reminder at the configured interval
   */
  public async evaluateRecurringTicketAlerts(currentUser: User | null): Promise<{
    ringTriggered: boolean;
    unclosedCount: number;
    unclosedTickets: Ticket[];
  }> {
    const intervalMinutes = this.getConfiguredReNotificationMinutes();
    const ringDurationSeconds = this.getConfiguredRingDurationSeconds();
    const allTickets = await ticketService.getTickets();

    // Unclosed tickets = status NOT 'Closed' and NOT 'Resolved'
    let unclosedTickets = allTickets.filter(
      (t) => t.status !== 'Closed' && t.status !== 'Resolved'
    );

    // If currentUser is non-IT staff, filter for tickets reported by or assigned to them or in their department
    if (currentUser && !this.isItOrSuperAdmin(currentUser)) {
      unclosedTickets = unclosedTickets.filter(
        (t) =>
          t.reportedBy?.uid === currentUser.id ||
          t.assignedTo?.uid === currentUser.id ||
          (t.department && currentUser.department && t.department.toLowerCase() === currentUser.department.toLowerCase())
      );
    }

    if (unclosedTickets.length === 0) {
      return { ringTriggered: false, unclosedCount: 0, unclosedTickets: [] };
    }

    const now = Date.now();
    const intervalMs = intervalMinutes * 60 * 1000;
    const lastRings = this.getLastRingsMap();
    let shouldRing = false;
    let criticalFound = false;
    const dueTickets: Ticket[] = [];

    for (const ticket of unclosedTickets) {
      const ticketCreatedTime = new Date(ticket.createdAt).getTime();
      const lastRingTime = lastRings[ticket.id];

      // If ticket has been unclosed for at least the configured interval since last bell ring, or never rung before
      if (!lastRingTime || (now - lastRingTime >= intervalMs)) {
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

      // Play bell ringtone with configured duration
      await this.playBellRingtone(criticalFound, ringDurationSeconds);

      // Deliver OS system notification even if app is closed/minimized
      const ticketListStr = dueTickets
        .slice(0, 3)
        .map((t) => `#${t.ticketNumber}`)
        .join(', ');
      const extraCount = dueTickets.length > 3 ? ` +${dueTickets.length - 3} more` : '';

      await this.showSystemNotification(
        `🔔 ${intervalMinutes}-Min Unresolved Ticket Alert (${dueTickets.length})`,
        {
          body: `Pending unresolved tickets: ${ticketListStr}${extraCount}. Please attend to them!`,
          tag: `hitoms-recurring-reminder-${now}`,
          requireInteraction: criticalFound,
          vibrate: [300, 100, 300, 100, 600],
        }
      );

      // Post in-app recurring notification alert for IT & staff
      await notificationService.notify(
        `🔔 ${intervalMinutes}-Min Unresolved Ticket Alert (${dueTickets.length})`,
        `The following ticket(s) have been open for over ${intervalMinutes} minutes without being resolved: ${ticketListStr}${extraCount}. Please review!`,
        criticalFound ? 'error' : 'warning',
        'Tickets',
        currentUser ? currentUser.id : 'ALL'
      );
    }

    return {
      ringTriggered: shouldRing,
      unclosedCount: unclosedTickets.length,
      unclosedTickets,
    };
  }

  /**
   * Alias for backwards compatibility
   */
  public async evaluateRecurring30MinAlerts(currentUser: User | null) {
    return this.evaluateRecurringTicketAlerts(currentUser);
  }

  /**
   * Start recurring background checking loop (polls every 30s)
   */
  public startRecurringBellMonitor(getCurrentUser: () => User | null, onRefresh?: () => void): void {
    if (this.intervalId !== null) return;

    const runCheck = async () => {
      const user = getCurrentUser();
      const res = await this.evaluateRecurringTicketAlerts(user);
      if (res.ringTriggered && onRefresh) {
        onRefresh();
      }
    };

    // Trigger immediate check after startup
    setTimeout(() => {
      runCheck().catch((e) => console.warn('[TicketSoundService] Startup re-notification check notice:', e));
    }, 2000);

    // Check every 30 seconds for tickets crossing the threshold
    this.intervalId = window.setInterval(runCheck, 30000);
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
   * Test system notification ring (plays chime + siren test and triggers OS notification)
   */
  public async testSystemNotificationRing(customDurationSec?: number): Promise<void> {
    await this.requestNotificationPermission();
    const duration =
      customDurationSec !== undefined ? customDurationSec : this.getConfiguredRingDurationSeconds();
    await this.playBellRingtone(true, duration);
    await this.showSystemNotification('🔔 HITOMS System Notification Ring Test', {
      body: `Verified: Ring duration set to ${duration}s. Notification ring is active for alerts and tickets even when the app is closed!`,
      tag: 'hitoms-test-ring',
      requireInteraction: false,
      vibrate: [200, 100, 200, 100, 400],
    });
  }

  /**
   * Alias for backward compatibility
   */
  public async testBellSound(): Promise<void> {
    return this.testSystemNotificationRing();
  }

  private handleRemoteRingEvent(
    ticketNumber: string,
    title: string,
    priority: string = 'Normal',
    reason: string = 'REMOTE'
  ): void {
    console.log(`[TicketSoundService] Remote bell event received: ${ticketNumber} (${reason})`);
    this.playBellRingtone(priority === 'Critical');
    this.showSystemNotification(`🔔 Ticket #${ticketNumber} Logged`, {
      body: `${title} [${priority} Priority] reported. Tap to open.`,
      tag: `remote-${ticketNumber}`,
      requireInteraction: priority === 'Critical',
    });
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

export const ticketSoundService = new SystemNotificationRingService();
export const systemNotificationRingService = ticketSoundService;
