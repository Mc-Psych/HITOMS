import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, AlertTriangle, Sparkles, Flame, Radio } from 'lucide-react';
import { type QuickTriggerPreset, emergencyService, DEFAULT_QUICK_TRIGGERS } from '../services/emergencyService';
import { type User } from '../types';

interface EditQuickTriggerModalProps {
  preset: QuickTriggerPreset | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSaveSuccess: () => void;
}

export const EditQuickTriggerModal: React.FC<EditQuickTriggerModalProps> = ({
  preset,
  isOpen,
  onClose,
  currentUser,
  onSaveSuccess,
}) => {
  const [badgeTitle, setBadgeTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultMessage, setDefaultMessage] = useState('');
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'WARNING'>('CRITICAL');
  const [codeType, setCodeType] = useState<QuickTriggerPreset['codeType']>('CODE_BLUE_IT');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (preset) {
      setBadgeTitle(preset.badgeTitle || '');
      setSubTitle(preset.subTitle || '');
      setDescription(preset.description || '');
      setDefaultTitle(preset.defaultTitle || '');
      setDefaultMessage(preset.defaultMessage || '');
      setSeverity(preset.severity || 'CRITICAL');
      setCodeType(preset.codeType || 'CODE_BLUE_IT');
    }
  }, [preset, isOpen]);

  if (!isOpen || !preset) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTitle.trim() || !defaultTitle.trim() || !defaultMessage.trim()) {
      setErrorMessage('Please fill in all required trigger preset fields.');
      return;
    }

    if (!currentUser) {
      setErrorMessage('User session required to perform administrative changes.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updated: QuickTriggerPreset = {
        id: preset.id,
        codeType,
        badgeTitle: badgeTitle.trim(),
        subTitle: subTitle.trim(),
        description: description.trim(),
        defaultTitle: defaultTitle.trim(),
        defaultMessage: defaultMessage.trim(),
        severity,
      };

      await emergencyService.saveQuickTrigger(updated, currentUser);
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save quick trigger preset:', err);
      setErrorMessage(err.message || 'Failed to save trigger preset changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = async () => {
    if (!currentUser) return;
    const defaultItem = DEFAULT_QUICK_TRIGGERS.find((d) => d.id === preset.id);
    if (defaultItem) {
      setBadgeTitle(defaultItem.badgeTitle);
      setSubTitle(defaultItem.subTitle);
      setDescription(defaultItem.description);
      setDefaultTitle(defaultItem.defaultTitle);
      setDefaultMessage(defaultItem.defaultMessage);
      setSeverity(defaultItem.severity);
      setCodeType(defaultItem.codeType);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Radio className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                Edit Quick Emergency Trigger Preset
              </h3>
              <p className="text-xs text-slate-400">
                Customize trigger text, target area, and default broadcast wording for Super Admin & IT Admin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Preset Badge Title *</label>
              <input
                type="text"
                required
                value={badgeTitle}
                onChange={(e) => setBadgeTitle(e.target.value)}
                placeholder="e.g. CODE BLUE IT"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Target Area / Subtitle *</label>
              <input
                type="text"
                required
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                placeholder="e.g. ICU / OT Rapid Dispatch"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Code Type Classification</label>
              <select
                value={codeType}
                onChange={(e: any) => setCodeType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
              >
                <option value="CODE_BLUE_IT">Code Blue IT</option>
                <option value="EHR_DOWNTIME">EHR Downtime</option>
                <option value="CODE_RED_NETWORK">Network / PACS Outage</option>
                <option value="CYBER_LOCKDOWN">Cyber Lockdown</option>
                <option value="GENERAL_EMERGENCY">General Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Broadcast Severity</label>
              <select
                value={severity}
                onChange={(e: any) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
              >
                <option value="CRITICAL">CRITICAL (Red Siren)</option>
                <option value="HIGH">HIGH (Amber Banner)</option>
                <option value="WARNING">WARNING (Sky Blue Banner)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Trigger Description / Guidance</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain when staff/admins should trigger this emergency protocol..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Default Broadcast Headline / Title *</label>
            <input
              type="text"
              required
              value={defaultTitle}
              onChange={(e) => setDefaultTitle(e.target.value)}
              placeholder="e.g. 🚨 CODE BLUE IT: Rapid Response Dispatched to ICU / ER"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Default Broadcast Body Message *</label>
            <textarea
              rows={3}
              required
              value={defaultMessage}
              onChange={(e) => setDefaultMessage(e.target.value)}
              placeholder="Enter exact message sent to all hospital terminals..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500 leading-relaxed"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Reset fields to factory default text"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Trigger Preset'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
