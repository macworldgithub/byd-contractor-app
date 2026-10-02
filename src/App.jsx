import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PWAProvider } from './contexts/PWAContext';
import { offlineApi } from './api/client';
import { initOfflineSync } from './utils/offlineQueue';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import KanbanPage from './pages/KanbanPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TemplatesPage from './pages/TemplatesPage';
import TimeLogsPage from './pages/TimeLogsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import SyncDashboardPage from './pages/SyncDashboardPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner lg" />
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role === 'contractor') return <Navigate to="/" replace />;

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const cleanup = initOfflineSync(offlineApi, (result) => {
        console.log(`[OfflineSync] Flushed ${result.succeeded} actions.`);
      });
      return cleanup;
    }
  }, [user]);

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
      <Route path="/kanban" element={<ProtectedRoute><KanbanPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute adminOnly><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute adminOnly><TemplatesPage /></ProtectedRoute>} />
      <Route path="/time-logs" element={<ProtectedRoute adminOnly><TimeLogsPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
      <Route path="/sync" element={<ProtectedRoute adminOnly><SyncDashboardPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PWAProvider>
          <Router>
            <AppRoutes />
          </Router>
        </PWAProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
