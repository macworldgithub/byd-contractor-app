import { accountId } from '../utils/offlineStore';
import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getToken, setToken, removeToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const remember = (current) => {
    localStorage.setItem('byd_user', JSON.stringify(current));
    setUser(current);
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      let expired = true;
      try { expired = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 <= Date.now(); } catch { /* Invalid token */ }
      if (expired) { removeToken(); setLoading(false); return; }
      authApi.me()
        .then(remember)
        .catch((error) => {
          if (navigator.onLine && !(error instanceof TypeError)) { removeToken(); setUser(null); return; }
          // A network outage must not destroy an otherwise valid offline session.
          try { const cached = JSON.parse(localStorage.getItem('byd_user') || 'null'); setUser(cached?.id === accountId() ? cached : null); } catch { setUser(null); }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    if (!['contractor', 'admin', 'super_admin', 'site_admin'].includes(data.user?.role)) throw new Error('This account does not have contractor app access.');
    setToken(data.access_token);
    remember(data.user);
    return data.user;
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export const useIsAdmin = () => {
  const { user } = useAuth();
  return ['admin', 'super_admin', 'site_admin'].includes(user?.role);
};

export const useIsSuperAdmin = () => {
  const { user } = useAuth();
  return user?.role === 'super_admin';
};
