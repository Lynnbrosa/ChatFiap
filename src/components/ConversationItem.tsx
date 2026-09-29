import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { Avatar } from './Avatar';
import { formatTimeOrDate } from '../utils/formatters';

interface ConversationItemProps {
  id: string;
  type: 'direct' | 'group';
  title: string;
  photoUrl?: string | null;
  lastMessage?: string;
  lastMessageAt?: number;
  onPress: () => void;
  memberCount?: number;
  memberLimit?: number;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  type,
  title,
  photoUrl,
  lastMessage,
  lastMessageAt,
  onPress,
  memberCount,
  memberLimit,
}) => {
  const isGroup = type === 'group';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrapper}>
        <Avatar uri={photoUrl} name={title} size={52} isGroup={isGroup} />
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: isGroup ? colors.badgeGroup : colors.badgeDirect },
          ]}
        >
          <Text style={styles.typeBadgeText}>{isGroup ? 'GRP' : 'DM'}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {lastMessageAt ? (
            <Text style={styles.timestamp}>{formatTimeOrDate(lastMessageAt)}</Text>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMessage || 'Nenhuma mensagem ainda'}
          </Text>
          {isGroup && memberCount !== undefined && memberLimit !== undefined && (
            <View style={styles.capacityBadge}>
              <Text style={styles.capacityText}>
                {memberCount}/{memberLimit}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  capacityBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  capacityText: {
    fontSize: 11,
    color: colors.primaryLight,
    fontWeight: '600',
  },
});
