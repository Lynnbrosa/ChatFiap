import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatPhoneNumber, formatBirthDate } from '../utils/formatters';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { register, loading, authError, clearError } = useAuth();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePickPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setLocalError('Permissão para acessar a galeria de fotos foi negada.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[RegisterScreen] Erro ao selecionar imagem:', err);
      setLocalError('Erro ao abrir a galeria de imagens.');
    }
  };

  const handleRegister = async () => {
    setLocalError(null);
    clearError();

    if (!name.trim()) {
      setLocalError('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Por favor, informe seu endereço de e-mail.');
      return;
    }
    if (!password) {
      setLocalError('Por favor, crie uma senha segura.');
      return;
    }
    if (password.length < 6) {
      setLocalError('A senha deve possuir no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('A confirmação de senha não coincide com a senha digitada.');
      return;
    }
    if (!phoneNumber.trim()) {
      setLocalError('Por favor, informe seu número de celular com DDD.');
      return;
    }
    if (!birthDate.trim()) {
      setLocalError('Por favor, informe sua data de nascimento.');
      return;
    }

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        birthDate: birthDate.trim(),
        photoUri,
      });
      // Auth state changes and routes to Conversations
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no cadastro.';
      if (msg.includes('email-already-in-use')) {
        setLocalError('Este endereço de e-mail já está em uso.');
      } else if (msg.includes('invalid-email')) {
        setLocalError('Formato de e-mail inválido.');
      } else if (msg.includes('weak-password')) {
        setLocalError('A senha escolhida é fraca. Utilize números e letras.');
      } else {
        setLocalError(msg);
      }
    }
  };

  const activeError = localError || authError;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Criar Nova Conta</Text>
          <Text style={styles.subtitle}>Preencha seus dados para começar a conversar</Text>
        </View>

        <ErrorMessage message={activeError || ''} onDismiss={() => { setLocalError(null); clearError(); }} />

        <View style={styles.card}>
          {/* Seletor de Foto de Perfil */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarButton} onPress={handlePickPhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={colors.primaryLight} />
                  <Text style={styles.avatarPlaceholderText}>Adicionar Foto</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Nome */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Carlos Silva"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* E-mail */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="carlos@exemplo.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Celular com formatação */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número de Celular</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="(11) 98765-4321"
                placeholderTextColor={colors.textMuted}
                value={phoneNumber}
                onChangeText={(val) => setPhoneNumber(formatPhoneNumber(val))}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </View>

          {/* Data de Nascimento com formatação */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data de Nascimento</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.textMuted}
                value={birthDate}
                onChangeText={(val) => setBirthDate(formatBirthDate(val))}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          {/* Senha */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha (mínimo 6 caracteres)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmação de Senha */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar Senha</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="shield-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>
          </View>

          {/* Botão de Cadastro */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Cadastrar Conta</Text>
            )}
          </TouchableOpacity>

          {/* Voltar para Login */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Já tem uma conta?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}> Fazer Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 11,
    color: colors.primaryLight,
    fontWeight: '600',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 46,
    color: colors.textPrimary,
    fontSize: 15,
  },
  eyeButton: {
    padding: 8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryLight,
  },
});
