import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { usePWA } from '../../contexts/PWAContext';

export default function PWAInstallBanner() {
  const {
    canInstall,
    isInstalled,
    isIOS,
    showInstallBanner,
    installApp,
    dismissBanner,
  } = usePWA();

  // If already installed or banner dismissed, don't show
  if (isInstalled || !showInstallBanner) return null;

  return (
    <aside
      className="pwa-install-banner fade-in"
      role="banner"
      aria-label="App Installation Prompt"
    >
      <div className="pwa-banner-content">
        <img
          src="/pwa-192x192.png"
          alt="BYD Contractor Hub"
          className="pwa-banner-icon"
          width="44"
          height="44"
        />

        <div className="pwa-banner-text">
          <div className="pwa-banner-title">
            Install BYD Contractor Hub
          </div>
          {isIOS ? (
            <div className="pwa-banner-desc">
              Tap <Share size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> Share below, then tap <PlusSquare size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> <strong>'Add to Home Screen'</strong> for full-screen and offline access.
            </div>
          ) : (
            <div className="pwa-banner-desc">
              Install to your home screen or desktop for rapid offline access and instant notifications.
            </div>
          )}
        </div>

        <div className="pwa-banner-actions">
          {canInstall && (
            <button
              type="button"
              className="btn btn-primary btn-sm pwa-install-btn"
              onClick={installApp}
            >
              <Download size={15} />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            className="btn-icon sm pwa-banner-close"
            onClick={dismissBanner}
            aria-label="Dismiss banner"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
