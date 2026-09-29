import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { getGroup } from '../services/groupService';
import { getUserProfile } from '../services/userService';
import { ChatUser } from '../types/user';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';

type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const { user } = useAuth();

  const {
    conversationId,
    conversationType,
    title,
    photoUrl,
    directParticipantUid,
  } = route.params;

  const isGroup = conversationType === 'group';

  const {
    messages,
    loading,
    sending,
    error,
    sendChatMessage,
    clearChatError,
  } = useChat(conversationId, conversationType);

  const flatListRef = useRef<FlatList>(null);
  const [groupMembers, setGroupMembers] = useState<ChatUser[]>([]);

  // Carregar dados dos integrantes do grupo para suporte a menções e mensagens direcionadas
  useEffect(() => {
    async function loadMembers() {
      if (!isGroup) return;
      try {
        const group = await getGroup(conversationId);
        if (group && group.memberIds) {
          const membersData = await Promise.all(
            group.memberIds.map((uid) => getUserProfile(uid))
          );
          setGroupMembers(membersData.filter((m): m is ChatUser => m !== null));
        }
      } catch (err) {
        console.error('[ChatScreen] Erro ao carregar integrantes para menção:', err);
      }
    }
    loadMembers();
  }, [conversationId, isGroup]);

  // Rolar automaticamente para a mensagem mais recente
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleHeaderPhotoPress = () => {
    if (isGroup) {
      navigation.navigate('GroupMembers', { groupId: conversationId });
    } else if (directParticipantUid) {
      navigation.navigate('Profile', { userUid: directParticipantUid });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header Customizado com foto clicável */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerProfileButton}
            onPress={handleHeaderPhotoPress}
            activeOpacity={0.7}
          >
            <Avatar uri={photoUrl} name={title} size={40} isGroup={isGroup} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isGroup
                  ? `${groupMembers.length} integrantes • Toque para ver`
                  : 'Toque para ver perfil'}
              </Text>
            </View>
          </TouchableOpacity>

          {isGroup && (
            <TouchableOpacity
              style={styles.groupOptionsButton}
              onPress={() => navigation.navigate('GroupMembers', { groupId: conversationId })}
              accessibilityLabel="Opções do grupo"
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback de Erro */}
        <ErrorMessage message={error || ''} onDismiss={clearChatError} />

        {/* Lista de Mensagens em Tempo Real */}
        {loading ? (
          <Loading message="Carregando mensagens em tempo real..." fullscreen />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatMessage
                message={item}
                isOwn={item.senderId === user?.uid}
                isGroup={isGroup}
                currentUserId={user?.uid || ''}
              />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="Nenhuma mensagem ainda"
                description="Envie a primeira mensagem para iniciar esta conversa!"
              />
            }
          />
        )}

        {/* Campo de Entrada de Mensagem com Suporte a Menções */}
        <ChatInput
          onSend={sendChatMessage}
          sending={sending}
          isGroup={isGroup}
          groupMembers={groupMembers}
          currentUserId={user?.uid || ''}
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
  groupOptionsButton: {
    padding: 6,
    marginLeft: 8,
  },
  messagesList: {
    paddingVertical: 12,
    flexGrow: 1,
  },
});
