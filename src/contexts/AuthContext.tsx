import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { User } from 'firebase/auth';
import { ChatUser } from '../types/user';
import {
  loginUser,
  registerUser,
  logoutUser,
  onAuthStateChangedListener,
  RegisterParams,
} from '../services/authService';
import { getUserProfile } from '../services/userService';

export interface AuthContextType {
  user: ChatUser | null;
  firebaseUser: User | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) {
      setUser(null);
      return;
    }
    try {
      const profile = await getUserProfile(firebaseUser.uid);
      setUser(profile);
    } catch (err) {
      console.error('[AuthContext] Falha ao recarregar perfil:', err);
    }
  }, [firebaseUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const profile = await getUserProfile(fbUser.uid);
          setUser(profile);
        } catch (err) {
          console.error('[AuthContext] Falha ao buscar perfil da sessão:', err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const result = await loginUser(email, pass);
      setFirebaseUser(result.firebaseUser);
      setUser(result.profile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação';
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (params: RegisterParams) => {
    setLoading(true);
    setAuthError(null);
    try {
      const newUser = await registerUser(params);
      setUser(newUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no cadastro';
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setFirebaseUser(null);
    } catch (err) {
      console.error('[AuthContext] Falha ao efetuar logout:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      firebaseUser,
      loading,
      authError,
      login,
      register,
      logout,
      refreshProfile,
      clearError,
    }),
    [user, firebaseUser, loading, authError, login, register, logout, refreshProfile, clearError]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
