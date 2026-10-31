import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, Flip, SplitText, DrawSVGPlugin);

let debugMotionDisabled = false;
const motionListeners = new Set<(disabled: boolean) => void>();

export function isMotionDisabled(): boolean {
  if (debugMotionDisabled) return true;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersReducedMotion(): boolean {
  return isMotionDisabled();
}

export function setDebugMotionDisabled(disabled: boolean): void {
  debugMotionDisabled = disabled;
  if (disabled) {
    gsap.globalTimeline.timeScale(20);
  } else {
    gsap.globalTimeline.timeScale(1);
  }
  motionListeners.forEach((cb) => cb(debugMotionDisabled));
}

export function getDebugMotionDisabled(): boolean {
  return debugMotionDisabled;
}

export function subscribeMotionDebug(cb: (disabled: boolean) => void): () => void {
  motionListeners.add(cb);
  return () => {
    motionListeners.delete(cb);
  };
}

export function fadeUp(
  target: gsap.TweenTarget,
  options: {
    y?: number;
    duration?: number;
    delay?: number;
    ease?: string;
    scrollTrigger?: ScrollTrigger.Vars;
  } = {}
) {
  if (isMotionDisabled()) {
    gsap.set(target, { opacity: 1, y: 0 });
    return null;
  }

  return gsap.fromTo(
    target,
    { opacity: 0, y: options.y ?? 24 },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.85,
      delay: options.delay ?? 0,
      ease: options.ease ?? 'power3.out',
      scrollTrigger: options.scrollTrigger,
      clearProps: 'transform',
    }
  );
}

export function staggerIn(
  targets: gsap.TweenTarget,
  options: {
    y?: number;
    stagger?: number;
    duration?: number;
    delay?: number;
    ease?: string;
    scrollTrigger?: ScrollTrigger.Vars;
  } = {}
) {
  if (isMotionDisabled()) {
    gsap.set(targets, { opacity: 1, y: 0 });
    return null;
  }

  return gsap.fromTo(
    targets,
    { opacity: 0, y: options.y ?? 22 },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.85,
      stagger: options.stagger ?? 0.08,
      delay: options.delay ?? 0,
      ease: options.ease ?? 'expo.out',
      scrollTrigger: options.scrollTrigger,
      clearProps: 'transform',
    }
  );
}

export function revealText(
  lineTargets: gsap.TweenTarget,
  options: {
    stagger?: number;
    duration?: number;
    delay?: number;
  } = {}
) {
  if (isMotionDisabled()) {
    gsap.set(lineTargets, { yPercent: 0, opacity: 1 });
    return null;
  }

  return gsap.fromTo(
    lineTargets,
    { yPercent: 108, opacity: 0 },
    {
      yPercent: 0,
      opacity: 1,
      duration: options.duration ?? 1.0,
      stagger: options.stagger ?? 0.06,
      delay: options.delay ?? 0.08,
      ease: 'expo.out',
    }
  );
}

export function splitLettersReveal(
  element: HTMLElement | null,
  options: {
    stagger?: number;
    duration?: number;
    delay?: number;
  } = {}
) {
  if (!element) return null;
  if (isMotionDisabled()) {
    gsap.set(element, { opacity: 1 });
    return null;
  }

  try {
    const split = new SplitText(element, { type: 'chars' });
    return gsap.fromTo(
      split.chars,
      { yPercent: 110, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: options.duration ?? 0.75,
        stagger: options.stagger ?? 0.04,
        delay: options.delay ?? 0,
        ease: 'expo.out',
      }
    );
  } catch {
    return fadeUp(element, options);
  }
}

export function wipeIn(
  target: gsap.TweenTarget,
  options: {
    duration?: number;
    delay?: number;
  } = {}
) {
  if (isMotionDisabled()) {
    gsap.set(target, {
      clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
      opacity: 1,
    });
    return null;
  }

  return gsap.fromTo(
    target,
    {
      clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
      opacity: 0.4,
    },
    {
      clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
      opacity: 1,
      duration: options.duration ?? 1.1,
      delay: options.delay ?? 0,
      ease: 'expo.out',
    }
  );
}

export function drawSvgPath(
  pathElement: SVGGeometryElement | null,
  options: {
    duration?: number;
    delay?: number;
    ease?: string;
  } = {}
) {
  if (!pathElement) return null;
  const totalLen = pathElement.getTotalLength ? pathElement.getTotalLength() : 200;
  gsap.set(pathElement, {
    strokeDasharray: totalLen,
    strokeDashoffset: isMotionDisabled() ? 0 : totalLen,
  });

  if (isMotionDisabled()) return null;

  return gsap.to(pathElement, {
    strokeDashoffset: 0,
    duration: options.duration ?? 0.9,
    delay: options.delay ?? 0,
    ease: options.ease ?? 'power3.inOut',
  });
}

export function countUp(
  element: HTMLElement | null,
  endValue: number,
  options: {
    duration?: number;
    suffix?: string;
    prefix?: string;
    decimals?: number;
  } = {}
) {
  if (!element) return null;
  const decimals = options.decimals ?? 0;
  const prefix = options.prefix ?? '';
  const suffix = options.suffix ?? '';

  if (isMotionDisabled()) {
    element.textContent = `${prefix}${endValue.toFixed(decimals)}${suffix}`;
    return null;
  }

  const counter = { val: 0 };
  return gsap.to(counter, {
    val: endValue,
    duration: options.duration ?? 1.0,
    ease: 'power4.out',
    onUpdate: () => {
      element.textContent = `${prefix}${counter.val.toFixed(decimals)}${suffix}`;
    },
  });
}

/**
 * Magnetic pull within 80px proximity using gsap.quickTo for 60fps performance.
 */
export function magneticHover(element: HTMLElement | null, strength = 10): () => void {
  if (!element || typeof window === 'undefined') return () => {};
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) return () => {};

  const xTo = gsap.quickTo(element, 'x', { duration: 0.45, ease: 'power3.out' });
  const yTo = gsap.quickTo(element, 'y', { duration: 0.45, ease: 'power3.out' });

  const handleWindowMove = (e: MouseEvent) => {
    if (isMotionDisabled()) {
      xTo(0);
      yTo(0);
      return;
    }
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;
    const distance = Math.hypot(distX, distY);

    if (distance < 80 + Math.max(rect.width, rect.height) / 2) {
      const pull = Math.max(0, 1 - distance / (80 + Math.max(rect.width, rect.height) / 2));
      xTo((distX / (rect.width / 2 || 1)) * strength * pull);
      yTo((distY / (rect.height / 2 || 1)) * strength * pull);
    } else {
      xTo(0);
      yTo(0);
    }
  };

  const handleLeave = () => {
    xTo(0);
    yTo(0);
  };

  window.addEventListener('mousemove', handleWindowMove, { passive: true });
  element.addEventListener('mouseleave', handleLeave);

  return () => {
    window.removeEventListener('mousemove', handleWindowMove);
    element.removeEventListener('mouseleave', handleLeave);
  };
}

/**
 * 3D Card Tilt (max 6 degrees) with soft radial light spot following cursor.
 */
export function bindCard3DTilt(cards: HTMLElement[]): () => void {
  if (typeof window === 'undefined') return () => {};
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) return () => {};

  const cleanups: Array<() => void> = [];

  cards.forEach((card) => {
    gsap.set(card, { transformPerspective: 900, transformStyle: 'preserve-3d' });

    const rotX = gsap.quickTo(card, 'rotationX', { duration: 0.45, ease: 'power3.out' });
    const rotY = gsap.quickTo(card, 'rotationY', { duration: 0.45, ease: 'power3.out' });

    const onMove = (e: MouseEvent) => {
      if (isMotionDisabled()) return;
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const tiltY = (px - 0.5) * 12; // max ±6 deg
      const tiltX = (0.5 - py) * 12; // max ±6 deg
      rotX(tiltX);
      rotY(tiltY);
      card.style.setProperty('--spot-x', `${Math.round(px * 100)}%`);
      card.style.setProperty('--spot-y', `${Math.round(py * 100)}%`);
    };

    const onLeave = () => {
      rotX(0);
      rotY(0);
    };

    card.addEventListener('mousemove', onMove, { passive: true });
    card.addEventListener('mouseleave', onLeave);

    cleanups.push(() => {
      card.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseleave', onLeave);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

export function pageTransition(
  container: HTMLElement | null,
  wipeCurtain?: HTMLElement | null
) {
  if (!container) return null;
  if (isMotionDisabled()) {
    gsap.set(container, { opacity: 1, y: 0 });
    if (wipeCurtain) gsap.set(wipeCurtain, { scaleX: 0 });
    return null;
  }

  const tl = gsap.timeline();
  if (wipeCurtain) {
    tl.fromTo(
      wipeCurtain,
      { scaleX: 0, transformOrigin: 'left center', opacity: 1 },
      { scaleX: 1, duration: 0.32, ease: 'expo.in' }
    ).to(wipeCurtain, {
      scaleX: 0,
      transformOrigin: 'right center',
      duration: 0.38,
      ease: 'expo.out',
    });
  }

  tl.fromTo(
    container,
    { opacity: 0, y: 18 },
    {
      opacity: 1,
      y: 0,
      duration: 0.65,
      ease: 'power3.out',
      clearProps: 'transform',
    },
    wipeCurtain ? 0.22 : 0
  );

  return tl;
}

export { gsap, ScrollTrigger, Flip, SplitText, DrawSVGPlugin };
