import { Alert } from 'react-native';

export function navigateToLogin(navigation: any) {
  const target =
    navigation?.getParent?.('RootStack') ||
    navigation?.getParent?.() ||
    navigation;
  const routeNames: string[] = target?.getState?.()?.routeNames || [];
  const loginRoute = routeNames.includes('GuestLogin')
    ? 'GuestLogin'
    : routeNames.includes('Login')
      ? 'Login'
      : null;

  if (loginRoute) {
    target?.navigate?.(loginRoute);
  }
}

export function promptGuestLogin(
  navigation: any,
  message = 'This action needs a signed-in account.',
) {
  Alert.alert('Log in to continue', message, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Log In',
      onPress: () => navigateToLogin(navigation),
    },
  ]);
}
