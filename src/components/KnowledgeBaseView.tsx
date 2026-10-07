import React, { useState, useEffect, useRef } from 'react';
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
  Edit3,
  Plus,
  Wifi,
  Globe,
  Power,
  Layers,
  ExternalLink,
  ShieldCheck,
  MousePointer,
  Sparkles,
  Keyboard,
  Command,
  X,
  Key,
} from 'lucide-react';
import { type KnowledgeArticle, type User } from '../types';
import { getAllFromStore, putToStore } from '../services/localDatabaseService';
import { authService } from '../services/authService';
import { SopEditModal } from './SopEditModal';

const DEFAULT_SOP_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'sop-001',
    articleId: 'SOP-001',
    title: 'SOP: How to Clear Browser Data in Google Chrome or Microsoft Edge',
    category: 'Browser & EHR',
    problem: 'LHIMS pages freeze, show stale patient records, or produce unexpected display glitch after system update.',
    symptoms: [
      'Stale patient clinical records displaying on nurse workstation',
      'Blank white screen when opening LHIMS interface',
      'Button clicks unresponsive in Chrome or Edge',
    ],
    tags: ['Chrome', 'Edge', 'Browser', 'Cache', 'LHIMS'],
    solution: 'Clear browser cookies and cached images/files across All Time, then restart browser and re-open http://10.10.16.50/lhims_245.',
    steps: [
      'Open Google Chrome or Microsoft Edge on your workstation computer.',
      'Press the keyboard shortcut Ctrl + Shift + Delete (or click 3 dots menu at top-right -> Settings -> Clear Browsing Data).',
      'In the pop-up window, select Time Range dropdown and set to "All time" (or "Everything").',
      'Check the boxes for "Cookies and other site data" and "Cached images and files".',
      'Click the blue "Clear data" / "Clear now" button and wait a few seconds.',
      'Close all open browser windows, re-open Chrome or Edge, and enter http://10.10.16.50/lhims_245.',
    ],
    views: 142,
    createdBy: 'IT Operations Unit',
    updatedBy: 'IT Admin / Super Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'SYNCED',
    _syncVersion: 1,
    _lastSyncedAt: null,
    _deviceId: 'default-device',
  },
  {
    id: 'sop-002',
    articleId: 'SOP-002',
    title: 'SOP: How to Disconnect and Connect to Hospital eHealth Wi-Fi',
    category: 'Network & Wi-Fi',
    problem: 'Staff mobile tablet or laptop loses wireless network connection to hospital eHealth Wi-Fi or shows IP conflict.',
    symptoms: [
      'Wi-Fi icon displays yellow warning or disconnected globe',
      'LHIMS Mobile App displays "Host Unreachable"',
      'Unable to roam between ward Access Points',
    ],
    tags: ['Wi-Fi', 'eHealth', 'Wireless', 'Password', 'Network'],
    solution: 'Connect to SSID "eHealth" using wireless security key "1234567890". Enable Connect Automatically for ward roaming.',
    steps: [
      'Click the Wi-Fi / Network icon in bottom-right corner of Windows taskbar (or top-right of mobile tablet).',
      'If connected to wrong network, click Disconnect. Right-click "eHealth" and select "Forget" if credentials were corrupt.',
      'Select the network named "eHealth" from the list of available wireless SSIDs.',
      'Check the box "Connect automatically" to enable seamless roaming across ward Access Points.',
      'Click Connect. When prompted for Security Key / Password, type: 1234567890',
      'Click Next / Join. Verify connection status reads "Connected, secured" with valid IP address.',
    ],
    views: 189,
    createdBy: 'IT Operations Unit',
    updatedBy: 'IT Admin / Super Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'SYNCED',
    _syncVersion: 1,
    _lastSyncedAt: null,
    _deviceId: 'default-device',
  },
  {
    id: 'sop-003',
    articleId: 'SOP-003',
    title: 'SOP: How to Properly Boot, Restart, or Shutdown a Workstation Computer',
    category: 'Hardware & OS',
    problem: 'Workstation computer sluggish, barcode scanner unresponsive, or system requires routine power cycle.',
    symptoms: [
      'Computer running for days without rebooting',
      'USB barcode scanner or label printer unresponsive',
      'High RAM memory usage causing clinical system lag',
    ],
    tags: ['Workstation', 'Power', 'Restart', 'Boot', 'Shutdown'],
    solution: 'Gracefully save work, exit open software, and perform Windows Restart or Shutdown. Press physical power button to boot.',
    steps: [
      'Save all open clinical documents and exit active software applications.',
      'Click the Windows Start Menu icon in bottom-left corner of the screen.',
      'Click the Power button icon symbol.',
      'Select "Restart" (for soft reset/system glitch) or "Shutdown" (for end of shift / severe storm alert).',
      'To Boot On: Press the physical Power button on front of desktop tower or laptop lid once.',
      'Wait for Windows login prompt, enter official credentials, and verify LAN connection icon is lit.',
    ],
    views: 165,
    createdBy: 'IT Operations Unit',
    updatedBy: 'IT Admin / Super Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'SYNCED',
    _syncVersion: 1,
    _lastSyncedAt: null,
    _deviceId: 'default-device',
  },
  {
    id: 'sop-004',
    articleId: 'SOP-004',
    title: 'SOP: Opening Browser & Entering LHIMS EHR and CPH Inventory Web URLs',
    category: 'Hospital Systems & LHIMS',
    problem: 'Clinical, ward, or pharmacy staff need exact internal IP web addresses for LHIMS EHR and Inventory Requisitions.',
    symptoms: [
      'Error 404 or "Site cannot be reached" when typing public domain names',
      'Staff entering incorrect IP address or port number',
      'New staff orientation for electronic health records',
    ],
    tags: ['LHIMS', 'EHR', 'Inventory', 'CPH', 'URL', 'Browser'],
    solution: 'Enter 10.10.16.50/lhims_245 for Electronic Health Records and 10.10.16.50/lhims_245/CPH for CPH Inventory Requisitions.',
    steps: [
      'Launch Google Chrome or Microsoft Edge from desktop shortcut.',
      'Click the address bar at the top of the browser window and clear any existing URL text.',
      'For LHIMS Electronic Health Records (EHR): Type 10.10.16.50/lhims_245 and press Enter.',
      'For Inventory Requisitions & CPH Portal: Type 10.10.16.50/lhims_245/CPH and press Enter.',
      'Bookmark both URLs by pressing Ctrl + D on keyboard so they appear in browser top bar for 1-click access.',
      'Enter staff clinical username and password, then confirm active department station.',
    ],
    views: 220,
    createdBy: 'IT Operations Unit',
    updatedBy: 'IT Admin / Super Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'SYNCED',
    _syncVersion: 1,
    _lastSyncedAt: null,
    _deviceId: 'default-device',
  },
  {
    id: 'sop-005',
    articleId: 'SOP-005',
    title: 'SOP: Essential Hospital Workstation Keyboard Shortcuts & Rapid System Recovery Keys',
    category: 'Workstation & Security',
    problem: 'Hospital clinical and administrative staff face system lag, browser caching locks, or require fast emergency workstation lock.',
    symptoms: [
      'Need to immediately lock workstation when leaving bedside (HIPAA/Data Security)',
      'Browser page frozen and mouse unresponsive',
      'Need fast cache purge without navigating complex menus',
      'Accidental closure of clinical EHR / LHIMS tab with unsaved context',
    ],
    tags: ['Shortcuts', 'Keyboard', 'Hotkeys', 'Security', 'Lock', 'Cache', 'LHIMS'],
    solution: 'Use standardized hospital workstation key combinations for emergency locking, browser cache purging, window switching, and instant printing.',
    steps: [
      'EMERGENCY LOCK (Win + L): Press Windows Key + L immediately when leaving nursing station or desk to prevent unauthorized patient record access.',
      'HARD BROWSER RELOAD (Ctrl + F5 or Ctrl + Shift + R): Forces Google Chrome/Edge to discard local cache and fetch fresh LHIMS code directly from internal server.',
      'CLEAR BROWSING DATA (Ctrl + Shift + Delete): Instantly opens the browser Clear Data dialog to purge corrupted session cookies.',
      'TASK MANAGER / FORCE QUIT (Ctrl + Shift + Esc): Opens Task Manager to terminate unresponsive LHIMS, PDF readers, or clinical software.',
      'REOPEN CLOSED TAB (Ctrl + Shift + T): Instantly recovers an accidentally closed patient browser tab with its previous URL intact.',
      'FIND PATIENT / KEYWORD (Ctrl + F): Search for a specific patient folder ID, test name, or medication on long EHR pages.',
      'DIRECT PRINT RECORD (Ctrl + P): Opens standard print dialog for prescription, triage ticket, or lab report printing.',
      'RUN COMMAND PROMPT (Win + R): Opens Windows Run box for IT diagnostic commands (e.g., "ping 10.10.16.50 -t" or "ipconfig").',
      'LHIMS BOOKMARK BAR (Ctrl + D): Adds active hospital URL to browser bookmarks bar for single-click access.',
      'FAST APPLICATION SWITCH (Alt + Tab): Quickly toggle between LHIMS EHR, Laboratory System, and Hospital Helpdesk.',
    ],
    views: 310,
    createdBy: 'IT Operations Unit',
    updatedBy: 'IT Admin / Super Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'SYNCED',
    _syncVersion: 1,
    _lastSyncedAt: null,
    _deviceId: 'default-device',
  },
];

interface KnowledgeBaseViewProps {
  currentUser?: User | null;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ currentUser }) => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  const [sopOnlyFilter, setSopOnlyFilter] = useState(false);

  // Edit / Add Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [isShortcutsGuideOpen, setIsShortcutsGuideOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isSuperAdminOrIT = authService.isSuperAdminOrIT(currentUser);

  const safeArticles = articles || [];
  const filtered = safeArticles.filter((a) => {
    const prob = (a.problemDescription || a.problem || '').toLowerCase();
    const tagsArr = a.tags || a.symptoms || [];
    const matchesSearch =
      (a.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      prob.includes(searchQuery.toLowerCase()) ||
      tagsArr.some((t) => (t || '').toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = categoryFilter === 'ALL' || a.category === categoryFilter;
    const matchesSop = !sopOnlyFilter || (a.articleId && a.articleId.startsWith('SOP')) || (a.title && a.title.includes('SOP'));
    return matchesSearch && matchesCat && matchesSop;
  });

  const categories = Array.from(new Set(safeArticles.map((a) => a.category).filter(Boolean)));
  const sopCount = safeArticles.filter((a) => (a.articleId && a.articleId.startsWith('SOP')) || (a.title && a.title.includes('SOP'))).length;

  // Keyboard shortcut listener for power-user clinical/IT navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing inside an input, textarea or contenteditable
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsGuideOpen((prev) => !prev);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (isShortcutsGuideOpen) {
          setIsShortcutsGuideOpen(false);
        }
      } else if (!isInput && (e.key === 'j' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (filtered.length > 0) {
          const currentIndex = filtered.findIndex((a) => a.id === selectedArticle?.id);
          const nextIndex = currentIndex < filtered.length - 1 ? currentIndex + 1 : 0;
          setSelectedArticle(filtered[nextIndex]);
        }
      } else if (!isInput && (e.key === 'k' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (filtered.length > 0) {
          const currentIndex = filtered.findIndex((a) => a.id === selectedArticle?.id);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : filtered.length - 1;
          setSelectedArticle(filtered[prevIndex]);
        }
      } else if (!isInput && (e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey) {
        if (selectedArticle) {
          e.preventDefault();
          window.print();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShortcutsGuideOpen, filtered, selectedArticle]);

  const loadArticles = async () => {
    let data = await getAllFromStore<KnowledgeArticle>('knowledgeBase');
    if (!data || data.length === 0) {
      for (const sop of DEFAULT_SOP_ARTICLES) {
        await putToStore('knowledgeBase', sop);
      }
      data = await getAllFromStore<KnowledgeArticle>('knowledgeBase');
    } else {
      for (const sop of DEFAULT_SOP_ARTICLES) {
        if (!data.some((a) => a.articleId === sop.articleId)) {
          await putToStore('knowledgeBase', sop);
        }
      }
      data = await getAllFromStore<KnowledgeArticle>('knowledgeBase');
    }

    setArticles(data || []);
    if (data && data.length > 0) {
      if (!selectedArticle || !data.some((a) => a.id === selectedArticle.id)) {
        // Prefer selecting SOP-001 by default
        const sopDefault = data.find((a) => a.articleId === 'SOP-001') || data[0];
        setSelectedArticle(sopDefault);
      } else {
        const refreshed = data.find((a) => a.id === selectedArticle.id);
        if (refreshed) setSelectedArticle(refreshed);
      }
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handleOpenEdit = (art: KnowledgeArticle) => {
    setEditingArticle(art);
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingArticle(null);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600" />
            <span>Basic & Troubleshooting Procedures</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Offline knowledge base and basic troubleshooting procedures for clinical staff and technicians.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Basic & Troubleshooting... (Press /)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
            />
            <kbd className="hidden sm:inline-block absolute right-2.5 top-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700">
              /
            </kbd>
          </div>

          <button
            onClick={() => setIsShortcutsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0"
            title="Hospital & Workstation Keyboard Shortcuts (Press ?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">Shortcuts</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[9px] font-mono text-slate-600 dark:text-slate-300">
              ?
            </kbd>
          </button>

          {isSuperAdminOrIT && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Troubleshooting Guide</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Article List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                setCategoryFilter('ALL');
                setSopOnlyFilter(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${
                categoryFilter === 'ALL' && !sopOnlyFilter
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              All ({safeArticles.length})
            </button>
            <button
              onClick={() => setSopOnlyFilter(!sopOnlyFilter)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 transition ${
                sopOnlyFilter
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50'
              }`}
              title="Filter only Basic & Troubleshooting Guides"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>📋 Basic & Troubleshooting ({sopCount})</span>
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategoryFilter(c);
                  setSopOnlyFilter(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${
                  categoryFilter === c && !sopOnlyFilter
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filtered.map((art) => {
              const displayTags =
                art.tags && art.tags.length > 0
                  ? art.tags.slice(0, 2).join(' • ')
                  : art.articleId || '';

              return (
                <div
                  key={art.id}
                  onClick={() => setSelectedArticle(art)}
                  className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                    selectedArticle?.id === art.id
                      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 shadow-xs'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-sky-600 dark:text-sky-400">{art.category}</span>
                    <span className="font-mono text-slate-400">{art.articleId}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                    {art.title}
                  </h4>
                  <p className="text-slate-500 line-clamp-2 mt-1 text-[11px]">
                    {art.problemDescription || art.problem}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Selected SOP Reader & Visual Diagram */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
          {selectedArticle ? (
            <div>
              {/* Reader Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-bold">
                    {selectedArticle.category}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {selectedArticle.articleId}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Updated by {selectedArticle.updatedBy || 'IT Admin'}
                  </span>
                  {isSuperAdminOrIT && (
                    <button
                      onClick={() => handleOpenEdit(selectedArticle)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950 text-slate-700 dark:text-slate-200 hover:text-sky-600 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-500" />
                      <span>Edit SOP</span>
                    </button>
                  )}
                </div>
              </div>

              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-3">
                {selectedArticle.title}
              </h2>

              {/* Problem / Trigger Card */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Problem Symptoms &amp; Diagnostic Trigger</span>
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedArticle.problemDescription || selectedArticle.problem}
                </p>

                {selectedArticle.symptoms && selectedArticle.symptoms.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
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

              {/* SPECIAL VISUAL ILLUSTRATIONS & DIAGRAM CARDS FOR SOPs */}
              {selectedArticle.articleId === 'SOP-001' && (
                <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-sky-950 via-slate-900 to-sky-950 border border-sky-800/60 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      <span>Visual Illustration: Chrome / Edge Clear Browsing Data</span>
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-900/80 text-sky-200 border border-sky-700">
                      Ctrl + Shift + Delete
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 space-y-1">
                      <span className="font-bold text-sky-400 block text-[11px]">Step A: Keyboard Trigger</span>
                      <p className="text-[11px] text-slate-300">
                        Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] border border-slate-600">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] border border-slate-600">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] border border-slate-600">Del</kbd> in browser.
                      </p>
                    </div>
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 space-y-1">
                      <span className="font-bold text-amber-400 block text-[11px]">Step B: Select Range</span>
                      <p className="text-[11px] text-slate-300">
                        Set Time range to <strong>All time</strong>. Check Cookies &amp; Cache boxes.
                      </p>
                    </div>
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 space-y-1">
                      <span className="font-bold text-emerald-400 block text-[11px]">Step C: Clear &amp; Reload</span>
                      <p className="text-[11px] text-slate-300">
                        Click <strong>Clear data</strong>. Restart browser and open LHIMS link.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedArticle.articleId === 'SOP-002' && (
                <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-800/60 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-emerald-400" />
                      <span>Visual Illustration: Hospital eHealth Wi-Fi Credentials</span>
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 border border-emerald-700">
                      WPA2 Enterprise / Personal
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px]">Hospital Wireless Network (SSID):</span>
                      <p className="text-sm font-black text-emerald-400 font-mono">eHealth</p>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-slate-400 text-[11px]">Wi-Fi Password / Security Key:</span>
                      <p className="text-sm font-black text-amber-300 font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 inline-block mt-0.5">
                        1234567890
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedArticle.articleId === 'SOP-003' && (
                <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-purple-950 border border-purple-800/60 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                      <Power className="w-4 h-4 text-purple-400" />
                      <span>Visual Illustration: Workstation Power Options</span>
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/80 text-purple-200 border border-purple-700">
                      Windows Start Menu
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 text-center">
                      <span className="font-bold text-sky-400 block text-[11px]">Boot On</span>
                      <p className="text-[10px] text-slate-300 mt-1">Press physical power button on tower once.</p>
                    </div>
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 text-center">
                      <span className="font-bold text-amber-400 block text-[11px]">Restart</span>
                      <p className="text-[10px] text-slate-300 mt-1">Start Menu -&gt; Power -&gt; Restart (for glitches).</p>
                    </div>
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 text-center">
                      <span className="font-bold text-rose-400 block text-[11px]">Shutdown</span>
                      <p className="text-[10px] text-slate-300 mt-1">Start Menu -&gt; Power -&gt; Shutdown (end of shift).</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedArticle.articleId === 'SOP-004' && (
                <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800/60 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-indigo-400" />
                      <span>Visual Illustration: Exact LHIMS Internal Address Bar URLs</span>
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                      Browser Address Bar
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="font-bold text-slate-300">1. LHIMS EHR Portal:</span>
                      <code className="text-sky-300 font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 font-bold">
                        http://10.10.16.50/lhims_245
                      </code>
                    </div>
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="font-bold text-slate-300">2. CPH Inventory Requisitions:</span>
                      <code className="text-emerald-300 font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 font-bold">
                        http://10.10.16.50/lhims_245/CPH
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {selectedArticle.articleId === 'SOP-005' && (
                <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border border-amber-800/60 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Keyboard className="w-4 h-4 text-amber-400" />
                      <span>Visual Illustration: Clinical &amp; Workstation Shortcut Matrix</span>
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/80 text-amber-200 border border-amber-700">
                      Hospital Quick Reference
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-300 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                          Emergency Screen Lock
                        </span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] text-white font-bold">
                          Win + L
                        </kbd>
                      </div>
                      <p className="text-[10px] text-slate-400">Instantly protects patient privacy when leaving nursing station.</p>
                    </div>

                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-300 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-sky-400" />
                          Hard Cache Bypass
                        </span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] text-white font-bold">
                          Ctrl + F5
                        </kbd>
                      </div>
                      <p className="text-[10px] text-slate-400">Forces browser to reload latest LHIMS code from server.</p>
                    </div>

                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Purge Browser Data
                        </span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] text-white font-bold">
                          Ctrl + Shift + Del
                        </kbd>
                      </div>
                      <p className="text-[10px] text-slate-400">Opens dialog to clear corrupted cookies across All Time.</p>
                    </div>

                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Force Close Frozen App
                        </span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] text-white font-bold">
                          Ctrl + Shift + Esc
                        </kbd>
                      </div>
                      <p className="text-[10px] text-slate-400">Opens Task Manager directly to terminate locked processes.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step-by-Step Resolution Guide */}
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Standard Step-by-Step Resolution Protocol</span>
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
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed pt-0.5 font-medium">
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
                  <strong className="block font-bold">Technician Guidance &amp; Solution Summary:</strong>
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

      {/* Edit / Add SOP Modal */}
      <SopEditModal
        article={editingArticle}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaveSuccess={() => {
          loadArticles();
        }}
      />

      {/* Hospital Workstation & Clinical Keyboard Shortcuts Guide Modal */}
      {isShortcutsGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setIsShortcutsGuideOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-xs text-slate-800 dark:text-slate-200 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Hospital Standard Operating Keyboard Shortcuts
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Rapid terminal &amp; clinical workstation keys for LHIMS, EHR, security, and triage.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShortcutsGuideOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Emergency & Workstation Security */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Emergency &amp; Data Protection</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Instant Screen Lock</span>
                    <span className="text-[10px] text-slate-500">Mandatory when leaving clinical station</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Win + L
                  </kbd>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Task Manager / Force Kill</span>
                    <span className="text-[10px] text-slate-500">Terminate frozen EHR / clinical apps</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Ctrl + Shift + Esc
                  </kbd>
                </div>
              </div>
            </div>

            {/* 2. LHIMS & Browser Navigation */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                <span>LHIMS &amp; Clinical Browser Operations</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Clear Cache &amp; Cookies</span>
                    <span className="text-[10px] text-slate-500">Resolve stale patient data display</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Ctrl + Shift + Del
                  </kbd>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Hard Page Refresh</span>
                    <span className="text-[10px] text-slate-500">Bypass local cache from hospital server</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Ctrl + F5
                  </kbd>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Reopen Closed Patient Tab</span>
                    <span className="text-[10px] text-slate-500">Restore accidentally closed ward page</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Ctrl + Shift + T
                  </kbd>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Print Lab Slip / Chart</span>
                    <span className="text-[10px] text-slate-500">Direct workstation printer dialog</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Ctrl + P
                  </kbd>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Find Patient / Word on Screen</span>
                    <span className="text-[10px] text-slate-500">Quickly find folder or lab test name</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Ctrl + F
                  </kbd>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Bookmark LHIMS Portal</span>
                    <span className="text-[10px] text-slate-500">Save 10.10.16.50/lhims_245 to top bar</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Ctrl + D
                  </kbd>
                </div>
              </div>
            </div>

            {/* 3. In-App HITOMS SOP Shortcuts */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Command className="w-4 h-4" />
                <span>HITOMS SOP Interactive Hotkeys</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block mb-1">Focus Search</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    /
                  </kbd>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block mb-1">Next SOP</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    J or ↓
                  </kbd>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block mb-1">Previous SOP</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    K or ↑
                  </kbd>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block mb-1">Print Active SOP</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    P
                  </kbd>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsShortcutsGuideOpen(false)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer shadow-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
