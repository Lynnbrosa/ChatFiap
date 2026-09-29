import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { PublicUserProfile } from '../types/user';
import { useAuth } from '../hooks/useAuth';
import { listUsers } from '../services/userService';
import { getOrCreateDirectConversation } from '../services/chatService';
import { getFriendlyErrorMessage } from '../utils/errors';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';

type UsersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Users'>;
type UsersScreenRouteProp = RouteProp<RootStackParamList, 'Users'>;

export const UsersScreen: React.FC = () => {
  const navigation = useNavigation<UsersScreenNavigationProp>();
  const route = useRoute<UsersScreenRouteProp>();
  const params = route.params;
  const { user: currentUser } = useAuth();
  const currentUid = currentUser?.uid ?? null;

  const isGroupSelect = params.mode === 'group_select';
  const excludeIds = useMemo(
    () => (params.mode === 'group_select' ? params.excludeIds ?? [] : []),
    [params]
  );
  const maxSelectable = params.mode === 'group_select' ? params.maxSelectable : undefined;

  const [users, setUsers] = useState<PublicUserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    params.mode === 'group_select' ? params.selectedIds ?? [] : []
  );
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!currentUid) return;
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers(currentUid));
    } catch (err) {
      setLoadError(getFriendlyErrorMessage(err, 'Não foi possível carregar a lista de usuários.'));
    } finally {
      setLoading(false);
    }
  }, [currentUid]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // O próprio usuário já é removido em listUsers; integrantes atuais também ficam de fora
  const filteredUsers = useMemo(() => {
    const available = users.filter((u) => u.uid !== currentUid && !excludeIds.includes(u.uid));
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, search, excludeIds, currentUid]);

  const selectionLimitReached = maxSelectable !== undefined && selectedIds.length >= maxSelectable;

  const toggleSelect = (uid: string) => {
    setActionError(null);
    if (selectedIds.includes(uid)) {
      setSelectedIds((prev) => prev.filter((id) => id !== uid));
      return;
    }
    if (maxSelectable !== undefined && selectedIds.length >= maxSelectable) {
      setActionError(`O grupo só tem ${maxSelectable} vaga(s) disponível(is).`);
      return;
    }
    setSelectedIds((prev) => [...prev, uid]);
  };

  const handleStartDirectChat = async (targetUser: PublicUserProfile) => {
    if (!currentUid) return;
    setActionError(null);
    setStartingChatWith(targetUser.uid);
    try {
      const conversation = await getOrCreateDirectConversation(currentUid, targetUser.uid);
      navigation.replace('Chat', {
        conversationId: conversation.id,
        conversationType: 'direct',
        title: targetUser.name,
        photoUrl: targetUser.photoUrl,
        directParticipantUid: targetUser.uid,
      });
    } catch (err) {
      setActionError(getFriendlyErrorMessage(err, 'Não foi possível iniciar a conversa.'));
      setStartingChatWith(null);
    }
  };

  const handleConfirmGroupSelection = () => {
    if (params.mode !== 'group_select') return;
    const { target } = params;
    if (target.screen === 'GroupMembers') {
      navigation.popTo('GroupMembers', { groupId: target.groupId, selectedMemberIds: selectedIds });
    } else {
      navigation.popTo('GroupForm', { selectedMemberIds: selectedIds }, { merge: true });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar pelo nome..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isGroupSelect && (
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionCount}>
            {selectedIds.length} selecionado(s)
            {maxSelectable !== undefined ? ` • ${maxSelectable} vaga(s)` : ''}
          </Text>
          <TouchableOpacity
            style={[styles.confirmButton, selectedIds.length === 0 && styles.confirmButtonDisabled]}
            onPress={handleConfirmGroupSelection}
            disabled={selectedIds.length === 0}
          >
            <Text style={styles.confirmButtonText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      )}

      <ErrorMessage message={actionError || ''} onDismiss={() => setActionError(null)} />

      {loading ? (
        <Loading message="Carregando usuários..." fullscreen />
      ) : loadError ? (
        <ErrorMessage message={loadError} onRetry={loadUsers} />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.uid);
            const isStarting = startingChatWith === item.uid;
            const blocked = isGroupSelect && !isSelected && selectionLimitReached;

            return (
              <TouchableOpacity
                style={[
                  styles.userItem,
                  isSelected && styles.userItemSelected,
                  blocked && styles.userItemBlocked,
                ]}
                onPress={() =>
                  isGroupSelect ? toggleSelect(item.uid) : handleStartDirectChat(item)
                }
                disabled={startingChatWith !== null}
              >
                <Avatar uri={item.photoUrl} name={item.name} size={48} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>
                    {isGroupSelect ? 'Toque para selecionar' : 'Toque para conversar'}
                  </Text>
                </View>

                {isGroupSelect ? (
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </View>
                ) : isStarting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.startChatIcon}>
                    <Ionicons name="chatbubble-outline" size={20} color={colors.primaryLight} />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Nenhum usuário disponível"
              description={
                search
                  ? 'Nenhum usuário corresponde à sua busca.'
                  : 'Ainda não há outros usuários cadastrados para selecionar.'
              }
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  userItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  userItemBlocked: {
    opacity: 0.45,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  startChatIcon: {
    padding: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
