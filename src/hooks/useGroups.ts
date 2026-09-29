import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChatGroup } from '../types/group';
import { PublicUserProfile } from '../types/user';
import {
  listenUserGroups,
  listenGroup,
  createGroup,
  updateGroupSettings,
  addMembersToGroup,
  removeMemberFromGroup,
  CreateGroupParams,
  CreateGroupResult,
  UpdateGroupParams,
} from '../services/groupService';
import { getPublicProfile } from '../services/userService';
import { getAvailableVacancies } from '../utils/groupValidation';
import { getFriendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

export interface UseGroupsReturn {
  groups: ChatGroup[];
  loading: boolean;
  error: string | null;
  createNewGroup: (params: Omit<CreateGroupParams, 'ownerId'>) => Promise<CreateGroupResult>;
  updateGroup: (groupId: string, updates: UpdateGroupParams) => Promise<void>;
  addMembers: (groupId: string, memberIds: string[]) => Promise<void>;
  removeMember: (groupId: string, memberIdToRemove: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  clearGroupError: () => void;
  ownedGroups: ChatGroup[];
}

/** Grupos do usuário autenticado, sincronizados em tempo real pelo Firestore. */
export function useGroups(): UseGroupsReturn {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearGroupError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!uid) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = listenUserGroups(
      uid,
      (updatedGroups) => {
        setGroups(updatedGroups);
        setLoading(false);
      },
      (listenError) => {
        setLoading(false);
        setError(getFriendlyErrorMessage(listenError, 'Não foi possível carregar seus grupos.'));
      }
    );

    return unsubscribe;
  }, [uid]);

  const requireUid = useCallback((): string => {
    if (!uid) throw new Error('Sua sessão expirou. Entre novamente.');
    return uid;
  }, [uid]);

  const createNewGroup = useCallback(
    (params: Omit<CreateGroupParams, 'ownerId'>) =>
      createGroup({ ...params, ownerId: requireUid() }),
    [requireUid]
  );

  const updateGroup = useCallback(
    (groupId: string, updates: UpdateGroupParams) =>
      updateGroupSettings(groupId, updates, requireUid()),
    [requireUid]
  );

  const addMembers = useCallback(
    (groupId: string, memberIds: string[]) => addMembersToGroup(groupId, memberIds, requireUid()),
    [requireUid]
  );

  const removeMember = useCallback(
    (groupId: string, memberIdToRemove: string) =>
      removeMemberFromGroup(groupId, memberIdToRemove, requireUid()),
    [requireUid]
  );

  const leaveGroup = useCallback(
    (groupId: string) => {
      const currentUid = requireUid();
      return removeMemberFromGroup(groupId, currentUid, currentUid);
    },
    [requireUid]
  );

  const ownedGroups = useMemo(
    () => (uid ? groups.filter((g) => g.ownerId === uid) : []),
    [groups, uid]
  );

  return {
    groups,
    loading,
    error,
    createNewGroup,
    updateGroup,
    addMembers,
    removeMember,
    leaveGroup,
    clearGroupError,
    ownedGroups,
  };
}

export interface UseGroupDetailsReturn {
  group: ChatGroup | null;
  members: PublicUserProfile[];
  loading: boolean;
  error: string | null;
  isOwner: boolean;
  isMember: boolean;
  vacancies: number;
}

/**
 * Um grupo em tempo real + perfis públicos dos integrantes.
 * Se o usuário for removido, `isMember` passa a ser false imediatamente.
 */
export function useGroupDetails(groupId: string | null): UseGroupDetailsReturn {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [members, setMembers] = useState<PublicUserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(groupId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = listenGroup(
      groupId,
      (data) => {
        setGroup(data);
        setError(data ? null : 'Grupo não encontrado.');
        setLoading(false);
      },
      (listenError) => {
        setGroup(null);
        setLoading(false);
        setError(
          getFriendlyErrorMessage(listenError, 'Não foi possível carregar os dados do grupo.')
        );
      }
    );

    return unsubscribe;
  }, [groupId]);

  // Chave estável para só recarregar perfis quando a lista de integrantes muda
  const memberKey = group ? group.memberIds.join(',') : '';

  useEffect(() => {
    if (!memberKey) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    const ids = memberKey.split(',');
    Promise.all(ids.map((id) => getPublicProfile(id)))
      .then((profiles) => {
        if (!cancelled) {
          setMembers(profiles.filter((p): p is PublicUserProfile => p !== null));
        }
      })
      .catch((err: unknown) => {
        console.warn('[useGroupDetails] Falha ao carregar integrantes:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [memberKey]);

  const isMember = useMemo(
    () => Boolean(group && uid && group.memberIds.includes(uid)),
    [group, uid]
  );
  const isOwner = Boolean(group && uid && group.ownerId === uid);
  const vacancies = useMemo(
    () => (group ? getAvailableVacancies(group.memberIds.length, group.memberLimit) : 0),
    [group]
  );

  return { group, members, loading, error, isOwner, isMember, vacancies };
}
