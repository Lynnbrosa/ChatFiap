import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';

/**
 * Hook para acessar o estado e as operações de autenticação da aplicação
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider.');
  }
  return context;
}
