import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { api, clearAuthToken, getAuthToken, setAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  setup: (username: string, password: string, fullName?: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: true,
  setup: async () => {},
  login: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);

  useEffect(() => {
    // 1. Check if server needs first-run setup
    api.getSetupStatus()
      .then((status) => {
        setIsInitialized(status.initialized);
        if (!status.initialized) {
          clearAuthToken();
          setIsLoading(false);
          return;
        }

        // 2. If initialized, check existing token
        const token = getAuthToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        api.getMe()
          .then((userData) => {
            setUser(userData);
          })
          .catch(() => {
            clearAuthToken();
            setUser(null);
          })
          .finally(() => {
            setIsLoading(false);
          });
      })
      .catch(() => {
        // Fallback
        setIsLoading(false);
      });
  }, []);

  const setup = async (username: string, password: string, fullName?: string) => {
    const res = await api.setupAdmin({ username, password, full_name: fullName });
    setAuthToken(res.token);
    setUser(res.user);
    setIsInitialized(true);
  };

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setAuthToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitialized,
        setup,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
