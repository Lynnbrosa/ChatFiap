import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { MessageTarget } from '../types/chat';
import { ChatUser } from '../types/user';
import { Avatar } from './Avatar';

interface ChatInputProps {
  onSend: (text: string, target?: MessageTarget, mentionedUserIds?: string[]) => Promise<void>;
  sending: boolean;
  isGroup: boolean;
  groupMembers?: ChatUser[];
  currentUserId: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  sending,
  isGroup,
  groupMembers = [],
  currentUserId,
}) => {
  const [text, setText] = useState<string>('');
  const [targetMember, setTargetMember] = useState<ChatUser | null>(null);
  const [mentionedMembers, setMentionedMembers] = useState<ChatUser[]>([]);
  const [showMemberPicker, setShowMemberPicker] = useState<boolean>(false);
  const [pickerMode, setPickerMode] = useState<'target' | 'mention'>('mention');

  // Filtra outros membros do grupo
  const eligibleMembers = groupMembers.filter((m) => m.uid !== currentUserId);

  const handleSend = async () => {
    if (!text.trim() || sending) return;

    const trimmed = text.trim();
    const target: MessageTarget = targetMember
      ? { type: 'member', memberId: targetMember.uid }
      : { type: 'conversation' };

    const mentionedIds = mentionedMembers.map((m) => m.uid);

    try {
      await onSend(trimmed, target, mentionedIds);
      setText('');
      setTargetMember(null);
      setMentionedMembers([]);
    } catch {
      // O erro já é tratado no hook pai
    }
  };

  const openPicker = (mode: 'target' | 'mention') => {
    setPickerMode(mode);
    setShowMemberPicker(true);
  };

  const handleSelectMember = (member: ChatUser) => {
    if (pickerMode === 'target') {
      setTargetMember(member);
    } else {
      if (!mentionedMembers.some((m) => m.uid === member.uid)) {
        setMentionedMembers((prev) => [...prev, member]);
        setText((prev) => (prev ? `${prev} @${member.name} ` : `@${member.name} `));
      }
    }
    setShowMemberPicker(false);
  };

  return (
    <View style={styles.container}>
      {/* Barra de alvos ou menções selecionadas */}
      {(targetMember || mentionedMembers.length > 0) && (
        <View style={styles.activePillsContainer}>
          {targetMember && (
            <View style={styles.targetPill}>
              <Ionicons name="pin" size={13} color={colors.warning} />
              <Text style={styles.pillText}>Para: {targetMember.name}</Text>
              <TouchableOpacity onPress={() => setTargetMember(null)}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {mentionedMembers.map((m) => (
            <View key={m.uid} style={styles.mentionPill}>
              <Text style={styles.pillText}>@{m.name}</Text>
              <TouchableOpacity
                onPress={() =>
                  setMentionedMembers((prev) => prev.filter((item) => item.uid !== m.uid))
                }
              >
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputRow}>
        {/* Botão de menção/direcionamento apenas para grupos */}
        {isGroup && eligibleMembers.length > 0 && (
          <TouchableOpacity
            style={styles.mentionButton}
            onPress={() => openPicker('mention')}
            accessibilityLabel="Mencionar integrante"
          >
            <Ionicons name="at" size={22} color={colors.primaryLight} />
          </TouchableOpacity>
        )}

        {isGroup && eligibleMembers.length > 0 && (
          <TouchableOpacity
            style={styles.mentionButton}
            onPress={() => openPicker('target')}
            accessibilityLabel="Direcionar mensagem a um integrante"
          >
            <Ionicons
              name={targetMember ? 'pin' : 'pin-outline'}
              size={20}
              color={targetMember ? colors.warning : colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {/* Campo de texto */}
        <TextInput
          style={styles.textInput}
          placeholder="Digite uma mensagem..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />

        {/* Botão de enviar */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Modal de seleção de membro */}
      <Modal
        visible={showMemberPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMemberPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerMode === 'target'
                  ? 'Direcionar mensagem a:'
                  : 'Mencionar integrante (@):'}
              </Text>
              <TouchableOpacity onPress={() => setShowMemberPicker(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={eligibleMembers}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberPickerItem}
                  onPress={() => handleSelectMember(item)}
                >
                  <Avatar uri={item.photoUrl} name={item.name} size={36} />
                  <Text style={styles.memberName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  activePillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  mentionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  pillText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mentionButton: {
    padding: 8,
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceBorder,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: 320,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
  },
  memberName: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
