import { type AiTriageResult, type TicketCategory, type TicketPriority } from '../types';

export class AiTriageService {
  public async analyzeTicket(data: {
    title: string;
    description: string;
    category?: string;
    department?: string;
    location?: string;
    assetTag?: string;
  }): Promise<AiTriageResult> {
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`AI Triage HTTP error: ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.triage) {
        return {
          recommendedPriority: json.triage.recommendedPriority as TicketPriority,
          patientCareImpact: json.triage.patientCareImpact || 'Standard clinical workflow evaluation',
          suggestedCategory: (json.triage.suggestedCategory || 'Hardware') as TicketCategory,
          rootCauseHypothesis: json.triage.rootCauseHypothesis || 'Rule-based evaluation applied',
          immediateActionSteps: json.triage.immediateActionSteps || [
            'Verify physical hardware connections and power LEDs.',
            'Test gateway switch ping and port link status.',
            'Check for active network maintenance or EMR session timeouts.',
          ],
          riskSummary: json.triage.riskSummary || 'Standard IT issue handling.',
          analyzedAt: new Date().toISOString(),
        };
      }
      throw new Error('Invalid AI response structure');
    } catch (err) {
      console.warn('[AiTriageService] AI endpoint query failed, applying client fallback:', err);
      // Client-side rule fallback
      const dept = (data.department || '').toUpperCase();
      const desc = (data.description || '').toUpperCase();
      const isCritical = dept.includes('ICU') || dept.includes('ER') || dept.includes('OT') || desc.includes('MONITOR') || desc.includes('VENTILATOR') || desc.includes('PACS');

      return {
        recommendedPriority: isCritical ? 'Critical' : 'Medium',
        patientCareImpact: isCritical
          ? 'Potential high clinical impact on critical patient care unit.'
          : 'Standard operational impact on hospital workflows.',
        suggestedCategory: (data.category as TicketCategory) || 'Hardware',
        rootCauseHypothesis: 'Rule-based offline triage analysis applied.',
        immediateActionSteps: [
          'Inspect physical device power, network Ethernet cables, and Wi-Fi link.',
          'Verify workstation IP configuration and test ping to department switch.',
          'Check application service health or EMR login token validity.',
          'Escalate immediately to On-Call IT Lead if patient care is affected.',
        ],
        riskSummary: 'Ensure clinical staff are updated if troubleshooting exceeds 15 minutes.',
        analyzedAt: new Date().toISOString(),
      };
    }
  }
}

export const aiTriageService = new AiTriageService();
