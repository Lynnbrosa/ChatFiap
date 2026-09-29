import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
import { getOwnProfile } from '../services/userService';
import { getFriendlyErrorMessage } from '../utils/errors';

export interface AuthContextType {
  user: ChatUser | null;
  firebaseUser: User | null;
  /** true só durante a recuperação inicial da sessão. */
  initializing: boolean;
  /** true enquanto login, cadastro ou logout estão em andamento. */
  actionLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  authNotice: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (params: RegisterParams) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
  clearNotice: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<ChatUser | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Evita que o listener de sessão sobrescreva o perfil enquanto o cadastro ainda o está gravando
  const registeringRef = useRef<boolean>(false);
  // Distingue logout voluntário de sessão encerrada/expirada
  const explicitLogoutRef = useRef<boolean>(false);
  const hadSessionRef = useRef<boolean>(false);

  const clearError = useCallback(() => setAuthError(null), []);
  const clearNotice = useCallback(() => setAuthNotice(null), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (!fbUser) {
        if (hadSessionRef.current && !explicitLogoutRef.current) {
          setAuthError('Sua sessão expirou. Entre novamente.');
        }
        hadSessionRef.current = false;
        explicitLogoutRef.current = false;
        setUser(null);
        setInitializing(false);
        return;
      }

      hadSessionRef.current = true;
      if (registeringRef.current) {
        setInitializing(false);
        return;
      }

      try {
        const profile = await getOwnProfile(fbUser.uid);
        setUser(profile);
      } catch (err) {
        console.error('[AuthContext] Falha ao carregar o perfil da sessão:', err);
        setAuthError(getFriendlyErrorMessage(err, 'Não foi possível carregar seu perfil.'));
      } finally {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      setUser(await getOwnProfile(firebaseUser.uid));
    } catch (err) {
      console.error('[AuthContext] Falha ao recarregar o perfil:', err);
    }
  }, [firebaseUser]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setActionLoading(true);
    setAuthError(null);
    try {
      const profile = await loginUser(email, password);
      setUser(profile);
      return true;
    } catch (err) {
      setAuthError(getFriendlyErrorMessage(err, 'Não foi possível entrar. Tente novamente.'));
      return false;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const register = useCallback(async (params: RegisterParams): Promise<boolean> => {
    setActionLoading(true);
    setAuthError(null);
    registeringRef.current = true;
    try {
      const result = await registerUser(params);
      setUser(result.user);
      if (result.photoUploadFailed) {
        setAuthNotice('Conta criada, mas a foto de perfil não pôde ser enviada.');
      }
      return true;
    } catch (err) {
      setAuthError(getFriendlyErrorMessage(err, 'Não foi possível concluir o cadastro.'));
      return false;
    } finally {
      registeringRef.current = false;
      setActionLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setActionLoading(true);
    explicitLogoutRef.current = true;
    try {
      await logoutUser(user?.uid ?? null);
      setUser(null);
      setFirebaseUser(null);
    } catch (err) {
      explicitLogoutRef.current = false;
      setAuthError(getFriendlyErrorMessage(err, 'Não foi possível sair da conta.'));
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      firebaseUser,
      initializing,
      actionLoading,
      isAuthenticated: firebaseUser !== null && user !== null,
      authError,
      authNotice,
      login,
      register,
      logout,
      refreshProfile,
      clearError,
      clearNotice,
    }),
    [
      user,
      firebaseUser,
      initializing,
      actionLoading,
      authError,
      authNotice,
      login,
      register,
      logout,
      refreshProfile,
      clearError,
      clearNotice,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
