import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChatMessage as ChatMessageType } from '../types/chat';
import { colors } from '../theme/colors';
import { formatTimeOrDate } from '../utils/formatters';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
  isGroup: boolean;
  currentUserId: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isOwn,
  isGroup,
  currentUserId,
}) => {
  const isDirectTarget =
    message.target &&
    message.target.type === 'member' &&
    message.target.memberId === currentUserId;

  const isMentioned =
    Array.isArray(message.mentionedUserIds) &&
    message.mentionedUserIds.includes(currentUserId);

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.containerOwn : styles.containerOther,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          (isDirectTarget || isMentioned) && !isOwn && styles.bubbleHighlighted,
        ]}
      >
        {/* Nome do autor nas conversas de grupo (apenas mensagens de outros) */}
        {isGroup && !isOwn && (
          <Text style={styles.senderName}>{message.senderName || 'Integrante'}</Text>
        )}

        {/* Indicador de mensagem direcionada a um integrante */}
        {message.target && message.target.type === 'member' && (
          <View style={styles.targetBadge}>
            <Text style={styles.targetBadgeText}>
              {isDirectTarget ? '📌 Direcionada a você' : '📌 Mensagem direcionada'}
            </Text>
          </View>
        )}

        {/* Texto da mensagem */}
        <Text style={[styles.messageText, isOwn ? styles.textOwn : styles.textOther]}>
          {message.text}
        </Text>

        {/* Timestamp */}
        <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
          {formatTimeOrDate(message.createdAt)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  containerOwn: {
    justifyContent: 'flex-end',
  },
  containerOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  bubbleHighlighted: {
    borderColor: colors.primaryLight,
    borderWidth: 1.5,
    backgroundColor: '#201C38',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
    marginBottom: 4,
  },
  targetBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  targetBadgeText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  textOwn: {
    color: '#FFFFFF',
  },
  textOther: {
    color: colors.textPrimary,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timestampOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  timestampOther: {
    color: colors.textMuted,
  },
});
