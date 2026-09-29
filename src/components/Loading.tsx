import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface LoadingProps {
  message?: string;
  fullscreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Carregando...',
  fullscreen = false,
}) => {
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
