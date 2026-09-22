import React, { useState, useEffect } from 'react';
import { Send, Users, Building, User, AlertTriangle, Info, AlertCircle, CheckCircle2, X, MessageSquare, History } from 'lucide-react';
import { type User as UserType, type AppNotification } from '../types';
import { notificationService, type SendMessageParams } from '../services/notificationService';
import { auditService } from '../services/auditService';

interface ITMessagingModalProps {
  currentUser: UserType;
  allUsers: UserType[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEPARTMENTS = [
  'Emergency & Trauma',
  'Intensive Care Unit (ICU)',
  'Maternity & Obstetrics',
  'Pharmacy',
  'Laboratory & Pathology',
  'Radiology & Imaging',
  'Outpatient Department (OPD)',
  'Surgical Theater',
  'Pediatrics',
  'Administration & Finance',
  'IT Operations',
  'Procurement & Stores',
];

export const ITMessagingModal: React.FC<ITMessagingModalProps> = ({
  currentUser,
  allUsers,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'COMPOSE' | 'HISTORY'>('COMPOSE');
  const [targetType, setTargetType] = useState<'ALL' | 'UNIT' | 'USER'>('ALL');
  const [targetUnit, setTargetUnit] = useState<string>(DEPARTMENTS[0]);
  const [targetUserId, setTargetUserId] = useState<string>(allUsers[0]?.id || '');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'info' | 'warning' | 'error' | 'success'>('info');
  const [isSending, setIsSending] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentHistory, setSentHistory] = useState<AppNotification[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      loadHistory();
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadHistory = async () => {
    const list = await notificationService.getAllSentMessages();
    setSentHistory(list);
  };

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim() || !message.trim()) {
      setErrorMessage('Please provide both a subject and message body.');
      return;
    }

    setIsSending(true);
    try {
      const params: SendMessageParams = {
        title: title.trim(),
        message: message.trim(),
        type: priority,
        targetType,
        targetUnit: targetType === 'UNIT' ? targetUnit : undefined,
        targetUserId: targetType === 'USER' ? targetUserId : undefined,
        senderName: currentUser.fullName,
        senderRole: currentUser.role,
        module: 'IT Communications',
      };

      await notificationService.sendMessage(params);
      await auditService.logAction(
        'SEND_IT_MESSAGE',
        'Communications',
        targetType,
        null,
        { targetType, targetUnit: params.targetUnit, targetUserId: params.targetUserId, title }
      );

      setSuccessNotice(true);
      setTitle('');
      setMessage('');
      await loadHistory();

      setTimeout(() => {
        setSuccessNotice(false);
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch hospital communication.');
    } finally {
      setIsSending(false);
    }
  };

  const selectedTargetUser = allUsers.find((u) => u.id === targetUserId);

  return (
    <div
      id="it-messaging-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        id="it-messaging-modal"
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-xs text-slate-800 dark:text-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Hospital IT Messaging & Broadcast Center</h3>
              <p className="text-[11px] text-slate-400">
                Dispatch urgent advisories, maintenance notices, and direct instructions across local units.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('COMPOSE')}
            className={`py-3 px-4 font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'COMPOSE'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose Message</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('HISTORY');
              loadHistory();
            }}
            className={`py-3 px-4 font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Sent Communications ({sentHistory.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'COMPOSE' && (
            <form onSubmit={handleSend} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Hospital communication successfully delivered to target recipients!</span>
                </div>
              )}

              {/* Target Audience Selector */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Target Recipient Scope *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('ALL')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      targetType === 'ALL'
                        ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-600 text-sky-600 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>All Hospital Staff</span>
                    <span className="text-[10px] text-slate-400 font-normal">Hospital-Wide Broadcast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('UNIT')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      targetType === 'UNIT'
                        ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-600 text-sky-600 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Specific Unit</span>
                    <span className="text-[10px] text-slate-400 font-normal">Single Clinical/Admin Dept</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('USER')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      targetType === 'USER'
                        ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-600 text-sky-600 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Single Staff Member</span>
                    <span className="text-[10px] text-slate-400 font-normal">Direct User Direct Message</span>
                  </button>
                </div>
              </div>

              {/* Conditional Target Details */}
              {targetType === 'UNIT' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Hospital Unit / Department
                  </label>
                  <select
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-sky-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'USER' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Staff Recipient
                  </label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-sky-500"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} — {u.department} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Message Priority / Category */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'info', label: 'General Notice', color: 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' },
                  { key: 'warning', label: 'Maintenance Warning', color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
                  { key: 'error', label: 'Critical Outage', color: 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
                  { key: 'success', label: 'Resolved / Normal', color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPriority(item.key as any)}
                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer ${
                      priority === item.key ? item.color : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Subject Title */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Heading *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Starlink Dish Relocation at 23:00"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message Content & Instructions *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide precise details, affected systems, downtime window, or steps for staff..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Sending Dispatch...' : 'Broadcast Message'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              {sentHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No communications have been dispatched yet.</p>
                </div>
              ) : (
                sentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            item.type === 'error'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700'
                              : item.type === 'warning'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700'
                              : item.type === 'success'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700'
                              : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700'
                          }`}
                        >
                          {item.type}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white">{item.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      <span>
                        Audience:{' '}
                        <strong className="text-sky-600">
                          {item.targetType === 'ALL'
                            ? 'All Staff'
                            : item.targetType === 'UNIT'
                            ? `Unit: ${item.targetUnit || 'Department'}`
                            : 'Single User'}
                        </strong>
                      </span>
                      {item.senderName && (
                        <span>
                          Sender: <strong>{item.senderName}</strong> ({item.senderRole})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
