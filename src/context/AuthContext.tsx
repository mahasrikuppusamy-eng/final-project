import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios.js';
import { SEED_USERS } from '../../server/src/seed/seedData.js';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessable_token'));
  const [loading, setLoading] = useState<boolean>(true);

  // Validate existing token on mount
  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('accessable_token');
      if (storedToken) {
        // Restore demo session (GitHub Pages static deploy)
        if (storedToken.startsWith('demo_')) {
          const demoUserJson = localStorage.getItem('accessable_demo_user');
          if (demoUserJson) {
            try {
              setUser(JSON.parse(demoUserJson));
            } catch {
              localStorage.removeItem('accessable_token');
              localStorage.removeItem('accessable_demo_user');
            }
          }
          setLoading(false);
          return;
        }

        try {
          const res = await api.get('/api/auth/me');
          if (res.data.success && res.data.user) {
            setUser(res.data.user);
          } else {
            localStorage.removeItem('accessable_token');
            setToken(null);
            setUser(null);
          }
        } catch (err) {
          localStorage.removeItem('accessable_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    // On GitHub Pages (static deploy), authenticate against seed users locally
    const isStaticDeploy = import.meta.env.BASE_URL !== '/' && !import.meta.env.VITE_API_URL;
    if (isStaticDeploy) {
      const match = SEED_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (match) {
        const demoUser: User = { id: match._id, name: match.name, email: match.email, role: match.role };
        const demoToken = `demo_${match._id}`;
        localStorage.setItem('accessable_token', demoToken);
        localStorage.setItem('accessable_demo_user', JSON.stringify(demoUser));
        setToken(demoToken);
        setUser(demoUser);
        return { success: true };
      }
      return { success: false, message: 'Invalid email or password. Try the demo credentials below.' };
    }

    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (res.data.success) {
        localStorage.setItem('accessable_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Login failed. Please check your credentials.',
      };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    // On GitHub Pages (static deploy), simulate registration locally
    const isStaticDeploy = import.meta.env.BASE_URL !== '/' && !import.meta.env.VITE_API_URL;
    if (isStaticDeploy) {
      const demoUser: User = {
        id: `demo_${Date.now()}`,
        name,
        email,
        role: 'user',
      };
      const demoToken = `demo_${demoUser.id}`;
      localStorage.setItem('accessable_token', demoToken);
      localStorage.setItem('accessable_demo_user', JSON.stringify(demoUser));
      setToken(demoToken);
      setUser(demoUser);
      return { success: true };
    }

    try {
      const res = await api.post('/api/auth/register', { name, email, password });
      if (res.data.success) {
        localStorage.setItem('accessable_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Registration failed' };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Registration failed. Please try again.',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessable_token');
    localStorage.removeItem('accessable_demo_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
