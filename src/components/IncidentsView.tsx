import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  X,
  Send,
  ShieldAlert,
} from 'lucide-react';
import {
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
  type RootCauseAnalysis,
  type User as UserType,
} from '../types';
import { incidentService } from '../services/incidentService';
import { authService } from '../services/authService';

interface IncidentsViewProps {
  incidents?: Incident[];
  currentUser: UserType | null;
  onRefresh: () => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents = [],
  currentUser,
  onRefresh,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineUpdate, setTimelineUpdate] = useState('');

  // Permission check: strictly Super Admin and IT unit staff can declare incidents and post updates/RCA
  const canManageIncidents = authService.canManageIncidents(currentUser);

  // Declare modal state
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('High');
  const [affectedSystemsInput, setAffectedSystemsInput] = useState('LHIMS, Main Switch');
  const [affectedDeptsInput, setAffectedDeptsInput] = useState('Maternity, OPD, Pharmacy');
  const [assignedTeam, setAssignedTeam] = useState('Core Infrastructure Team');
  const [impact, setImpact] = useState('Clinical delays across outpatients');

  // RCA / Resolve modal state
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [immediateCause, setImmediateCause] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [preventiveAction, setPreventiveAction] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');

  const safeIncidents = incidents || [];
  const filtered = safeIncidents.filter((i) => {
    return (
      (i.incidentNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.affectedDepartments || []).some((d) => (d || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleDeclareIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentUser) return;

    try {
      await incidentService.reportIncident(
        {
          title: title.trim(),
          description: description.trim(),
          severity,
          affectedSystems: affectedSystemsInput.split(',').map((s) => s.trim()),
          affectedDepartments: affectedDeptsInput.split(',').map((d) => d.trim()),
          assignedTeam,
          impact,
        },
        currentUser
      );

      setDeclareModalOpen(false);
      setTitle('');
      setDescription('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTimeline = async () => {
    if (!selectedIncident || !timelineUpdate.trim() || !currentUser) return;
    try {
      const updated = await incidentService.addTimelineUpdate(
        selectedIncident.id,
        timelineUpdate.trim(),
        currentUser
      );
      setSelectedIncident(updated);
      setTimelineUpdate('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !resolutionSummary.trim() || !rootCause.trim() || !currentUser) return;

    const rca: RootCauseAnalysis = {
      immediateCause,
      rootCause,
      contributingFactors: immediateCause,
      correctiveAction,
      preventiveAction,
      lessonsLearned,
      responsiblePerson: currentUser.fullName,
      targetDate: new Date().toISOString().split('T')[0],
    };

    try {
      const updated = await incidentService.resolveIncident(
        selectedIncident.id,
        resolutionSummary.trim(),
        rca,
        currentUser
      );
      setSelectedIncident(updated);
      setResolveModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-600" />
            <span>Major Incidents & Root Cause Analysis</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline incident response coordination, live timelines, and formal RCA post-mortems.
          </p>
        </div>

        {canManageIncidents ? (
          <button
            onClick={() => setDeclareModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Declare Major Incident</span>
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700">
            Auditor / Management View Only
          </span>
        )}
      </div>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((inc) => {
          const isActive = inc.status === 'Active' || inc.status === 'Investigating';
          return (
            <div
              key={inc.id}
              onClick={() => setSelectedIncident(inc)}
              className={`border rounded-2xl p-5 shadow-2xs transition cursor-pointer flex flex-col justify-between space-y-4 ${
                isActive
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-rose-600">{inc.incidentNumber}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inc.severity === 'Critical'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isActive ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-2">
                  {inc.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                  {inc.description}
                </p>

                <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Affected Departments:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {Array.isArray(inc.affectedDepartments)
                        ? inc.affectedDepartments.join(', ')
                        : (inc.affectedDepartments || 'General')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Declared At:</span>
                    <span className="text-slate-600 dark:text-slate-300">{new Date(inc.startTime).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-600">
                  {(inc.timeline || []).length} timeline updates
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Inspect Incident & RCA →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Incident Details & Timeline Drawer */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-rose-600 text-sm">{selectedIncident.incidentNumber}</span>
                <span className="font-bold text-slate-900 dark:text-white text-base truncate">
                  {selectedIncident.title}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                  {selectedIncident.status}
                </span>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical & Operational Impact</h4>
                <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {selectedIncident.impact || selectedIncident.description}
                </p>
              </div>

              {/* RCA Details if completed */}
              {selectedIncident.rootCauseAnalysis && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Root Cause Analysis (RCA) Completed</span>
                  </div>
                  <p><strong>Root Cause:</strong> {selectedIncident.rootCauseAnalysis.rootCause}</p>
                  <p><strong>Immediate Cause:</strong> {selectedIncident.rootCauseAnalysis.immediateCause}</p>
                  <p><strong>Corrective Action:</strong> {selectedIncident.rootCauseAnalysis.correctiveAction}</p>
                  <p><strong>Preventive Action:</strong> {selectedIncident.rootCauseAnalysis.preventiveAction}</p>
                  <p className="italic text-slate-500"><strong>Lessons Learned:</strong> {selectedIncident.rootCauseAnalysis.lessonsLearned}</p>
                </div>
              )}

              {/* Action Bar (Resolve Button) */}
              {selectedIncident.status !== 'Resolved' && selectedIncident.status !== 'Closed' && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                  <span className="text-amber-800 dark:text-amber-200 font-medium">
                    Incident is currently ongoing. Coordinate recovery with team.
                  </span>
                  {canManageIncidents ? (
                    <button
                      onClick={() => setResolveModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                    >
                      Resolve & Conduct RCA
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Ongoing • IT Action Required
                    </span>
                  )}
                </div>
              )}

              {/* Timeline Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Live Response Timeline ({(selectedIncident.timeline || []).length})
                </h4>

                <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800 pl-4 ml-2">
                  {(selectedIncident.timeline || []).map((t, idx) => (
                    <div key={idx} className="relative pb-3">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-600 border-2 border-white dark:border-slate-900" />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-900 dark:text-white">{t.user}</span>
                        <span className="text-slate-400">{new Date(t.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">{t.message}</p>
                    </div>
                  ))}
                </div>

                {/* Add Timeline Entry */}
                {canManageIncidents ? (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Broadcast an update on cable check, switch reboot, or status..."
                      value={timelineUpdate}
                      onChange={(e) => setTimelineUpdate(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTimeline()}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={handleAddTimeline}
                      disabled={!timelineUpdate.trim()}
                      className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 text-center border border-slate-200 dark:border-slate-800">
                    Live timeline broadcasts restricted to IT Response Engineers & Super Admin.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Declare Incident Modal */}
      {declareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                <Flame className="w-5 h-5" />
                <span>Declare Major Hospital IT Incident</span>
              </h3>
              <button onClick={() => setDeclareModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeclareIncident} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Incident Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starlink satellite link loss - fallback to local LAN only"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Severity *</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Critical">Critical (Whole hospital outage)</option>
                    <option value="High">High (Key clinical department affected)</option>
                    <option value="Medium">Medium (Single ward or redundant system)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Assigned Team</label>
                  <input
                    type="text"
                    value={assignedTeam}
                    onChange={(e) => setAssignedTeam(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Affected Systems (comma separated)</label>
                <input
                  type="text"
                  value={affectedSystemsInput}
                  onChange={(e) => setAffectedSystemsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Affected Departments (comma separated)</label>
                <input
                  type="text"
                  value={affectedDeptsInput}
                  onChange={(e) => setAffectedDeptsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Initial Impact & Symptoms *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe patient flow blockage, clinical delay, or equipment status..."
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeclareModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Activate Incident Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve & RCA Modal */}
      {resolveModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 overflow-y-auto space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Resolve & Complete Root Cause Analysis</span>
            </h3>

            <form onSubmit={handleResolveIncident} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Resolution Summary *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="What actions brought the system back to operational state?"
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Immediate Cause *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Power surge tripped server room circuit breaker"
                  value={immediateCause}
                  onChange={(e) => setImmediateCause(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Root Cause (Underlying defect) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Server room UPS battery failed to bridge transition"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Corrective Action *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reset breakers, restarted database container"
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Preventive Action *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Replace UPS battery bank and schedule weekly generator test"
                  value={preventiveAction}
                  onChange={(e) => setPreventiveAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Lessons Learned</label>
                <textarea
                  rows={2}
                  placeholder="Key takeaways for hospital IT operations..."
                  value={lessonsLearned}
                  onChange={(e) => setLessonsLearned(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Submit RCA & Close Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
