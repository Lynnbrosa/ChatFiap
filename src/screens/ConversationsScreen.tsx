import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useNotifications } from '../hooks/useNotifications';
import { listenUserDirectConversations } from '../services/chatService';
import { getUserProfile } from '../services/userService';
import { DirectConversation } from '../types/chat';
import { ChatUser } from '../types/user';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { ConversationItem } from '../components/ConversationItem';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

type ConversationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Conversations'>;

interface DirectConversationWithPartner extends DirectConversation {
  partnerUser?: ChatUser;
}

export const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<ConversationsScreenNavigationProp>();
  const { user, logout } = useAuth();
  const { groups, loading: groupsLoading } = useGroups();

  const [directConvos, setDirectConvos] = useState<DirectConversationWithPartner[]>([]);
  const [directLoading, setDirectLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'group'>('all');

  // Configurar roteamento automático quando o usuário tocar em uma notificação push
  const handleNotificationTap = useCallback(
    (payload: { conversationId: string; conversationType: 'direct' | 'group' }) => {
      navigation.navigate('Chat', {
        conversationId: payload.conversationId,
        conversationType: payload.conversationType,
        title: payload.conversationType === 'group' ? 'Grupo' : 'Conversa Direta',
      });
    },
    [navigation]
  );

  useNotifications(handleNotificationTap);

  // Escutar conversas individuais do usuário
  useEffect(() => {
    if (!user) return;

    setDirectLoading(true);
    const unsubscribe = listenUserDirectConversations(user.uid, async (convos) => {
      // Buscar dados do outro participante para cada conversa
      const enriched: DirectConversationWithPartner[] = await Promise.all(
        convos.map(async (c) => {
          const otherUid = c.participantIds.find((id) => id !== user.uid);
          if (otherUid) {
            const partner = await getUserProfile(otherUid);
            return { ...c, partnerUser: partner || undefined };
          }
          return c;
        })
      );
      setDirectConvos(enriched);
      setDirectLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  // Conversas unificadas e ordenadas pela última atividade
  const unifiedConversations = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'direct' | 'group';
      title: string;
      photoUrl?: string | null;
      lastMessage?: string;
      lastMessageAt?: number;
      memberCount?: number;
      memberLimit?: number;
      directPartnerUid?: string;
    }> = [];

    if (filterType === 'all' || filterType === 'direct') {
      directConvos.forEach((d) => {
        list.push({
          id: d.id,
          type: 'direct',
          title: d.partnerUser?.name || 'Conversa Individual',
          photoUrl: d.partnerUser?.photoUrl || null,
          lastMessage: d.lastMessage,
          lastMessageAt: d.lastMessageAt || d.updatedAt || d.createdAt,
          directPartnerUid: d.partnerUser?.uid,
        });
      });
    }

    if (filterType === 'all' || filterType === 'group') {
      groups.forEach((g) => {
        list.push({
          id: g.id,
          type: 'group',
          title: g.name,
          photoUrl: g.photoUrl || null,
          lastMessage: g.lastMessage,
          lastMessageAt: g.lastMessageAt || g.updatedAt || g.createdAt,
          memberCount: g.memberIds.length,
          memberLimit: g.memberLimit,
        });
      });
    }

    return list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }, [directConvos, groups, filterType]);

  const isLoading = directLoading && groupsLoading;

  return (
    <View style={styles.container}>
      {/* Header com perfil, título e botão de logout */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => user && navigation.navigate('Profile', { userUid: user.uid })}
        >
          <Avatar uri={user?.photoUrl} name={user?.name} size={40} />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'Meu Perfil'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityLabel="Sair da conta"
        >
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Ações rápidas: Nova Conversa Direta e Novo Grupo */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionCardPrimary]}
          onPress={() => navigation.navigate('Users', { mode: 'direct' })}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          <Text style={styles.actionCardText}>Nova Conversa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionCardSecondary]}
          onPress={() => navigation.navigate('GroupForm', {})}
        >
          <Ionicons name="people" size={20} color="#FFFFFF" />
          <Text style={styles.actionCardText}>Novo Grupo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros: Todos / Diretas / Grupos */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.tab, filterType === 'all' && styles.tabActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.tabText, filterType === 'all' && styles.tabTextActive]}>
            Todas ({directConvos.length + groups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filterType === 'direct' && styles.tabActive]}
          onPress={() => setFilterType('direct')}
        >
          <Text style={[styles.tabText, filterType === 'direct' && styles.tabTextActive]}>
            Diretas ({directConvos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filterType === 'group' && styles.tabActive]}
          onPress={() => setFilterType('group')}
        >
          <Text style={[styles.tabText, filterType === 'group' && styles.tabTextActive]}>
            Grupos ({groups.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Conversas com Estado Vazio e Loading */}
      {isLoading ? (
        <Loading message="Carregando suas conversas..." fullscreen />
      ) : (
        <FlatList
          data={unifiedConversations}
          keyExtractor={(item) => `${item.type}_${item.id}`}
          renderItem={({ item }) => (
            <ConversationItem
              id={item.id}
              type={item.type}
              title={item.title}
              photoUrl={item.photoUrl}
              lastMessage={item.lastMessage}
              lastMessageAt={item.lastMessageAt}
              memberCount={item.memberCount}
              memberLimit={item.memberLimit}
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: item.id,
                  conversationType: item.type,
                  title: item.title,
                  photoUrl: item.photoUrl || undefined,
                  directParticipantUid: item.directPartnerUid,
                })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Nenhuma conversa encontrada"
              description="Inicie uma conversa individual com outro usuário ou crie um grupo para interagir."
              actionLabel="Buscar Usuários"
              onAction={() => navigation.navigate('Users', { mode: 'direct' })}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  userInfo: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  actionCardPrimary: {
    backgroundColor: colors.primary,
  },
  actionCardSecondary: {
    backgroundColor: colors.badgeGroup,
  },
  actionCardText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  tabActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primaryLight,
  },
});
