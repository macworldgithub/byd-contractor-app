import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import PWAInstallBanner from '../common/PWAInstallBanner';

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <PWAInstallBanner />
        <main className="page-content fade-in">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
