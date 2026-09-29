import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
  onDismiss,
}) => {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle" size={22} color={colors.danger} style={styles.icon} />
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
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
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  icon: {
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  message: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 6,
  },
  retryText: {
    color: colors.primaryLight,
    fontWeight: '700',
    fontSize: 13,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 6,
  },
});
