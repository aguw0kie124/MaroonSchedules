import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  SafeAreaView,
  Alert,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Hash,
  KeyRound,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react-native';

import { COLORS, SPACING, TYPOGRAPHY } from '../constants';
import { GoogleIcon } from './common/CustomIcons';
import { ScalePressable } from './common/Motion';
import { useSessionStore } from '../store/sessionStore';

const APPLE_LABEL = '\uF8FF';

type AuthFlow =
  | 'initial'
  | 'email_signin'
  | 'email_signup'
  | 'otp_verify'
  | 'forgot_password'
  | 'reset_password';

type AccountMode = 'user' | 'admin';

type ModeConfig = {
  mode: AccountMode;
  title: string;
  subtitle: string;
  eyebrow: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
};

const MODE_CONFIG: Record<AccountMode, ModeConfig> = {
  user: {
    mode: 'user',
    title: 'Student Access',
    subtitle: 'Events, schedules, places, and campus tools in one clean flow.',
    eyebrow: 'Campus Life',
    icon: GraduationCap,
  },
  admin: {
    mode: 'admin',
    title: 'Admin Access',
    subtitle: 'Post and manage featured campus events with organizer tools.',
    eyebrow: 'Organizer Portal',
    icon: ShieldCheck,
  },
};

export function AuthLanding() {
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const selectedMode: AccountMode = authMode === 'admin' ? 'admin' : 'user';
  const modeConfig = MODE_CONFIG[selectedMode];

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

  const selectMode = (mode: AccountMode) => {
    setAuthMode(mode);
  };

  const openEmailFlow = (flow: 'email_signin' | 'email_signup', mode: AccountMode = selectedMode) => {
    setAuthMode(mode);
    resetFields();
    setAuthFlow(flow);
  };

  const onOAuthPress = async (flow: 'tamu' | 'admin' | 'apple' | 'adminApple') => {
    try {
      exitGuestMode();
      setAuthMode(flow === 'admin' || flow === 'adminApple' ? 'admin' : 'user');
      setIsLoading(true);
      setActiveFlow(flow);
      const authResult =
        flow === 'apple' || flow === 'adminApple'
          ? await startAppleOAuthFlow({ redirectUrl: Linking.createURL('/') })
          : await startGoogleOAuthFlow({ redirectUrl: Linking.createURL('/') });
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
      } else {
        Alert.alert('Error', 'Verification failed. Please check the code and try again.');
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
      Alert.alert('Error', 'Enter your email first.');
      return;
    }

    setIsLoading(true);
    setActiveFlow('email');
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setAuthFlow('reset_password');
    } catch (err: any) {
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const onResetPassword = async () => {
    if (!isSignInLoaded || !code || !password) {
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
      } else {
        Alert.alert('Error', 'Reset failed. Please check the code and try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', getAuthErrorMessage('email', err));
    } finally {
      setIsLoading(false);
      setActiveFlow(null);
    }
  };

  const googleFlow = selectedMode === 'admin' ? 'admin' : 'tamu';
  const appleFlow = selectedMode === 'admin' ? 'adminApple' : 'apple';
  const primaryCtaLabel = selectedMode === 'admin' ? 'Continue as admin' : 'Sign up free';
  const primaryCtaCaption =
    selectedMode === 'admin'
      ? 'Use your organizer credentials to manage campus events.'
      : 'Create your MaroonLife account with email and password.';

  const roleChips = useMemo(
    () =>
      (Object.keys(MODE_CONFIG) as AccountMode[]).map((mode) => {
        const config = MODE_CONFIG[mode];
        const active = mode === selectedMode;
        const Icon = config.icon;
        return (
          <ScalePressable
            key={mode}
            onPress={() => selectMode(mode)}
            style={[styles.modeChip, active && styles.modeChipActive]}
          >
            <Icon size={16} color={active ? '#FFFFFF' : '#B8B8B8'} />
            <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
              {mode === 'admin' ? 'Admin' : 'Student'}
            </Text>
          </ScalePressable>
        );
      }),
    [selectedMode],
  );

  const renderProviderButton = ({
    label,
    sublabel,
    onPress,
    icon,
    loading,
  }: {
    label: string;
    sublabel?: string;
    onPress: () => void;
    icon: React.ReactNode;
    loading?: boolean;
  }) => (
    <ScalePressable style={styles.outlineButton} onPress={onPress} disabled={isLoading}>
      <View style={styles.outlineIconWrap}>
        {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : icon}
      </View>
      <View style={styles.outlineTextWrap}>
        <Text style={styles.outlineButtonText}>{label}</Text>
        {sublabel ? <Text style={styles.outlineButtonSubtext}>{sublabel}</Text> : null}
      </View>
    </ScalePressable>
  );

  const renderInitialFlow = () => {
    const HeroIcon = modeConfig.icon;
    return (
      <>
        <View style={styles.modeSwitch}>{roleChips}</View>

        <View style={styles.heroWrap}>
          <View style={styles.brandBadge}>
            <HeroIcon size={30} color="#B41A0C" />
          </View>
          <Text style={styles.brandTitle}>MaroonLife</Text>
          <Text style={styles.brandSubtitle}>Your campus, curated.</Text>
        </View>

        <View style={styles.roleSummaryCard}>
          <View style={styles.roleSummaryHeader}>
            <Text style={styles.roleSummaryEyebrow}>{modeConfig.eyebrow}</Text>
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.roleSummaryTitle}>{modeConfig.title}</Text>
          <Text style={styles.roleSummaryBody}>{modeConfig.subtitle}</Text>
        </View>

        <ScalePressable
          style={styles.primaryCta}
          onPress={() => openEmailFlow('email_signup')}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#5A0904', '#730C06', '#8B1208']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryCtaGradient}
          >
            <Text style={styles.primaryCtaText}>{primaryCtaLabel}</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </LinearGradient>
        </ScalePressable>

        <Text style={styles.primaryCtaCaption}>{primaryCtaCaption}</Text>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.providersStack}>
          {renderProviderButton({
            label: 'Continue with Google',
            sublabel: selectedMode === 'admin' ? 'Organizer Google sign-in' : 'Fast campus sign-in',
            onPress: () => onOAuthPress(googleFlow),
            loading: activeFlow === googleFlow,
            icon: <GoogleIcon size={20} />,
          })}

          {renderProviderButton({
            label: 'Use email and password',
            sublabel: selectedMode === 'admin' ? 'Manual admin login or signup' : 'Manual student login or signup',
            onPress: () => openEmailFlow('email_signin'),
            icon: <Mail size={20} color="#FFFFFF" />,
          })}

          {Platform.OS === 'ios'
            ? renderProviderButton({
                label: 'Continue with Apple',
                sublabel: selectedMode === 'admin' ? 'Apple sign-in for admins' : 'Apple sign-in for students',
                onPress: () => onOAuthPress(appleFlow),
                loading: activeFlow === appleFlow,
                icon: <Text style={styles.appleGlyph}>{APPLE_LABEL}</Text>,
              })
            : null}
        </View>

        <View style={styles.bottomPrompt}>
          <Text style={styles.bottomPromptText}>Already have an account?</Text>
          <Pressable onPress={() => openEmailFlow('email_signin')} hitSlop={12}>
            <Text style={styles.bottomPromptLink}>Log in</Text>
          </Pressable>
        </View>
      </>
    );
  };

  const renderBackButton = (label: string, target: AuthFlow = 'initial') => (
    <Pressable style={styles.inlineBackButton} onPress={() => setAuthFlow(target)} hitSlop={12}>
      <ArrowLeft size={18} color="#FFFFFF" />
      <Text style={styles.inlineBackText}>{label}</Text>
    </Pressable>
  );

  const renderField = ({
    icon,
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    keyboardType,
  }: {
    icon: React.ReactNode;
    placeholder: string;
    value: string;
    onChangeText: (value: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'number-pad';
  }) => (
    <View style={styles.inputShell}>
      <View style={styles.inputIconWrap}>{icon}</View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#777777"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        editable={!isLoading}
      />
    </View>
  );

  const renderFormLayout = ({
    title,
    subtitle,
    backLabel,
    backTarget,
    children,
    footer,
  }: {
    title: string;
    subtitle: string;
    backLabel?: string;
    backTarget?: AuthFlow;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <View style={styles.formWrap}>
      {backLabel ? renderBackButton(backLabel, backTarget) : null}
      <View style={styles.formModePill}>
        <Sparkles size={14} color="#E9D8D6" />
        <Text style={styles.formModePillText}>{selectedMode === 'admin' ? 'Admin flow' : 'Student flow'}</Text>
      </View>
      <Text style={styles.formTitle}>{title}</Text>
      <Text style={styles.formSubtitle}>{subtitle}</Text>
      <View style={styles.formCard}>{children}</View>
      {footer}
    </View>
  );

  const renderActionButton = ({
    label,
    icon,
    onPress,
  }: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
  }) => (
    <ScalePressable style={styles.formPrimaryButton} onPress={onPress} disabled={isLoading}>
      <LinearGradient
        colors={['#5A0904', '#730C06', '#8B1208']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.formPrimaryGradient}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            {icon}
            <Text style={styles.formPrimaryText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </ScalePressable>
  );

  const renderEmailSignIn = () =>
    renderFormLayout({
      title: selectedMode === 'admin' ? 'Admin login' : 'Log in',
      subtitle:
        selectedMode === 'admin'
          ? 'Use your organizer credentials to access event management.'
          : 'Welcome back. Pick up where you left off.',
      backLabel: 'Back',
      backTarget: 'initial',
      children: (
        <>
          {renderField({
            icon: <Mail size={18} color="#B8B8B8" />,
            placeholder: 'Email address',
            value: email,
            onChangeText: setEmail,
            keyboardType: 'email-address',
          })}
          {renderField({
            icon: <KeyRound size={18} color="#B8B8B8" />,
            placeholder: 'Password',
            value: password,
            onChangeText: setPassword,
            secureTextEntry: true,
          })}
          {renderActionButton({
            label: 'Log in',
            icon: <LogIn size={18} color="#FFFFFF" />,
            onPress: onEmailSignIn,
          })}
          <Pressable style={styles.centerLinkWrap} onPress={() => setAuthFlow('forgot_password')}>
            <Text style={styles.secondaryLink}>Forgot password?</Text>
          </Pressable>
        </>
      ),
      footer: (
        <View style={styles.bottomPrompt}>
          <Text style={styles.bottomPromptText}>Need an account?</Text>
          <Pressable onPress={() => openEmailFlow('email_signup')} hitSlop={12}>
            <Text style={styles.bottomPromptLink}>Create one</Text>
          </Pressable>
        </View>
      ),
    });

  const renderEmailSignUp = () =>
    renderFormLayout({
      title: selectedMode === 'admin' ? 'Create admin account' : 'Create account',
      subtitle:
        selectedMode === 'admin'
          ? 'Set up your organizer access with email and password.'
          : 'Create your MaroonLife account in a minute.',
      backLabel: 'Back',
      backTarget: 'initial',
      children: (
        <>
          {renderField({
            icon: <Mail size={18} color="#B8B8B8" />,
            placeholder: 'Email address',
            value: email,
            onChangeText: setEmail,
            keyboardType: 'email-address',
          })}
          {renderField({
            icon: <KeyRound size={18} color="#B8B8B8" />,
            placeholder: 'Password',
            value: password,
            onChangeText: setPassword,
            secureTextEntry: true,
          })}
          {renderActionButton({
            label: selectedMode === 'admin' ? 'Create admin account' : 'Sign up free',
            icon: <UserPlus size={18} color="#FFFFFF" />,
            onPress: onEmailSignUp,
          })}
        </>
      ),
      footer: (
        <View style={styles.bottomPrompt}>
          <Text style={styles.bottomPromptText}>Already registered?</Text>
          <Pressable onPress={() => openEmailFlow('email_signin')} hitSlop={12}>
            <Text style={styles.bottomPromptLink}>Log in</Text>
          </Pressable>
        </View>
      ),
    });

  const renderOtpVerify = () =>
    renderFormLayout({
      title: 'Verify email',
      subtitle: `Enter the code sent to ${email || 'your inbox'}.`,
      backLabel: 'Back to sign up',
      backTarget: 'email_signup',
      children: (
        <>
          {renderField({
            icon: <Hash size={18} color="#B8B8B8" />,
            placeholder: 'Verification code',
            value: code,
            onChangeText: setCode,
            keyboardType: 'number-pad',
          })}
          {renderActionButton({
            label: 'Verify and continue',
            onPress: onVerifyEmail,
          })}
        </>
      ),
    });

  const renderForgotPassword = () =>
    renderFormLayout({
      title: 'Reset password',
      subtitle: 'We will send a reset code to your email.',
      backLabel: 'Back to login',
      backTarget: 'email_signin',
      children: (
        <>
          {renderField({
            icon: <Mail size={18} color="#B8B8B8" />,
            placeholder: 'Email address',
            value: email,
            onChangeText: setEmail,
            keyboardType: 'email-address',
          })}
          {renderActionButton({
            label: 'Send reset code',
            onPress: onForgotPassword,
          })}
        </>
      ),
    });

  const renderResetPassword = () =>
    renderFormLayout({
      title: 'Choose a new password',
      subtitle: 'Enter the reset code and your new password.',
      backLabel: 'Back',
      backTarget: 'forgot_password',
      children: (
        <>
          {renderField({
            icon: <Hash size={18} color="#B8B8B8" />,
            placeholder: 'Reset code',
            value: code,
            onChangeText: setCode,
            keyboardType: 'number-pad',
          })}
          {renderField({
            icon: <KeyRound size={18} color="#B8B8B8" />,
            placeholder: 'New password',
            value: password,
            onChangeText: setPassword,
            secureTextEntry: true,
          })}
          {renderActionButton({
            label: 'Reset password',
            onPress: onResetPassword,
          })}
        </>
      ),
    });

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#FFF8F6', '#FFFDFC', '#F6F1EE']} style={StyleSheet.absoluteFill} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {authFlow === 'initial' && renderInitialFlow()}
          {authFlow === 'email_signin' && renderEmailSignIn()}
          {authFlow === 'email_signup' && renderEmailSignUp()}
          {authFlow === 'otp_verify' && renderOtpVerify()}
          {authFlow === 'forgot_password' && renderForgotPassword()}
          {authFlow === 'reset_password' && renderResetPassword()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  glowTop: {
    position: 'absolute',
    top: -110,
    left: -20,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(128, 10, 4, 0.10)',
  },
  glowBottom: {
    position: 'absolute',
    right: -70,
    bottom: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(96, 6, 6, 0.08)',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(80,0,0,0.08)',
    borderWidth: 1,
    borderRadius: 999,
    padding: 6,
    gap: 6,
    alignSelf: 'center',
    marginBottom: 30,
  },
  modeChip: {
    minWidth: 126,
    height: 42,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
  },
  modeChipActive: {
    backgroundColor: COLORS.primary,
  },
  modeChipText: {
    color: '#7A6A67',
    fontSize: 15,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandBadge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(122, 12, 7, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(180, 26, 12, 0.16)',
    marginBottom: 20,
  },
  brandTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 58,
    lineHeight: 62,
    fontWeight: '900',
    color: '#141111',
    letterSpacing: -2.2,
    textAlign: 'center',
  },
  brandSubtitle: {
    ...TYPOGRAPHY.body,
    marginTop: 10,
    fontSize: 18,
    lineHeight: 24,
    color: '#7B7270',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  roleSummaryCard: {
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.08)',
    paddingHorizontal: 22,
    paddingVertical: 18,
    marginBottom: 22,
  },
  roleSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  roleSummaryEyebrow: {
    color: '#8A5B54',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#A51B10',
  },
  roleSummaryTitle: {
    color: '#191414',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  roleSummaryBody: {
    color: '#726866',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryCta: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryCtaGradient: {
    minHeight: 76,
    borderRadius: 999,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  primaryCtaCaption: {
    marginTop: 12,
    marginBottom: 26,
    color: '#746968',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(80,0,0,0.12)',
  },
  dividerText: {
    color: '#8C7F7D',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  providersStack: {
    gap: 14,
  },
  outlineButton: {
    minHeight: 82,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.14)',
    backgroundColor: 'rgba(255,255,255,0.64)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  outlineIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(80,0,0,0.06)',
  },
  outlineTextWrap: {
    flex: 1,
  },
  outlineButtonText: {
    color: '#181313',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  outlineButtonSubtext: {
    color: '#766D6B',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  appleGlyph: {
    color: '#181313',
    fontSize: 24,
    lineHeight: 26,
  },
  bottomPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 28,
  },
  bottomPromptText: {
    color: '#7A7270',
    fontSize: 16,
  },
  bottomPromptLink: {
    color: '#231919',
    fontSize: 16,
    fontWeight: '800',
  },
  formWrap: {
    paddingTop: 12,
  },
  inlineBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  inlineBackText: {
    color: '#231919',
    fontSize: 15,
    fontWeight: '700',
  },
  formModePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.08)',
    marginBottom: 16,
  },
  formModePillText: {
    color: '#7D5650',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  formTitle: {
    ...TYPOGRAPHY.title,
    color: '#171212',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  formSubtitle: {
    ...TYPOGRAPHY.body,
    color: '#756C69',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    marginBottom: 22,
  },
  formCard: {
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.08)',
    padding: 18,
    gap: 14,
  },
  inputShell: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(80,0,0,0.10)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputIconWrap: {
    width: 26,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#1B1515',
    fontSize: 16,
    ...TYPOGRAPHY.body,
  },
  formPrimaryButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 6,
  },
  formPrimaryGradient: {
    minHeight: 64,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  formPrimaryText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  centerLinkWrap: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  secondaryLink: {
    color: '#5A0904',
    fontSize: 15,
    fontWeight: '700',
  },
});
