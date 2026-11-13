import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface UserProfile {
  id: string;
  login: string;
  email: string | null;
  fullname: string;
  role: string;
  avatar_url: string | null;
  intra_id: number | null;
  bio?: string | null;
  permissions?: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (loginOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (login: string, email: string, fullname: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isAuthModalOpen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/session', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { signed_in?: boolean; user?: UserProfile };
        if (data.signed_in && data.user) {
          const meRes = await fetch('/api/v1/users/me', { credentials: 'include' }).catch(() => null);
          if (meRes && meRes.ok) {
            const fullProfile = (await meRes.json()) as UserProfile;
            setUser(fullProfile);
          } else {
            setUser(data.user);
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (loginOrEmail: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          login_or_email: loginOrEmail,
          password,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.detail || 'Failed to authenticate.' };
      }

      const data = await res.json();
      setUser(data.user);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error.' };
    }
  };

  const register = async (login: string, email: string, fullname: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          login,
          email,
          fullname,
          password,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.detail || 'Registration failed.' };
      }

      const data = await res.json();
      setUser(data.user);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        isAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
