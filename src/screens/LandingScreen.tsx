import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Cpu, Database, FileText, Terminal, CheckCircle2 } from 'lucide-react';
import { DiagonalSlash } from '../components/DiagonalSlash';
import { GhostText } from '../components/GhostText';
import {
  HeroPosterSculpture,
  PosterStarburst,
  SparkleFourPoint,
  CircleExploreCTA,
  SideNumberRail,
} from '../components/PosterVisuals';
import {
  gsap,
  ScrollTrigger,
  isMotionDisabled,
  wipeIn,
  revealText,
  fadeUp,
  magneticHover,
  bindCard3DTilt,
  countUp,
} from '../lib/animations';

interface LandingScreenProps {
  preloaderComplete?: boolean;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  preloaderComplete = true,
}) => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const slashRef = useRef<HTMLDivElement>(null);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const sculptureRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  // Pinned Scroll Storytelling refs
  const storyPinSectionRef = useRef<HTMLDivElement>(null);
  const storyProgressPathRef = useRef<SVGLineElement>(null);
  const [activeStoryStep, setActiveStoryStep] = useState<number>(0);

  // Offline Moment refs
  const offlineSectionRef = useRef<HTMLDivElement>(null);
  const wifiBar1Ref = useRef<SVGPathElement>(null);
  const wifiBar2Ref = useRef<SVGPathElement>(null);
  const wifiBar3Ref = useRef<SVGPathElement>(null);
  const [offlineBadgeTriggered, setOfflineBadgeTriggered] = useState<boolean>(false);
  const [typedOfflineDemo, setTypedOfflineDemo] = useState<string>('');

  // Marquee + Stat Counters refs
  const marqueeTrackRef = useRef<HTMLDivElement>(null);
  const statCloudRef = useRef<HTMLSpanElement>(null);
  const statOnDeviceRef = useRef<HTMLSpanElement>(null);
  const statAccountsRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!preloaderComplete || !rootRef.current) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (isMotionDisabled()) return;

        // 1. Diagonal slash wipes in
        if (slashRef.current) {
          wipeIn(slashRef.current, { duration: 1.05, delay: 0.05 });
        }

        // 2. HERO: Headline lines reveal from masks (stagger 0.06)
        revealText('.hero-line-inner', { stagger: 0.06, duration: 1.0, delay: 0.08 });

        // Hero visual enters with scale 1.15 -> 1 + slight rotation settle
        if (sculptureRef.current) {
          gsap.fromTo(
            sculptureRef.current,
            { opacity: 0, scale: 1.15, rotate: -9 },
            {
              opacity: 1,
              scale: 1,
              rotate: 0,
              duration: 1.25,
              delay: 0.12,
              ease: 'expo.out',
            }
          );
        }

        // Decorative starbursts and orbit rings rotate slowly forever
        gsap.to('.continuous-spin-starburst', {
          rotation: 360,
          duration: 24,
          repeat: -1,
          ease: 'none',
        });

        gsap.to('.hero-orbit-ring', {
          rotation: -360,
          transformOrigin: '280px 280px',
          duration: 36,
          repeat: -1,
          ease: 'none',
        });

        // Sub-text and CTAs fade up
        fadeUp('.hero-fade-item', { y: 20, duration: 0.85, delay: 0.28 });

        // Chat mockup rises and settles into its editorial tilt
        if (mockupRef.current) {
          gsap.fromTo(
            mockupRef.current,
            { opacity: 0, y: 42, rotate: 0 },
            {
              opacity: 1,
              y: 0,
              rotate: -1.5,
              duration: 1.1,
              delay: 0.34,
              ease: 'expo.out',
            }
          );
        }

        // 3. SCROLL STORYTELLING ("HOW IT WORKS" — pinned, scrub, DrawSVG progress line, ghost words horizontal)
        if (storyPinSectionRef.current) {
          ScrollTrigger.create({
            trigger: storyPinSectionRef.current,
            start: 'top top',
            end: '+=1600',
            pin: true,
            scrub: 0.6,
            onUpdate: (self) => {
              const p = self.progress;
              if (p < 0.34) setActiveStoryStep(0);
              else if (p < 0.68) setActiveStoryStep(1);
              else setActiveStoryStep(2);

              if (storyProgressPathRef.current) {
                const offset = 300 * (1 - p);
                storyProgressPathRef.current.style.strokeDashoffset = `${offset}`;
              }
            },
          });

          gsap.to('.story-ghost-word-left', {
            xPercent: -22,
            ease: 'none',
            scrollTrigger: {
              trigger: storyPinSectionRef.current,
              start: 'top bottom',
              end: '+=2000',
              scrub: 1,
            },
          });

          gsap.to('.story-ghost-word-right', {
            xPercent: 22,
            ease: 'none',
            scrollTrigger: {
              trigger: storyPinSectionRef.current,
              start: 'top bottom',
              end: '+=2000',
              scrub: 1,
            },
          });
        }

        // 4. THE OFFLINE MOMENT ("TURN OFF YOUR WIFI." — bars switch off 1 by 1, badge changes, scripted typing)
        if (offlineSectionRef.current) {
          const targetSentence = 'Still here. Nothing left your device.';
          const tlOffline = gsap.timeline({
            scrollTrigger: {
              trigger: offlineSectionRef.current,
              start: 'top 68%',
              once: true,
            },
          });

          tlOffline
            .to(wifiBar3Ref.current, { opacity: 0.12, duration: 0.35, ease: 'power3.out' })
            .to(wifiBar2Ref.current, { opacity: 0.12, duration: 0.35, ease: 'power3.out' })
            .to(wifiBar1Ref.current, {
              opacity: 0.12,
              duration: 0.35,
              ease: 'power3.out',
              onComplete: () => setOfflineBadgeTriggered(true),
            })
            .to(
              { charCount: 0 },
              {
                charCount: targetSentence.length,
                duration: 1.25,
                ease: 'none',
                onUpdate: function () {
                  const len = Math.round(this.targets()[0].charCount);
                  setTypedOfflineDemo(targetSentence.slice(0, len));
                },
              }
            );
        }

        // 5. MARQUEE + COUNTERS (infinite marquee reacting to scroll velocity + stat countUp)
        if (marqueeTrackRef.current) {
          const marqueeTween = gsap.to(marqueeTrackRef.current, {
            xPercent: -50,
            duration: 18,
            repeat: -1,
            ease: 'none',
          });

          ScrollTrigger.create({
            onUpdate: (self) => {
              const velocityBoost = Math.min(4.5, 1 + Math.abs(self.getVelocity()) / 600);
              gsap.to(marqueeTween, {
                timeScale: velocityBoost,
                duration: 0.25,
                overwrite: true,
              });
            },
          });
        }

        ScrollTrigger.create({
          trigger: '.stats-counter-section',
          start: 'top 82%',
          once: true,
          onEnter: () => {
            countUp(statCloudRef.current, 0, { duration: 0.9 });
            countUp(statOnDeviceRef.current, 100, { suffix: '%', duration: 1.1 });
            countUp(statAccountsRef.current, 0, { duration: 0.9 });
          },
        });

        // 6. Feature Cards staggered fade-up on enter
        const featureCards = gsap.utils.toArray<HTMLElement>('.feature-editorial-card');
        if (featureCards.length > 0) {
          gsap.fromTo(
            featureCards,
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.85,
              stagger: 0.1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: '.features-grid-section',
                start: 'top 82%',
                once: true,
              },
            }
          );
        }

        // 7. Section Dividers draw from 0 to 100% width
        const dividers = gsap.utils.toArray<HTMLElement>('.animated-divider-line');
        dividers.forEach((line) => {
          gsap.fromTo(
            line,
            { scaleX: 0, transformOrigin: 'left center' },
            {
              scaleX: 1,
              duration: 1.0,
              ease: 'expo.out',
              scrollTrigger: {
                trigger: line,
                start: 'top 88%',
                once: true,
              },
            }
          );
        });
      });

      // Desktop-only Mouse-Move Parallax on Hero + 3D Card Tilt
      let cleanupMouseMove = () => {};
      let cleanupTilt = () => {};

      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const layer1X = gsap.quickTo('.hero-depth-layer-1', 'x', {
          duration: 0.6,
          ease: 'power3.out',
        });
        const layer1Y = gsap.quickTo('.hero-depth-layer-1', 'y', {
          duration: 0.6,
          ease: 'power3.out',
        });
        const layer2X = gsap.quickTo('.hero-depth-layer-2', 'x', {
          duration: 0.6,
          ease: 'power3.out',
        });
        const layer2Y = gsap.quickTo('.hero-depth-layer-2', 'y', {
          duration: 0.6,
          ease: 'power3.out',
        });
        const headX = headlineRef.current
          ? gsap.quickTo(headlineRef.current, 'x', { duration: 0.65, ease: 'power3.out' })
          : null;
        const headY = headlineRef.current
          ? gsap.quickTo(headlineRef.current, 'y', { duration: 0.65, ease: 'power3.out' })
          : null;

        const onMove = (e: MouseEvent) => {
          if (isMotionDisabled()) return;
          const nx = (e.clientX / window.innerWidth - 0.5) * 2;
          const ny = (e.clientY / window.innerHeight - 0.5) * 2;
          layer1X(nx * 18);
          layer1Y(ny * 18);
          layer2X(nx * 32);
          layer2Y(ny * 32);
          if (headX && headY) {
            headX(nx * -10);
            headY(ny * -6);
          }
        };

        window.addEventListener('mousemove', onMove, { passive: true });
        cleanupMouseMove = () => window.removeEventListener('mousemove', onMove);

        const tiltCards = gsap.utils.toArray<HTMLElement>('.feature-editorial-card');
        cleanupTilt = bindCard3DTilt(tiltCards);
      });

      const cleanMagnetic1 = magneticHover(ctaBtnRef.current, 10);

      return () => {
        cleanMagnetic1();
        cleanupMouseMove();
        cleanupTilt();
        mm.revert();
      };
    },
    { scope: rootRef, dependencies: [preloaderComplete] }
  );

  const storySteps = [
    {
      num: '01',
      title: 'DOWNLOAD ONCE',
      subtitle: 'WebGPU Weights Cached in Browser',
      description:
        'Select Llama-3.2-1B-Instruct (q4) or SmolLM2. Weights download once into your local IndexedDB & Cache Storage—no account, no API key, no subscription.',
      deviceStatus: 'SHADER CACHE: 100% READY · 680 MB STORED LOCALLY',
    },
    {
      num: '02',
      title: 'ADD DOCUMENTS',
      subtitle: 'Private Local PDF & Markdown RAG',
      description:
        'Drop sensitive contracts, research papers, or journals. Parsed locally via pdf.js and embedded into 384-d vectors in a background Web Worker.',
      deviceStatus: 'VECTOR INDEX: 384-D COSINE SIMILARITY · AIR-GAPPED',
    },
    {
      num: '03',
      title: 'ASK ANYTHING',
      subtitle: 'Streaming Chat + Local JSON Tool Actions',
      description:
        'Query your knowledge base with verifiable citations, or instruct Kavach to create notes, schedule tasks, and evaluate math with one-click Undo.',
      deviceStatus: 'INFERENCE: STREAMING ON-DEVICE · 0 BYTES TO CLOUD',
    },
  ];

  const features = [
    {
      index: '01',
      label: 'WEBGPU LOCAL INFERENCE',
      title: 'IN-BROWSER NEURAL EXECUTION',
      description:
        'Runs Llama-3.2-1B-Instruct q4 inside a dedicated Web Worker using @mlc-ai/web-llm. Zero API keys, zero cloud servers, zero per-token billing.',
      icon: Cpu,
    },
    {
      index: '02',
      label: 'PRIVATE VECTOR RAG',
      title: 'ON-DEVICE DOCUMENT VAULT',
      description:
        'Drop PDFs, Markdown, or text notes. Parsed locally via pdf.js and embedded with all-MiniLM-L6-v2 into IndexedDB with verifiable source citations.',
      icon: FileText,
    },
    {
      index: '03',
      label: 'DETERMINISTIC ACTIONS',
      title: 'LOCAL JSON TOOL CALLING',
      description:
        'Creates notes, schedules tasks, sets reminders, and evaluates calculations directly in IndexedDB—complete with schema repair and one-click Undo.',
      icon: Terminal,
    },
    {
      index: '04',
      label: 'PERSISTENT SOVEREIGNTY',
      title: 'INDEXEDDB MEMORY & PWA',
      description:
        'Full conversation history, personal memory facts, and cached model shaders persist across refreshes and work with your network hardware disabled.',
      icon: Database,
    },
  ];

  return (
    <div ref={rootRef} className="relative overflow-hidden flex">
      <SideNumberRail activeIndex={1} />

      <div className="flex-1 min-w-0">
        {/* HERO SECTION */}
        <section className="relative pt-6 pb-16 md:pt-10 md:pb-24 px-5 sm:px-10 max-w-7xl mx-auto">
          <div className="hero-fade-item flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b kavach-divider text-[11px] font-mono uppercase tracking-[0.2em]">
            <span className="flex items-center gap-2">
              <SparkleFourPoint className="w-3.5 h-3.5" />
              <span>VOL. 01 — SOVEREIGN PERSONAL AI MANIFESTO</span>
            </span>
            <span>100% ON-DEVICE · WEBGPU · ZERO TELEMETRY</span>
          </div>

          <div className="relative py-4 md:py-8">
            <div
              ref={sculptureRef}
              className="w-[260px] h-[260px] sm:w-[370px] sm:h-[370px] lg:w-[450px] lg:h-[450px] mx-auto lg:mx-0 lg:absolute lg:right-6 lg:-top-4 z-10 pointer-events-none"
            >
              <HeroPosterSculpture />
            </div>

            <PosterStarburst className="hidden sm:block w-14 h-14 absolute right-4 top-2 z-20" />

            <h1
              ref={headlineRef}
              className="relative z-20 font-poster text-[15vw] sm:text-[12.5vw] lg:text-[10.2vw] leading-[0.84] tracking-tight uppercase select-none"
            >
              <span className="block overflow-hidden">
                <span className="hero-line-inner block">YOUR AI.</span>
              </span>
              <span className="block overflow-hidden">
                <span className="hero-line-inner block kavach-accent-text">
                  YOUR DEVICE.
                </span>
              </span>
            </h1>
          </div>

          <div className="my-4">
            <DiagonalSlash ref={slashRef} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end pt-6">
            <div className="lg:col-span-7 space-y-6">
              <div className="hero-fade-item flex items-center gap-3 text-xs font-mono uppercase tracking-[0.2em] opacity-75">
                <span>[01 // ARCHITECTURE]</span>
                <span>·</span>
                <span>AIR-GAPPED PERSONAL INTELLIGENCE</span>
              </div>

              <p className="hero-fade-item font-editorial-label text-2xl sm:text-3xl leading-snug max-w-xl">
                Works without internet. Your data never leaves this device.
              </p>

              <div className="hero-fade-item flex flex-wrap items-center gap-6 pt-2">
                <button
                  ref={ctaBtnRef}
                  type="button"
                  onClick={() => navigate('/onboarding')}
                  className="px-8 py-4 rounded-full kavach-btn-accent font-semibold text-sm uppercase tracking-[0.14em] flex items-center gap-3 shadow-md cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <CircleExploreCTA
                  label="Explore now"
                  onClick={() => navigate('/chat')}
                />
              </div>
            </div>

            <div className="lg:col-span-5">
              <div
                ref={mockupRef}
                data-cursor="OPEN"
                onClick={() => navigate('/chat')}
                className="kavach-card p-6 space-y-4 cursor-pointer"
              >
                <div className="flex items-center justify-between pb-3 border-b kavach-divider text-xs font-mono">
                  <span className="uppercase tracking-wider font-semibold">
                    KAVACH // LLAMA-3.2-1B
                  </span>
                  <span className="kavach-accent-text font-semibold">
                    ● 0 B CLOUD TRAFFIC
                  </span>
                </div>

                <div className="flex justify-end">
                  <div className="kavach-user-bubble px-4 py-3 text-xs max-w-[85%] leading-relaxed font-medium">
                    Summarize my Q4 architecture notes and add a high priority task to verify the offline backup.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--bg-page)] border kavach-divider space-y-2 text-xs">
                  <div className="font-mono text-[11px] uppercase tracking-wider kavach-accent-text font-semibold">
                    Kavach · On-Device Synthesis
                  </div>
                  <p className="leading-relaxed">
                    Your Q4 notes prioritize replacing cloud telemetry with IndexedDB metrics and running <strong>Llama-3.2-1B q4</strong> for sub-40ms local latency.
                  </p>
                  <div className="pt-2 border-t kavach-divider flex items-center justify-between text-[11px] font-mono">
                    <span>TOOL: add_task (Executed)</span>
                    <span className="underline kavach-accent-text">Undo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SIGNATURE MOMENT 7: INFINITE VELOCITY MARQUEE + STAT COUNTERS */}
        <section className="border-y kavach-divider py-5 overflow-hidden select-none bg-[var(--bg-card)]/60">
          <div
            ref={marqueeTrackRef}
            className="flex items-center gap-10 whitespace-nowrap w-max font-poster text-4xl sm:text-6xl tracking-wide"
          >
            {[0, 1, 2, 3].map((rep) => (
              <div key={rep} className="flex items-center gap-10">
                <span>PRIVATE</span>
                <span className="kavach-accent-text">•</span>
                <span>OFFLINE</span>
                <span className="kavach-accent-text">•</span>
                <span>YOURS</span>
                <span className="kavach-accent-text">•</span>
                <span>ON-DEVICE</span>
                <span className="kavach-accent-text">•</span>
              </div>
            ))}
          </div>
        </section>

        <section className="stats-counter-section max-w-7xl mx-auto px-5 sm:px-10 py-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="kavach-card p-6 flex items-baseline justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.18em] opacity-70">
                EXTERNAL TELEMETRY
              </div>
              <div className="text-sm font-semibold mt-1">Cloud API Calls</div>
            </div>
            <span
              ref={statCloudRef}
              className="font-poster text-6xl kavach-accent-text tabular-nums"
            >
              0
            </span>
          </div>

          <div className="kavach-card p-6 flex items-baseline justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.18em] opacity-70">
                EXECUTION RESIDENCY
              </div>
              <div className="text-sm font-semibold mt-1">On-Device Inference</div>
            </div>
            <span
              ref={statOnDeviceRef}
              className="font-poster text-6xl kavach-accent-text tabular-nums"
            >
              100%
            </span>
          </div>

          <div className="kavach-card p-6 flex items-baseline justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.18em] opacity-70">
                IDENTITY LOCK-IN
              </div>
              <div className="text-sm font-semibold mt-1">Accounts Required</div>
            </div>
            <span
              ref={statAccountsRef}
              className="font-poster text-6xl kavach-accent-text tabular-nums"
            >
              0
            </span>
          </div>
        </section>

        {/* SIGNATURE MOMENT 5: PINNED SCROLL STORYTELLING ("HOW IT WORKS") */}
        <section
          ref={storyPinSectionRef}
          className="relative min-h-screen flex flex-col justify-center px-5 sm:px-10 py-16 max-w-7xl mx-auto overflow-hidden"
        >
          {/* Horizontal Moving Ghost Words */}
          <div
            aria-hidden="true"
            className="story-ghost-word-left absolute top-8 left-0 ghost-outline-text text-[7rem] sm:text-[11rem] whitespace-nowrap"
          >
            DOWNLOAD ONCE · WORK FOREVER
          </div>
          <div
            aria-hidden="true"
            className="story-ghost-word-right absolute bottom-6 right-0 ghost-outline-text text-[7rem] sm:text-[11rem] whitespace-nowrap"
          >
            LOCAL VECTOR VAULT · WEBGPU
          </div>

          <div className="relative z-10 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b kavach-divider pb-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-[0.2em] kavach-accent-text font-semibold">
                  [02 // SCROLL STORYTELLING]
                </span>
                <h2 className="text-4xl sm:text-6xl font-poster mt-1">
                  HOW IT WORKS
                </h2>
              </div>

              {/* DrawSVG Thin Progress Line */}
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs uppercase tracking-widest">
                  STEP 0{activeStoryStep + 1} / 03
                </span>
                <svg width="160" height="8" viewBox="0 0 300 8" className="overflow-visible">
                  <line
                    x1="0"
                    y1="4"
                    x2="300"
                    y2="4"
                    stroke="var(--border-hairline)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <line
                    ref={storyProgressPathRef}
                    x1="0"
                    y1="4"
                    x2="300"
                    y2="4"
                    stroke="var(--accent-primary)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="300"
                    strokeDashoffset="200"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: 3 Steps Crossfade List */}
              <div className="lg:col-span-6 space-y-4">
                {storySteps.map((st, idx) => {
                  const isActive = idx === activeStoryStep;
                  return (
                    <div
                      key={st.num}
                      onClick={() => setActiveStoryStep(idx)}
                      className={`kavach-card p-6 transition-all duration-500 cursor-pointer ${
                        isActive
                          ? 'opacity-100 ring-2 ring-[var(--accent-primary)] translate-x-1'
                          : 'opacity-45 hover:opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.18em] mb-1">
                        <span className="kavach-accent-text font-bold">
                          STEP {st.num}
                        </span>
                        <span>{st.subtitle}</span>
                      </div>
                      <h3 className="text-3xl font-poster tracking-wide">{st.title}</h3>
                      <p className="text-xs sm:text-sm leading-relaxed opacity-85 mt-1.5">
                        {st.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Right: Dynamic Device Illustration Changing State Each Step */}
              <div className="lg:col-span-6">
                <div className="kavach-card p-8 space-y-6">
                  <div className="flex items-center justify-between border-b kavach-divider pb-3 text-xs font-mono">
                    <span>LOCAL DEVICE STATE // STEP 0{activeStoryStep + 1}</span>
                    <span className="kavach-accent-text font-bold">● ISOLATED</span>
                  </div>

                  {/* Step-specific SVG Device Diagram */}
                  <div className="h-56 rounded-2xl bg-[var(--bg-page)] border kavach-divider flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <svg viewBox="0 0 280 120" className="w-64 h-28">
                      <rect
                        x="20"
                        y="12"
                        width="240"
                        height="96"
                        rx="16"
                        fill="var(--bg-card)"
                        stroke="var(--text-primary)"
                        strokeWidth="2"
                      />
                      {activeStoryStep === 0 && (
                        <>
                          <circle
                            cx="80"
                            cy="60"
                            r="26"
                            stroke="var(--accent-primary)"
                            strokeWidth="5"
                            fill="none"
                          />
                          <path
                            d="M72 60L78 66L90 52"
                            stroke="var(--accent-primary)"
                            strokeWidth="3"
                            fill="none"
                            strokeLinecap="round"
                          />
                          <rect x="124" y="42" width="110" height="12" rx="6" fill="var(--accent-primary)" />
                          <rect x="124" y="64" width="80" height="10" rx="5" fill="var(--text-primary)" opacity="0.3" />
                        </>
                      )}
                      {activeStoryStep === 1 && (
                        <>
                          <rect x="46" y="34" width="44" height="52" rx="6" fill="var(--accent-primary)" />
                          <path d="M106 60H154" stroke="var(--text-primary)" strokeWidth="2" strokeDasharray="4 4" />
                          <circle cx="196" cy="44" r="10" fill="var(--secondary-solid)" />
                          <circle cx="222" cy="64" r="10" fill="var(--accent-primary)" />
                          <circle cx="188" cy="78" r="10" fill="var(--secondary-solid)" />
                        </>
                      )}
                      {activeStoryStep === 2 && (
                        <>
                          <rect x="42" y="32" width="130" height="22" rx="10" fill="var(--accent-primary)" />
                          <rect x="96" y="62" width="142" height="26" rx="10" fill="var(--secondary-solid)" />
                        </>
                      )}
                    </svg>

                    <div className="font-mono text-xs uppercase tracking-wider kavach-accent-text font-semibold">
                      {storySteps[activeStoryStep].deviceStatus}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SIGNATURE MOMENT 6: THE OFFLINE MOMENT ("TURN OFF YOUR WIFI.") */}
        <section
          ref={offlineSectionRef}
          className="max-w-7xl mx-auto px-5 sm:px-10 py-20"
        >
          <div className="kavach-card p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border kavach-divider bg-[var(--bg-page)] text-xs font-mono uppercase tracking-wider">
                <span className="kavach-accent-text">●</span>
                <span>
                  {offlineBadgeTriggered ? '● Offline · Verified' : 'Disconnecting Wi-Fi...'}
                </span>
              </div>

              <h2 className="text-5xl sm:text-7xl font-poster leading-[0.88]">
                TURN OFF YOUR WIFI.
              </h2>

              <p className="text-sm sm:text-base leading-relaxed opacity-85 max-w-lg">
                Go ahead—flip your laptop&apos;s physical Wi-Fi switch or toggle Airplane Mode right now. While cloud wrappers crash with network errors, Kavach keeps streaming tokens from local VRAM.
              </p>

              {/* Animated Wi-Fi Icon Whose Bars Switch Off One by One */}
              <div className="flex items-center gap-5 pt-2">
                <div className="w-20 h-20 rounded-2xl bg-[var(--bg-page)] border kavach-divider flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-11 h-11" fill="none">
                    {/* Outer Bar 3 */}
                    <path
                      ref={wifiBar3Ref}
                      d="M8 24C21.3 12 42.7 12 56 24"
                      stroke="var(--text-primary)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {/* Middle Bar 2 */}
                    <path
                      ref={wifiBar2Ref}
                      d="M16 34C24.8 26 39.2 26 48 34"
                      stroke="var(--text-primary)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {/* Inner Bar 1 */}
                    <path
                      ref={wifiBar1Ref}
                      d="M24 44C28.4 40 35.6 40 40 44"
                      stroke="var(--text-primary)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <circle cx="32" cy="52" r="3.5" fill="var(--accent-primary)" />
                  </svg>
                </div>

                <div className="text-xs font-mono space-y-1">
                  <div className="uppercase tracking-wider font-semibold">
                    NETWORK INTERFACE: {offlineBadgeTriggered ? 'DISABLED (0.0 KB/s)' : 'DROPPING...'}
                  </div>
                  <div className="opacity-75">
                    LOCAL WEBGPU ENGINE: ACTIVE &amp; STREAMING
                  </div>
                </div>
              </div>
            </div>

            {/* Scripted Typing Demo Card */}
            <div className="lg:col-span-6">
              <div className="p-6 rounded-2xl bg-[var(--bg-page)] border kavach-divider space-y-4">
                <div className="flex items-center justify-between pb-3 border-b kavach-divider text-xs font-mono">
                  <span>AIR-GAPPED DEMO // LIVE PROOF</span>
                  <span className="kavach-accent-text font-bold">● Offline</span>
                </div>

                <div className="flex justify-end">
                  <div className="kavach-user-bubble px-4 py-2.5 text-xs">
                    My Wi-Fi is completely off. Are you still running?
                  </div>
                </div>

                <div className="kavach-card p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider kavach-accent-text font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Kavach · Local VRAM Response</span>
                  </div>
                  <p className="font-mono text-sm sm:text-base font-semibold min-h-[28px]">
                    {typedOfflineDemo || 'Still here. Nothing left your device.'}
                    <span className="inline-block w-2 h-4 ml-1 bg-[var(--accent-primary)] animate-pulse align-middle" />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-6">
          <GhostText text="SOVEREIGN" speed={-55} />
        </div>

        {/* SIGNATURE MOMENT 8: 3D TILT FEATURE CARDS */}
        <section className="features-grid-section max-w-7xl mx-auto px-5 sm:px-10 pb-24 space-y-10">
          <div className="space-y-3">
            <div className="animated-divider-line h-[1px] w-full bg-[var(--border-hairline)]" />
            <div className="flex flex-wrap items-baseline justify-between gap-4 pt-2">
              <h2 className="text-4xl sm:text-6xl font-poster">
                FOUR PILLARS OF LOCAL AUTONOMY
              </h2>
              <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-75">
                INDEX // 01 — 04
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.index}
                  data-cursor="VIEW"
                  className="feature-editorial-card kavach-card p-7 flex flex-col justify-between space-y-5 transition-shadow duration-300"
                >
                  <div className="flex items-center justify-between border-b kavach-divider pb-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] kavach-accent-text font-semibold">
                      {feat.index} // {feat.label}
                    </span>
                    <Icon className="w-4 h-4 kavach-accent-text" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-poster tracking-wide">
                      {feat.title}
                    </h3>
                    <p className="text-sm leading-relaxed opacity-85">
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="animated-divider-line h-[1px] w-full bg-[var(--border-hairline)]" />
        </section>
      </div>
    </div>
  );
};
