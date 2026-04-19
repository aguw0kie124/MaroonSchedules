import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  GraduationCap,
  Hash,
  KeyRound,
  Mail,
  ShieldCheck,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeInUp,
  FadeOutLeft,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useSessionStore } from '../store/sessionStore';
import { AppleIcon, GoogleIcon } from './common/CustomIcons';

const COLORS = {
  maroon: '#500000',
  maroonLight: '#700000',
  background: '#FDFCFB',
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#565555',
  outline: 'rgba(0, 0, 0, 0.08)',
};

type EntryView = 'welcome' | 'signup' | 'login' | 'admin';
type ScreenView =
  | EntryView
  | 'email_signin'
  | 'email_signup'
  | 'otp_verify'
  | 'forgot_password'
  | 'reset_password';
type AccountMode = 'user' | 'admin';
type OAuthFlow = 'tamu' | 'admin' | 'apple' | 'adminApple' | 'email';
type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error' | 'none';

const PAGE_ENTERING = FadeInRight.duration(300);
const PAGE_EXITING = FadeOutLeft.duration(220);

interface AuthLandingProps {
  initialView?: EntryView;
  onBack?: () => void;
}

export function AuthLanding({ initialView = 'welcome', onBack }: AuthLandingProps) {
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const exitGuestMode = useSessionStore((state) => state.exitGuestMode);
  const setAuthMode = useSessionStore((state) => state.setAuthMode);
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  const authMode = useSessionStore((state) => state.authMode);

  const [view, setView] = useState<ScreenView>(initialView);
  const [entryView, setEntryView] = useState<EntryView>(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFlow, setActiveFlow] = useState<OAuthFlow | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const liveGlow = useSharedValue(0);
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const oauthRedirectUrl = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: 'maroonlife',
        path: 'sso-callback',
      }),
    [],
  );

  useEffect(() => {
    setView(initialView);
    setEntryView(initialView);
    if (initialView === 'welcome') {
      resetSessionMode();
      return;
    }
    setAuthMode(initialView === 'admin' ? 'admin' : 'user');
  }, [initialView, resetSessionMode, setAuthMode]);

  useEffect(() => {
    liveGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0, { duration: 1800 }),
      ),
      -1,
      false,
    );
  }, [liveGlow]);

  const selectedMode: AccountMode = useMemo(
    () => (entryView === 'admin' || authMode === 'admin' ? 'admin' : 'user'),
    [authMode, entryView],
  );

  const liveGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.92 + liveGlow.value * 0.08,
    textShadowRadius: 4 + liveGlow.value * 6,
    transform: [{ scale: 1 + liveGlow.value * 0.012 }],
  }));

  const iconGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + liveGlow.value * 0.16,
    shadowOpacity: 0.18 + liveGlow.value * 0.14,
    shadowRadius: 18 + liveGlow.value * 16,
    transform: [{ scale: 1.02 + liveGlow.value * 0.14 }],
  }));

  const triggerHaptic = (kind: HapticKind = 'selection') => {
    switch (kind) {
      case 'selection':
        Haptics.selectionAsync().catch(() => {});
        return;
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      case 'none':
      default:
        return;
    }
  };

  const transitionToView = (nextView: ScreenView, haptic: HapticKind = 'selection') => {
    if (nextView !== view) {
      triggerHaptic(haptic);
    }
    setView(nextView);
  };

  const getAuthErrorMessage = (_flow: string, err: any) =>
    err?.errors?.[0]?.longMessage ||
    err?.errors?.[0]?.message ||
    err?.message ||
    'Action failed';

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setCode('');
  };

  const navigateToEntry = (nextView: EntryView) => {
    if (nextView !== view || nextView !== entryView) {
      triggerHaptic(nextView === 'welcome' ? 'selection' : 'light');
    }
    resetFields();
    setEntryView(nextView);
    setView(nextView);
    if (nextView === 'welcome') {
      resetSessionMode();
      return;
    }
    setAuthMode(nextView === 'admin' ? 'admin' : 'user');
  };

  const handleEntryBack = () => {
    if (onBack && initialView !== 'welcome' && entryView === initialView && view === initialView) {
      triggerHaptic('selection');
      onBack();
      return;
    }
    navigateToEntry('welcome');
  };

  const openEmailFlow = (nextView: 'email_signin' | 'email_signup') => {
    triggerHaptic('light');
    exitGuestMode();
    setAuthMode(entryView === 'admin' ? 'admin' : 'user');
    setPassword('');
    setCode('');
    setView(nextView);
  };

  const onOAuthPress = async (flow: Exclude<OAuthFlow, 'email'>) => {
    if (isExpoGo) {
      triggerHaptic('warning');
      Alert.alert(
        'Development build required',
        'Google and Apple sign-in with Clerk require a development build. Expo Go falls back to exp:// callback URLs, which Clerk rejects for mobile OAuth. Run `npm run ios` or `npm run android`, then try again there.',
      );
      return;
    }
    try {
      triggerHaptic('light');
      exitGuestMode();
      setAuthMode(flow === 'admin' || flow === 'adminApple' ? 'admin' : 'user');
      setIsLoading(true);
      setActiveFlow(flow);
      const authResult =
        flow === 'apple' || flow === 'adminApple'
          ? await startAppleOAuthFlow({
              redirectUrl: oauthRedirectUrl,
            })
          : await startGoogleOAuthFlow({
              redirectUrl: oauthRedirectUrl,
            });
      const { createdSessionId, setActive } = authResult;
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        triggerHaptic('success');
      } else {
        triggerHaptic('error');
        resetSessionMode();
        Alert.alert('Error', 'Clerk did not return a valid session for this sign-in attempt.');
      }
    } catch (err: any) {
      triggerHaptic('error');
      resetSessionMode();
      console.warn('Sign in failed', flow, JSON.stringify(err, null, 2));
      Alert.alert('Error', getAuthErrorMessage(flow, err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onEmailSignIn = async () => {
    if (!isSignInLoaded) return;
    if (!email || !password) {
      triggerHaptic('warning');
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setActiveFlow('email');
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
        console.warn('Incomplete sign in status:', result.status);
        Alert.alert(
          'Notice',
          'Additional verification is required. Please use a browser to complete your account setup.',
        );
      }
    } catch (err: any) {
      triggerHaptic('error');
      console.warn('Email sign in failed', JSON.stringify(err, null, 2));
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onEmailSignUp = async () => {
    if (!isSignUpLoaded) return;
    if (!email || !password) {
      triggerHaptic('warning');
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setActiveFlow('email');
    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      triggerHaptic('success');
      transitionToView('otp_verify', 'none');
    } catch (err: any) {
      triggerHaptic('error');
      console.warn('Email sign up failed', JSON.stringify(err, null, 2));
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onVerifyEmail = async () => {
    if (!isSignUpLoaded) return;
    if (!code) {
      triggerHaptic('warning');
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }

    setIsLoading(true);
    setActiveFlow('email');
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
        console.warn('Incomplete verification status:', result.status);
        Alert.alert('Error', 'Verification failed. Please check the code and try again.');
      }
    } catch (err: any) {
      triggerHaptic('error');
      console.warn('Verification failed', JSON.stringify(err, null, 2));
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onForgotPassword = async () => {
    if (!isSignInLoaded) return;
    if (!email) {
      triggerHaptic('warning');
      Alert.alert('Error', 'Please enter your email address first.');
      return;
    }

    setIsLoading(true);
    setActiveFlow('email');
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      triggerHaptic('success');
      transitionToView('reset_password', 'none');
    } catch (err: any) {
      triggerHaptic('error');
      console.warn('Password reset request failed', JSON.stringify(err, null, 2));
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onResetPassword = async () => {
    if (!isSignInLoaded) return;
    if (!code || !password) {
      triggerHaptic('warning');
      Alert.alert('Error', 'Please enter both the code and your new password.');
      return;
    }

    setIsLoading(true);
    setActiveFlow('email');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
        console.warn('Incomplete reset status:', result.status);
        Alert.alert('Error', 'Reset failed. Please check the code and try again.');
      }
    } catch (err: any) {
      triggerHaptic('error');
      console.warn('Password reset failed', JSON.stringify(err, null, 2));
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const resendVerificationCode = async () => {
    if (!isSignUpLoaded) return;
    try {
      triggerHaptic('selection');
      setIsLoading(true);
      setActiveFlow('email');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      triggerHaptic('success');
      Alert.alert('Verification code sent', 'Check your inbox for a fresh code.');
    } catch (err: any) {
      triggerHaptic('error');
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const renderWelcome = () => (
    <Animated.View entering={PAGE_ENTERING} exiting={PAGE_EXITING} style={styles.container}>
      <Animated.View entering={FadeInDown.duration(280)} style={styles.centerContent}>
        <View style={styles.logoHeroWrap}>
          <Animated.View style={[styles.logoGlowHalo, iconGlowStyle]} />
          <Animated.View entering={ZoomIn.duration(340)} style={styles.logoCircleLarge}>
            <GraduationCap size={48} color="#FFFFFF" />
          </Animated.View>
        </View>
        <Animated.View entering={FadeInDown.delay(50).duration(260)} style={styles.brandNameRow}>
          <Text style={[styles.brandName, styles.brandMaroonText]}>Maroon</Text>
          <Text style={[styles.brandName, styles.brandLifeText]}>Life</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(120).duration(280)} style={styles.taglineRow}>
          <Text style={styles.tagline}>Your Campus. </Text>
          <Animated.Text style={[styles.tagline, styles.liveText, liveGlowStyle]}>Live</Animated.Text>
          <Text style={styles.tagline}>.</Text>
        </Animated.View>
      </Animated.View>

      <View style={styles.buttonGroup}>
        <Animated.View entering={FadeInUp.delay(180).duration(280)}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigateToEntry('signup')}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Sign up free</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240).duration(280)}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigateToEntry('login')}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            <Text style={styles.secondaryButtonText}>Log in</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(280)}>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => navigateToEntry('admin')}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.adminButtonText}>Are you an admin?</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );

  const renderAuthView = (type: Extract<EntryView, 'signup' | 'login' | 'admin'>) => {
    const googleFlow = type === 'admin' ? 'admin' : 'tamu';
    const appleFlow = type === 'admin' ? 'adminApple' : 'apple';

    return (
      <Animated.View entering={PAGE_ENTERING} exiting={PAGE_EXITING} style={styles.container}>
        <Animated.View entering={FadeInDown.duration(220)}>
          <TouchableOpacity style={styles.backButton} onPress={handleEntryBack} activeOpacity={0.8}>
            <ChevronLeft size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(260)} style={styles.headerArea}>
          <Animated.View entering={ZoomIn.delay(70).duration(280)} style={styles.logoCircleSmall}>
            {type === 'admin' ? (
              <ShieldCheck size={32} color={COLORS.maroon} />
            ) : (
              <GraduationCap size={32} color={COLORS.maroon} />
            )}
          </Animated.View>
          <Text style={styles.viewTitle}>
            {type === 'signup' ? 'Get started' : type === 'login' ? 'Login to MaroonLife' : 'Admin'}
          </Text>
          <Text style={styles.viewCaption}>
            {type === 'signup'
              ? 'Discover events, places, social, and more.'
              : type === 'admin'
                ? 'Post and manage featured campus events'
                : ''}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(300)} style={styles.authGroup}>
          <Animated.View entering={FadeInUp.delay(140).duration(280)}>
            <TouchableOpacity
              style={styles.primaryAuthButton}
              onPress={() => openEmailFlow(type === 'signup' ? 'email_signup' : 'email_signin')}
              disabled={isLoading}
              activeOpacity={0.9}
            >
              <Mail size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Continue with email</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(180).duration(280)} style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.line} />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(220).duration(280)}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => onOAuthPress(googleFlow)}
              disabled={isLoading}
              activeOpacity={0.9}
            >
              {isLoading && activeFlow === googleFlow ? (
                <ActivityIndicator color={COLORS.maroon} />
              ) : (
                <GoogleIcon size={20} />
              )}
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(260).duration(280)}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => onOAuthPress(appleFlow)}
              disabled={isLoading}
              activeOpacity={0.9}
            >
              {isLoading && activeFlow === appleFlow ? (
                <ActivityIndicator color={COLORS.maroon} />
              ) : (
                <AppleIcon size={20} color={COLORS.maroon} />
              )}
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(320).duration(280)} style={styles.footer}>
          <Text style={styles.footerText}>
            {type === 'admin'
              ? 'Not an Admin? '
              : type === 'signup'
                ? 'Already have an account? '
                : "Don't have an account? "}
            <Text
              style={styles.footerLink}
              onPress={() => {
                if (type === 'admin') {
                  navigateToEntry('welcome');
                  return;
                }
                navigateToEntry(type === 'signup' ? 'login' : 'signup');
              }}
            >
              {type === 'admin' ? 'Go back' : type === 'signup' ? 'Log in' : 'Sign up'}
            </Text>
          </Text>
        </Animated.View>
      </Animated.View>
    );
  };

  const renderInput = ({
    value,
    onChangeText,
    placeholder,
    icon,
    secureTextEntry,
    keyboardType,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    icon: React.ReactNode;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'number-pad';
  }) => (
    <View style={styles.inputField}>
      {icon}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        editable={!isLoading}
      />
    </View>
  );

  const renderFormLayout = ({
    title,
    caption,
    icon,
    backTarget,
    actionLabel,
    onAction,
    children,
    footerContent,
  }: {
    title: string;
    caption: string;
    icon: React.ReactNode;
    backTarget: ScreenView;
    actionLabel: string;
    onAction: () => void;
    children: React.ReactNode;
    footerContent?: React.ReactNode;
  }) => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.formScrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={PAGE_ENTERING} exiting={PAGE_EXITING} style={styles.formContainer}>
        <Animated.View entering={FadeInDown.duration(220)}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => transitionToView(backTarget)}
            activeOpacity={0.8}
          >
            <ChevronLeft size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(260)} style={styles.headerArea}>
          <Animated.View entering={ZoomIn.delay(70).duration(280)} style={styles.logoCircleSmall}>
            {icon}
          </Animated.View>
          <Text style={styles.viewTitle}>{title}</Text>
          <Text style={styles.viewCaption}>{caption}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(130).duration(300)} style={styles.formGroup}>
          {children}
          <Animated.View entering={FadeInUp.delay(220).duration(280)}>
            <TouchableOpacity
              style={styles.primaryAuthButton}
              onPress={onAction}
              disabled={isLoading}
              activeOpacity={0.9}
            >
              {isLoading && activeFlow === 'email' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{actionLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {footerContent ? (
          <Animated.View entering={FadeInUp.delay(280).duration(280)} style={styles.footer}>
            {footerContent}
          </Animated.View>
        ) : null}
      </Animated.View>
    </ScrollView>
  );

  const renderEmailSignIn = () =>
    renderFormLayout({
      title: selectedMode === 'admin' ? 'Admin' : 'Log in',
      caption:
        selectedMode === 'admin'
          ? 'Use your organizer credentials to continue.'
          : 'Enter your email and password to continue.',
      icon:
        selectedMode === 'admin' ? (
          <ShieldCheck size={32} color={COLORS.maroon} />
        ) : (
          <GraduationCap size={32} color={COLORS.maroon} />
        ),
      backTarget: entryView,
      actionLabel: 'Log in',
      onAction: onEmailSignIn,
      children: (
        <>
          {renderInput({
            value: email,
            onChangeText: setEmail,
            placeholder: 'Email address',
            icon: <Mail size={20} color={COLORS.maroon} />,
            keyboardType: 'email-address',
          })}
          {renderInput({
            value: password,
            onChangeText: setPassword,
            placeholder: 'Password',
            icon: <KeyRound size={20} color={COLORS.maroon} />,
            secureTextEntry: true,
          })}
          <TouchableOpacity
            style={styles.inlineLinkButton}
            onPress={() => transitionToView('forgot_password')}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.inlineLinkText}>Forgot password?</Text>
          </TouchableOpacity>
        </>
      ),
      footerContent:
        selectedMode === 'admin' ? (
          <Text style={styles.footerText}>
            Not an Admin?{' '}
            <Text style={styles.footerLink} onPress={() => navigateToEntry('welcome')}>
              Go back
            </Text>
          </Text>
        ) : (
          <Text style={styles.footerText}>
            {"Don't have an account? "}
            <Text style={styles.footerLink} onPress={() => transitionToView('email_signup')}>
              Sign up
            </Text>
          </Text>
        ),
    });

  const renderEmailSignUp = () =>
    renderFormLayout({
      title: 'Create account',
      caption: 'Create your MaroonLife account with email and password.',
      icon: <GraduationCap size={32} color={COLORS.maroon} />,
      backTarget: entryView,
      actionLabel: 'Sign up free',
      onAction: onEmailSignUp,
      children: (
        <>
          {renderInput({
            value: email,
            onChangeText: setEmail,
            placeholder: 'Email address',
            icon: <Mail size={20} color={COLORS.maroon} />,
            keyboardType: 'email-address',
          })}
          {renderInput({
            value: password,
            onChangeText: setPassword,
            placeholder: 'Password',
            icon: <KeyRound size={20} color={COLORS.maroon} />,
            secureTextEntry: true,
          })}
        </>
      ),
      footerContent: (
        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Text style={styles.footerLink} onPress={() => transitionToView('email_signin')}>
            Log in
          </Text>
        </Text>
      ),
    });

  const renderOtpVerify = () =>
    renderFormLayout({
      title: 'Verify email',
      caption: `Enter the code sent to ${email || 'your inbox'}.`,
      icon: <GraduationCap size={32} color={COLORS.maroon} />,
      backTarget: 'email_signup',
      actionLabel: 'Verify and continue',
      onAction: onVerifyEmail,
      children: (
        <>
          {renderInput({
            value: code,
            onChangeText: setCode,
            placeholder: 'Verification code',
            icon: <Hash size={20} color={COLORS.maroon} />,
            keyboardType: 'number-pad',
          })}
          <TouchableOpacity
            style={styles.inlineLinkButton}
            onPress={resendVerificationCode}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.inlineLinkText}>Resend code</Text>
          </TouchableOpacity>
        </>
      ),
    });

  const renderForgotPassword = () =>
    renderFormLayout({
      title: 'Reset password',
      caption: 'Enter your email to receive a reset code.',
      icon:
        selectedMode === 'admin' ? (
          <ShieldCheck size={32} color={COLORS.maroon} />
        ) : (
          <GraduationCap size={32} color={COLORS.maroon} />
        ),
      backTarget: 'email_signin',
      actionLabel: 'Send reset code',
      onAction: onForgotPassword,
      children: (
        <>
          {renderInput({
            value: email,
            onChangeText: setEmail,
            placeholder: 'Email address',
            icon: <Mail size={20} color={COLORS.maroon} />,
            keyboardType: 'email-address',
          })}
        </>
      ),
    });

  const renderResetPassword = () =>
    renderFormLayout({
      title: 'Choose a new password',
      caption: 'Enter the reset code and your new password.',
      icon:
        selectedMode === 'admin' ? (
          <ShieldCheck size={32} color={COLORS.maroon} />
        ) : (
          <GraduationCap size={32} color={COLORS.maroon} />
        ),
      backTarget: 'forgot_password',
      actionLabel: 'Reset password',
      onAction: onResetPassword,
      children: (
        <>
          {renderInput({
            value: code,
            onChangeText: setCode,
            placeholder: 'Reset code',
            icon: <Hash size={20} color={COLORS.maroon} />,
            keyboardType: 'number-pad',
          })}
          {renderInput({
            value: password,
            onChangeText: setPassword,
            placeholder: 'New password',
            icon: <KeyRound size={20} color={COLORS.maroon} />,
            secureTextEntry: true,
          })}
        </>
      ),
    });

  const renderCurrentView = () => {
    switch (view) {
      case 'welcome':
        return renderWelcome();
      case 'signup':
      case 'login':
      case 'admin':
        return renderAuthView(view);
      case 'email_signin':
        return renderEmailSignIn();
      case 'email_signup':
        return renderEmailSignUp();
      case 'otp_verify':
        return renderOtpVerify();
      case 'forgot_password':
        return renderForgotPassword();
      case 'reset_password':
        return renderResetPassword();
      default:
        return renderWelcome();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {renderCurrentView()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingTop: 40,
  },
  formScrollContent: {
    flexGrow: 1,
  },
  formContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingTop: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  logoHeroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoGlowHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(128, 12, 12, 0.18)',
    shadowColor: COLORS.maroon,
    shadowOffset: { width: 0, height: 0 },
  },
  logoCircleLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandName: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  brandMaroonText: {
    color: COLORS.maroon,
  },
  brandLifeText: {
    color: '#121212',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagline: {
    fontSize: 18,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  liveText: {
    color: COLORS.maroon,
    fontWeight: '700',
    textShadowColor: 'rgba(128, 12, 12, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
  },
  buttonGroup: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.maroon,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  secondaryButtonText: {
    color: COLORS.maroon,
    fontSize: 16,
    fontWeight: '700',
  },
  adminButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  adminButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircleSmall: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  viewTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.maroon,
    textAlign: 'center',
  },
  viewCaption: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  authGroup: {
    gap: 12,
  },
  formGroup: {
    gap: 12,
  },
  primaryAuthButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.maroon,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.outline,
  },
  dividerText: {
    marginHorizontal: 16,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  socialButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.outline,
    minHeight: 52,
  },
  socialButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  inlineLinkButton: {
    alignItems: 'center',
    marginTop: 4,
  },
  inlineLinkText: {
    color: COLORS.maroon,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  footerLink: {
    color: COLORS.maroon,
    fontWeight: '800',
  },
});
