import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowModal(true);
          }
        }}
        className="px-3 py-1.5 rounded-full border kavach-divider bg-[var(--bg-card)] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Install Kavach as an offline app"
      >
        <Download className="w-3.5 h-3.5 kavach-accent-text" />
        <span className="hidden sm:inline">Install</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="kavach-card max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b kavach-divider pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 kavach-accent-text" />
                <h3 className="text-xl font-poster tracking-wide">
                  Install Kavach Offline App
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:opacity-75"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="text-sm space-y-2 leading-relaxed">
                <p>To install Kavach on iPhone or iPad:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Tap the <strong>Share</strong> icon in Safari&apos;s bottom bar.</li>
                  <li>Select <strong>Add to Home Screen</strong>.</li>
                  <li>Launch Kavach anytime—even in Airplane Mode.</li>
                </ol>
              </div>
            ) : (
              <div className="text-sm space-y-2 leading-relaxed">
                <p>
                  Kavach&apos;s Service Worker and Web App Manifest are active and caching assets for offline execution.
                </p>
                <p className="text-xs opacity-80">
                  In Chrome, Edge, or Brave, click the <strong>Install Kavach</strong> icon in your browser&apos;s address bar to run in standalone desktop window mode.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-full kavach-btn-accent text-xs font-semibold uppercase tracking-wider"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
