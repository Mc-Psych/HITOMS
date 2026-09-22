import React, { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Building,
  User,
  X,
} from 'lucide-react';
import { type ProcurementRequest, type User as UserType } from '../types';
import { getAllFromStore, putToStore, generateUUID, getDeviceId } from '../services/localDatabaseService';
import { auditService } from '../services/auditService';
import { syncService } from '../services/syncService';
import { authService } from '../services/authService';

interface ProcurementViewProps {
  currentUser: UserType | null;
}

export const ProcurementView: React.FC<ProcurementViewProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Permission check: strictly Super Admin, IT staff, Procurement Officer & Department Heads can submit/approve
  // Auditor and Hospital Management are read-only
  const canManageProcurement = authService.canManageProcurement(currentUser);
  const isReadOnly = authService.isReadOnlyAuditorOrManagement(currentUser);

  // Form state
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState(150);
  const [department, setDepartment] = useState(currentUser?.department || 'Laboratory');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState<ProcurementRequest['priority']>('Medium');

  const loadRequests = async () => {
    const list = await getAllFromStore<ProcurementRequest>('procurementRequests');
    setRequests(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  React.useEffect(() => {
    loadRequests();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !currentUser) return;

    const id = generateUUID();
    const reqNumber = 'PR-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date().toISOString();

    const newReq: ProcurementRequest = {
      id,
      requestNumber: reqNumber,
      item: itemName.trim(),
      requestedBy: currentUser.fullName,
      department,
      quantity,
      estimatedCost,
      justification,
      priority,
      status: 'Submitted',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('procurementRequests', newReq);
    await auditService.logAction('CREATE_PROCUREMENT_REQUEST', 'Procurement', id, null, newReq);
    await syncService.enqueueOperation('procurementRequests', id, 'CREATE', newReq);

    setCreateModalOpen(false);
    setItemName('');
    setJustification('');
    loadRequests();
  };

  const handleUpdateStatus = async (req: ProcurementRequest, newStatus: ProcurementRequest['status']) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    req.status = newStatus;
    if (newStatus === 'Ordered' || newStatus === 'Completed') {
      req.approvedBy = currentUser.fullName;
    }
    req.updatedAt = now;
    req._syncStatus = 'PENDING_SYNC';
    req._syncVersion = (req._syncVersion || 1) + 1;

    await putToStore('procurementRequests', req);
    await auditService.logAction('UPDATE_PROCUREMENT_STATUS', 'Procurement', req.id, null, { status: newStatus });
    await syncService.enqueueOperation('procurementRequests', req.id, 'UPDATE', req);
    loadRequests();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-sky-600" />
            <span>IT Procurement & Requisitions</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline hardware purchasing requests, approvals, and budget tracking for hospital departments.
          </p>
        </div>

        {!isReadOnly ? (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Requisition</span>
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700">
            Auditor / Management View Only
          </span>
        )}
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {requests.map((req) => (
          <div
            key={req.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-sky-600">{req.requestNumber}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    req.status === 'Approved' || req.status === 'Received'
                      ? 'bg-emerald-100 text-emerald-800'
                      : req.status === 'Rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {req.status}
                </span>
              </div>

              <h3 className="font-bold text-base text-slate-900 dark:text-white mt-2">
                {req.item}
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{req.justification}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{req.department}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Quantity & Cost:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {req.quantity} units (${req.estimatedCost})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Requested By:</span>
                  <span className="text-slate-600 dark:text-slate-300">{req.requestedBy}</span>
                </div>
              </div>
            </div>

            {/* Approval Controls */}
            {req.status === 'Submitted' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                {canManageProcurement ? (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(req, 'Ordered')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Order</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(req, 'Rejected')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Pending Procurement / IT Approval
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">New Requisition</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Equipment / Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zebra ZD220 Barcode Label Printer for Laboratory"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Estimated Cost ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Department *</label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Clinical Justification *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why current equipment cannot meet clinical requirements..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
