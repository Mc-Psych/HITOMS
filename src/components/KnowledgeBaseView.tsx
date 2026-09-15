import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  ChevronRight,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Printer,
  Radio,
  Server,
} from 'lucide-react';
import { type KnowledgeArticle } from '../types';
import { getAllFromStore } from '../services/localDatabaseService';

export const KnowledgeBaseView: React.FC = () => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  React.useEffect(() => {
    const load = async () => {
      const data = await getAllFromStore<KnowledgeArticle>('knowledgeBase');
      setArticles(data || []);
      if (data && data.length > 0 && !selectedArticle) {
        setSelectedArticle(data[0]);
      }
    };
    load();
  }, []);

  const safeArticles = articles || [];
  const filtered = safeArticles.filter((a) => {
    const prob = (a.problemDescription || a.problem || '').toLowerCase();
    const tagsArr = a.tags || a.symptoms || [];
    const matchesSearch =
      (a.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      prob.includes(searchQuery.toLowerCase()) ||
      tagsArr.some((t) => (t || '').toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = categoryFilter === 'ALL' || a.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = Array.from(new Set(safeArticles.map((a) => a.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600" />
            <span>Hospital IT Standard Operating Procedures (SOP)</span>
          </h1>
          <p className="text-xs text-slate-500">
            Offline knowledge base for clinical staff and technicians during Internet or system disruptions.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search symptoms, LHIMS, printer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Article list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${
                categoryFilter === 'ALL'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${
                  categoryFilter === c
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filtered.map((art) => {
              const displayTags = art.tags && art.tags.length > 0
                ? art.tags.join(', ')
                : (art.symptoms && art.symptoms.length > 0
                    ? art.symptoms.slice(0, 2).join(' • ')
                    : art.articleId || '');
              return (
                <div
                  key={art.id}
                  onClick={() => setSelectedArticle(art)}
                  className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                    selectedArticle?.id === art.id
                      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-sky-600">{art.category}</span>
                    <span className="truncate max-w-[120px] text-right">{displayTags}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mt-1">{art.title}</h4>
                  <p className="text-slate-500 line-clamp-2 mt-1">{art.problemDescription || art.problem}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Selected Article Reader */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
          {selectedArticle ? (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="px-2.5 py-1 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-bold">
                  {selectedArticle.category} SOP
                </span>
                <span className="text-xs text-slate-400">
                  Created by {selectedArticle.author || selectedArticle.createdBy || 'IT Administration'}
                </span>
              </div>

              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-3">
                {selectedArticle.title}
              </h2>

              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Problem Symptoms & Diagnostic Trigger</span>
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedArticle.problemDescription || selectedArticle.problem}
                </p>

                {selectedArticle.symptoms && selectedArticle.symptoms.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Observed Symptoms:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {selectedArticle.symptoms.map((symp, sIdx) => (
                        <li key={sIdx}>{symp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Step-by-Step Resolution Guide */}
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Standard Step-by-Step Resolution</span>
                </h3>

                <div className="space-y-3">
                  {(selectedArticle.steps || []).map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <span className="w-6 h-6 rounded-lg bg-sky-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed pt-0.5">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Solution Summary Note */}
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Technician Guidance:</strong>
                  <span>{selectedArticle.solution}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-slate-400">
              Select an SOP article on the left to review instructions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
