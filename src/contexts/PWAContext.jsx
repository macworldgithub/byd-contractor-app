import { createContext, useContext, useState, useEffect } from 'react';

const PWAContext = createContext(null);

export function PWAProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    // 1. Detect if already installed / running in standalone mode
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
      return isStandalone;
    };

    const standalone = checkStandalone();

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIosDevice);

    // 3. Listen for Chrome/Edge/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);

      // Check if user dismissed it earlier during this session
      const dismissed = sessionStorage.getItem('byd_pwa_prompt_dismissed');
      if (!dismissed && !checkStandalone()) {
        setShowInstallBanner(true);
      }
    };

    // 4. Listen for successful install event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      sessionStorage.removeItem('byd_pwa_prompt_dismissed');
    };

    // 5. Network status listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If iOS Safari and not standalone, show prompt banner if not previously dismissed
    if (isIosDevice && !standalone) {
      const dismissed = sessionStorage.getItem('byd_pwa_prompt_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
      return choiceResult?.outcome;
    }
    return null;
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('byd_pwa_prompt_dismissed', 'true');
  };

  return (
    <PWAContext.Provider
      value={{
        deferredPrompt,
        canInstall: !!deferredPrompt,
        isInstalled,
        isIOS,
        isOnline,
        showInstallBanner,
        setShowInstallBanner,
        installApp,
        dismissBanner,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

export const usePWA = () => {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA must be used within PWAProvider');
  return ctx;
};
