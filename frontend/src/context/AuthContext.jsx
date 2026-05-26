import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiRegister, apiGetMe } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ipl_token'));
  const [loading, setLoading] = useState(true);

  // On mount, verify stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('ipl_token');
    if (storedToken) {
      apiGetMe(storedToken)
        .then((data) => {
          setUser(data.user || data);
          setToken(storedToken);
        })
        .catch(() => {
          localStorage.removeItem('ipl_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin({ username, password });
    const { token: newToken, user: newUser } = data;
    localStorage.setItem('ipl_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return data;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const data = await apiRegister({ username, email, password });
    const { token: newToken, user: newUser } = data;
    localStorage.setItem('ipl_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return data;
  }, []);

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
