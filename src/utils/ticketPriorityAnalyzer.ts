import { type TicketPriority, type TicketCategory } from '../types';

export interface PriorityAnalysisResult {
  priority: TicketPriority;
  score: number; // 1 to 100
  reason: string;
  matchedKeywords: string[];
}

/**
 * Intelligent Automated Ticket Priority Analyzer
 * Analyzes ticket title, description, and category to set the ticket priority
 * automatically based on clinical impact, service availability, and urgency keywords.
 */
export function analyzeTicketPriority(
  title: string,
  description: string,
  category: TicketCategory
): PriorityAnalysisResult {
  const combinedText = `${title || ''} ${description || ''}`.toLowerCase();

  // Keyword Matrix with Urgency Weights
  const criticalPatterns = [
    { text: 'lhims down', weight: 35 },
    { text: 'system down', weight: 35 },
    { text: 'outage', weight: 30 },
    { text: 'icu', weight: 35 },
    { text: 'operating room', weight: 35 },
    { text: 'theatre', weight: 35 },
    { text: 'emergency room', weight: 35 },
    { text: 'er down', weight: 35 },
    { text: 'pharmacy down', weight: 30 },
    { text: 'cashier blocked', weight: 30 },
    { text: 'billing down', weight: 30 },
    { text: 'server crash', weight: 35 },
    { text: 'database crash', weight: 35 },
    { text: 'fire', weight: 40 },
    { text: 'security breach', weight: 40 },
    { text: 'ransomware', weight: 40 },
    { text: 'starlink down', weight: 30 },
    { text: 'entire hospital', weight: 30 },
    { text: 'cannot dispense', weight: 30 },
    { text: 'patient care blocked', weight: 35 },
  ];

  const highPatterns = [
    { text: 'urgent', weight: 20 },
    { text: 'network offline', weight: 20 },
    { text: 'no internet', weight: 20 },
    { text: 'wi-fi down', weight: 20 },
    { text: 'switch failure', weight: 20 },
    { text: 'ups battery', weight: 20 },
    { text: 'ward scanner', weight: 20 },
    { text: 'lab equipment', weight: 20 },
    { text: 'prescription printer', weight: 20 },
    { text: 'cannot log in', weight: 20 },
    { text: 'login failed', weight: 20 },
    { text: 'corrupted', weight: 20 },
    { text: 'data loss', weight: 25 },
    { text: 'intermittent disconnect', weight: 18 },
  ];

  const mediumPatterns = [
    { text: 'printer jam', weight: 10 },
    { text: 'sluggish', weight: 10 },
    { text: 'slow', weight: 10 },
    { text: 'email', weight: 10 },
    { text: 'mouse', weight: 10 },
    { text: 'keyboard', weight: 10 },
    { text: 'monitor flickering', weight: 10 },
    { text: 'toner', weight: 10 },
    { text: 'paper jam', weight: 10 },
  ];

  const lowPatterns = [
    { text: 'question', weight: 5 },
    { text: 'how to', weight: 5 },
    { text: 'training', weight: 5 },
    { text: 'inquiry', weight: 5 },
    { text: 'routine', weight: 5 },
    { text: 'feature request', weight: 5 },
    { text: 'suggestion', weight: 5 },
  ];

  let score = 25; // Base score (Medium-Low baseline)
  const matchedKeywords: string[] = [];

  // Category Baselines
  if (category === 'Server' || category === 'Hospital System' || category === 'Security') {
    score += 25;
  } else if (category === 'Network' || category === 'Internet') {
    score += 15;
  } else if (category === 'Hardware' || category === 'Printer') {
    score += 5;
  }

  // Check Critical
  for (const pat of criticalPatterns) {
    if (combinedText.includes(pat.text)) {
      score += pat.weight;
      matchedKeywords.push(pat.text);
    }
  }

  // Check High
  for (const pat of highPatterns) {
    if (combinedText.includes(pat.text)) {
      score += pat.weight;
      matchedKeywords.push(pat.text);
    }
  }

  // Check Medium
  for (const pat of mediumPatterns) {
    if (combinedText.includes(pat.text)) {
      score += pat.weight;
      matchedKeywords.push(pat.text);
    }
  }

  // Check Low reduction
  for (const pat of lowPatterns) {
    if (combinedText.includes(pat.text)) {
      score -= pat.weight;
      matchedKeywords.push(pat.text);
    }
  }

  // Determine Priority tier based on total score
  let priority: TicketPriority = 'Medium';
  let reason = 'Standard operational request priority assigned based on problem description.';

  if (score >= 70) {
    priority = 'Critical';
    reason = `Critical priority auto-assigned due to high clinical impact triggers (${matchedKeywords.slice(0, 3).join(', ') || category}).`;
  } else if (score >= 45) {
    priority = 'High';
    reason = `High priority auto-assigned due to operational disruption signals (${matchedKeywords.slice(0, 3).join(', ') || category}).`;
  } else if (score <= 20) {
    priority = 'Low';
    reason = `Low priority auto-assigned for non-blocking routine request (${matchedKeywords.slice(0, 3).join(', ') || 'Inquiry'}).`;
  } else {
    priority = 'Medium';
    reason = `Medium priority auto-assigned for standard department support ticket.`;
  }

  return {
    priority,
    score: Math.min(100, Math.max(1, score)),
    reason,
    matchedKeywords,
  };
}

/**
 * Formats a duration in minutes into a clean human-readable interval
 * e.g., 45 -> "45m", 125 -> "2h 05m", 1480 -> "1d 0h 40m"
 */
export function formatResolutionInterval(minutes?: number | null): string {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) {
    return 'Pending';
  }
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);

  if (hours < 24) {
    return `${hours}h ${remainingMins > 0 ? `${remainingMins}m` : ''}`.trim();
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return `${days}d ${remainingHours}h ${remainingMins > 0 ? `${remainingMins}m` : ''}`.trim();
}
