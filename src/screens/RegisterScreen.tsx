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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { ErrorMessage } from '../components/ErrorMessage';
import { PhotoPicker } from '../components/PhotoPicker';
import { PickedImage } from '../types/image';
import { formatPhoneNumber, formatBirthDate } from '../utils/formatters';
import { isValidBirthDate, isValidEmail, isValidPhoneNumber } from '../utils/validators';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { register, actionLoading, authError, clearError } = useAuth();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!name.trim()) return 'Informe seu nome completo.';
    if (name.trim().length > 80) return 'O nome pode ter no máximo 80 caracteres.';
    if (!isValidEmail(email)) return 'Informe um e-mail válido.';
    if (!isValidPhoneNumber(phoneNumber)) return 'Informe um celular válido com DDD.';
    if (!isValidBirthDate(birthDate)) return 'Informe uma data de nascimento válida (DD/MM/AAAA).';
    if (password.length < 6) return 'A senha deve ter no mínimo 6 caracteres.';
    if (password !== confirmPassword) return 'A confirmação de senha não coincide com a senha.';
    return null;
  };

  const handleRegister = async () => {
    setLocalError(null);
    clearError();

    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    // Em caso de sucesso o app entra direto nas conversas; em caso de falha o
    // formulário continua preenchido e o erro amigável aparece em authError.
    await register({
      name: name.trim(),
      email: email.trim(),
      password,
      phoneNumber: phoneNumber.trim(),
      birthDate: birthDate.trim(),
      photo,
    });
  };

  const activeError = localError || authError;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Criar nova conta</Text>
          <Text style={styles.subtitle}>Preencha seus dados para começar a conversar</Text>
        </View>

        <ErrorMessage
          message={activeError || ''}
          onDismiss={() => {
            setLocalError(null);
            clearError();
          }}
        />

        <View style={styles.card}>
          <View style={styles.avatarSection}>
            <PhotoPicker
              image={photo}
              label="Foto de perfil"
              size={90}
              onChange={setPhoto}
              onError={setLocalError}
              disabled={actionLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome completo</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Carlos Silva"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={80}
              />
            </View>
          </View>

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
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número de celular</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data de nascimento</Text>
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
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeButton}
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar senha</Text>
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

          <TouchableOpacity
            style={[styles.submitButton, actionLoading && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Cadastrar conta</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Já tem uma conta?</Text>
            <TouchableOpacity
              onPress={() => {
                clearError();
                navigation.navigate('Login');
              }}
              disabled={actionLoading}
            >
              <Text style={styles.loginLink}> Fazer login</Text>
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
