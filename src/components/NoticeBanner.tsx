import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type NoticeTone = 'warning' | 'info' | 'success';

interface NoticeBannerProps {
  message: string | null;
  tone?: NoticeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const TONES: Record<NoticeTone, { color: string; background: string }> = {
  warning: { color: colors.warning, background: colors.warningMuted },
  info: { color: colors.info, background: 'rgba(56, 189, 248, 0.12)' },
  success: { color: colors.accent, background: colors.accentMuted },
};

/** Aviso não bloqueante (conectividade, notificações, uploads). */
export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  message,
  tone = 'warning',
  icon = 'information-circle',
  actionLabel,
  onAction,
  onDismiss,
}) => {
  if (!message) return null;
  const palette = TONES[tone];

  return (
    <View style={[styles.container, { backgroundColor: palette.background, borderLeftColor: palette.color }]}>
      <Ionicons name={icon} size={20} color={palette.color} style={styles.icon} />
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} style={styles.actionButton}>
            <Text style={[styles.actionText, { color: palette.color }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton} accessibilityLabel="Fechar aviso">
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    marginHorizontal: 16,
  },
  icon: {
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 4,
  },
  actionText: {
    fontWeight: '700',
    fontSize: 13,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 6,
  },
});
