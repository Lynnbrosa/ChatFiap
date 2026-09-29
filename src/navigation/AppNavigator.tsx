import React, { useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { useNotificationNavigation } from '../hooks/useNotifications';
import { colors } from '../theme/colors';
import { Loading } from '../components/Loading';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { GroupFormScreen } from '../screens/GroupFormScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { GroupMembersScreen } from '../screens/GroupMembersScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
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
  const { initializing, isAuthenticated } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [navigationReady, setNavigationReady] = useState<boolean>(false);

  // Toque na notificação → abre a conversa (inclusive com o app fechado)
  useNotificationNavigation(navigationRef, navigationReady, isAuthenticated);

  // Só a recuperação inicial da sessão ocupa a tela inteira. Login/cadastro mostram o
  // loading no próprio botão, para não desmontar o formulário nem perder mensagens de erro.
  if (initializing) {
    return <Loading message="Recuperando sessão..." fullscreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => setNavigationReady(true)}
    >
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen
              name="Conversations"
              component={ConversationsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="Users"
              component={UsersScreen}
              options={({ route }) => ({
                title:
                  route.params.mode === 'group_select' ? 'Selecionar integrantes' : 'Nova conversa',
              })}
            />
            <Stack.Screen
              name="GroupForm"
              component={GroupFormScreen}
              options={({ route }) => ({
                title: route.params?.groupId ? 'Configurações do grupo' : 'Novo grupo',
              })}
            />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="GroupMembers"
              component={GroupMembersScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
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
