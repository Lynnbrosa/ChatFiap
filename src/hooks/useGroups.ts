import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChatGroup, NotificationPolicy } from '../types/group';
import {
  listenUserGroups,
  createGroup,
  updateGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  CreateGroupParams,
} from '../services/groupService';
import { useAuth } from './useAuth';

export interface UseGroupsReturn {
  groups: ChatGroup[];
  loading: boolean;
  error: string | null;
  createNewGroup: (params: Omit<CreateGroupParams, 'ownerId'>) => Promise<ChatGroup>;
  modifyGroup: (
    groupId: string,
    updates: Partial<Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>>
  ) => Promise<void>;
  addMember: (groupId: string, newMemberId: string) => Promise<void>;
  removeMember: (groupId: string, memberIdToRemove: string) => Promise<void>;
  clearGroupError: () => void;
  ownedGroups: ChatGroup[];
}

/**
 * Hook para gerenciar grupos do usuário com sincronização em tempo real e proteção contra concorrência
 */
export function useGroups(): UseGroupsReturn {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearGroupError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = listenUserGroups(user.uid, (updatedGroups) => {
      setGroups(updatedGroups);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const createNewGroup = useCallback(
    async (params: Omit<CreateGroupParams, 'ownerId'>): Promise<ChatGroup> => {
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }
      setError(null);
      try {
        const group = await createGroup({
          ...params,
          ownerId: user.uid,
        });
        return group;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao criar grupo.';
        setError(msg);
        throw err;
      }
    },
    [user]
  );

  const modifyGroup = useCallback(
    async (
      groupId: string,
      updates: Partial<Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>>
    ): Promise<void> => {
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }
      setError(null);
      try {
        await updateGroup(groupId, updates, user.uid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao atualizar grupo.';
        setError(msg);
        throw err;
      }
    },
    [user]
  );

  const addMember = useCallback(
    async (groupId: string, newMemberId: string): Promise<void> => {
      setError(null);
      try {
        await addMemberToGroup(groupId, newMemberId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao adicionar integrante ao grupo.';
        setError(msg);
        throw err;
      }
    },
    []
  );

  const removeMember = useCallback(
    async (groupId: string, memberIdToRemove: string): Promise<void> => {
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }
      setError(null);
      try {
        await removeMemberFromGroup(groupId, memberIdToRemove, user.uid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao remover integrante do grupo.';
        setError(msg);
        throw err;
      }
    },
    [user]
  );

  const ownedGroups = useMemo(() => {
    if (!user) return [];
    return groups.filter((g) => g.ownerId === user.uid);
  }, [groups, user]);

  return {
    groups,
    loading,
    error,
    createNewGroup,
    modifyGroup,
    addMember,
    removeMember,
    clearGroupError,
    ownedGroups,
  };
}
