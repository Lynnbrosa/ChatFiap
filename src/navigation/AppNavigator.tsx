import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { Loading } from '../components/Loading';

// Telas
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { GroupFormScreen } from '../screens/GroupFormScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { GroupMembersScreen } from '../screens/GroupMembersScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const darkNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.surfaceBorder,
    primary: colors.primary,
  },
};

export const AppNavigator: React.FC = () => {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return <Loading message="Inicializando sessão..." fullscreen />;
  }

  return (
    <NavigationContainer theme={darkNavigationTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {firebaseUser ? (
          // Fluxo Autenticado
          <>
            <Stack.Screen
              name="Conversations"
              component={ConversationsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Users"
              component={UsersScreen}
              options={({ route }) => ({
                title:
                  route.params?.mode === 'group_select'
                    ? 'Selecionar Integrantes'
                    : 'Nova Conversa',
              })}
            />
            <Stack.Screen
              name="GroupForm"
              component={GroupFormScreen}
              options={{
                title: 'Configurações de Grupo',
              }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GroupMembers"
              component={GroupMembersScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Fluxo de Autenticação
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
