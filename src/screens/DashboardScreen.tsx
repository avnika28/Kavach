import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGSAP } from '@gsap/react';
import {
  CheckSquare,
  FileText,
  Bell,
  BookOpen,
  HardDrive,
  Cpu,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import { db, DEFAULT_SETTINGS } from '../store/db';
import { gsap, countUp, staggerIn, bindCard3DTilt } from '../lib/animations';

let hasVisitedDashboardOnce = false;

export const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const tasksCountRef = useRef<HTMLSpanElement>(null);
  const notesCountRef = useRef<HTMLSpanElement>(null);
  const remindersCountRef = useRef<HTMLSpanElement>(null);
  const docsCountRef = useRef<HTMLSpanElement>(null);

  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray()) || [];
  const reminders = useLiveQuery(() => db.reminders.toArray()) || [];
  const documents = useLiveQuery(() => db.documents.toArray()) || [];
  const chunks = useLiveQuery(() => db.chunks.count()) || 0;
  const settings = useLiveQuery(() => db.settings.get('global')) || DEFAULT_SETTINGS;

  const [storageEstimate, setStorageEstimate] = useState<{
    usageMB: number;
    quotaMB: number;
  }>({ usageMB: 14.2, quotaMB: 2048 });

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        const usageMB = Number(((est.usage || 14_800_000) / (1024 * 1024)).toFixed(2));
        const quotaMB = Number(((est.quota || 2_147_483_648) / (1024 * 1024)).toFixed(0));
        setStorageEstimate({ usageMB, quotaMB });
      });
    }
  }, [tasks.length, notes.length, documents.length]);

  const pendingTasks = tasks.filter((t) => !t.completed);
  const activeReminders = reminders.filter((r) => !r.dismissed);
  const indexedDocs = documents.filter((d) => d.status === 'indexed');

  // GSAP: Bento cards stagger in on first visit only + 3D tilt on desktop
  useGSAP(
    () => {
      if (!hasVisitedDashboardOnce) {
        staggerIn('.bento-dashboard-card', { stagger: 0.08, y: 22, duration: 0.75 });
        hasVisitedDashboardOnce = true;
      }
      const cards = gsap.utils.toArray<HTMLElement>('.bento-dashboard-card');
      return bindCard3DTilt(cards);
    },
    { scope: containerRef }
  );

  // GSAP: Numbers count up
  useEffect(() => {
    countUp(tasksCountRef.current, pendingTasks.length, { duration: 0.8 });
    countUp(notesCountRef.current, notes.length, { duration: 0.8 });
    countUp(remindersCountRef.current, activeReminders.length, { duration: 0.8 });
    countUp(docsCountRef.current, indexedDocs.length, { duration: 0.8 });
  }, [pendingTasks.length, notes.length, activeReminders.length, indexedDocs.length]);

  const toggleTask = async (id: string, current: boolean) => {
    await db.tasks.update(id, { completed: !current });
  };

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto w-full px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b kavach-divider pb-5">
        <div>
          <span className="font-editorial-label italic text-base">
            Sovereign Command Center · Local IndexedDB Vault
          </span>
          <h1 className="text-5xl sm:text-6xl font-display-bebas mt-1">
            PERSONAL INTELLIGENCE BENTO
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="px-5 py-2.5 rounded-[20px] bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors"
        >
          <span>Ask Kavach Agent</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* 6-Card Editorial Bento Grid with 3px Hover Lift */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Tasks Card */}
        <div className="bento-dashboard-card kavach-card p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-[3px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <span className="font-editorial-label italic text-base font-semibold">
                01 · Active Tasks
              </span>
              <CheckSquare className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            </div>

            <div className="flex items-baseline justify-between">
              <span
                ref={tasksCountRef}
                className="text-5xl font-display-bebas tabular-nums"
              >
                {pendingTasks.length}
              </span>
              <span className="text-xs font-mono opacity-75">
                {tasks.filter((t) => t.completed).length} completed
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {tasks.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  onClick={() => toggleTask(t.id, t.completed)}
                  className="flex items-center gap-2.5 text-xs p-2 rounded-xl bg-[#1C0A0A]/5 dark:bg-[#E8D2B5]/5 cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      t.completed
                        ? 'bg-[#590907] border-[#590907] text-[#E8D2B5]'
                        : 'border-current opacity-60'
                    }`}
                  >
                    {t.completed && <Check className="w-3 h-3" />}
                  </span>
                  <span className={`truncate ${t.completed ? 'line-through opacity-60' : ''}`}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/tools')}
            className="mt-5 pt-3 border-t kavach-divider text-xs font-medium flex items-center justify-between hover:opacity-80 cursor-pointer"
          >
            <span>Manage Tasks in Tools</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Notes Card */}
        <div className="bento-dashboard-card kavach-card p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-[3px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <span className="font-editorial-label italic text-base font-semibold">
                02 · Vault Notes
              </span>
              <FileText className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            </div>

            <div className="flex items-baseline justify-between">
              <span
                ref={notesCountRef}
                className="text-5xl font-display-bebas tabular-nums"
              >
                {notes.length}
              </span>
              <span className="text-xs font-mono opacity-75">Full-text searchable</span>
            </div>

            <div className="space-y-2 pt-1">
              {notes.slice(0, 2).map((n) => (
                <div
                  key={n.id}
                  className="p-2.5 rounded-xl bg-[#1C0A0A]/5 dark:bg-[#E8D2B5]/5 space-y-1 text-xs"
                >
                  <div className="font-semibold truncate">{n.title}</div>
                  <p className="opacity-75 line-clamp-2 text-[11px]">{n.content}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/tools')}
            className="mt-5 pt-3 border-t kavach-divider text-xs font-medium flex items-center justify-between hover:opacity-80 cursor-pointer"
          >
            <span>Open Notes Editor</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3. Reminders Card */}
        <div className="bento-dashboard-card kavach-card p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-[3px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <span className="font-editorial-label italic text-base font-semibold">
                03 · Scheduled Reminders
              </span>
              <Bell className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            </div>

            <div className="flex items-baseline justify-between">
              <span
                ref={remindersCountRef}
                className="text-5xl font-display-bebas tabular-nums"
              >
                {activeReminders.length}
              </span>
              <span className="text-xs font-mono opacity-75">Local cadence</span>
            </div>

            <div className="space-y-2 pt-1">
              {activeReminders.slice(0, 2).map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl bg-[#1C0A0A]/5 dark:bg-[#E8D2B5]/5 text-xs space-y-0.5"
                >
                  <div className="font-semibold truncate">{r.title}</div>
                  <div className="font-mono text-[11px] opacity-75">{r.remindAt}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/tools')}
            className="mt-5 pt-3 border-t kavach-divider text-xs font-medium flex items-center justify-between hover:opacity-80 cursor-pointer"
          >
            <span>Configure Reminders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4. Documents Indexed (RAG) Card */}
        <div className="bento-dashboard-card kavach-card p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-[3px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <span className="font-editorial-label italic text-base font-semibold">
                04 · Knowledge Base RAG
              </span>
              <BookOpen className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            </div>

            <div className="flex items-baseline justify-between">
              <span
                ref={docsCountRef}
                className="text-5xl font-display-bebas tabular-nums"
              >
                {indexedDocs.length}
              </span>
              <span className="text-xs font-mono opacity-75">{chunks} vector chunks</span>
            </div>

            <p className="text-xs leading-relaxed opacity-85">
              Embedded locally in 384 dimensions (`all-MiniLM-L6-v2`). Cosine similarity runs across active documents during chat.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/knowledge')}
            className="mt-5 pt-3 border-t kavach-divider text-xs font-medium flex items-center justify-between hover:opacity-80 cursor-pointer"
          >
            <span>Upload PDF / MD / TXT</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5. Storage Meter Card */}
        <div className="bento-dashboard-card kavach-card p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-[3px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <span className="font-editorial-label italic text-base font-semibold">
                05 · On-Device Storage Meter
              </span>
              <HardDrive className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-display-bebas tabular-nums">
                {storageEstimate.usageMB} MB
              </span>
              <span className="text-xs font-mono opacity-75">
                Quota: ~{storageEstimate.quotaMB} MB
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-[#1C0A0A]/15 dark:bg-[#E8D2B5]/15 overflow-hidden">
              <div
                className="h-full bg-[#590907]"
                style={{
                  width: `${Math.max(
                    6,
                    Math.min(100, (storageEstimate.usageMB / storageEstimate.quotaMB) * 100)
                  )}%`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono opacity-80">
              <div>Vector Chunks: {chunks}</div>
              <div>Notes &amp; Tasks: {notes.length + tasks.length}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="mt-5 pt-3 border-t kavach-divider text-xs font-medium flex items-center justify-between hover:opacity-80 cursor-pointer"
          >
            <span>Backup or Wipe Vault</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6. Model Status Card */}
        <div className="bento-dashboard-card kavach-card p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-[3px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <span className="font-editorial-label italic text-base font-semibold">
                06 · Model &amp; Worker Status
              </span>
              <Cpu className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            </div>

            <div>
              <div className="text-2xl font-display-bebas tracking-wide truncate">
                {settings.selectedModel}
              </div>
              <div className="text-xs font-mono text-[#590907] dark:text-[#E8D2B5] mt-1">
                ● Ready · Offline ({settings.engineMode})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="p-2 rounded-xl bg-[#1C0A0A]/5 dark:bg-[#E8D2B5]/5">
                Temp: {settings.temperature}
              </div>
              <div className="p-2 rounded-xl bg-[#1C0A0A]/5 dark:bg-[#E8D2B5]/5">
                Max Tok: {settings.maxTokens}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="mt-5 pt-3 border-t kavach-divider text-xs font-medium flex items-center justify-between hover:opacity-80 cursor-pointer"
          >
            <span>Switch Local Model</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
