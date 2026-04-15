import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  SafeAreaView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { TYPOGRAPHY, SPACING } from '../constants';
import { Button } from './Button';
import * as Linking from 'expo-linking';
import { useSessionStore } from '../store/sessionStore';
import { GoogleIcon } from './common/CustomIcons';
import { useTheme } from './SharedUI';
import { Mail, KeyRound, ArrowLeft, UserPlus, LogIn, Hash } from 'lucide-react-native';

const APPLE_LABEL = '\uF8FF';

type AuthFlow = 'initial' | 'email_signin' | 'email_signup' | 'otp_verify' | 'forgot_password' | 'reset_password';

export function AuthLanding() {
  const { COLORS, campusTheme } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const exitGuestMode = useSessionStore((state) => state.exitGuestMode);
  const setAuthMode = useSessionStore((state) => state.setAuthMode);
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  const authMode = useSessionStore((state) => state.authMode);

  const [isLoading, setIsLoading] = useState(false);
  const [activeFlow, setActiveFlow] = useState<'tamu' | 'admin' | 'apple' | 'adminApple' | 'email' | null>(null);
  const [authFlow, setAuthFlow] = useState<AuthFlow>('initial');

  // Email flow state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const getAuthErrorMessage = (flow: string, err: any) => {
    return (
      err?.errors?.[0]?.longMessage ||
      err?.errors?.[0]?.message ||
      err?.message ||
      'Action failed'
    );
  };

  const onOAuthPress = async (flow: 'tamu' | 'admin' | 'apple' | 'adminApple') => {
    try {
      exitGuestMode();
      setAuthMode(flow === 'admin' || flow === 'adminApple' ? 'admin' : 'user');
      setIsLoading(true);
      setActiveFlow(flow);
      const authResult =
        flow === 'apple' || flow === 'adminApple'
          ? await startAppleOAuthFlow({
              redirectUrl: Linking.createURL('/'),
            })
          : await startGoogleOAuthFlow({
              redirectUrl: Linking.createURL('/'),
            });
      const { createdSessionId, setActive } = authResult;
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else {
        resetSessionMode();
        Alert.alert('Error', 'Clerk did not return a valid session for this sign-in attempt.');
      }
    } catch (err: any) {
      resetSessionMode();
      console.warn('Sign in failed', flow, JSON.stringify(err, null, 2));
      Alert.alert('Error', getAuthErrorMessage(flow, err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onEmailFlowEntry = (mode: 'user' | 'admin') => {
    setAuthMode(mode);
    setEmail('');
    setPassword('');
    setAuthFlow('email_signin');
  };

  const toggleAuthFlow = (flow: AuthFlow) => {
    setEmail('');
    setPassword('');
    setAuthFlow(flow);
  };

  // Logic copied from LoginScreen.tsx
  const onEmailSignIn = async () => {
    if (!isSignInLoaded) return;
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setActiveFlow('email');
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
      } else {
        Alert.alert('Notice', 'Additional verification is required. Please use a browser to complete setup.');
      }
    } catch (err: any) {
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onEmailSignUp = async () => {
    if (!isSignUpLoaded) return;
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setActiveFlow('email');
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setAuthFlow('otp_verify');
    } catch (err: any) {
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onVerifyEmail = async () => {
    if (!isSignUpLoaded) return;
    if (!code) {
      Alert.alert('Error', 'Please enter verification code.');
      return;
    }
    setIsLoading(true);
    setActiveFlow('email');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onForgotPassword = async () => {
    if (!isSignInLoaded || !email) {
      Alert.alert('Error', 'Enter email first.');
      return;
    }
    setIsLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setAuthFlow('reset_password');
    } catch (err: any) {
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (!isSignInLoaded || !code || !password) return;
    setIsLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code, password });
      if (result.status === 'complete') await setSignInActive({ session: result.createdSessionId });
    } catch (err: any) {
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
    }
  };

  const renderGoogleLabel = () => (
    <View style={styles.oauthLabel}>
      <GoogleIcon size={24} />
    </View>
  );

  const renderAppleLabel = () => (
    <View style={styles.oauthLabel}>
      <Text style={styles.appleIconOnly}>{APPLE_LABEL}</Text>
    </View>
  );

  const renderInitialFlow = () => (
    <View style={styles.buttonGroup}>
      <View style={styles.accountCard}>
        <View style={styles.accountHeader}>
          <Text style={styles.accountTitle}>Student</Text>
          <Text style={styles.accountSubtitle}>Classes, events, places, and campus tools</Text>
        </View>
            <View style={styles.providerRow}>
              <Button
                variant="primary"
                style={styles.providerButton}
                onPress={() => onOAuthPress('tamu')}
                disabled={isLoading}
              >
                {isLoading && activeFlow === 'tamu' ? <ActivityIndicator color="#FFF" /> : renderGoogleLabel()}
              </Button>
              {Platform.OS === 'ios' && (
                <Button
                  variant="secondary"
                  style={styles.providerButton}
                  onPress={() => onOAuthPress('apple')}
                  disabled={isLoading}
                >
                  {isLoading && activeFlow === 'apple' ? <ActivityIndicator color={COLORS.primary} /> : renderAppleLabel()}
                </Button>
              )}
            </View>
        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.line} />
        </View>
        <Button
          variant="secondary"
          style={styles.emailOptionButton}
          onPress={() => onEmailFlowEntry('user')}
          disabled={isLoading}
        >
          <Mail size={18} color={COLORS.primary} />
          <Text style={styles.emailOptionText}>Continue with Email</Text>
        </Button>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountHeader}>
          <Text style={styles.accountTitle}>Admin</Text>
          <Text style={styles.accountSubtitle}>Post and manage featured campus events</Text>
        </View>
            <View style={styles.providerRow}>
              <Button
                variant="secondary"
                style={styles.providerButton}
                onPress={() => onOAuthPress('admin')}
                disabled={isLoading}
              >
                {isLoading && activeFlow === 'admin' ? <ActivityIndicator color={COLORS.primary} /> : renderGoogleLabel()}
              </Button>
              {Platform.OS === 'ios' && (
                <Button
                  variant="secondary"
                  style={styles.providerButton}
                  onPress={() => onOAuthPress('adminApple')}
                  disabled={isLoading}
                >
                  {isLoading && activeFlow === 'adminApple' ? <ActivityIndicator color={COLORS.primary} /> : renderAppleLabel()}
                </Button>
              )}
            </View>
        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.line} />
        </View>
        <Button
          variant="secondary"
          style={styles.emailOptionButton}
          onPress={() => onEmailFlowEntry('admin')}
          disabled={isLoading}
        >
          <Mail size={18} color={COLORS.primary} />
          <Text style={styles.emailOptionText}>Continue with Email</Text>
        </Button>
      </View>
    </View>
  );

  const renderEmailSignIn = () => (
    <View style={styles.emailFlowContainer}>
      <Pressable style={styles.backButtonInline} onPress={() => setAuthFlow('initial')}>
        <ArrowLeft size={20} color={COLORS.primary} />
        <Text style={styles.backButtonTextInline}>Back</Text>
      </Pressable>
      <Text style={styles.flowTitle}>{authMode === 'admin' ? 'Admin Login' : 'Student Login'}</Text>
      <Text style={styles.flowSubtitle}>Enter your email and password.</Text>
      <View style={styles.inputWrapper}>
        <Mail size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={COLORS.textTertiary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      </View>
      <View style={styles.inputWrapper}>
        <KeyRound size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textTertiary} value={password} onChangeText={setPassword} secureTextEntry />
      </View>
      <Button variant="primary" style={styles.submitButton} onPress={onEmailSignIn} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#FFF" /> : <View style={styles.buttonContent}><LogIn size={20} color="#FFF" /><Text style={styles.submitButtonText}>Sign In</Text></View>}
      </Button>
      <View style={styles.authLinksRow}>
        <Pressable onPress={() => setAuthFlow('forgot_password')}><Text style={styles.footerLink}>Forgot password?</Text></Pressable>
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>New here?</Text>
        <Pressable 
          onPress={() => toggleAuthFlow('email_signup')}
          hitSlop={15}
        >
          <Text style={styles.footerLink}>Create account</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderEmailSignUp = () => (
    <View style={styles.emailFlowContainer}>
      <Pressable style={styles.backButtonInline} onPress={() => setAuthFlow('email_signin')}>
        <ArrowLeft size={20} color={COLORS.primary} />
        <Text style={styles.backButtonTextInline}>Back to sign in</Text>
      </Pressable>
      <Text style={styles.flowTitle}>Create Account</Text>
      <Text style={styles.flowSubtitle}>Join MaroonSchedules as a {authMode === 'admin' ? 'Campus Admin' : 'Student'}.</Text>
      <View style={styles.inputWrapper}>
        <Mail size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={COLORS.textTertiary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      </View>
      <View style={styles.inputWrapper}>
        <KeyRound size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textTertiary} value={password} onChangeText={setPassword} secureTextEntry />
      </View>
      <Button variant="primary" style={styles.submitButton} onPress={onEmailSignUp} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#FFF" /> : <View style={styles.buttonContent}><UserPlus size={20} color="#FFF" /><Text style={styles.submitButtonText}>Create Account</Text></View>}
      </Button>
    </View>
  );

  const renderOtpVerify = () => (
    <View style={styles.emailFlowContainer}>
      <Text style={styles.flowTitle}>Verify Email</Text>
      <Text style={styles.flowSubtitle}>Enter the code sent to {email}.</Text>
      <View style={styles.inputWrapper}>
        <Hash size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Code" placeholderTextColor={COLORS.textTertiary} value={code} onChangeText={setCode} keyboardType="number-pad" />
      </View>
      <Button variant="primary" style={styles.submitButton} onPress={onVerifyEmail} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Verify & Continue</Text>}
      </Button>
    </View>
  );

  const renderForgotPassword = () => (
    <View style={styles.emailFlowContainer}>
      <Pressable style={styles.backButtonInline} onPress={() => setAuthFlow('email_signin')}>
        <ArrowLeft size={20} color={COLORS.primary} />
        <Text style={styles.backButtonTextInline}>Back</Text>
      </Pressable>
      <Text style={styles.flowTitle}>Reset Password</Text>
      <View style={styles.inputWrapper}>
        <Mail size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.textTertiary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      </View>
      <Button variant="primary" style={styles.submitButton} onPress={onForgotPassword} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Send Reset Code</Text>}
      </Button>
    </View>
  );

  const renderResetPassword = () => (
    <View style={styles.emailFlowContainer}>
      <Text style={styles.flowTitle}>New Password</Text>
      <View style={styles.inputWrapper}>
        <Hash size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Code" placeholderTextColor={COLORS.textTertiary} value={code} onChangeText={setCode} keyboardType="number-pad" />
      </View>
      <View style={styles.inputWrapper}>
        <KeyRound size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="New Password" placeholderTextColor={COLORS.textTertiary} value={password} onChangeText={setPassword} secureTextEntry />
      </View>
      <Button variant="primary" style={styles.submitButton} onPress={onResetPassword} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Reset Password</Text>}
      </Button>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.colorAccentTop} />
          {authFlow === 'initial' && (
            <>
              <View style={styles.logoContainer}>
                <Image source={campusTheme.branding.logo} style={styles.logoImage} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.appTitle}>MaroonSchedules</Text>
                <Text style={styles.campusTitle}>{campusTheme.branding.campusName}</Text>
              </View>
              <View style={styles.accentLine} />
              <View style={styles.spacer} />
              {renderInitialFlow()}
            </>
          )}
          {authFlow === 'email_signin' && renderEmailSignIn()}
          {authFlow === 'email_signup' && renderEmailSignUp()}
          {authFlow === 'otp_verify' && renderOtpVerify()}
          {authFlow === 'forgot_password' && renderForgotPassword()}
          {authFlow === 'reset_password' && renderResetPassword()}
          <View style={styles.colorAccentBottom} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
    position: 'relative',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  colorAccentTop: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 100,
    zIndex: 0,
    opacity: 0.5,
  },
  colorAccentBottom: {
    position: 'absolute',
    bottom: -80,
    right: -50,
    width: 180,
    height: 180,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 90,
    zIndex: 0,
  },
  logoContainer: {
    marginBottom: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  appTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
    zIndex: 1,
  },
  campusTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  accentLine: {
    width: 60,
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginBottom: SPACING.lg,
    zIndex: 1,
  },
  spacer: {
    height: SPACING.xs,
  },
  buttonGroup: {
    width: '100%',
    zIndex: 1,
    gap: SPACING.md,
  },
  accountCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  accountHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  accountTitle: {
    ...TYPOGRAPHY.body,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  accountSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: 4,
  },
  providerButton: {
    width: 64,
    height: 52,
    paddingHorizontal: 0,
  },
  oauthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  providerButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  appleIconOnly: {
    fontSize: 24,
    color: COLORS.primary,
  },
  oauthLabelTextPrimary: {
    color: '#FFFFFF',
  },
  oauthLabelTextSecondary: {
    color: COLORS.primary,
  },
  emailOptionButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    borderRadius: 12,
  },
  emailOptionText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    ...TYPOGRAPHY.body,
    paddingHorizontal: 10,
    color: COLORS.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emailFlowContainer: {
    width: '100%',
    paddingTop: SPACING.md,
  },
  backButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: 8,
  },
  backButtonTextInline: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  flowTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  flowSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    ...TYPOGRAPHY.body,
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    marginTop: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  footerLink: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  authLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
});
