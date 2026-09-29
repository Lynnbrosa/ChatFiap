import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { PublicUserProfile } from '../types/user';
import { ChatMessage as ChatMessageType } from '../types/chat';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useGroupDetails } from '../hooks/useGroups';
import { getPublicProfile } from '../services/userService';
import { setActiveConversation } from '../services/notificationService';
import { getOtherParticipantId } from '../utils/conversationId';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { NoticeBanner } from '../components/NoticeBanner';
import { ConnectivityBanner } from '../components/ConnectivityBanner';

type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const { conversationId, conversationType } = route.params;
  const isGroup = conversationType === 'group';

  // Grupo: dados em tempo real (nome, foto, integrantes). Se o usuário for removido, o chat bloqueia.
  const groupDetails = useGroupDetails(isGroup ? conversationId : null);

  // Conversa individual: o outro participante é derivado do ID da conversa
  const partnerUid = useMemo(
    () =>
      isGroup ? null : route.params.directParticipantUid ?? getOtherParticipantId(conversationId, uid),
    [isGroup, route.params.directParticipantUid, conversationId, uid]
  );
  const [partner, setPartner] = useState<PublicUserProfile | null>(null);

  useEffect(() => {
    if (!partnerUid) return;
    let cancelled = false;
    getPublicProfile(partnerUid)
      .then((profile) => {
        if (!cancelled) setPartner(profile);
      })
      .catch((err: unknown) => console.warn('[ChatScreen] Falha ao carregar participante:', err));
    return () => {
      cancelled = true;
    };
  }, [partnerUid]);

  const isActiveMember = isGroup ? groupDetails.isMember : partnerUid !== null;
  const removedFromGroup = isGroup && !groupDetails.loading && !groupDetails.isMember;

  const {
    messages,
    loading,
    sending,
    error,
    accessDenied,
    pushWarning,
    sendChatMessage,
    clearChatError,
    clearPushWarning,
  } = useChat(conversationId, conversationType, isActiveMember);

  // Evita exibir o push desta conversa enquanto ela está aberta
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId]);

  const flatListRef = useRef<FlatList<ChatMessageType>>(null);

  const membersById = useMemo(() => {
    const map: Record<string, PublicUserProfile> = {};
    groupDetails.members.forEach((m) => {
      map[m.uid] = m;
    });
    return map;
  }, [groupDetails.members]);

  const title = isGroup
    ? groupDetails.group?.name ?? route.params.title ?? 'Grupo'
    : partner?.name ?? route.params.title ?? 'Conversa';
  const photoUrl = isGroup
    ? groupDetails.group?.photoUrl ?? route.params.photoUrl
    : partner?.photoUrl ?? route.params.photoUrl;

  const subtitle = isGroup
    ? groupDetails.group
      ? `${groupDetails.group.memberIds.length}/${groupDetails.group.memberLimit} integrantes • toque para ver`
      : 'Carregando integrantes...'
    : 'Toque para ver o perfil';

  const handleHeaderPhotoPress = () => {
    if (isGroup) {
      navigation.navigate('GroupMembers', { groupId: conversationId });
    } else if (partnerUid) {
      navigation.navigate('Profile', { userUid: partnerUid });
    }
  };

  const blocked = removedFromGroup || accessDenied;
  const blockedMessage = removedFromGroup
    ? 'Você não faz mais parte deste grupo e não pode enviar nem receber novas mensagens.'
    : 'Você não tem acesso a esta conversa.';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Conversations'))}
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerProfileButton}
            onPress={handleHeaderPhotoPress}
            activeOpacity={0.7}
            accessibilityLabel={isGroup ? 'Ver integrantes do grupo' : 'Ver perfil'}
          >
            <Avatar uri={photoUrl} name={title} size={40} isGroup={isGroup} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <ConnectivityBanner />
        <ErrorMessage message={error || ''} onDismiss={clearChatError} />
        <NoticeBanner message={pushWarning} tone="warning" icon="notifications-off-outline" onDismiss={clearPushWarning} />

        {blocked ? (
          <EmptyState
            icon="lock-closed-outline"
            title="Acesso encerrado"
            description={blockedMessage}
          />
        ) : loading ? (
          <Loading message="Carregando mensagens..." fullscreen />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatMessage
                message={item}
                isOwn={item.senderId === uid}
                isGroup={isGroup}
                currentUserId={uid}
                authorName={membersById[item.senderId]?.name}
                targetName={
                  item.target.type === 'member' ? membersById[item.target.memberId]?.name : undefined
                }
              />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="Nenhuma mensagem ainda"
                description="Envie a primeira mensagem para iniciar esta conversa!"
              />
            }
          />
        )}

        <ChatInput
          onSend={sendChatMessage}
          sending={sending}
          isGroup={isGroup}
          groupMembers={groupDetails.members}
          currentUserId={uid}
          disabled={blocked}
          disabledMessage={blockedMessage}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  headerProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.primaryLight,
    marginTop: 1,
  },
  messagesList: {
    paddingVertical: 12,
    flexGrow: 1,
  },
});
