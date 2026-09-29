import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { ConversationType, DirectConversation } from '../types/chat';
import { PublicUserProfile } from '../types/user';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { usePushRegistration } from '../hooks/useNotifications';
import { listenUserDirectConversations } from '../services/chatService';
import { getPublicProfile } from '../services/userService';
import { getOtherParticipantId } from '../utils/conversationId';
import { getFriendlyErrorMessage } from '../utils/errors';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { ConversationItem } from '../components/ConversationItem';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { NoticeBanner } from '../components/NoticeBanner';
import { ConnectivityBanner } from '../components/ConnectivityBanner';

type ConversationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Conversations'>;

type ConversationFilter = 'all' | ConversationType;

type ConversationListItem = {
  id: string;
  type: ConversationType;
  title: string;
  photoUrl: string | null;
  lastMessage?: string;
  lastMessageAt: number;
  memberCount?: number;
  memberLimit?: number;
  directPartnerUid?: string;
};

export const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<ConversationsScreenNavigationProp>();
  const { user, logout, authNotice, clearNotice } = useAuth();
  const uid = user?.uid ?? null;
  const { groups, loading: groupsLoading, error: groupsError } = useGroups();
  const push = usePushRegistration();

  const [directConvos, setDirectConvos] = useState<DirectConversation[]>([]);
  const [partners, setPartners] = useState<Record<string, PublicUserProfile>>({});
  const [directLoading, setDirectLoading] = useState<boolean>(true);
  const [directError, setDirectError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ConversationFilter>('all');
  const [pushNoticeDismissed, setPushNoticeDismissed] = useState<boolean>(false);
  const requestedPartnersRef = useRef<Set<string>>(new Set());

  // Conversas individuais em tempo real (Firestore)
  useEffect(() => {
    if (!uid) return;

    setDirectLoading(true);
    const unsubscribe = listenUserDirectConversations(
      uid,
      (convos) => {
        setDirectConvos(convos);
        setDirectError(null);
        setDirectLoading(false);
      },
      (err) => {
        setDirectLoading(false);
        setDirectError(getFriendlyErrorMessage(err, 'Não foi possível carregar suas conversas.'));
      }
    );

    return unsubscribe;
  }, [uid]);

  // Perfis públicos dos outros participantes (buscados uma única vez cada)
  useEffect(() => {
    if (!uid) return;
    const missing = directConvos
      .map((c) => getOtherParticipantId(c.id, uid))
      .filter((id): id is string => id !== null && !requestedPartnersRef.current.has(id));

    if (missing.length === 0) return;
    missing.forEach((id) => requestedPartnersRef.current.add(id));

    Promise.all(missing.map((id) => getPublicProfile(id)))
      .then((profiles) => {
        setPartners((prev) => {
          const next = { ...prev };
          profiles.forEach((p) => {
            if (p) next[p.uid] = p;
          });
          return next;
        });
      })
      .catch((err: unknown) => console.warn('[ConversationsScreen] Falha ao carregar perfis:', err));
  }, [directConvos, uid]);

  const handleLogout = () => {
    const confirmLogout = () => {
      logout();
    };
    if (Platform.OS === 'web') {
      confirmLogout();
      return;
    }
    Alert.alert('Sair da conta', 'Tem certeza que deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: confirmLogout },
    ]);
  };

  // Lista unificada, filtrada e ordenada pela última atividade
  const unifiedConversations = useMemo<ConversationListItem[]>(() => {
    const directItems: ConversationListItem[] =
      filterType === 'group' || !uid
        ? []
        : directConvos.map((d) => {
            const partnerUid = getOtherParticipantId(d.id, uid) ?? undefined;
            const partner = partnerUid ? partners[partnerUid] : undefined;
            return {
              id: d.id,
              type: 'direct',
              title: partner?.name ?? 'Conversa individual',
              photoUrl: partner?.photoUrl || null,
              lastMessage: d.lastMessage,
              lastMessageAt: d.lastMessageAt ?? d.updatedAt ?? d.createdAt,
              directPartnerUid: partnerUid,
            };
          });

    const groupItems: ConversationListItem[] =
      filterType === 'direct'
        ? []
        : groups.map((g) => ({
            id: g.id,
            type: 'group',
            title: g.name,
            photoUrl: g.photoUrl || null,
            lastMessage: g.lastMessage,
            lastMessageAt: g.lastMessageAt ?? g.updatedAt ?? g.createdAt,
            memberCount: g.memberIds.length,
            memberLimit: g.memberLimit,
          }));

    return [...directItems, ...groupItems].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }, [directConvos, groups, filterType, partners, uid]);

  const isLoading = directLoading || groupsLoading;
  const listError = directError || groupsError;

  const pushNotice = useMemo(() => {
    if (pushNoticeDismissed) return null;
    if (push.status === 'permission_denied' || push.status === 'no_token' || push.status === 'unavailable') {
      return push.message;
    }
    return null;
  }, [push.status, push.message, pushNoticeDismissed]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => uid && navigation.navigate('Profile', { userUid: uid })}
          accessibilityLabel="Abrir meu perfil"
        >
          <Avatar uri={user?.photoUrl} name={user?.name} size={40} />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'Meu perfil'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} accessibilityLabel="Sair da conta">
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ConnectivityBanner />
      <NoticeBanner message={authNotice} tone="info" onDismiss={clearNotice} />
      <NoticeBanner
        message={pushNotice}
        tone="warning"
        icon="notifications-off-outline"
        actionLabel={
          push.status === 'permission_denied'
            ? 'Abrir configurações'
            : push.status === 'no_token'
              ? 'Tentar novamente'
              : undefined
        }
        onAction={() => {
          if (push.status === 'permission_denied') {
            Linking.openSettings();
          } else {
            push.retry();
          }
        }}
        onDismiss={() => setPushNoticeDismissed(true)}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionCardPrimary]}
          onPress={() => navigation.navigate('Users', { mode: 'direct' })}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          <Text style={styles.actionCardText}>Nova conversa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionCardSecondary]}
          onPress={() => navigation.navigate('GroupForm', {})}
        >
          <Ionicons name="people" size={20} color="#FFFFFF" />
          <Text style={styles.actionCardText}>Novo grupo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterTabs}>
        {(
          [
            { key: 'all', label: `Todas (${directConvos.length + groups.length})` },
            { key: 'direct', label: `Individuais (${directConvos.length})` },
            { key: 'group', label: `Grupos (${groups.length})` },
          ] as const
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, filterType === tab.key && styles.tabActive]}
            onPress={() => setFilterType(tab.key)}
          >
            <Text style={[styles.tabText, filterType === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ErrorMessage message={listError || ''} />

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
              title="Nenhuma conversa ainda"
              description="Inicie uma conversa individual com outro usuário ou crie um grupo."
              actionLabel="Buscar usuários"
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
