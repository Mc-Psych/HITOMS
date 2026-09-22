import React, { useState } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Send,
  Calendar,
  Building,
  MapPin,
  ChevronRight,
  X,
  FileText,
  AlertTriangle,
  Star,
} from 'lucide-react';
import {
  type Ticket,
  type TicketPriority,
  type TicketCategory,
  type TicketStatus,
  type User as UserType,
  type Attachment,
} from '../types';
import { ticketService } from '../services/ticketService';

interface TicketsViewProps {
  tickets?: Ticket[];
  allUsers?: UserType[];
  assets?: any[];
  currentUser: UserType | null;
  onRefresh: () => void;
  openCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  tickets = [],
  allUsers = [],
  currentUser,
  onRefresh,
  openCreateModal = false,
  onCloseCreateModal,
}) => {
  const safeTickets = tickets || [];
  const safeAllUsers = allUsers || [];
  const [localCreateModalOpen, setLocalCreateModalOpen] = useState(false);
  const isCreateModalOpen = openCreateModal || localCreateModalOpen;

  const handleCloseCreateModal = () => {
    setLocalCreateModalOpen(false);
    if (onCloseCreateModal) {
      onCloseCreateModal();
    }
  };

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Form states for creating ticket
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('Hardware');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [department, setDepartment] = useState(currentUser?.department || 'OPD');
  const [location, setLocation] = useState('Block A - Room 102');
  const [isGeneralIssue, setIsGeneralIssue] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail view interaction states
  const [commentText, setCommentText] = useState('');
  const [assignTechnicianId, setAssignTechnicianId] = useState('');
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('');
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionDesc, setResolutionDesc] = useState('');
  const [resolutionWork, setResolutionWork] = useState('');
  const [resolutionRec, setResolutionRec] = useState('');

  // Rating & confirmation states
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [isConfirmingRating, setIsConfirmingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const itStaff = safeAllUsers.filter(
    (u) => u.role === 'IT_OFFICER' || u.role === 'IT_ADMIN' || u.role === 'SUPER_ADMIN'
  );

  const canAssign = currentUser && ['SUPER_ADMIN', 'IT_ADMIN'].includes(currentUser.role);
  const canUpdateStatus = currentUser && ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'].includes(currentUser.role);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (resolveModalOpen) setResolveModalOpen(false);
        else if (isCreateModalOpen) handleCloseCreateModal();
        else if (selectedTicket) setSelectedTicket(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resolveModalOpen, isCreateModalOpen, selectedTicket]);

  // Filter tickets
  const filteredTickets = safeTickets.filter((t) => {
    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.reportedBy.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    const matchesDept = deptFilter === 'ALL' || t.department === deptFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesDept;
  });

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileUrl = event.target?.result as string;
        setAttachedFiles((prev) => [
          ...prev,
          {
            id: 'att-' + Math.random().toString(36).substring(2, 9),
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      await ticketService.createTicket(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          department,
          location,
          isGeneralIssue,
          attachments: attachedFiles,
        },
        currentUser
      );

      // Reset form
      setTitle('');
      setDescription('');
      setIsGeneralIssue(false);
      setAttachedFiles([]);
      handleCloseCreateModal();
      onRefresh();
    } catch (err) {
      console.error('Failed to create ticket', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAndClose = async () => {
    if (!selectedTicket || !currentUser) return;
    setIsConfirmingRating(true);
    setRatingError(null);
    try {
      const updated = await ticketService.closeTicketWithRating(
        selectedTicket.id,
        ratingScore,
        ratingFeedback.trim(),
        currentUser
      );
      setSelectedTicket(updated);
      setRatingFeedback('');
      onRefresh();
    } catch (err: any) {
      setRatingError(err.message || 'Failed to confirm resolution and rate IT service.');
    } finally {
      setIsConfirmingRating(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !commentText.trim() || !currentUser) return;
    try {
      const updated = await ticketService.addComment(selectedTicket.id, commentText.trim(), currentUser);
      setSelectedTicket(updated);
      setCommentText('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignTicket = async () => {
    if (!selectedTicket || !assignTechnicianId || !currentUser) return;
    const tech = allUsers.find((u) => u.id === assignTechnicianId);
    if (!tech) return;

    try {
      const updated = await ticketService.assignTicket(
        selectedTicket.id,
        { uid: tech.id, name: tech.fullName, email: tech.email },
        currentUser
      );
      setSelectedTicket(updated);
      setAssignTechnicianId('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!selectedTicket || !currentUser) return;
    try {
      const updated = await ticketService.updateStatus(selectedTicket.id, status, currentUser);
      setSelectedTicket(updated);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !resolutionDesc.trim() || !resolutionWork.trim() || !currentUser) return;
    try {
      const updated = await ticketService.resolveTicket(
        selectedTicket.id,
        {
          description: resolutionDesc.trim(),
          workPerformed: resolutionWork.trim(),
          preventiveRecommendation: resolutionRec.trim() || undefined,
        },
        currentUser
      );
      setSelectedTicket(updated);
      setResolveModalOpen(false);
      setResolutionDesc('');
      setResolutionWork('');
      setResolutionRec('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Unique departments for filter
  const departments = Array.from(new Set(safeTickets.map((t) => t.department)));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-sky-600" />
            <span>Hospital IT Help Desk</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline-first issue tracking. Tickets are committed locally to IndexedDB and queue automatically.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="ticket-search-input"
              type="text"
              placeholder="Search tickets, tags, staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Status Filter */}
          <select
            id="ticket-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Statuses ({safeTickets.length})</option>
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending">Pending</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>

          {/* Priority Filter */}
          <select
            id="ticket-priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Department Filter */}
          <select
            id="ticket-dept-filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Title & Category</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Department / Location</th>
                <th className="px-4 py-3">Reported By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sync Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No tickets found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-sky-600">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{ticket.title}</div>
                      <div className="text-[10px] text-slate-400">{ticket.category}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ticket.priority === 'Critical'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            : ticket.priority === 'High'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            : ticket.priority === 'Medium'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div>{ticket.department}</div>
                      <div className="text-[10px] text-slate-400">{ticket.location}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div>{ticket.reportedBy.name}</div>
                      <div className="text-[10px] text-slate-400">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          ticket.status === 'Resolved' || ticket.status === 'Closed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : ticket.status === 'In Progress'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                            : ticket.status === 'Assigned'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                          ticket._syncStatus === 'SYNCED'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {ticket._syncStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicket(ticket);
                        }}
                        className="text-sky-600 hover:text-sky-700 font-semibold text-xs flex items-center justify-end gap-1 ml-auto"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Detail Drawer / Modal */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sky-600 text-sm">{selectedTicket.ticketNumber}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedTicket.priority === 'Critical'
                      ? 'bg-rose-100 text-rose-700'
                      : selectedTicket.priority === 'High'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {selectedTicket.priority}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Status: {selectedTicket.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Title & Description */}
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.title}</h2>
                <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400">Department</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedTicket.department}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Location</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedTicket.location}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Reported By</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedTicket.reportedBy.name}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Assigned Technician</span>
                  <div className="font-semibold text-sky-600 mt-0.5">
                    {selectedTicket.assignedTo ? selectedTicket.assignedTo.name : 'Unassigned'}
                  </div>
                </div>
              </div>

              {/* SLA Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-sky-900 dark:text-sky-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <span>
                    Resolution Target: <strong>{new Date(selectedTicket.sla.resolutionDue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> ({new Date(selectedTicket.sla.resolutionDue).toLocaleDateString()})
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-100">
                  SLA Active
                </span>
              </div>

              {/* Resolution block if resolved */}
              {selectedTicket.resolution && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Resolution Summary</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">
                    <strong>Work Performed:</strong> {selectedTicket.resolution.workPerformed}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200">
                    <strong>Solution:</strong> {selectedTicket.resolution.description}
                  </p>
                  {selectedTicket.resolution.preventiveRecommendation && (
                    <p className="text-slate-600 dark:text-slate-400 italic">
                      <strong>Preventive Rec:</strong> {selectedTicket.resolution.preventiveRecommendation}
                    </p>
                  )}
                  <div className="text-[10px] text-emerald-600 mt-2">
                    Resolved by {selectedTicket.resolution.resolvedBy} on {new Date(selectedTicket.resolution.resolvedAt).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Unit Confirmation & IT Service Rating Block for Resolved Tickets */}
              {selectedTicket.status === 'Resolved' && (() => {
                const isGeneral = Boolean(selectedTicket.isGeneralIssue);
                const isSameUnit = currentUser?.department?.toLowerCase() === selectedTicket.department?.toLowerCase();
                const isReporter = currentUser?.id === selectedTicket.reportedBy?.uid;
                const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
                const canConfirmTicket = isGeneral || isSameUnit || isReporter || isSuperAdmin;

                return (
                  <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/70 dark:bg-amber-950/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>Unit Confirmation & IT Performance Rating</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                        {isGeneral ? 'General Hospital Issue (Any Staff May Confirm)' : `Reporting Unit Only: ${selectedTicket.department}`}
                      </span>
                    </div>

                    {canConfirmTicket ? (
                      <div className="space-y-3 pt-1">
                        <p className="text-slate-700 dark:text-slate-300 text-xs">
                          The IT team has reported this issue resolved. Please verify functionality in your unit, rate how IT handled the request, and confirm ticket closure.
                        </p>

                        {ratingError && (
                          <div className="p-2.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{ratingError}</span>
                          </div>
                        )}

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                            Rate IT Support Quality: <span className="text-amber-600 font-extrabold">{ratingScore} / 5 Stars</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRatingScore(star)}
                                className="p-1 hover:scale-110 transition cursor-pointer"
                                title={`${star} Star${star > 1 ? 's' : ''}`}
                              >
                                <Star
                                  className={`w-6 h-6 ${
                                    star <= ratingScore
                                      ? 'text-amber-500 fill-amber-500'
                                      : 'text-slate-300 dark:text-slate-600'
                                  }`}
                                />
                              </button>
                            ))}
                            <span className="text-xs text-slate-500 font-medium ml-2">
                              {ratingScore === 5 && 'Outstanding & Quick Resolution'}
                              {ratingScore === 4 && 'Good Service & Verified Working'}
                              {ratingScore === 3 && 'Satisfactory Support'}
                              {ratingScore === 2 && 'Resolved with Delays'}
                              {ratingScore === 1 && 'Poor Handling / Persistent Issues'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                            Verification Feedback / Notes (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Tested in OPD room, LHIMS network and label printer are operating normally"
                            value={ratingFeedback}
                            onChange={(e) => setRatingFeedback(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-amber-500 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleConfirmAndClose}
                            disabled={isConfirmingRating}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isConfirmingRating ? 'Confirming Closure...' : 'Confirm Resolution & Close Ticket'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed">
                          <strong>Unit Confirmation Required:</strong> Under hospital IT governance, only staff belonging to the reporting department (<strong>{selectedTicket.department}</strong>) can confirm resolution and submit the IT performance rating for this ticket.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Display Confirmed Rating if Closed */}
              {selectedTicket.status === 'Closed' && selectedTicket.confirmationRating && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Unit Verified Resolution & IT Rating</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= selectedTicket.confirmationRating!.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      ))}
                      <span className="font-bold text-xs text-amber-600 ml-1">
                        {selectedTicket.confirmationRating.rating}/5
                      </span>
                    </div>
                  </div>
                  {selectedTicket.confirmationRating.feedback && (
                    <p className="text-slate-600 dark:text-slate-300 italic text-xs">
                      &ldquo;{selectedTicket.confirmationRating.feedback}&rdquo;
                    </p>
                  )}
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <span>
                      Confirmed by <strong>{selectedTicket.confirmationRating.confirmedBy.name}</strong> ({selectedTicket.confirmationRating.confirmedBy.department})
                    </span>
                    <span>{new Date(selectedTicket.confirmationRating.confirmedAt).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Quick Actions (Assign / Status Change / Resolve) */}
              {canUpdateStatus || canAssign ? (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
                      IT Technician Operations
                    </span>
                    <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold px-2 py-0.5 rounded-full">
                      Authorized: {currentUser?.role}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Assign - Only SUPER_ADMIN & IT_ADMIN */}
                    {canAssign && (
                      <>
                        <select
                          id="assign-tech-select"
                          value={assignTechnicianId}
                          onChange={(e) => setAssignTechnicianId(e.target.value)}
                          className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        >
                          <option value="">Assign to Technician...</option>
                          {itStaff.map((s) => (
                            <option key={s.id} value={s.id}>{s.fullName} ({s.role})</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAssignTicket}
                          disabled={!assignTechnicianId}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-40 cursor-pointer"
                        >
                          Assign
                        </button>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
                      </>
                    )}

                    {/* Status Changes - IT Staff & Admins */}
                    {canUpdateStatus && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus('In Progress')}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
                        >
                          Set In Progress
                        </button>

                        <button
                          onClick={() => setResolveModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                        >
                          Resolve Ticket
                        </button>

                        <button
                          onClick={() => handleUpdateStatus('Closed')}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold cursor-pointer"
                        >
                          Close
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-800/60 bg-sky-50/60 dark:bg-sky-950/30 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <span className="font-semibold text-sky-900 dark:text-sky-200">Staff & Clinical View:</span> Ticket status and technical resolutions are managed by designated Hospital IT officers. You can add notes or reply below to communicate with the IT response team.
                  </div>
                </div>
              )}

              {/* Comments Timeline */}
              <div className="space-y-3">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Activity & Communication History ({selectedTicket.comments.length})
                </span>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {selectedTicket.comments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No comments recorded yet.</p>
                  ) : (
                    selectedTicket.comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {c.userName} <span className="text-sky-600">({c.userRole})</span>
                          </span>
                          <span className="text-slate-400">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-xs">{c.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add an internal note or clinical staff update..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                    className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Ticket Modal */}
      {resolveModalOpen && selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setResolveModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Resolve Ticket {selectedTicket.ticketNumber}</span>
            </h3>

            <form onSubmit={handleResolveTicket} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Work Performed *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Replaced faulty RJ45 keystone, reconfigured LAN IP on Maternity workstation..."
                  value={resolutionWork}
                  onChange={(e) => setResolutionWork(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Solution Description *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Summary of outcome and verification with department staff..."
                  value={resolutionDesc}
                  onChange={(e) => setResolutionDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Preventive Recommendation (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Install cable trunking to avoid nurse trolley snagging wire"
                  value={resolutionRec}
                  onChange={(e) => setResolutionRec(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
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
                  Complete Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={handleCloseCreateModal}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-sky-600" />
                <span>Create Hospital IT Ticket</span>
              </h3>
              <button onClick={handleCloseCreateModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maternity LHIMS terminal cannot access patient records"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TicketCategory)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Hospital System">Hospital System (LHIMS)</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Network">Network / LAN</option>
                    <option value="Internet">Internet / Starlink</option>
                    <option value="Printer">Printer</option>
                    <option value="Account/Login">Account / Login</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Priority *</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Low">Low (Non-clinical)</option>
                    <option value="Medium">Medium (General)</option>
                    <option value="High">High (Clinical Delay)</option>
                    <option value="Critical">Critical (Immediate Patient Care Impact)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Location / Room *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Detailed Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe error messages, symptoms, what steps occurred before failure..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* General Hospital Issue Checkbox */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGeneralIssue}
                    onChange={(e) => setIsGeneralIssue(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      General Hospital Issue (Hospital-Wide)
                    </span>
                    <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                      Check this if the issue affects the entire hospital (e.g. Starlink internet outage, main LHIMS server unreachable, power generator transfer failure) rather than solely your reporting unit. Any hospital staff member will be authorized to confirm and rate resolution.
                    </span>
                  </div>
                </label>
              </div>

              {/* Local File Attachment */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Attach Photo or Screenshot (Saved locally)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
                {attachedFiles.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {attachedFiles.map((f) => (
                      <span key={f.id} className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                        {f.fileName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Locally...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
