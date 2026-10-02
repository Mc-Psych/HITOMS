import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  HardDrive,
  Plus,
  Search,
  QrCode,
  ArrowRightLeft,
  History,
  ShieldCheck,
  CheckCircle2,
  X,
  Building,
  MapPin,
  Laptop,
  Server,
  Printer,
  ChevronRight,
  User,
  Key,
  CheckSquare,
  Square,
  FileText,
  Tag,
  Camera,
  Upload,
  Download,
  Image as ImageIcon,
  AlertTriangle,
  Edit3,
  Trash2,
  Save,
  DollarSign,
  SlidersHorizontal,
} from 'lucide-react';
import {
  type Asset,
  type AssetStatus,
  type AssetCondition,
  type AssetHistoryEntry,
  type User as UserType,
  type SystemSettings,
  type Department,
} from '../types';
import { assetService } from '../services/assetService';
import { authService } from '../services/authService';
import { departmentService } from '../services/departmentService';
import {
  generateAssetQrMetadataPayload,
  downloadAssetQrJpeg,
} from '../utils/qrLabelGenerator';
import { SoftwareSubscriptionsTab } from './SoftwareSubscriptionsTab';
import { AssetQRLabelModal } from './AssetQRLabelModal';
import { AssetBulkUploadModal } from './AssetBulkUploadModal';
import { AssetRegisterReportModal } from './AssetRegisterReportModal';

interface AssetsViewProps {
  assets: Asset[];
  allUsers: UserType[];
  currentUser: UserType | null;
  systemSettings?: SystemSettings | null;
  onRefresh: () => void;
  onReportIssueForAsset?: (asset: Asset) => void;
}

export const AssetsView: React.FC<AssetsViewProps> = ({
  assets,
  allUsers,
  currentUser,
  systemSettings,
  onRefresh,
  onReportIssueForAsset,
}) => {
  const [activeTab, setActiveTab] = useState<'HARDWARE' | 'SUBSCRIPTIONS'>('HARDWARE');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Loaded departments
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);

  useEffect(() => {
    departmentService
      .getDepartments()
      .then((depts) => {
        if (depts && depts.length > 0) {
          setDepartmentsList(depts);
        }
      })
      .catch(console.error);
  }, []);

  const allDepartmentNames = useMemo(() => {
    const fromDepts = departmentsList.map((d) => d.name);
    const fromAssets = assets.map((a) => a.department).filter(Boolean);
    const combined = Array.from(new Set([...fromDepts, ...fromAssets]));
    if (combined.length === 0) {
      return [
        'Accident & Emergency (A&E)',
        'Pharmacy',
        'Laboratory & Pathology',
        'Radiology & Imaging',
        'Intensive Care Unit (ICU)',
        'Outpatient Department (OPD)',
        'Maternity & Neonatal Ward',
        'Main Surgical Theatre',
        'IT & Telecommunications',
        'Hospital Administration & HR',
        'Accounts & Billing',
      ];
    }
    return combined.sort();
  }, [departmentsList, assets]);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Transfer / Reassign state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAssignedUser, setNewAssignedUser] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Create Asset Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [newAssetType, setNewAssetType] = useState<string>('Desktop');

  // Permission check: strictly Super Admin and IT unit staff can edit/add/delete assets.
  const canManageAssets = authService.canManageAssets(currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isSuperAdminOrIT =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'IT_ADMIN' ||
    currentUser?.role === 'IT_OFFICER';

  // Dynamic asset types, conditions & statuses state
  const [assetTypesList, setAssetTypesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hitoms_custom_asset_types');
      return saved ? JSON.parse(saved) : ['Desktop', 'Laptop', 'Server', 'Switch', 'Router', 'Access Point', 'Printer', 'UPS', 'Barcode Scanner', 'Tablet', 'Network Cable', 'Mouse', 'Keyboard', 'Wi-Fi Adapter', 'Bluetooth Adapter'];
    } catch {
      return ['Desktop', 'Laptop', 'Server', 'Switch', 'Router', 'Access Point', 'Printer', 'UPS', 'Barcode Scanner', 'Tablet', 'Network Cable', 'Mouse', 'Keyboard', 'Wi-Fi Adapter', 'Bluetooth Adapter'];
    }
  });

  const [assetConditionsList, setAssetConditionsList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hitoms_custom_asset_conditions');
      return saved ? JSON.parse(saved) : ['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Defective'];
    } catch {
      return ['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Defective'];
    }
  });

  const [assetStatusesList, setAssetStatusesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hitoms_custom_asset_statuses');
      return saved ? JSON.parse(saved) : ['Active', 'In Use', 'In Storage', 'Assigned', 'Available', 'Under Repair', 'Maintenance', 'Decommissioned', 'Disposed', 'Reserved'];
    } catch {
      return ['Active', 'In Use', 'In Storage', 'Assigned', 'Available', 'Under Repair', 'Maintenance', 'Decommissioned', 'Disposed', 'Reserved'];
    }
  });

  const [typesConditionsModalOpen, setTypesConditionsModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<'TYPES' | 'CONDITIONS' | 'STATUSES'>('TYPES');
  const [newTypeInput, setNewTypeInput] = useState('');
  const [newConditionInput, setNewConditionInput] = useState('');
  const [newStatusInput, setNewStatusInput] = useState('');
  const [editingTypeOriginal, setEditingTypeOriginal] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState('');
  const [editingCondOriginal, setEditingCondOriginal] = useState<string | null>(null);
  const [editingCondValue, setEditingCondValue] = useState('');
  const [editingStatusOriginal, setEditingStatusOriginal] = useState<string | null>(null);
  const [editingStatusValue, setEditingStatusValue] = useState('');

  const handleSaveAssetTypes = (types: string[]) => {
    setAssetTypesList(types);
    try {
      localStorage.setItem('hitoms_custom_asset_types', JSON.stringify(types));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSaveAssetConditions = (conds: string[]) => {
    setAssetConditionsList(conds);
    try {
      localStorage.setItem('hitoms_custom_asset_conditions', JSON.stringify(conds));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSaveAssetStatuses = (statuses: string[]) => {
    setAssetStatusesList(statuses);
    try {
      localStorage.setItem('hitoms_custom_asset_statuses', JSON.stringify(statuses));
    } catch (e) {
      console.warn(e);
    }
  };

  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [department, setDepartment] = useState('Pharmacy');
  const [location, setLocation] = useState('Dispensing Counter 1');
  const [assignedUser, setAssignedUser] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('Good');
  const [assetStatus, setAssetStatus] = useState<string>('Active');
  const [ipAddress, setIpAddress] = useState('192.168.10.');
  const [os, setOs] = useState('Windows 11 Pro');
  const [purchasePrice, setPurchasePrice] = useState<number>(1250);
  const [supplier, setSupplier] = useState('Hospital Authorized Vendor');

  // Type-specific specification states (Create)
  const [upsCapacity, setUpsCapacity] = useState('1000VA (1 kVA)');
  const [printerOutputType, setPrinterOutputType] = useState('Monochrome (Black & White)');
  const [printerTech, setPrinterTech] = useState('LaserJet');
  const [environmentSpec, setEnvironmentSpec] = useState('Indoor');
  const [cableCategory, setCableCategory] = useState('Cat 6');
  const [serverFormFactor, setServerFormFactor] = useState('Rackmount 2U');
  const [switchPorts, setSwitchPorts] = useState('24-Port Managed PoE+');
  const [computerSpecs, setComputerSpecs] = useState('Intel Core i5 / 16GB RAM / 512GB SSD');
  const [scannerType, setScannerType] = useState('Handheld USB Barcode Scanner');
  const [mouseConnectivity, setMouseConnectivity] = useState('Wired');
  const [keyboardConnectivity, setKeyboardConnectivity] = useState('Wired');
  const [wifiAdapterType, setWifiAdapterType] = useState('Dongle (USB)');
  const [bluetoothAdapterType, setBluetoothAdapterType] = useState('Dongle (USB)');

  // Asset Register Modal State
  const [assetRegisterModalOpen, setAssetRegisterModalOpen] = useState(false);

  // Edit Asset Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editAssetName, setEditAssetName] = useState('');
  const [editAssetTag, setEditAssetTag] = useState('');
  const [editAssetType, setEditAssetType] = useState('Desktop');
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAssignedUser, setEditAssignedUser] = useState('');
  const [editCondition, setEditCondition] = useState<AssetCondition>('Good');
  const [editStatus, setEditStatus] = useState<AssetStatus>('Active');
  const [editOperatingSystem, setEditOperatingSystem] = useState('');
  const [editIpAddress, setEditIpAddress] = useState('');
  const [editMacAddress, setEditMacAddress] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState<number>(0);
  const [editSupplier, setEditSupplier] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Type-specific specification states (Edit)
  const [editUpsCapacity, setEditUpsCapacity] = useState('1000VA (1 kVA)');
  const [editPrinterOutputType, setEditPrinterOutputType] = useState('Monochrome (Black & White)');
  const [editPrinterTech, setEditPrinterTech] = useState('LaserJet');
  const [editEnvironmentSpec, setEditEnvironmentSpec] = useState('Indoor');
  const [editCableCategory, setEditCableCategory] = useState('Cat 6');
  const [editServerFormFactor, setEditServerFormFactor] = useState('Rackmount 2U');
  const [editSwitchPorts, setEditSwitchPorts] = useState('24-Port Managed PoE+');
  const [editComputerSpecs, setEditComputerSpecs] = useState('Intel Core i5 / 16GB RAM / 512GB SSD');
  const [editScannerType, setEditScannerType] = useState('Handheld USB Barcode Scanner');
  const [editMouseConnectivity, setEditMouseConnectivity] = useState('Wired');
  const [editKeyboardConnectivity, setEditKeyboardConnectivity] = useState('Wired');
  const [editWifiAdapterType, setEditWifiAdapterType] = useState('Dongle (USB)');
  const [editBluetoothAdapterType, setEditBluetoothAdapterType] = useState('Dongle (USB)');

  // Delete Asset Modal state
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // QR Scanner modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [scannedTagInput, setScannedTagInput] = useState('');
  const [scannedAssetFound, setScannedAssetFound] = useState<Asset | null>(null);

  // Bulk Upload Modal state
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);

  // QR Label Print Modal states
  const [qrLabelAsset, setQrLabelAsset] = useState<Asset | null>(null);
  const [batchQRModalOpen, setBatchQRModalOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [detailQrCodeDataUrl, setDetailQrCodeDataUrl] = useState<string>('');

  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.name && a.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      a.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((a.serialNumber || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
      a.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.assignedUser && a.assignedUser.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || a.assetType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesDept = deptFilter === 'ALL' || a.department === deptFilter;

    return matchesSearch && matchesType && matchesStatus && matchesDept;
  });

  // Generate rich QR code data URL whenever selectedAsset changes (encodes Name, Serial, Dept, etc.)
  useEffect(() => {
    if (!selectedAsset) {
      setDetailQrCodeDataUrl('');
      return;
    }
    const payload = generateAssetQrMetadataPayload(selectedAsset);
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setDetailQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate detail QR:', err));
  }, [selectedAsset]);

  // Selection toggle helpers
  const toggleSelectAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (selectedAssetIds.size === filteredAssets.length && filteredAssets.length > 0) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const handleSelectAsset = async (asset: Asset) => {
    setSelectedAsset(asset);
    setLoadingHistory(true);
    try {
      const history = await assetService.getAssetHistory(asset.id);
      setAssetHistory(history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setEditAssetName(asset.name || '');
    setEditAssetTag(asset.assetTag || '');
    setEditAssetType(asset.assetType || 'Desktop');
    setEditManufacturer(asset.manufacturer || '');
    setEditModel(asset.model || '');
    setEditSerialNumber(asset.serialNumber || '');
    setEditDepartment(asset.department || (allDepartmentNames[0] || 'Pharmacy'));
    setEditLocation(asset.location || '');
    setEditAssignedUser(asset.assignedUser || '');
    setEditCondition(asset.condition || 'Good');
    setEditStatus(asset.status || 'Active');
    setEditOperatingSystem(asset.operatingSystem || '');
    setEditIpAddress(asset.ipAddress || '');
    setEditMacAddress(asset.macAddress || '');
    setEditPurchaseDate(asset.purchaseDate || '');
    setEditPurchasePrice(asset.purchasePrice || 0);
    setEditSupplier(asset.supplier || '');
    setEditNotes(asset.notes || '');

    // Prefill type-specific fields
    setEditUpsCapacity(asset.upsCapacity || '1000VA (1 kVA)');
    setEditPrinterOutputType(asset.printerOutputType || 'Monochrome (Black & White)');
    setEditPrinterTech('LaserJet');
    setEditEnvironmentSpec(asset.accessPointEnvironment || asset.cableEnvironment || 'Indoor');
    setEditCableCategory('Cat 6');
    setEditServerFormFactor('Rackmount 2U');
    setEditSwitchPorts('24-Port Managed PoE+');
    setEditComputerSpecs('Intel Core i5 / 16GB RAM / 512GB SSD');
    setEditScannerType('Handheld USB Barcode Scanner');
    setEditMouseConnectivity(asset.mouseConnectivity || 'Wired');
    setEditKeyboardConnectivity(asset.keyboardConnectivity || 'Wired');
    setEditWifiAdapterType(asset.wifiAdapterType || 'Dongle (USB)');
    setEditBluetoothAdapterType(asset.bluetoothAdapterType || 'Dongle (USB)');

    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !currentUser) return;
    setIsSavingEdit(true);
    try {
      const typeUpper = editAssetType.toUpperCase();
      const isEditUps = typeUpper.includes('UPS');
      const isEditCompute = ['DESKTOP', 'LAPTOP', 'SERVER', 'WORKSTATION', 'TABLET'].some((k) => typeUpper.includes(k));

      let typeSpecSummary = '';
      if (typeUpper.includes('UPS')) {
        typeSpecSummary = `Capacity: ${editUpsCapacity}`;
      } else if (typeUpper.includes('PRINTER')) {
        typeSpecSummary = `Print Mode: ${editPrinterOutputType} | Tech: ${editPrinterTech}`;
      } else if (typeUpper.includes('ACCESS POINT') || typeUpper.includes('AP')) {
        typeSpecSummary = `Environment: ${editEnvironmentSpec} | Dual-Band Wi-Fi`;
      } else if (typeUpper.includes('CABLE') || typeUpper.includes('PATCH')) {
        typeSpecSummary = `Environment: ${editEnvironmentSpec} | Category: ${editCableCategory}`;
      } else if (typeUpper.includes('SERVER')) {
        typeSpecSummary = `Form Factor: ${editServerFormFactor}`;
      } else if (typeUpper.includes('SWITCH') || typeUpper.includes('ROUTER') || typeUpper.includes('FIREWALL')) {
        typeSpecSummary = `Ports & PoE: ${editSwitchPorts} | Environment: ${editEnvironmentSpec}`;
      } else if (isEditCompute) {
        typeSpecSummary = `Hardware: ${editComputerSpecs}`;
      } else if (typeUpper.includes('SCANNER')) {
        typeSpecSummary = `Scanner Type: ${editScannerType}`;
      } else if (typeUpper.includes('MOUSE')) {
        typeSpecSummary = `Connectivity: ${editMouseConnectivity}`;
      } else if (typeUpper.includes('KEYBOARD')) {
        typeSpecSummary = `Connectivity: ${editKeyboardConnectivity}`;
      } else if (typeUpper.includes('WI-FI') || typeUpper.includes('WIFI')) {
        typeSpecSummary = `Interface: ${editWifiAdapterType}`;
      } else if (typeUpper.includes('BLUETOOTH')) {
        typeSpecSummary = `Interface: ${editBluetoothAdapterType}`;
      }

      const fullSpecs = `${editAssetName.trim() ? `${editAssetName.trim()} • ` : ''}${editManufacturer.trim()} ${editModel.trim()}${
        typeSpecSummary ? ` [${typeSpecSummary}]` : ''
      }`;

      const updated = await assetService.updateAsset(
        editingAsset.id,
        {
          name: editAssetName.trim() || undefined,
          assetTag: editAssetTag.trim(),
          assetType: editAssetType,
          manufacturer: editManufacturer.trim(),
          model: editModel.trim(),
          serialNumber: editSerialNumber.trim() || undefined,
          department: editDepartment.trim(),
          location: editLocation.trim(),
          assignedUser: editAssignedUser.trim() || undefined,
          condition: editCondition,
          status: editStatus,
          operatingSystem: isEditCompute ? (editOperatingSystem.trim() || undefined) : undefined,
          ipAddress: !isEditUps ? (editIpAddress.trim() || undefined) : undefined,
          macAddress: !isEditUps ? (editMacAddress.trim() || undefined) : undefined,
          purchaseDate: editPurchaseDate || undefined,
          purchasePrice: Number(editPurchasePrice) || 0,
          supplier: editSupplier.trim() || undefined,
          notes: editNotes.trim() || undefined,
          upsCapacity: typeUpper.includes('UPS') ? editUpsCapacity : undefined,
          printerOutputType: typeUpper.includes('PRINTER') ? editPrinterOutputType : undefined,
          accessPointEnvironment: (typeUpper.includes('ACCESS POINT') || typeUpper.includes('AP')) ? editEnvironmentSpec : undefined,
          cableEnvironment: (typeUpper.includes('CABLE') || typeUpper.includes('PATCH')) ? editEnvironmentSpec : undefined,
          mouseConnectivity: typeUpper.includes('MOUSE') ? editMouseConnectivity : undefined,
          keyboardConnectivity: typeUpper.includes('KEYBOARD') ? editKeyboardConnectivity : undefined,
          wifiAdapterType: (typeUpper.includes('WI-FI') || typeUpper.includes('WIFI')) ? editWifiAdapterType : undefined,
          bluetoothAdapterType: typeUpper.includes('BLUETOOTH') ? editBluetoothAdapterType : undefined,
          specifications: fullSpecs,
        },
        currentUser,
        editReason || 'Hardware record modified by authorized IT Unit / Super Admin'
      );
      setEditModalOpen(false);
      if (selectedAsset && selectedAsset.id === editingAsset.id) {
        setSelectedAsset(updated);
        const history = await assetService.getAssetHistory(updated.id);
        setAssetHistory(history);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to update asset:', err);
      alert('Failed to update asset record.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeleteAsset = async () => {
    if (!assetToDelete || !currentUser) return;
    setIsDeletingAsset(true);
    try {
      await assetService.deleteAsset(
        assetToDelete.id,
        currentUser,
        deleteReason || 'Removed by authorized IT Unit / Super Admin'
      );
      if (selectedAsset && selectedAsset.id === assetToDelete.id) {
        setSelectedAsset(null);
      }
      setAssetToDelete(null);
      setDeleteReason('');
      onRefresh();
    } catch (err) {
      console.error('Failed to delete asset:', err);
      alert('Failed to delete asset record.');
    } finally {
      setIsDeletingAsset(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedAssetIds.size === 0 || !currentUser) return;
    setIsBatchDeleting(true);
    try {
      for (const id of selectedAssetIds) {
        await assetService.deleteAsset(
          id,
          currentUser,
          'Batch deletion executed by IT / Super Admin'
        );
      }
      if (selectedAsset && selectedAssetIds.has(selectedAsset.id)) {
        setSelectedAsset(null);
      }
      setSelectedAssetIds(new Set());
      setBatchDeleteModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed batch delete:', err);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manufacturer.trim() || !model.trim() || !currentUser) return;

    try {
      const typeUpper = newAssetType.toUpperCase();
      const isUps = typeUpper.includes('UPS');
      const isCompute = ['DESKTOP', 'LAPTOP', 'SERVER', 'WORKSTATION', 'TABLET'].some((k) => typeUpper.includes(k));

      let typeSpecSummary = '';
      if (typeUpper.includes('UPS')) {
        typeSpecSummary = `Capacity: ${upsCapacity}`;
      } else if (typeUpper.includes('PRINTER')) {
        typeSpecSummary = `Print Mode: ${printerOutputType} | Tech: ${printerTech}`;
      } else if (typeUpper.includes('ACCESS POINT') || typeUpper.includes('AP')) {
        typeSpecSummary = `Environment: ${environmentSpec} | Dual-Band Wi-Fi`;
      } else if (typeUpper.includes('CABLE') || typeUpper.includes('PATCH')) {
        typeSpecSummary = `Environment: ${environmentSpec} | Category: ${cableCategory}`;
      } else if (typeUpper.includes('SERVER')) {
        typeSpecSummary = `Form Factor: ${serverFormFactor}`;
      } else if (typeUpper.includes('SWITCH') || typeUpper.includes('ROUTER') || typeUpper.includes('FIREWALL')) {
        typeSpecSummary = `Ports & PoE: ${switchPorts} | Environment: ${environmentSpec}`;
      } else if (isCompute) {
        typeSpecSummary = `Hardware: ${computerSpecs}`;
      } else if (typeUpper.includes('SCANNER')) {
        typeSpecSummary = `Scanner Type: ${scannerType}`;
      } else if (typeUpper.includes('MOUSE')) {
        typeSpecSummary = `Connectivity: ${mouseConnectivity}`;
      } else if (typeUpper.includes('KEYBOARD')) {
        typeSpecSummary = `Connectivity: ${keyboardConnectivity}`;
      } else if (typeUpper.includes('WI-FI') || typeUpper.includes('WIFI')) {
        typeSpecSummary = `Interface: ${wifiAdapterType}`;
      } else if (typeUpper.includes('BLUETOOTH')) {
        typeSpecSummary = `Interface: ${bluetoothAdapterType}`;
      }

      const fullSpecs = `${assetName.trim() ? `${assetName.trim()} • ` : ''}${manufacturer.trim()} ${model.trim()}${
        typeSpecSummary ? ` [${typeSpecSummary}]` : ''
      }`;

      await assetService.createAsset(
        {
          name: assetName.trim() || undefined,
          assetType: newAssetType,
          manufacturer: manufacturer.trim(),
          model: model.trim(),
          serialNumber: serialNumber.trim() || undefined,
          department,
          location,
          assignedUser: assignedUser.trim() || undefined,
          purchaseDate: new Date().toISOString().split('T')[0],
          purchasePrice: Number(purchasePrice) || 0,
          supplier: supplier.trim() || 'Hospital Authorized Vendor',
          warrantyStart: new Date().toISOString().split('T')[0],
          warrantyEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 3).toISOString().split('T')[0],
          condition,
          status: (assetStatus as AssetStatus) || (assignedUser.trim() ? 'Assigned' : 'Active'),
          operatingSystem: isCompute ? os : undefined,
          ipAddress: !isUps ? (ipAddress.trim() || undefined) : undefined,
          upsCapacity: typeUpper.includes('UPS') ? upsCapacity : undefined,
          printerOutputType: typeUpper.includes('PRINTER') ? printerOutputType : undefined,
          accessPointEnvironment: (typeUpper.includes('ACCESS POINT') || typeUpper.includes('AP')) ? environmentSpec : undefined,
          cableEnvironment: (typeUpper.includes('CABLE') || typeUpper.includes('PATCH')) ? environmentSpec : undefined,
          mouseConnectivity: typeUpper.includes('MOUSE') ? mouseConnectivity : undefined,
          keyboardConnectivity: typeUpper.includes('KEYBOARD') ? keyboardConnectivity : undefined,
          wifiAdapterType: (typeUpper.includes('WI-FI') || typeUpper.includes('WIFI')) ? wifiAdapterType : undefined,
          bluetoothAdapterType: typeUpper.includes('BLUETOOTH') ? bluetoothAdapterType : undefined,
          specifications: fullSpecs,
        },
        currentUser
      );

      setCreateModalOpen(false);
      setAssetName('');
      setManufacturer('');
      setModel('');
      setSerialNumber('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !currentUser) return;

    try {
      const updated = await assetService.updateAsset(
        selectedAsset.id,
        {
          department: newDepartment || selectedAsset.department,
          location: newLocation || selectedAsset.location,
          assignedUser: newAssignedUser || selectedAsset.assignedUser,
        },
        currentUser,
        transferReason
      );
      setSelectedAsset(updated);
      setTransferModalOpen(false);
      const history = await assetService.getAssetHistory(updated.id);
      setAssetHistory(history);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanTag = async (overrideValue?: string) => {
    const raw = (overrideValue !== undefined ? overrideValue : scannedTagInput).trim();
    if (!raw) return;

    // Check if input is a rich formatted QR string (e.g. from mobile camera or barcode scanner)
    const tagMatch = raw.match(/TAG[:\s]+([A-Za-z0-9-_]+)/i);
    const snMatch = raw.match(/S\/N[:\s]+([A-Za-z0-9-_]+)/i);
    let searchTerm = raw;

    if (tagMatch && tagMatch[1]) {
      searchTerm = tagMatch[1];
    } else if (raw.startsWith('HITOMS-ASSET:')) {
      searchTerm = raw.replace('HITOMS-ASSET:', '');
    } else if (snMatch && snMatch[1]) {
      searchTerm = snMatch[1];
    }

    let found = await assetService.getAssetByTag(searchTerm);
    if (!found) {
      // Check if matches serial number or id directly
      found = assets.find(
        (a) =>
          a.serialNumber.toLowerCase() === searchTerm.toLowerCase() ||
          a.assetTag.toLowerCase() === searchTerm.toLowerCase() ||
          a.id === searchTerm
      ) || null;
    }

    if (found) {
      setScannedAssetFound(found);
      handleSelectAsset(found);
    } else {
      alert(`Asset matching "${searchTerm}" not found in local database.`);
    }
  };

  const departments = Array.from(new Set(assets.map((a) => a.department)));

  const renderTypeSpecificFields = (currentType: string, isEditMode: boolean = false) => {
    const typeUpper = currentType.toUpperCase();

    return (
      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-sky-200/80 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400 font-bold text-xs">
          <SlidersHorizontal className="w-4 h-4 text-sky-600" />
          <span>Type-Specific Specifications ({currentType})</span>
        </div>

        {/* 1. UPS CAPACITY */}
        {typeUpper.includes('UPS') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">UPS Capacity / VA Rating *</label>
              <select
                value={isEditMode ? editUpsCapacity : upsCapacity}
                onChange={(e) => (isEditMode ? setEditUpsCapacity(e.target.value) : setUpsCapacity(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
              >
                <option value="500VA">500 VA</option>
                <option value="650VA">650 VA</option>
                <option value="1000VA (1 kVA)">1000 VA (1 kVA)</option>
                <option value="1.5 kVA">1.5 kVA</option>
                <option value="2.0 kVA">2.0 kVA</option>
                <option value="3.0 kVA">3.0 kVA</option>
                <option value="5.0 kVA">5.0 kVA</option>
                <option value="6.0 kVA">6.0 kVA</option>
                <option value="10.0 kVA Online">10.0 kVA Online Double-Conversion</option>
                <option value="15.0 kVA+ Industrial">15.0 kVA+ Industrial / Theater UPS</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Backup Topology / Type</label>
              <select
                defaultValue="Line-Interactive"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="Line-Interactive">Line-Interactive</option>
                <option value="Online Double-Conversion">Online Double-Conversion</option>
                <option value="Offline / Standby">Offline / Standby</option>
              </select>
            </div>
          </div>
        )}

        {/* 2. PRINTER */}
        {typeUpper.includes('PRINTER') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Color / Output Mode *</label>
              <select
                value={isEditMode ? editPrinterOutputType : printerOutputType}
                onChange={(e) => (isEditMode ? setEditPrinterOutputType(e.target.value) : setPrinterOutputType(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
              >
                <option value="Monochrome (Black & White)">Monochrome (Black & White)</option>
                <option value="Color">Color</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Printer Technology</label>
              <select
                value={isEditMode ? editPrinterTech : printerTech}
                onChange={(e) => (isEditMode ? setEditPrinterTech(e.target.value) : setPrinterTech(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="LaserJet">LaserJet</option>
                <option value="InkJet">InkJet</option>
                <option value="Thermal Barcode / Receipt">Thermal / Barcode Receipt</option>
                <option value="Multi-Function Copier / All-in-One">Multi-Function Copier / All-in-One</option>
                <option value="Dot Matrix">Dot Matrix</option>
              </select>
            </div>
          </div>
        )}

        {/* 3. ACCESS POINT */}
        {(typeUpper.includes('ACCESS POINT') || typeUpper.includes('AP') || typeUpper.includes('WIRELESS')) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Deployment Environment *</label>
              <select
                value={isEditMode ? editEnvironmentSpec : environmentSpec}
                onChange={(e) => (isEditMode ? setEditEnvironmentSpec(e.target.value) : setEnvironmentSpec(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
              >
                <option value="Indoor">Indoor</option>
                <option value="Outdoor">Outdoor</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Wi-Fi Standard / Frequency</label>
              <select
                defaultValue="Dual-Band (2.4GHz & 5GHz)"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="Dual-Band (2.4GHz & 5GHz)">Dual-Band (2.4GHz & 5GHz)</option>
                <option value="Wi-Fi 6 (802.11ax)">Wi-Fi 6 (802.11ax)</option>
                <option value="Wi-Fi 6E (6GHz)">Wi-Fi 6E (6GHz Tri-Band)</option>
                <option value="Outdoor Long-Range Mesh">Outdoor Long-Range Mesh</option>
              </select>
            </div>
          </div>
        )}

        {/* 4. NETWORK CABLE */}
        {(typeUpper.includes('CABLE') || typeUpper.includes('PATCH') || typeUpper.includes('NETWORK CABLE')) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Cable Environment *</label>
              <select
                value={isEditMode ? editEnvironmentSpec : environmentSpec}
                onChange={(e) => (isEditMode ? setEditEnvironmentSpec(e.target.value) : setEnvironmentSpec(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
              >
                <option value="Indoor">Indoor</option>
                <option value="Outdoor">Outdoor / Outdoor Armored</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Cable Category / Specification</label>
              <select
                value={isEditMode ? editCableCategory : cableCategory}
                onChange={(e) => (isEditMode ? setEditCableCategory(e.target.value) : setCableCategory(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="Cat 6">Cat 6 (UTP / STP)</option>
                <option value="Cat 6A">Cat 6A (10G Shielded)</option>
                <option value="Cat 7">Cat 7 (S/FTP)</option>
                <option value="Fiber Optic Single-Mode">Fiber Optic Single-Mode (OS2)</option>
                <option value="Fiber Optic Multi-Mode">Fiber Optic Multi-Mode (OM3/OM4)</option>
                <option value="Cat 5e">Cat 5e</option>
              </select>
            </div>
          </div>
        )}

        {/* 5. SERVER */}
        {typeUpper.includes('SERVER') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Server Form Factor *</label>
              <select
                value={isEditMode ? editServerFormFactor : serverFormFactor}
                onChange={(e) => (isEditMode ? setEditServerFormFactor(e.target.value) : setServerFormFactor(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="Rackmount 1U">Rackmount 1U</option>
                <option value="Rackmount 2U">Rackmount 2U</option>
                <option value="Rackmount 4U">Rackmount 4U</option>
                <option value="Tower Server">Tower Server</option>
                <option value="Blade Chassis">Blade Chassis</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Storage / RAID Array</label>
              <select
                defaultValue="RAID 5 (Parity)"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="RAID 1 (Mirrored)">RAID 1 (Mirrored)</option>
                <option value="RAID 5 (Parity)">RAID 5 (Parity)</option>
                <option value="RAID 10 (Striped + Mirrored)">RAID 10</option>
                <option value="No RAID">No RAID</option>
              </select>
            </div>
          </div>
        )}

        {/* 6. SWITCH / ROUTER / FIREWALL */}
        {(typeUpper.includes('SWITCH') || typeUpper.includes('ROUTER') || typeUpper.includes('FIREWALL')) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Port Count & Power *</label>
              <select
                value={isEditMode ? editSwitchPorts : switchPorts}
                onChange={(e) => (isEditMode ? setEditSwitchPorts(e.target.value) : setSwitchPorts(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="8-Port Non-PoE">8-Port Non-PoE</option>
                <option value="16-Port Managed PoE+">16-Port Managed PoE+</option>
                <option value="24-Port Managed PoE+">24-Port Managed PoE+</option>
                <option value="48-Port Managed PoE+">48-Port Managed PoE+</option>
                <option value="Enterprise Core Modular">Enterprise Core Modular</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Deployment Environment</label>
              <select
                value={isEditMode ? editEnvironmentSpec : environmentSpec}
                onChange={(e) => (isEditMode ? setEditEnvironmentSpec(e.target.value) : setEnvironmentSpec(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="Indoor">Indoor Server Room / Rack</option>
                <option value="Outdoor">Outdoor / Weatherproof Cabinet</option>
              </select>
            </div>
          </div>
        )}

        {/* 7. DESKTOP / LAPTOP / WORKSTATION / TABLET */}
        {['DESKTOP', 'LAPTOP', 'WORKSTATION', 'TABLET'].some((k) => typeUpper.includes(k)) && (
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Hardware Processor & Memory Configuration</label>
            <select
              value={isEditMode ? editComputerSpecs : computerSpecs}
              onChange={(e) => (isEditMode ? setEditComputerSpecs(e.target.value) : setComputerSpecs(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="Intel Core i5 / 16GB RAM / 512GB SSD">Intel Core i5 / 16GB RAM / 512GB SSD</option>
              <option value="Intel Core i7 / 32GB RAM / 1TB SSD">Intel Core i7 / 32GB RAM / 1TB SSD</option>
              <option value="AMD Ryzen 5 / 16GB RAM / 512GB SSD">AMD Ryzen 5 / 16GB RAM / 512GB SSD</option>
              <option value="Apple M2/M3 Pro / 16GB RAM / 512GB SSD">Apple M2/M3 Pro / 16GB RAM / 512GB SSD</option>
              <option value="Intel Core i3 / 8GB RAM / 256GB SSD">Intel Core i3 / 8GB RAM / 256GB SSD</option>
            </select>
          </div>
        )}

        {/* 8. SCANNER / BARCODE */}
        {typeUpper.includes('SCANNER') && (
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Scanner Mechanism / Type</label>
            <select
              value={isEditMode ? editScannerType : scannerType}
              onChange={(e) => (isEditMode ? setEditScannerType(e.target.value) : setScannerType(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="Handheld USB Barcode Scanner">Handheld USB Barcode Scanner</option>
              <option value="Wireless Bluetooth Barcode Scanner">Wireless Bluetooth Barcode Scanner</option>
              <option value="Flatbed Document Scanner">Flatbed Document Scanner</option>
              <option value="High-Speed Sheetfed Scanner">High-Speed Sheetfed Scanner</option>
            </select>
          </div>
        )}

        {/* 9. MOUSE */}
        {typeUpper.includes('MOUSE') && (
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Mouse Connectivity *</label>
            <select
              value={isEditMode ? editMouseConnectivity : mouseConnectivity}
              onChange={(e) => (isEditMode ? setEditMouseConnectivity(e.target.value) : setMouseConnectivity(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
            >
              <option value="Wired">Wired</option>
              <option value="Wireless">Wireless</option>
            </select>
          </div>
        )}

        {/* 10. KEYBOARD */}
        {typeUpper.includes('KEYBOARD') && (
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Keyboard Connectivity *</label>
            <select
              value={isEditMode ? editKeyboardConnectivity : keyboardConnectivity}
              onChange={(e) => (isEditMode ? setEditKeyboardConnectivity(e.target.value) : setKeyboardConnectivity(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
            >
              <option value="Wired">Wired</option>
              <option value="Wireless">Wireless</option>
            </select>
          </div>
        )}

        {/* 11. WI-FI ADAPTER */}
        {(typeUpper.includes('WI-FI') || typeUpper.includes('WIFI')) && (
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Wi-Fi Adapter Interface / Form Factor *</label>
            <select
              value={isEditMode ? editWifiAdapterType : wifiAdapterType}
              onChange={(e) => (isEditMode ? setEditWifiAdapterType(e.target.value) : setWifiAdapterType(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
            >
              <option value="Dongle (USB)">Dongle (USB)</option>
              <option value="PCI / PCIe Card">PCI / PCIe Card</option>
            </select>
          </div>
        )}

        {/* 12. BLUETOOTH ADAPTER */}
        {typeUpper.includes('BLUETOOTH') && (
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Bluetooth Adapter Interface / Form Factor *</label>
            <select
              value={isEditMode ? editBluetoothAdapterType : bluetoothAdapterType}
              onChange={(e) => (isEditMode ? setEditBluetoothAdapterType(e.target.value) : setBluetoothAdapterType(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer font-medium"
            >
              <option value="Dongle (USB)">Dongle (USB)</option>
              <option value="PCI / PCIe Card">PCI / PCIe Card</option>
            </select>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Asset Module Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('HARDWARE')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition cursor-pointer ${
            activeTab === 'HARDWARE'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Hardware Registry ({assets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SUBSCRIPTIONS')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition cursor-pointer ${
            activeTab === 'SUBSCRIPTIONS'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Software Licenses & Subscriptions</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-bold">
        
          </span>
        </button>
      </div>

      {activeTab === 'SUBSCRIPTIONS' ? (
        <SoftwareSubscriptionsTab
          currentUser={currentUser}
          onRefreshParent={onRefresh}
        />
      ) : (
        <>
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <span>IT Hardware Asset Registry</span>
              </h1>
              <p className="text-xs text-slate-500">
                Offline clinical hardware inventory with immutable transfer history, custodian tracking, and QR code tagging.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="scan-qr-btn"
                onClick={() => {
                  setScannedAssetFound(null);
                  setScannedTagInput('');
                  setQrModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                title="Scan or lookup QR code data / hardware serial number"
              >
                <QrCode className="w-4 h-4 text-sky-400" />
                <span>Scan / Lookup QR</span>
              </button>

              <button
                id="batch-print-qr-btn"
                onClick={() => setBatchQRModalOpen(true)}
                title="Print batch QR code labels for physical equipment tracking"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 font-semibold text-xs border border-indigo-700/80 transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                <span>
                  {selectedAssetIds.size > 0
                    ? `Print ${selectedAssetIds.size} Selected QR Labels`
                    : `Print QR Labels (${filteredAssets.length})`}
                </span>
              </button>

              {canManageAssets && selectedAssetIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setBatchDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  title="Delete all currently selected assets from repository"
                >
                  <Trash2 className="w-4 h-4 text-rose-200" />
                  <span>Delete Selected ({selectedAssetIds.size})</span>
                </button>
              )}

              {canManageAssets && (
                <button
                  id="bulk-upload-assets-btn"
                  onClick={() => setBulkUploadModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  title="Bulk upload multiple IT assets via CSV / Excel template"
                >
                  <Upload className="w-4 h-4 text-emerald-200" />
                  <span>Bulk Upload (CSV)</span>
                </button>
              )}

              {isSuperAdminOrIT && (
                <button
                  id="asset-register-report-btn"
                  onClick={() => setAssetRegisterModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  title="Generate official hospital asset register in PDF and Excel formats"
                >
                  <FileText className="w-4 h-4 text-purple-200" />
                  <span>Asset Register (PDF/Excel)</span>
                </button>
              )}

              {canManageAssets ? (
                <button
                  id="register-asset-btn"
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Asset</span>
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700">
                  Audit / Management View Only
                </span>
              )}
            </div>
          </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="asset-search-input"
              type="text"
              placeholder="Search tag, serial, model, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
            />
          </div>

          <select
            id="asset-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Asset Types</option>
            <option value="Desktop">Desktop Workstations</option>
            <option value="Laptop">Clinical Laptops</option>
            <option value="Server">Servers & Hosts</option>
            <option value="Switch">Network Switches</option>
            <option value="Router">Routers</option>
            <option value="Access Point">Wi-Fi Access Points</option>
            <option value="Printer">Printers & Scanners</option>
            <option value="UPS">UPS / Power Backup</option>
          </select>

          <select
            id="asset-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Assigned">Assigned</option>
            <option value="Available">Available / In Storage</option>
            <option value="Under Repair">Under Repair</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>

          <select
            id="asset-dept-filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {allDepartmentNames.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Multi-Select Floating Notification / Action Strip */}
        {selectedAssetIds.size > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-900 dark:text-indigo-200">
                {selectedAssetIds.size} of {filteredAssets.length} assets selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBatchQRModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print {selectedAssetIds.size} Labels</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAssetIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium px-2 py-1"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asset Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllFiltered}
                    className="text-slate-500 hover:text-sky-600 transition"
                    title={selectedAssetIds.size === filteredAssets.length ? 'Deselect All' : 'Select All Filtered'}
                  >
                    {filteredAssets.length > 0 && selectedAssetIds.size === filteredAssets.length ? (
                      <CheckSquare className="w-4 h-4 text-sky-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Asset Tag</th>
                <th className="px-4 py-3">Equipment / Specs</th>
                <th className="px-4 py-3">Serial Number</th>
                <th className="px-4 py-3">Department & Room</th>
                <th className="px-4 py-3">Assigned User</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    No assets found in local registry.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const isSelected = selectedAssetIds.has(asset.id);
                  return (
                    <tr
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-3 py-3 text-center" onClick={(e) => toggleSelectAsset(asset.id, e)}>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-sky-600 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-sky-600">
                        {asset.assetTag}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {asset.manufacturer} {asset.model}
                        </div>
                        <div className="text-[10px] text-slate-400">{asset.assetType} - {asset.operatingSystem || 'Hardware'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {asset.serialNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div className="font-medium">{asset.department}</div>
                        <div className="text-[10px] text-slate-400">{asset.location}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {asset.assignedUser || <span className="text-slate-400 italic">Department shared</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            asset.condition === 'Excellent' || asset.condition === 'Good'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {asset.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            asset.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManageAssets && (
                            <>
                              <button
                                type="button"
                                title="Edit Asset Specifications & Custodian"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditModal(asset);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-semibold transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                title="Delete Asset from Registry"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssetToDelete(asset);
                                  setDeleteReason('');
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            title="Download scannable QR Code as JPEG image with Name, Serial Number, and Department details rendered below"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await downloadAssetQrJpeg(asset);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>QR JPEG</span>
                          </button>

                          <button
                            type="button"
                            title="Generate & Print Physical QR Code Tag Label"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrLabelAsset(asset);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 font-semibold transition cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>Print Label</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAsset(asset);
                            }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Details & Immutable History Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sky-600 text-sm">{selectedAsset.assetTag}</span>
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  {selectedAsset.manufacturer} {selectedAsset.model}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {selectedAsset.status}
                </span>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Asset QR Tag & Quick Barcode Preview */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-slate-900 text-white gap-4">
                <div className="flex items-center gap-4">
                  {/* Generated Scannable High-Res QR code box */}
                  <div className="w-20 h-20 bg-white p-1 rounded-xl flex items-center justify-center text-slate-950 shadow-inner overflow-hidden">
                    {detailQrCodeDataUrl ? (
                      <img
                        src={detailQrCodeDataUrl}
                        alt={`QR Code for ${selectedAsset.assetTag}`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <QrCode className="w-14 h-14 text-slate-900 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="font-mono text-base font-black text-sky-400">{selectedAsset.assetTag}</div>
                    <div className="text-xs text-slate-300">Hospital Equipment ID: {selectedAsset.qrCodeData}</div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">MAC: {selectedAsset.macAddress || 'N/A'} | IP: {selectedAsset.ipAddress || 'DHCP'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedAsset) await downloadAssetQrJpeg(selectedAsset);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-sm transition"
                    title="Download QR code as JPEG image with Name, Serial Number, and Assigned Department rendered below the QR code image"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR (JPEG)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQrLabelAsset(selectedAsset)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-sm transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print QR Label</span>
                  </button>

                  {canManageAssets && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAsset) handleOpenEditModal(selectedAsset);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Asset</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewDepartment(selectedAsset.department);
                          setNewLocation(selectedAsset.location);
                          setNewAssignedUser(selectedAsset.assignedUser || '');
                          setTransferModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer transition"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Transfer / Reassign</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAsset) {
                            setAssetToDelete(selectedAsset);
                            setDeleteReason('');
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Asset</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Specifications & Location Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <span className="text-slate-400">Department</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.department}</div>
                </div>
                <div>
                  <span className="text-slate-400">Room / Bed Area</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.location}</div>
                </div>
                <div>
                  <span className="text-slate-400">Assigned User</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.assignedUser || 'Shared'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Condition</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.condition}</div>
                </div>
                <div>
                  <span className="text-slate-400">Serial Number</span>
                  <div className="font-mono text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.serialNumber}</div>
                </div>
                <div>
                  <span className="text-slate-400">Operating System</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.operatingSystem || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Purchase Date</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.purchaseDate || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Supplier</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAsset.supplier || 'Hospital Procurement'}</div>
                </div>
              </div>

              {/* Immutable History Timeline (Section 13) */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-sky-600" />
                  <span>Immutable Asset Lifecycle History ({assetHistory.length})</span>
                </h4>

                <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800 pl-4 ml-2">
                  {loadingHistory ? (
                    <p className="text-slate-400">Loading audit history...</p>
                  ) : assetHistory.length === 0 ? (
                    <p className="text-slate-400 italic">No history records found.</p>
                  ) : (
                    assetHistory.map((h) => (
                      <div key={h.id} className="relative pb-3">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-sky-600 border-2 border-white dark:border-slate-900" />
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {h.action}
                          </span>
                          <span className="text-slate-400">{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{h.details}</p>
                        <div className="text-[10px] text-sky-600 mt-0.5">Performed by: {h.performedBy}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Asset Modal */}
      {transferModalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-600" />
                <span>Transfer Asset {selectedAsset.assetTag}</span>
              </h3>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferAsset} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Target Department *</label>
                <select
                  required
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="">-- Select Target Department --</option>
                  {allDepartmentNames.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Target Room / Location *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward Bed 4, Triage Desk 2, Server Rack B"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Assigned Custodian (Staff User)</label>
                <select
                  value={newAssignedUser}
                  onChange={(e) => setNewAssignedUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="">-- Department Shared / Unassigned --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.fullName}>
                      {u.fullName} ({u.department || 'Clinical'} • {u.role.replace(/_/g, ' ')})
                    </option>
                  ))}
                  {newAssignedUser &&
                    !allUsers.some((u) => u.fullName === newAssignedUser) && (
                      <option value={newAssignedUser}>{newAssignedUser} (Custom)</option>
                    )}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Transfer Reason / Authorization Note</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Relocated to maternity ward to support new triage desk"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Tag Scanner / Lookup Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-sky-600" />
                <span>Scan / Lookup QR Tag</span>
              </h3>
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-500">
              Paste or scan barcode/QR code data (or enter an Asset Tag / Serial Number like <strong>HIT-AST-000101</strong>) to retrieve instant offline hardware specifications.
            </p>

            <div className="space-y-2">
              <textarea
                rows={3}
                placeholder="Scan or paste QR code content or Asset Tag..."
                value={scannedTagInput}
                onChange={(e) => setScannedTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleScanTag();
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
              />

              <div className="flex flex-wrap gap-1 justify-center pt-1">
                <span className="text-[10px] text-slate-400">Quick Samples:</span>
                {assets.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setScannedTagInput(a.assetTag);
                      handleScanTag(a.assetTag);
                    }}
                    className="text-[10px] font-mono bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800 px-1.5 py-0.5 rounded cursor-pointer hover:bg-sky-100"
                  >
                    {a.assetTag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleScanTag()}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer shadow-sm transition"
            >
              Search Asset Record
            </button>

            {scannedAssetFound && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Hardware Record Verified</span>
                  </div>
                  <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                    {scannedAssetFound.assetTag}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Model:</span>
                    <span className="font-semibold">{scannedAssetFound.manufacturer} {scannedAssetFound.model}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Serial (S/N):</span>
                    <span className="font-mono">{scannedAssetFound.serialNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Location:</span>
                    <span>{scannedAssetFound.department} ({scannedAssetFound.location})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Custodian:</span>
                    <span>{scannedAssetFound.assignedUser || 'Shared Ward Device'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  {onReportIssueForAsset && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = scannedAssetFound;
                        setQrModalOpen(false);
                        onReportIssueForAsset(target);
                      }}
                      className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition"
                    >
                      <AlertTriangle className="w-4 h-4 text-white" />
                      <span>Report Issue on {scannedAssetFound.assetTag}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setQrLabelAsset(scannedAssetFound);
                      setQrModalOpen(false);
                    }}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print QR Label</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectAsset(scannedAssetFound);
                      setQrModalOpen(false);
                    }}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register Asset Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <span>Register New IT Asset</span>
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Asset Name / Clinical Equipment Title</label>
                <input
                  type="text"
                  placeholder="e.g. Pharmacy Dispensing Terminal 1, Maternity Ward Starlink Router, Theatre Central UPS"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Asset Type *</label>
                  <select
                    value={newAssetType}
                    onChange={(e) => setNewAssetType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {assetTypesList.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Condition *</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as AssetCondition)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {assetConditionsList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Status *</label>
                  <select
                    value={assetStatus}
                    onChange={(e) => setAssetStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {assetStatusesList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Type-Specific Specifications */}
              {renderTypeSpecificFields(newAssetType, false)}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dell, HP, Cisco, Lenovo, APC"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Model Name / Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OptiPlex 7090, Smart-UPS 1500"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Serial Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CN-0K9821-7281 (Optional)"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                {/* Operating System for compute devices */}
                {['Desktop', 'Laptop', 'Server', 'Workstation', 'Tablet'].includes(newAssetType) ? (
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Operating System</label>
                    <input
                      type="text"
                      placeholder="e.g. Windows 11 Pro, Ubuntu 24.04"
                      value={os}
                      onChange={(e) => setOs(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Assigned Custodian / Staff</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Mensah, Sister Rose"
                      value={assignedUser}
                      onChange={(e) => setAssignedUser(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Department *</label>
                  <select
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {allDepartmentNames.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Room / Exact Location *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Assigned Custodian (Staff)</label>
                  <select
                    value={assignedUser}
                    onChange={(e) => setAssignedUser(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Department Shared / Available --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.fullName}>
                        {u.fullName} ({u.department || 'Clinical'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Purchase Price (GH₵)</label>
                  <input
                    type="number"
                    min={0}
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Hospital Procurement Agency"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setTypesConditionsModalOpen(true)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer text-xs"
                      title="Manage Asset Types, Conditions, and Statuses"
                    >
                      ⚙️ Config
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                  >
                    Save to Local Register
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ASSET MODAL */}
      {editModalOpen && editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sky-600" />
                <span>Edit IT Asset: {editingAsset.assetTag}</span>
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAsset} className="space-y-4">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Asset Name / Clinical Equipment Title</label>
                <input
                  type="text"
                  placeholder="e.g. Pharmacy Dispensing Terminal 1, Maternity Ward Starlink Router, Theatre Central UPS"
                  value={editAssetName}
                  onChange={(e) => setEditAssetName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Asset Tag *</label>
                  <input
                    type="text"
                    required
                    value={editAssetTag}
                    onChange={(e) => setEditAssetTag(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Asset Type *</label>
                  <select
                    value={editAssetType}
                    onChange={(e) => setEditAssetType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {assetTypesList.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Serial Number (S/N) (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CN-0K9821-7281 (Optional)"
                    value={editSerialNumber}
                    onChange={(e) => setEditSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Type-Specific Specifications */}
              {renderTypeSpecificFields(editAssetType, true)}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    value={editManufacturer}
                    onChange={(e) => setEditManufacturer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Department *</label>
                  <select
                    required
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {allDepartmentNames.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Room / Location *</label>
                  <input
                    type="text"
                    required
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Assigned Custodian</label>
                  <select
                    value={editAssignedUser}
                    onChange={(e) => setEditAssignedUser(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Shared / Unassigned --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.fullName}>
                        {u.fullName} ({u.department || 'Clinical'})
                      </option>
                    ))}
                    {editAssignedUser &&
                      !allUsers.some((u) => u.fullName === editAssignedUser) && (
                        <option value={editAssignedUser}>{editAssignedUser} (Custom)</option>
                      )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Hardware Condition</label>
                  <select
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value as AssetCondition)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {assetConditionsList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Operational Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AssetStatus)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    {assetStatusesList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic OS and MAC fields: Hidden for UPS */}
              {!editAssetType.toUpperCase().includes('UPS') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['Desktop', 'Laptop', 'Server', 'Workstation', 'Tablet'].includes(editAssetType) && (
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Operating System</label>
                      <input
                        type="text"
                        value={editOperatingSystem}
                        onChange={(e) => setEditOperatingSystem(e.target.value)}
                        placeholder="Windows 11 Pro"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">MAC Address</label>
                    <input
                      type="text"
                      value={editMacAddress}
                      onChange={(e) => setEditMacAddress(e.target.value)}
                      placeholder="00:1A:2B:3C:4D:5E"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={editPurchaseDate}
                    onChange={(e) => setEditPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Purchase Price (GH₵)</label>
                  <input
                    type="number"
                    min={0}
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    placeholder="Hospital Procurement"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Clinical Notes & Hardware Specifics</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Hardware modifications, dual-monitor setup, or dedicated clinical role..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Modification Reason (for Audit Log)</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Upgraded RAM, updated custodian, corrected serial number"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setTypesConditionsModalOpen(true)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer text-xs"
                      title="Manage Asset Types, Conditions, and Statuses"
                    >
                      ⚙️ Config
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer shadow-sm transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ASSET CONFIRMATION MODAL */}
      {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Delete Hardware Asset
                </h3>
                <p className="text-[11px] text-slate-500">Permanent removal from IT registry</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="font-mono font-bold text-sky-600 text-sm">{assetToDelete.assetTag}</div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {assetToDelete.manufacturer} {assetToDelete.model}
              </div>
              <div className="text-[11px] text-slate-500">
                S/N: <span className="font-mono">{assetToDelete.serialNumber}</span> • Dept: {assetToDelete.department} ({assetToDelete.location})
              </div>
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">
                Reason for Deletion (Recorded in Audit Trail)
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Scrapped, damaged beyond repair, returned to vendor"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAssetToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAsset}
                disabled={isDeletingAsset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAsset ? 'Deleting...' : 'Confirm Deletion'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH DELETE ASSETS CONFIRMATION MODAL */}
      {batchDeleteModalOpen && selectedAssetIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Batch Delete {selectedAssetIds.size} Assets
                </h3>
                <p className="text-[11px] text-slate-500">Removal of multiple selected hardware records</p>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-slate-900 dark:text-white">{selectedAssetIds.size}</strong> selected assets from the hospital registry? This action will create audit logs for each record.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBatchDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={isBatchDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBatchDeleting ? 'Deleting Selected...' : `Delete ${selectedAssetIds.size} Assets`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Physical Label Modal (Single Asset) */}
      {qrLabelAsset && (
        <AssetQRLabelModal
          isOpen={true}
          onClose={() => setQrLabelAsset(null)}
          asset={qrLabelAsset}
          hospitalName={systemSettings?.hospitalName || 'GENERAL HOSPITAL IT UNIT'}
        />
      )}

      {/* QR Code Physical Labels Batch Modal (Multi-Asset) */}
      {batchQRModalOpen && (
        <AssetQRLabelModal
          isOpen={true}
          onClose={() => setBatchQRModalOpen(false)}
          asset={null}
          selectedAssets={
            selectedAssetIds.size > 0
              ? assets.filter((a) => selectedAssetIds.has(a.id))
              : filteredAssets
          }
          hospitalName={systemSettings?.hospitalName || 'GENERAL HOSPITAL IT UNIT'}
        />
      )}

      {/* Bulk Upload IT Assets Modal (CSV / Excel template) */}
      <AssetBulkUploadModal
        isOpen={bulkUploadModalOpen}
        onClose={() => setBulkUploadModalOpen(false)}
        currentUser={currentUser}
        existingAssets={assets}
        onSuccess={(created) => {
          onRefresh();
        }}
        onOpenQRBatchPrint={(created) => {
          setSelectedAssetIds(new Set(created.map((a) => a.id)));
          setBatchQRModalOpen(true);
        }}
      />

      {/* MANAGE ASSET TYPES AND CONDITIONS MODAL */}
      {typesConditionsModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Manage Asset Types & Equipment Conditions
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Super Admin & IT Unit configuration for hospital hardware registry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTypesConditionsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => setConfigModalTab('TYPES')}
                className={`px-4 py-2 font-bold text-xs border-b-2 transition cursor-pointer ${
                  configModalTab === 'TYPES'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Asset Types ({assetTypesList.length})
              </button>
              <button
                type="button"
                onClick={() => setConfigModalTab('CONDITIONS')}
                className={`px-4 py-2 font-bold text-xs border-b-2 transition cursor-pointer ${
                  configModalTab === 'CONDITIONS'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Asset Conditions ({assetConditionsList.length})
              </button>
              <button
                type="button"
                onClick={() => setConfigModalTab('STATUSES')}
                className={`px-4 py-2 font-bold text-xs border-b-2 transition cursor-pointer ${
                  configModalTab === 'STATUSES'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Asset Statuses ({assetStatusesList.length})
              </button>
            </div>

            {/* TAB 1: ASSET TYPES */}
            {configModalTab === 'TYPES' && (
              <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Asset Hardware Types ({assetTypesList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = [
                        'Desktop',
                        'Laptop',
                        'Server',
                        'Workstation',
                        'Tablet',
                        'UPS',
                        'Switch',
                        'Router',
                        'Printer',
                        'Scanner',
                        'Barcode Scanner',
                        'Projector',
                        'Monitor',
                        'Biometric Terminal',
                        'IP Phone',
                        'Other Equipment',
                      ];
                      handleSaveAssetTypes(defaults);
                    }}
                    className="text-[10px] text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                  >
                    Reset Default Types
                  </button>
                </div>

                {/* Add New Type input */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. ECG Machine, Starlink Terminal, Infusion Pump..."
                    value={newTypeInput}
                    onChange={(e) => setNewTypeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newTypeInput.trim();
                        if (trimmed && !assetTypesList.includes(trimmed)) {
                          handleSaveAssetTypes([...assetTypesList, trimmed]);
                          setNewTypeInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:outline-none text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newTypeInput.trim();
                      if (trimmed && !assetTypesList.includes(trimmed)) {
                        handleSaveAssetTypes([...assetTypesList, trimmed]);
                        setNewTypeInput('');
                      }
                    }}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Type</span>
                  </button>
                </div>

                {/* Types List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {assetTypesList.map((t) => (
                    <div
                      key={t}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      {editingTypeOriginal === t ? (
                        <div className="flex items-center gap-1 flex-1 mr-2">
                          <input
                            type="text"
                            value={editingTypeValue}
                            onChange={(e) => setEditingTypeValue(e.target.value)}
                            className="flex-1 px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-sky-500 rounded text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = editingTypeValue.trim();
                              if (trimmed && trimmed !== t) {
                                handleSaveAssetTypes(assetTypesList.map((item) => (item === t ? trimmed : item)));
                              }
                              setEditingTypeOriginal(null);
                            }}
                            className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTypeOriginal(null)}
                            className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{t}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTypeOriginal(t);
                                setEditingTypeValue(t);
                              }}
                              className="p-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                              title="Rename type"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {assetTypesList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleSaveAssetTypes(assetTypesList.filter((item) => item !== t));
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete type"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: ASSET CONDITIONS */}
            {configModalTab === 'CONDITIONS' && (
              <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Equipment Conditions ({assetConditionsList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = ['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Defective'];
                      handleSaveAssetConditions(defaults);
                    }}
                    className="text-[10px] text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                  >
                    Reset Default Conditions
                  </button>
                </div>

                {/* Add New Condition input */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. Scrapped, Faulty, Refurbished, Defective..."
                    value={newConditionInput}
                    onChange={(e) => setNewConditionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newConditionInput.trim();
                        if (trimmed && !assetConditionsList.includes(trimmed)) {
                          handleSaveAssetConditions([...assetConditionsList, trimmed]);
                          setNewConditionInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:outline-none text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newConditionInput.trim();
                      if (trimmed && !assetConditionsList.includes(trimmed)) {
                        handleSaveAssetConditions([...assetConditionsList, trimmed]);
                        setNewConditionInput('');
                      }
                    }}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Condition</span>
                  </button>
                </div>

                {/* Conditions List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {assetConditionsList.map((c) => (
                    <div
                      key={c}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      {editingCondOriginal === c ? (
                        <div className="flex items-center gap-1 flex-1 mr-2">
                          <input
                            type="text"
                            value={editingCondValue}
                            onChange={(e) => setEditingCondValue(e.target.value)}
                            className="flex-1 px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-sky-500 rounded text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = editingCondValue.trim();
                              if (trimmed && trimmed !== c) {
                                handleSaveAssetConditions(assetConditionsList.map((item) => (item === c ? trimmed : item)));
                              }
                              setEditingCondOriginal(null);
                            }}
                            className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCondOriginal(null)}
                            className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{c}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCondOriginal(c);
                                setEditingCondValue(c);
                              }}
                              className="p-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                              title="Rename condition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {assetConditionsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleSaveAssetConditions(assetConditionsList.filter((item) => item !== c));
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete condition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: ASSET STATUSES */}
            {configModalTab === 'STATUSES' && (
              <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Operational Statuses ({assetStatusesList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = [
                        'Active',
                        'In Use',
                        'In Storage',
                        'Assigned',
                        'Available',
                        'Under Repair',
                        'Maintenance',
                        'Decommissioned',
                        'Disposed',
                        'Reserved',
                      ];
                      handleSaveAssetStatuses(defaults);
                    }}
                    className="text-[10px] text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                  >
                    Reset Default Statuses
                  </button>
                </div>

                {/* Add New Status input */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. On Loan, Stolen, Calibration, Quarantine..."
                    value={newStatusInput}
                    onChange={(e) => setNewStatusInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newStatusInput.trim();
                        if (trimmed && !assetStatusesList.includes(trimmed)) {
                          handleSaveAssetStatuses([...assetStatusesList, trimmed]);
                          setNewStatusInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:outline-none text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newStatusInput.trim();
                      if (trimmed && !assetStatusesList.includes(trimmed)) {
                        handleSaveAssetStatuses([...assetStatusesList, trimmed]);
                        setNewStatusInput('');
                      }
                    }}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Status</span>
                  </button>
                </div>

                {/* Statuses List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {assetStatusesList.map((s) => (
                    <div
                      key={s}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      {editingStatusOriginal === s ? (
                        <div className="flex items-center gap-1 flex-1 mr-2">
                          <input
                            type="text"
                            value={editingStatusValue}
                            onChange={(e) => setEditingStatusValue(e.target.value)}
                            className="flex-1 px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-sky-500 rounded text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = editingStatusValue.trim();
                              if (trimmed && trimmed !== s) {
                                handleSaveAssetStatuses(assetStatusesList.map((item) => (item === s ? trimmed : item)));
                              }
                              setEditingStatusOriginal(null);
                            }}
                            className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStatusOriginal(null)}
                            className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{s}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStatusOriginal(s);
                                setEditingStatusValue(s);
                              }}
                              className="p-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                              title="Rename status"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {assetStatusesList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleSaveAssetStatuses(assetStatusesList.filter((item) => item !== s));
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete status"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTypesConditionsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Done & Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Register Report Generator Modal */}
      {assetRegisterModalOpen && (
        <AssetRegisterReportModal
          isOpen={assetRegisterModalOpen}
          onClose={() => setAssetRegisterModalOpen(false)}
          assets={assets}
          departments={departmentsList}
          allUsers={allUsers}
          currentUser={currentUser}
          systemSettings={systemSettings}
        />
      )}
        </>
      )}
    </div>
  );
};
