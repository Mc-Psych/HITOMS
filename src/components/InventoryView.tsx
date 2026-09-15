import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  History,
  X,
  FileText,
} from 'lucide-react';
import {
  type InventoryItem,
  type InventoryTransaction,
  type User as UserType,
} from '../types';
import { inventoryService } from '../services/inventoryService';

interface InventoryViewProps {
  inventory?: InventoryItem[];
  items?: InventoryItem[];
  currentUser: UserType | null;
  onRefresh: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory = [],
  items = [],
  currentUser,
  onRefresh,
}) => {
  const safeInventory = (inventory && inventory.length > 0 ? inventory : items) || [];
  const [activeTab, setActiveTab] = useState<'STOCK' | 'TRANSACTIONS'>('STOCK');
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Transaction modal state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [txType, setTxType] = useState<InventoryTransaction['transactionType']>('Stock Issued');
  const [quantity, setQuantity] = useState<number>(1);
  const [department, setDepartment] = useState('Maternity Ward');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('MAT-REQ-001');

  // New item modal state
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Cables');
  const [initialQty, setInitialQty] = useState(10);
  const [unit, setUnit] = useState('Pieces');
  const [minStock, setMinStock] = useState(5);
  const [storageLocation, setStorageLocation] = useState('Shelf A-3');

  React.useEffect(() => {
    const loadTx = async () => {
      const data = await inventoryService.getTransactions();
      setTransactions(data);
    };
    loadTx();
  }, [activeTab]);

  const filteredInventory = safeInventory.filter((item) => {
    return (
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleOpenTx = (item: InventoryItem, defaultType: InventoryTransaction['transactionType']) => {
    setSelectedItem(item);
    setTxType(defaultType);
    setQuantity(1);
    setReason('');
    setTxModalOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !currentUser || quantity <= 0) return;

    try {
      await inventoryService.recordTransaction(
        selectedItem.id,
        txType,
        quantity,
        reason || `${txType} recorded by ${currentUser.fullName}`,
        reference,
        txType === 'Stock Issued' ? department : undefined,
        currentUser
      );

      setTxModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Transaction error');
    }
  };

  const handleCreateItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !currentUser) return;

    try {
      await inventoryService.createItem(
        {
          itemName: itemName.trim(),
          category,
          quantity: initialQty,
          unit,
          minimumStock: minStock,
          maximumStock: minStock * 5,
          supplier: 'Hospital IT Supplier',
          unitCost: 15,
          storageLocation: storageLocation || 'IT Store Room Shelf A',
        },
        currentUser
      );

      setAddItemModalOpen(false);
      setItemName('');
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
            <Package className="w-5 h-5 text-sky-600" />
            <span>IT Consumables & Stock Inventory</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline storekeeper ledger. Issue CAT6, RJ45, toner, and peripherals directly to hospital wards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('STOCK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'STOCK'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Current Stock ({safeInventory.length})
            </button>
            <button
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'TRANSACTIONS'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Transaction Ledger ({transactions.length})
            </button>
          </div>

          <button
            onClick={() => setAddItemModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Catalog Item</span>
          </button>
        </div>
      </div>

      {activeTab === 'STOCK' ? (
        <>
          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search items, toner, cables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-sky-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Stock Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Available Quantity</th>
                    <th className="px-4 py-3">Min Threshold</th>
                    <th className="px-4 py-3">Store Location</th>
                    <th className="px-4 py-3 text-right">Stock Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInventory.map((item) => {
                    const isLow = item.quantity <= item.minimumStock;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 font-mono font-bold text-sky-600">
                          {item.itemCode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {item.itemName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {item.category}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold text-sm ${isLow ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                              {item.quantity} {item.unit}
                            </span>
                            {isLow && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                Low Stock
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono">
                          {item.minimumStock} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {item.location}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenTx(item, 'Stock Issued')}
                              className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 font-semibold cursor-pointer"
                            >
                              Issue to Ward
                            </button>
                            <button
                              onClick={() => handleOpenTx(item, 'Stock Received')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer"
                            >
                              Receive
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Transactions Ledger */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Transaction Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Target Ward / Dept</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(tx.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {tx.itemName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.transactionType === 'Stock Received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.transactionType === 'Stock Issued'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {tx.transactionType === 'Stock Issued' ? `-${tx.quantity}` : `+${tx.quantity}`}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {tx.department || 'Central Store'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {tx.performedBy}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <div>{tx.reference}</div>
                      <div className="text-[10px] text-slate-400">{tx.reason}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Stock Transaction Modal */}
      {txModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Record Stock: {selectedItem.itemName}
              </h3>
              <button onClick={() => setTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransactionSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Transaction Type *</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                >
                  <option value="Stock Issued">Stock Issued to Department</option>
                  <option value="Stock Received">Stock Received from Supplier</option>
                  <option value="Stock Returned">Stock Returned from Ward</option>
                  <option value="Damaged Stock">Damaged Stock Write-off</option>
                  <option value="Stock Adjustment">Physical Count Adjustment</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Quantity ({selectedItem.unit}) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none font-bold text-slate-900 dark:text-white"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Available: {selectedItem.quantity} {selectedItem.unit}</div>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Department / Ward</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Reference Voucher / Slip #</label>
                <input
                  type="text"
                  placeholder="e.g. REQ-2026-098"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Patching cabling in Maternity triage ward"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTxModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Confirm Ledger Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Catalog Item Modal */}
      {addItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Register New Stock Item
              </h3>
              <button onClick={() => setAddItemModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItemSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDMI Cable 2m, HP 85A Toner"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Cables">Network Cables</option>
                    <option value="Connectors">Connectors & Jacks</option>
                    <option value="Printer Supplies">Printer Supplies / Toner</option>
                    <option value="Peripherals">Peripherals (Keyboards/Mice)</option>
                    <option value="Tools">Tools & Testers</option>
                    <option value="Batteries">Batteries & Power</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Unit of Measure *</label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Initial Quantity *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={initialQty}
                    onChange={(e) => setInitialQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Low Stock Threshold *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Shelf / Bin Location</label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
