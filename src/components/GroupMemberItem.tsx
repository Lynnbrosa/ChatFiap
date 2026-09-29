import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Avatar } from './Avatar';
import { ChatUser } from '../types/user';

interface GroupMemberItemProps {
  member: ChatUser;
  isOwner: boolean;
  canRemove: boolean;
  onPressProfile: () => void;
  onRemove?: () => void;
}

export const GroupMemberItem: React.FC<GroupMemberItemProps> = ({
  member,
  isOwner,
  canRemove,
  onPressProfile,
  onRemove,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.profileSection}
        onPress={onPressProfile}
        activeOpacity={0.7}
      >
        <Avatar uri={member.photoUrl} name={member.name} size={44} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {member.name}
            </Text>
            {isOwner && (
              <View style={styles.ownerBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                <Text style={styles.ownerBadgeText}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {member.email}
          </Text>
        </View>
      </TouchableOpacity>

      {canRemove && onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          accessibilityLabel="Remover integrante"
        >
          <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  info: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  email: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
  },
});
