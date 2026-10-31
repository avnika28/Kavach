import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGSAP } from '@gsap/react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  HardDrive,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { db, DEFAULT_SETTINGS } from '../store/db';
import {
  KAVACH_MODELS,
  type DownloadProgressState,
  type WebGPUCheckResult,
} from '../lib/llm/types';
import { llmProvider } from '../lib/llm/webllmProvider';
import {
  PosterStarburst,
  CircleExploreCTA,
  SideNumberRail,
} from '../components/PosterVisuals';
import {
  gsap,
  staggerIn,
  prefersReducedMotion,
  drawSvgPath,
  bindCard3DTilt,
} from '../lib/animations';

export const OnboardingScreen: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const progressCircleRef = useRef<SVGCircleElement>(null);
  const checkmarkPathRef = useRef<SVGPathElement>(null);

  const settings = useLiveQuery(() => db.settings.get('global')) || DEFAULT_SETTINGS;

  const [selectedModelId, setSelectedModelId] = useState<string>(
    settings.selectedModel || KAVACH_MODELS[0].id
  );
  const [gpuCheck, setGpuCheck] = useState<WebGPUCheckResult | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadProgressState>(
    llmProvider.getStatus()
  );
  const [showFixGuide, setShowFixGuide] = useState<boolean>(false);

  useEffect(() => {
    llmProvider.checkWebGPU().then((res) => {
      setGpuCheck(res);
    });
  }, []);

  useGSAP(
    () => {
      staggerIn('.onboarding-model-card', { stagger: 0.09, y: 20, duration: 0.75 });
      const cards = gsap.utils.toArray<HTMLElement>('.onboarding-model-card');
      return bindCard3DTilt(cards);
    },
    { scope: containerRef }
  );

  useEffect(() => {
    if (!progressCircleRef.current) return;
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const targetOffset =
      circumference * (1 - Math.min(1, Math.max(0, downloadState.progress)));

    if (prefersReducedMotion()) {
      progressCircleRef.current.style.strokeDashoffset = `${targetOffset}`;
      return;
    }

    gsap.to(progressCircleRef.current, {
      strokeDashoffset: targetOffset,
      duration: 0.55,
      ease: 'power3.out',
    });

    if (downloadState.status === 'ready' && checkmarkPathRef.current) {
      drawSvgPath(checkmarkPathRef.current, { duration: 0.65, delay: 0.15 });
    }
  }, [downloadState.progress, downloadState.status]);

  const handleSelectModel = async (modelId: string) => {
    setSelectedModelId(modelId);
    await db.settings.put({
      ...settings,
      selectedModel: modelId,
    });
  };

  const startModelInitialization = async (preferInstantLocal = false) => {
    try {
      await llmProvider.initModel(
        selectedModelId,
        (state) => {
          setDownloadState({ ...state });
        },
        preferInstantLocal
      );
      await db.settings.put({
        ...settings,
        selectedModel: selectedModelId,
        engineMode: preferInstantLocal ? 'local-instant' : 'webgpu',
        onboardingCompleted: true,
      });
    } catch {
      // Reflected in downloadState
    }
  };

  const handleSwitchToSmallerModel = async () => {
    const smaller = KAVACH_MODELS[2];
    await handleSelectModel(smaller.id);
    await startModelInitialization(false);
  };

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pctDisplay = Math.round((downloadState.progress || 0) * 100);

  return (
    <div ref={containerRef} className="flex min-h-full">
      <SideNumberRail activeIndex={2} />

      <div className="flex-1 max-w-6xl mx-auto w-full px-5 sm:px-10 py-10 space-y-10">
        {/* Expressive Poster Header */}
        <div className="relative border-b kavach-divider pb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-mono uppercase tracking-[0.2em] kavach-accent-text font-semibold">
              [02 // ON-DEVICE NEURAL PROVISIONING]
            </div>
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-poster leading-[0.88]">
              SELECT YOUR LOCAL BRAIN.
            </h1>
            <p className="font-editorial-label text-xl sm:text-2xl opacity-90 pt-1">
              Download once, works offline forever.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <PosterStarburst className="w-12 h-12" />
            <CircleExploreCTA
              label="Skip to Chat"
              onClick={() => navigate('/chat')}
            />
          </div>
        </div>

        {/* WebGPU Hardware Status Banner */}
        {gpuCheck && (
          <div className="kavach-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              {gpuCheck.supported ? (
                <CheckCircle2 className="w-5 h-5 kavach-accent-text shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 kavach-accent-text shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {gpuCheck.supported
                    ? 'WebGPU Hardware Acceleration Verified'
                    : 'WebGPU Not Detected in Current Browser Context'}
                </div>
                <p className="text-xs opacity-80 font-mono">{gpuCheck.adapterName}</p>
              </div>
            </div>

            {!gpuCheck.supported && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowFixGuide((v) => !v)}
                  className="px-3.5 py-2 rounded-full border kavach-divider text-xs font-medium cursor-pointer"
                >
                  {showFixGuide ? 'Hide Fix Steps' : 'How to Enable WebGPU'}
                </button>
                <button
                  type="button"
                  onClick={() => startModelInitialization(true)}
                  className="px-4 py-2 rounded-full kavach-btn-accent text-xs font-semibold cursor-pointer"
                >
                  Use Instant On-Device Engine
                </button>
              </div>
            )}
          </div>
        )}

        {/* WebGPU Fix Steps */}
        {gpuCheck && (!gpuCheck.supported || showFixGuide) && (
          <div className="kavach-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <h2 className="text-2xl font-poster">
                WEBGPU NOT SUPPORTED — DIAGNOSTIC &amp; FIX STEPS
              </h2>
              <span className="font-mono text-xs kavach-accent-text">
                navigator.gpu check
              </span>
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm leading-relaxed">
              <li>
                <strong>Enable Hardware Acceleration</strong>: Open Chrome/Brave Settings → System → Enable <code>Use graphics acceleration when available</code> and relaunch.
              </li>
              <li>
                <strong>Enable WebGPU Flag</strong>: Navigate to <code>chrome://flags/#enable-unsafe-webgpu</code>, set it to <strong>Enabled</strong>, and restart the browser.
              </li>
              <li>
                <strong>Linux / Vulkan Users</strong>: Launch Chromium with <code>--enable-features=Vulkan,UseSkiaRenderer</code>.
              </li>
              <li>
                <strong>Immediate Offline Fallback</strong>: Click <strong>Instant Ready Mode</strong> below to use Kavach&apos;s built-in local synthesis, RAG, and tool executor with zero GPU requirement.
              </li>
            </ol>
          </div>
        )}

        {/* Model Picker Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {KAVACH_MODELS.map((model, idx) => {
            const isSelected = selectedModelId === model.id;
            return (
              <div
                key={model.id}
                onClick={() => handleSelectModel(model.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSelectModel(model.id);
                }}
                className={`onboarding-model-card kavach-card p-6 flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-[var(--accent-primary)]'
                    : 'opacity-85 hover:opacity-100'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b kavach-divider pb-3">
                    <span className="font-mono text-xs uppercase tracking-[0.16em] font-semibold">
                      0{idx + 1} · {model.tier}
                    </span>
                    {model.recommended && (
                      <span className="text-[11px] font-mono uppercase tracking-wider kavach-accent-text font-bold">
                        Recommended
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-3xl font-poster tracking-wide">{model.name}</h3>
                    <p className="text-xs font-mono opacity-70 mt-0.5">{model.id}</p>
                  </div>

                  <p className="text-xs leading-relaxed opacity-85">{model.description}</p>
                </div>

                <div className="pt-5 mt-5 border-t kavach-divider space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Download Size</span>
                    <span>{model.downloadSizeLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Est. VRAM</span>
                    <span>{model.vramMB} MB</span>
                  </div>
                  <div className="pt-2">
                    <div
                      className={`w-full py-2.5 rounded-full text-center font-sans font-semibold text-xs uppercase tracking-wider transition-colors ${
                        isSelected
                          ? 'kavach-btn-accent'
                          : 'border kavach-divider'
                      }`}
                    >
                      {isSelected ? 'Selected Model' : 'Select Model'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real Download Progress Ring */}
        <div className="kavach-card p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-4 flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="opacity-15"
                />
                <circle
                  ref={progressCircleRef}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {downloadState.status === 'ready' ? (
                  <svg className="w-8 h-8 mb-0.5" viewBox="0 0 32 32" fill="none">
                    <path
                      ref={checkmarkPathRef}
                      d="M7 16.5L13.5 23L25 9.5"
                      stroke="var(--accent-primary)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-2xl font-mono font-semibold tabular-nums">
                    {pctDisplay}%
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wider opacity-70">
                  {downloadState.status === 'ready' ? 'Ready · 100%' : 'Cached'}
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs font-editorial-label italic text-center opacity-80">
              Download once, works offline forever
            </p>
          </div>

          <div className="md:col-span-8 space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider kavach-accent-text font-semibold">
                <HardDrive className="w-3.5 h-3.5" />
                <span>
                  {downloadState.status === 'ready'
                    ? '● Ready · Offline'
                    : downloadState.status === 'downloading'
                    ? 'Downloading & Caching Shaders...'
                    : 'On-Device Provisioning'}
                </span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-poster">
                {downloadState.status === 'ready'
                  ? 'MODEL CACHED & READY FOR AIR-GAPPED USE'
                  : `INITIALIZE ${selectedModelId}`}
              </h3>
              <p className="text-xs font-mono opacity-80 break-words">{downloadState.text}</p>
            </div>

            {downloadState.status === 'error' && (
              <div className="p-4 rounded-2xl border kavach-divider space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold kavach-accent-text">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Model Load Failure: {downloadState.errorMessage || 'WebGPU shader allocation failed.'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleSwitchToSmallerModel}
                    className="px-4 py-2 rounded-full kavach-btn-accent text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Smaller Model (SmolLM2 ~360M)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startModelInitialization(true)}
                    className="px-4 py-2 rounded-full border kavach-divider text-xs font-medium cursor-pointer"
                  >
                    Activate Instant On-Device Runtime
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {downloadState.status !== 'ready' ? (
                <>
                  <button
                    type="button"
                    disabled={downloadState.status === 'downloading'}
                    onClick={() => startModelInitialization(false)}
                    className="px-6 py-3 rounded-full kavach-btn-accent disabled:opacity-50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {downloadState.status === 'downloading'
                        ? 'Downloading Weights...'
                        : 'Download & Load via WebGPU'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startModelInitialization(true)}
                    className="px-6 py-3 rounded-full border kavach-divider hover:bg-[var(--bg-card)] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 kavach-accent-text" />
                    <span>Instant Ready Mode (Zero Download)</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/chat')}
                    className="px-6 py-3 rounded-full kavach-btn-accent text-xs font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                  >
                    <span>Enter Offline Chat</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="px-5 py-3 rounded-full border kavach-divider text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Open Bento Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
