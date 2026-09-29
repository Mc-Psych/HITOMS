import React, { useState } from 'react';
import { X, Plus, Trash2, Save, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { type KnowledgeArticle } from '../types';
import { putToStore, getDeviceId } from '../services/localDatabaseService';
import { auditService } from '../services/auditService';

interface SopEditModalProps {
  article: KnowledgeArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const SopEditModal: React.FC<SopEditModalProps> = ({
  article,
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  const isEditing = Boolean(article && article.id);

  const [title, setTitle] = useState(article?.title || '');
  const [category, setCategory] = useState(article?.category || 'General IT');
  const [problem, setProblem] = useState(article?.problem || article?.problemDescription || '');
  const [solution, setSolution] = useState(article?.solution || '');
  const [symptomsText, setSymptomsText] = useState((article?.symptoms || []).join('\n'));
  const [steps, setSteps] = useState<string[]>(article?.steps && article.steps.length > 0 ? article.steps : ['']);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (article) {
      setTitle(article.title || '');
      setCategory(article.category || 'General IT');
      setProblem(article.problem || article.problemDescription || '');
      setSolution(article.solution || '');
      setSymptomsText((article.symptoms || []).join('\n'));
      setSteps(article.steps && article.steps.length > 0 ? article.steps : ['']);
    } else {
      setTitle('');
      setCategory('General IT');
      setProblem('');
      setSolution('');
      setSymptomsText('');
      setSteps(['']);
    }
  }, [article, isOpen]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    setSteps([...steps, '']);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, value: string) => {
    const updated = [...steps];
    updated[index] = value;
    setSteps(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please provide a title for this Standard Operating Procedure.');
      return;
    }
    if (!problem.trim()) {
      setErrorMessage('Please describe the problem symptoms or diagnostic trigger.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();
      const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
      const cleanSymptoms = symptomsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const articleId = article?.articleId || `SOP-${Date.now().toString().slice(-4)}`;
      const id = article?.id || `sop-${Date.now()}`;

      const updatedArticle: KnowledgeArticle = {
        id,
        articleId,
        title: title.trim(),
        category: category.trim(),
        problem: problem.trim(),
        problemDescription: problem.trim(),
        symptoms: cleanSymptoms,
        solution: solution.trim(),
        steps: cleanSteps.length > 0 ? cleanSteps : ['Follow standard troubleshooting guidelines.'],
        views: article?.views || 1,
        author: article?.author || 'IT Administration',
        createdBy: article?.createdBy || 'IT Unit',
        updatedBy: 'IT Admin / Super Admin',
        createdAt: article?.createdAt || now,
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
        _syncVersion: (article?._syncVersion || 1) + 1,
        _lastSyncedAt: null,
        _deviceId: article?._deviceId || getDeviceId(),
      };

      await putToStore('knowledgeBase', updatedArticle);

      await auditService.logAction(
        isEditing ? 'EDIT_SOP' : 'CREATE_SOP',
        'KnowledgeBase',
        id,
        article,
        `SOP "${updatedArticle.title}" (${updatedArticle.category}) updated by admin.`
      );

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving SOP:', err);
      setErrorMessage(err.message || 'Failed to save SOP article.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-800 dark:text-slate-100 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 border border-sky-300 dark:border-sky-800">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? `Edit SOP: ${article?.articleId || ''}` : 'Add New Hospital IT SOP'}
              </h2>
              <p className="text-xs text-slate-500">
                Modify standard operating protocols for clinical staff and IT engineers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Title & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                SOP Protocol Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SOP: How to Clear Browser Data in Chrome / Edge"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Browser & EHR, Network & Wi-Fi"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Problem / Trigger Description */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Problem / Diagnostic Trigger <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe when or why clinical staff should perform this SOP..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          {/* Symptoms List (One per line) */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Observed Symptoms (One symptom per line)
            </label>
            <textarea
              rows={2}
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              placeholder="e.g. Stale patient record&#10;LHIMS page freeze&#10;Wi-Fi icon disconnected"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Step-by-step resolution list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Step-by-Step Instructions
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-sky-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => handleStepChange(idx, e.target.value)}
                    placeholder={`Step ${idx + 1} action...`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500"
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950 rounded-lg cursor-pointer"
                      title="Remove step"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Solution Summary Note */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Technician Guidance / Solution Summary Note
            </label>
            <textarea
              rows={2}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="e.g. Ensure Chrome is completely restarted. For LHIMS EHR use 10.10.16.50/lhims_245 and CPH Inventory use 10.10.16.50/lhims_245/CPH."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save SOP Protocol'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
