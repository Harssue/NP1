import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiRegister } from '../api/index.js';

const AuthContext = createContext(null);

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : import.meta.env.PROD
  ? '/api'
  : 'http://localhost:5000/api';

async function fetchUserFromToken(token) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Token invalid');
  const data = await res.json();
  return data.user || data;
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('ipl_token'));
  const [loading, setLoading] = useState(true);

  // On mount, verify stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('ipl_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }
    fetchUserFromToken(storedToken)
      .then((u) => {
        setUser(u);
        setToken(storedToken);
      })
      .catch(() => {
        // Token expired or invalid — clear silently
        localStorage.removeItem('ipl_token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const _saveToken = useCallback((tok, userData) => {
    localStorage.setItem('ipl_token', tok);
    setToken(tok);
    setUser(userData);
  }, []);

  const login = useCallback(async (username, password) => {
    const data  = await apiLogin({ username, password });
    const tok   = data.access || data.token;
    // Node.js auth endpoint returns { token, user } directly
    const userData = data.user || await fetchUserFromToken(tok);
    _saveToken(tok, userData);
    return data;
  }, [_saveToken]);

  const register = useCallback(async (username, email, password) => {
    const data     = await apiRegister({ username, email, password });
    const tok      = data.access || data.token;
    const userData = data.user || { username };
    _saveToken(tok, userData);
    return data;
  }, [_saveToken]);

  const logout = useCallback(() => {
    localStorage.removeItem('ipl_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
