import React, { useState, useEffect, useMemo } from 'react';
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
import { useAuth } from '../hooks/useAuth';
import { getUsersList } from '../services/userService';
import { getOrCreateDirectConversation } from '../services/chatService';
import { ChatUser } from '../types/user';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

type UsersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Users'>;
type UsersScreenRouteProp = RouteProp<RootStackParamList, 'Users'>;

export const UsersScreen: React.FC = () => {
  const navigation = useNavigation<UsersScreenNavigationProp>();
  const route = useRoute<UsersScreenRouteProp>();
  const { user: currentUser } = useAuth();

  const mode = route.params?.mode || 'direct';
  const initialSelected = route.params?.selectedIds || [];
  const onSelectMembers = route.params?.onSelectMembers;

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      if (!currentUser) return;
      try {
        setLoading(true);
        const list = await getUsersList(currentUser.uid);
        setUsers(list);
      } catch (err) {
        console.error('[UsersScreen] Falha ao carregar usuários:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [currentUser]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phoneNumber.includes(q)
    );
  }, [users, search]);

  const toggleSelect = (uid: string) => {
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleStartDirectChat = async (targetUser: ChatUser) => {
    if (!currentUser) return;
    try {
      setStartingChatWith(targetUser.uid);
      const directConvo = await getOrCreateDirectConversation(currentUser.uid, targetUser.uid);
      navigation.replace('Chat', {
        conversationId: directConvo.id,
        conversationType: 'direct',
        title: targetUser.name,
        photoUrl: targetUser.photoUrl,
        directParticipantUid: targetUser.uid,
      });
    } catch (err) {
      console.error('[UsersScreen] Falha ao iniciar conversa direta:', err);
      setStartingChatWith(null);
    }
  };

  const handleConfirmGroupSelection = () => {
    if (onSelectMembers) {
      onSelectMembers(selectedIds);
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Barra de Pesquisa */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, e-mail ou celular..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Botão de confirmação para seleção em grupo */}
      {mode === 'group_select' && (
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionCount}>
            {selectedIds.length} integrante(s) selecionado(s)
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

      {loading ? (
        <Loading message="Carregando lista de usuários..." fullscreen />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.uid);
            const isStarting = startingChatWith === item.uid;

            return (
              <TouchableOpacity
                style={[styles.userItem, isSelected && styles.userItemSelected]}
                onPress={() => {
                  if (mode === 'group_select') {
                    toggleSelect(item.uid);
                  } else {
                    handleStartDirectChat(item);
                  }
                }}
                disabled={isStarting}
              >
                <Avatar uri={item.photoUrl} name={item.name} size={48} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <Text style={styles.userPhone}>{item.phoneNumber}</Text>
                </View>

                {mode === 'group_select' ? (
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
              title="Nenhum usuário encontrado"
              description="Não encontramos outros usuários cadastrados correspondentes à sua busca."
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
  userPhone: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
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
