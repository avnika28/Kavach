import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Lenis from 'lenis';
import {
  MessageSquare,
  LayoutGrid,
  BookOpen,
  Wrench,
  Settings,
  Compass,
  Cpu,
  Sun,
  Moon,
  Plus,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  Menu,
  Palette,
} from 'lucide-react';
import { db, DEFAULT_SETTINGS, type Conversation } from '../store/db';
import {
  gsap,
  ScrollTrigger,
  Flip,
  pageTransition,
  isMotionDisabled,
  getDebugMotionDisabled,
  setDebugMotionDisabled,
  subscribeMotionDebug,
} from '../lib/animations';
import { PWAInstallButton } from './PWAInstallButton';
import { SparkleFourPoint } from './PosterVisuals';
import { CustomCursor } from './CustomCursor';
import { providerManager, useProviderManager } from '../lib/llm/providerManager';

interface AppShellProps {
  children: React.ReactNode;
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

type PosterPalette = 'journal' | 'festival' | 'soundwaves' | 'momentum';

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const mainViewportRef = useRef<HTMLDivElement>(null);
  const wipeCurtainRef = useRef<HTMLDivElement>(null);
  const layoutBodyRef = useRef<HTMLDivElement>(null);
  const offlineBadgeRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const settings = useLiveQuery(() => db.settings.get('global')) || DEFAULT_SETTINGS;
  const conversations =
    useLiveQuery(() => db.conversations.orderBy('updatedAt').reverse().toArray()) || [];

  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : false
  );
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [palette, setPalette] = useState<PosterPalette>('journal');
  const [historySearch, setHistorySearch] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const [offlineToastMessage, setOfflineToastMessage] = useState<string | null>(null);
  const [motionPaused, setMotionPaused] = useState<boolean>(getDebugMotionDisabled());
  const providerSnap = useProviderManager();
  const lastHandledToastIdRef = useRef<number>(0);

  useEffect(() => {
    if (
      providerSnap.lastToast &&
      providerSnap.lastToast.id !== lastHandledToastIdRef.current
    ) {
      lastHandledToastIdRef.current = providerSnap.lastToast.id;
      setOfflineToastMessage(providerSnap.lastToast.message);
    }
  }, [providerSnap.lastToast]);

  // Initialize Lenis smooth scrolling synced with GSAP ScrollTrigger
  useEffect(() => {
    if (isMotionDisabled()) return;

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const tickerFn = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        ScrollTrigger.refresh();
      });
    }

    return () => {
      gsap.ticker.remove(tickerFn);
      lenis.destroy();
    };
  }, [motionPaused]);

  // Press "M" dev shortcut to toggle all motion for debugging
  useEffect(() => {
    const unsub = subscribeMotionDebug(setMotionPaused);
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'm' || e.key === 'M') {
        const next = !getDebugMotionDisabled();
        setDebugMotionDisabled(next);
        setOfflineToastMessage(
          next ? 'Motion Debug: Animations Paused (Press M)' : 'Motion Debug: Animations Active'
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unsub();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Connect real navigator.onLine events + animate offline badge and toast
  const triggerOfflineFeedback = (msg: string) => {
    setOfflineToastMessage(msg);
    if (!isMotionDisabled() && offlineBadgeRef.current) {
      gsap.fromTo(
        offlineBadgeRef.current,
        { scale: 0.9 },
        { scale: 1, duration: 0.55, ease: 'expo.out' }
      );
    }
  };

  useEffect(() => {
    const onOnline = () => {
      setBrowserOnline(true);
      triggerOfflineFeedback('Network detected — Kavach remains 100% On-Device.');
    };
    const onOffline = () => {
      setBrowserOnline(false);
      triggerOfflineFeedback('● Offline — Still here. Nothing left your device.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Animate toast slide-in & auto-dismiss
  useEffect(() => {
    if (!offlineToastMessage) return;
    if (toastRef.current && !isMotionDisabled()) {
      gsap.fromTo(
        toastRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }
      );
    }
    const timer = setTimeout(() => setOfflineToastMessage(null), 3600);
    return () => clearTimeout(timer);
  }, [offlineToastMessage]);

  // Sync dark mode and palette attribute on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-palette', 'soundwaves');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-palette', palette);
    }
  }, [settings.theme, palette]);

  // GSAP route transition: accent panel wipe + content fade/slide
  useEffect(() => {
    pageTransition(mainViewportRef.current, wipeCurtainRef.current);
    setTimeout(() => ScrollTrigger.refresh(), 120);
  }, [location.pathname]);

  // Use GSAP Flip when collapsing/expanding sidebar
  const handleToggleSidebar = () => {
    if (isMotionDisabled() || !layoutBodyRef.current) {
      setSidebarOpen((v) => !v);
      return;
    }
    const state = Flip.getState(layoutBodyRef.current.children);
    setSidebarOpen((v) => !v);
    requestAnimationFrame(() => {
      Flip.from(state, {
        duration: 0.55,
        ease: 'power3.inOut',
      });
    });
  };

  const cyclePalette = async () => {
    const order: PosterPalette[] = ['journal', 'festival', 'soundwaves', 'momentum'];
    const next = order[(order.indexOf(palette) + 1) % order.length];
    setPalette(next);
    if (next === 'soundwaves') {
      await db.settings.put({ ...settings, theme: 'dark' });
    } else if (settings.theme === 'dark') {
      await db.settings.put({ ...settings, theme: 'light' });
    }
  };

  const toggleTheme = async () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    await db.settings.put({ ...settings, theme: next });
  };

  const toggleSimulateOffline = async () => {
    const nextOffline = !settings.simulateOffline;
    await db.settings.put({
      ...settings,
      simulateOffline: nextOffline,
    });
    triggerOfflineFeedback(
      nextOffline
        ? '● Offline — Still here. Nothing left your device.'
        : 'Offline Simulation Unlocked — Still running 100% On-Device.'
    );
  };

  const isEffectivelyOffline = !browserOnline || settings.simulateOffline;

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  const startRename = (conv: Conversation) => {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const saveRename = async (id: string) => {
    if (editingTitle.trim()) {
      await db.conversations.update(id, {
        title: editingTitle.trim(),
        updatedAt: Date.now(),
      });
    }
    setEditingConvId(null);
  };

  const confirmDeleteConversation = async (id: string) => {
    await db.transaction('rw', [db.conversations, db.messages], async () => {
      await db.messages.where('conversationId').equals(id).delete();
      await db.conversations.delete(id);
    });
    setDeletingConvId(null);
    const remaining = await db.conversations.orderBy('updatedAt').reverse().toArray();
    if (remaining.length > 0) {
      onSelectConversation(remaining[0].id);
    } else {
      onNewConversation();
    }
  };

  const navItems = [
    { to: '/', label: '01 · Poster', icon: Compass },
    { to: '/onboarding', label: '02 · Engine', icon: Cpu },
    { to: '/dashboard', label: '03 · Bento', icon: LayoutGrid },
    { to: '/chat', label: '04 · Agent Chat', icon: MessageSquare },
    { to: '/knowledge', label: '05 · Knowledge', icon: BookOpen },
    { to: '/tools', label: '06 · Tools', icon: Wrench },
    { to: '/settings', label: '07 · Settings', icon: Settings },
  ];

  const topBarLinks = [
    { to: '/', label: 'Issue 01' },
    { to: '/dashboard', label: 'Bento' },
    { to: '/chat', label: 'Agent' },
    { to: '/knowledge', label: 'Vault' },
  ];

  const mobileNavItems = [
    { to: '/dashboard', label: 'Home', icon: LayoutGrid },
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/knowledge', label: 'Docs', icon: BookOpen },
    { to: '/tools', label: 'Tools', icon: Wrench },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const paletteLabel: Record<PosterPalette, string> = {
    journal: 'D: Journal',
    festival: 'A: Festival',
    soundwaves: 'B: Sound Waves',
    momentum: 'C: Momentum',
  };

  return (
    <div className="min-h-screen flex flex-col">
      <CustomCursor />

      {/* Accent Page Transition Wipe Curtain */}
      <div
        ref={wipeCurtainRef}
        aria-hidden="true"
        style={{ transform: 'scaleX(0)' }}
        className="fixed inset-0 z-40 pointer-events-none bg-[var(--accent-primary)]"
      />

      {/* Thin Top Nav */}
      <header className="sticky top-0 z-30 px-4 sm:px-7 py-3 border-b kavach-divider bg-[var(--bg-page)]/95 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleToggleSidebar}
            aria-label="Toggle Workspace Sidebar"
            className="p-2 rounded-xl border kavach-divider hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>

          <NavLink
            to="/"
            className="text-2xl font-display-bebas tracking-wider leading-none flex items-center gap-1.5"
          >
            <span>KAVACH</span>
            <SparkleFourPoint className="w-3.5 h-3.5" />
          </NavLink>

          {/* Required Top Badge: "● Local · Ollama" or "● Offline · Browser" */}
          <button
            ref={offlineBadgeRef}
            type="button"
            onClick={toggleSimulateOffline}
            title={
              isEffectivelyOffline
                ? 'Air-Gap Lock Active — Click to toggle'
                : 'Click to toggle Air-Gap Lock (Offline Simulation)'
            }
            className="px-3 py-1 rounded-full border kavach-divider bg-[var(--bg-card)] text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span className="kavach-accent-text text-[10px] leading-none">●</span>
            <span className="text-[11px] tracking-wide">
              {providerManager.getTopBarBadgeText(settings.providerMode || 'auto')}
            </span>
          </button>
        </div>

        {/* Center Nav Links with Underline Wipe */}
        <nav className="hidden lg:flex items-center gap-7 text-xs uppercase tracking-[0.18em] font-medium">
          {topBarLinks.map((lnk) => (
            <NavLink
              key={lnk.to}
              to={lnk.to}
              end={lnk.to === '/'}
              className={({ isActive }) =>
                `group relative py-1 transition-opacity whitespace-nowrap ${
                  isActive ? 'kavach-accent-text font-bold' : 'opacity-75 hover:opacity-100'
                }`
              }
            >
              <span>{lnk.label}</span>
              <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[var(--accent-primary)] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            </NavLink>
          ))}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 60);
            }}
            aria-label="Search Local Vault"
            className="p-2 rounded-full border kavach-divider hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
            title="Search local conversation vault"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={cyclePalette}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border kavach-divider bg-[var(--bg-card)] text-[11px] font-mono cursor-pointer"
            title="Switch between the 4 curated 3-color poster palettes"
          >
            <Palette className="w-3.5 h-3.5 kavach-accent-text" />
            <span>{paletteLabel[palette]}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Light/Dark Mode"
            className="p-2 rounded-full border kavach-divider bg-[var(--bg-card)] cursor-pointer"
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="px-4 py-1.5 rounded-full kavach-btn-accent text-xs font-semibold tracking-wide uppercase cursor-pointer whitespace-nowrap"
          >
            Launch Agent
          </button>
        </div>
      </header>

      {/* Workspace Body with GSAP Flip Support */}
      <div ref={layoutBodyRef} className="flex-1 flex flex-col md:flex-row min-w-0">
        {sidebarOpen && (
          <aside className="hidden md:flex md:w-[264px] shrink-0 flex-col justify-between border-r kavach-divider p-5 select-none">
            <div className="space-y-6">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.18em] opacity-70 pb-3 border-b kavach-divider">
                <span>INDEX // 01–07</span>
                <span>LOCAL VAULT</span>
              </div>

              <nav className="space-y-1" aria-label="Main Navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-[0.12em] font-semibold transition-colors whitespace-nowrap ${
                          isActive
                            ? 'kavach-btn-accent shadow-xs'
                            : 'hover:bg-[var(--bg-card)] opacity-80 hover:opacity-100'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              {/* Conversation History List */}
              <div className="pt-4 border-t kavach-divider space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.16em] opacity-75">
                    History ({conversations.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onNewConversation();
                      if (location.pathname !== '/chat') navigate('/chat');
                    }}
                    className="px-2.5 py-1 rounded-full kavach-btn-accent text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Filter local threads..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl bg-[var(--bg-card)] border kavach-divider focus:outline-none"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  {filteredConversations.map((conv) => {
                    const isSelected =
                      conv.id === activeConversationId && location.pathname === '/chat';
                    return (
                      <div
                        key={conv.id}
                        className={`group rounded-xl px-2.5 py-2 text-xs transition-colors flex items-center justify-between gap-1 ${
                          isSelected
                            ? 'bg-[var(--bg-card)] border kavach-divider font-semibold'
                            : 'hover:bg-[var(--bg-card)]/60 opacity-80'
                        }`}
                      >
                        {editingConvId === conv.id ? (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename(conv.id);
                                if (e.key === 'Escape') setEditingConvId(null);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 px-1.5 py-0.5 text-xs rounded bg-[var(--bg-page)] border kavach-divider"
                            />
                            <button
                              type="button"
                              onClick={() => saveRename(conv.id)}
                              className="p-1 kavach-accent-text"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingConvId(null)}
                              className="p-1 opacity-60"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectConversation(conv.id);
                                if (location.pathname !== '/chat') navigate('/chat');
                              }}
                              className="flex-1 text-left truncate cursor-pointer"
                            >
                              {conv.title}
                            </button>
                            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => startRename(conv)}
                                className="p-1 opacity-70 hover:opacity-100"
                                title="Rename"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingConvId(conv.id)}
                                className="p-1 opacity-70 hover:opacity-100 kavach-accent-text"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t kavach-divider space-y-1.5 text-[11px] font-mono opacity-75">
              <div className="flex items-center justify-between">
                <span>MODEL</span>
                <span className="truncate max-w-[130px]">
                  {settings.selectedModel.replace('-q4f16_1-MLC', '')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>MOTION [KEY: M]</span>
                <span>{motionPaused ? 'PAUSED' : '60FPS GSAP'}</span>
              </div>
            </div>
          </aside>
        )}

        {/* Animated Route Viewport */}
        <main
          ref={mainViewportRef}
          className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0"
        >
          {children}
        </main>
      </div>

      {/* Slide-in Offline / System Toast */}
      {offlineToastMessage && (
        <div
          ref={toastRef}
          className="fixed bottom-16 md:bottom-6 right-6 z-50 kavach-card px-4 py-3 text-xs font-mono flex items-center gap-2.5 shadow-lg border border-[var(--accent-primary)]"
        >
          <span className="kavach-accent-text font-bold">●</span>
          <span>{offlineToastMessage}</span>
        </div>
      )}

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t kavach-divider bg-[var(--bg-card)] grid grid-cols-5 py-1.5 px-2"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-medium transition-colors ${
                  isActive ? 'kavach-btn-accent' : 'opacity-75'
                }`
              }
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Delete Confirmation Modal */}
      {deletingConvId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="kavach-card max-w-sm w-full p-6 space-y-4">
            <h3 className="text-2xl font-display-bebas">Delete Local Thread?</h3>
            <p className="text-sm opacity-85 leading-relaxed">
              This will permanently remove this conversation and its messages from your local IndexedDB vault.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingConvId(null)}
                className="px-4 py-2 rounded-xl border kavach-divider text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteConversation(deletingConvId)}
                className="px-4 py-2 rounded-xl kavach-btn-accent text-xs font-medium"
              >
                Delete Thread
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
