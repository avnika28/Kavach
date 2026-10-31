import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  CheckSquare,
  Bell,
  Plus,
  Trash2,
  Check,
  Calculator,
  Search,
} from 'lucide-react';
import { db, type TaskItem } from '../store/db';
import { executeLocalTool } from '../lib/llm/toolSchema';
import { gsap, prefersReducedMotion } from '../lib/animations';

type ToolsTab = 'notes' | 'tasks' | 'reminders' | 'calculator';

export const ToolsScreen: React.FC = () => {
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray()) || [];
  const tasks = useLiveQuery(() => db.tasks.orderBy('createdAt').reverse().toArray()) || [];
  const reminders =
    useLiveQuery(() => db.reminders.orderBy('createdAt').reverse().toArray()) || [];

  const [activeTab, setActiveTab] = useState<ToolsTab>('notes');
  const [searchQuery, setSearchQuery] = useState('');

  // Notes state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('vault, personal');

  // Tasks state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskItem['priority']>('medium');
  const [taskDue, setTaskDue] = useState('Today');

  // Reminders state
  const [remTitle, setRemTitle] = useState('');
  const [remTime, setRemTime] = useState('Tomorrow · 09:00 Local');

  // Calculator state
  const [calcExpr, setCalcExpr] = useState('(1024 * 64) / 16');
  const [calcResult, setCalcResult] = useState<string>('4096');

  // Tab underline slide ref
  const tabUnderlineRef = useRef<HTMLDivElement>(null);
  const tabButtonsRef = useRef<Record<ToolsTab, HTMLButtonElement | null>>({
    notes: null,
    tasks: null,
    reminders: null,
    calculator: null,
  });

  useEffect(() => {
    const activeBtn = tabButtonsRef.current[activeTab];
    if (!activeBtn || !tabUnderlineRef.current) return;
    const { offsetLeft, offsetWidth } = activeBtn;
    if (prefersReducedMotion()) {
      tabUnderlineRef.current.style.transform = `translateX(${offsetLeft}px)`;
      tabUnderlineRef.current.style.width = `${offsetWidth}px`;
      return;
    }
    gsap.to(tabUnderlineRef.current, {
      x: offsetLeft,
      width: offsetWidth,
      duration: 0.45,
      ease: 'power3.out',
    });
  }, [activeTab]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;
    await executeLocalTool({
      tool: 'create_note',
      args: {
        title: noteTitle.trim() || 'Untitled Vault Note',
        content: noteContent.trim(),
        tags: noteTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      },
    });
    setNoteTitle('');
    setNoteContent('');
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await executeLocalTool({
      tool: 'add_task',
      args: {
        title: taskTitle.trim(),
        priority: taskPriority,
        dueDate: taskDue,
      },
    });
    setTaskTitle('');
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;
    await executeLocalTool({
      tool: 'set_reminder',
      args: {
        title: remTitle.trim(),
        remindAt: remTime.trim() || 'Today · 18:00 Local',
      },
    });
    setRemTitle('');
  };

  const handleRunCalculator = async (e: React.FormEvent) => {
    e.preventDefault();
    const record = await executeLocalTool({
      tool: 'calculate',
      args: { expression: calcExpr },
    });
    setCalcResult(record.resultSummary);
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b kavach-divider pb-5">
        <div>
          <span className="font-editorial-label italic text-base">
            On-Device Personal Productivity · Dexie IndexedDB
          </span>
          <h1 className="text-5xl sm:text-6xl font-display-bebas mt-1">
            LOCAL TOOLS &amp; RECORDS
          </h1>
        </div>

        {/* Animated Sliding Tab Bar */}
        <div className="relative flex items-center gap-2 border-b kavach-divider pb-2">
          {(
            [
              { id: 'notes', label: `Notes (${notes.length})`, icon: FileText },
              { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
              { id: 'reminders', label: `Reminders (${reminders.length})`, icon: Bell },
              { id: 'calculator', label: 'Calculator', icon: Calculator },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonsRef.current[tab.id] = el;
                }}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id ? 'opacity-100 font-semibold' : 'opacity-65 hover:opacity-90'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#590907] dark:text-[#E8D2B5]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div
            ref={tabUnderlineRef}
            className="absolute bottom-0 left-0 h-[2px] bg-[#590907] dark:bg-[#E8D2B5]"
          />
        </div>
      </div>

      {/* Tab 1: Notes */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleAddNote}
            className="lg:col-span-5 kavach-card p-6 space-y-4 h-fit"
          >
            <h2 className="text-2xl font-display-bebas border-b kavach-divider pb-2">
              CREATE LOCAL NOTE
            </h2>
            <div>
              <label className="block text-xs font-editorial-label italic mb-1">
                Note Title
              </label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Offline Vector Index Notes"
                className="w-full px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs focus:outline-none focus:border-[#590907]"
              />
            </div>
            <div>
              <label className="block text-xs font-editorial-label italic mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs font-mono focus:outline-none focus:border-[#590907]"
              />
            </div>
            <div>
              <label className="block text-xs font-editorial-label italic mb-1">
                Content
              </label>
              <textarea
                rows={5}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write markdown or plaintext stored strictly in IndexedDB..."
                className="w-full p-3.5 rounded-xl bg-transparent border kavach-divider text-xs focus:outline-none focus:border-[#590907]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Save Note to Vault</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter notes by title or content..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl kavach-card text-xs focus:outline-none"
              />
            </div>

            {filteredNotes.map((note) => (
              <div key={note.id} className="kavach-card p-6 space-y-3">
                <div className="flex items-start justify-between gap-4 border-b kavach-divider pb-2.5">
                  <div>
                    <h3 className="text-xl font-display-bebas tracking-wide">{note.title}</h3>
                    <div className="text-[11px] font-mono opacity-65">
                      {note.tags.join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => db.notes.delete(note.id)}
                    className="p-1.5 rounded-lg hover:bg-[#590907]/15 text-[#590907] dark:text-[#E8D2B5] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line opacity-90">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <form onSubmit={handleAddTask} className="kavach-card p-5 flex flex-wrap gap-3">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Add a new local task..."
              className="flex-1 min-w-[220px] px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs focus:outline-none focus:border-[#590907]"
            />
            <select
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value as TaskItem['priority'])}
              className="px-3 py-2 rounded-xl bg-transparent border kavach-divider text-xs font-medium"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <input
              type="text"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              placeholder="Due (e.g. Today)"
              className="w-36 px-3 py-2 rounded-xl bg-transparent border kavach-divider text-xs font-mono"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </form>

          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="kavach-card px-5 py-4 flex items-center justify-between gap-4"
              >
                <div
                  onClick={() => db.tasks.update(task.id, { completed: !task.completed })}
                  className="flex items-center gap-3.5 flex-1 cursor-pointer"
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      task.completed
                        ? 'bg-[#590907] border-[#590907] text-[#E8D2B5]'
                        : 'border-current opacity-60'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <div>
                    <div
                      className={`text-sm font-medium ${
                        task.completed ? 'line-through opacity-55' : ''
                      }`}
                    >
                      {task.title}
                    </div>
                    <div className="text-[11px] font-mono opacity-70 mt-0.5">
                      Priority: {task.priority.toUpperCase()} · Due: {task.dueDate || 'Anytime'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => db.tasks.delete(task.id)}
                  className="p-1.5 rounded-lg hover:bg-[#590907]/15 text-[#590907] dark:text-[#E8D2B5] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Reminders */}
      {activeTab === 'reminders' && (
        <div className="space-y-6">
          <form onSubmit={handleAddReminder} className="kavach-card p-5 flex flex-wrap gap-3">
            <input
              type="text"
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
              placeholder="Reminder description..."
              className="flex-1 min-w-[220px] px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs focus:outline-none focus:border-[#590907]"
            />
            <input
              type="text"
              value={remTime}
              onChange={(e) => setRemTime(e.target.value)}
              placeholder="Time (e.g. Tomorrow · 09:00)"
              className="w-56 px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs font-mono"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Set Reminder</span>
            </button>
          </form>

          <div className="space-y-3">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                className="kavach-card px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5">
                  <div
                    className={`text-sm font-medium ${
                      rem.dismissed ? 'line-through opacity-55' : ''
                    }`}
                  >
                    {rem.title}
                  </div>
                  <div className="text-xs font-mono opacity-75">{rem.remindAt}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => db.reminders.update(rem.id, { dismissed: !rem.dismissed })}
                    className="px-3 py-1 rounded-lg border kavach-divider text-xs font-medium cursor-pointer"
                  >
                    {rem.dismissed ? 'Restore' : 'Dismiss'}
                  </button>
                  <button
                    type="button"
                    onClick={() => db.reminders.delete(rem.id)}
                    className="p-1.5 rounded-lg hover:bg-[#590907]/15 text-[#590907] dark:text-[#E8D2B5] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Deterministic Local Calculator */}
      {activeTab === 'calculator' && (
        <div className="max-w-xl kavach-card p-7 space-y-4">
          <h2 className="text-2xl font-display-bebas border-b kavach-divider pb-2">
            LOCAL EXPRESSION EVALUATOR
          </h2>
          <form onSubmit={handleRunCalculator} className="space-y-3">
            <input
              type="text"
              value={calcExpr}
              onChange={(e) => setCalcExpr(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-transparent border kavach-divider font-mono text-sm focus:outline-none focus:border-[#590907]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium cursor-pointer"
            >
              Evaluate Expression
            </button>
          </form>
          <div className="p-4 rounded-xl bg-[#1C0A0A]/8 dark:bg-[#E8D2B5]/10 font-mono text-sm">
            {calcResult}
          </div>
        </div>
      )}
    </div>
  );
};
