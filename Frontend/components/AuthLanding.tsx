import React, { useState } from 'react';
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
  GraduationCap,
  Hash,
  KeyRound,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react-native';

import { COLORS, TYPOGRAPHY } from '../constants';
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
  const isAdminMode = selectedMode === 'admin';
  const primaryCtaLabel = isAdminMode ? 'Admin sign in' : 'Sign up free';
  const secondaryPromptLabel = isAdminMode ? 'Continue with Email' : 'Continue with Email';

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
    const HeroIcon = isAdminMode ? ShieldCheck : GraduationCap;
    return (
      <>
        <View style={styles.heroWrap}>
          <HeroIcon size={34} color="#B41A0C" />
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>MaroonLife</Text>
            {isAdminMode ? (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.brandSubtitle}>
            {isAdminMode ? 'Manage your campus presence.' : 'Your campus life, curated.'}
          </Text>
        </View>

        <ScalePressable
          style={styles.primaryCta}
          onPress={() => openEmailFlow(isAdminMode ? 'email_signin' : 'email_signup')}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#5A0904', '#6F0805', '#7E0A06']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryCtaGradient}
          >
            <Text style={styles.primaryCtaText}>{primaryCtaLabel}</Text>
          </LinearGradient>
        </ScalePressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.providersStack}>
          {renderProviderButton({
            label: 'Continue with Google',
            sublabel: isAdminMode ? undefined : undefined,
            onPress: () => onOAuthPress(googleFlow),
            loading: activeFlow === googleFlow,
            icon: <GoogleIcon size={20} />,
          })}

          {renderProviderButton({
            label: secondaryPromptLabel,
            onPress: () => openEmailFlow('email_signin'),
            icon: <Mail size={20} color="#FFFFFF" />,
          })}

          {Platform.OS === 'ios'
            ? renderProviderButton({
                label: 'Continue with Apple',
                sublabel: undefined,
                onPress: () => onOAuthPress(appleFlow),
                loading: activeFlow === appleFlow,
                icon: <Text style={styles.appleGlyph}>{APPLE_LABEL}</Text>,
              })
            : null}
        </View>

        <View style={styles.bottomPrompt}>
          {isAdminMode ? (
            <>
              <Text style={styles.bottomPromptText}>Need the student experience instead?</Text>
              <Pressable
                onPress={() => {
                  selectMode('user');
                  setAuthFlow('initial');
                }}
                hitSlop={12}
              >
                <Text style={styles.bottomPromptLink}>Back to student sign up</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.bottomPromptText}>Already have an account?</Text>
              <Pressable onPress={() => openEmailFlow('email_signin')} hitSlop={12}>
                <Text style={styles.bottomPromptLink}>Log in</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.adminLinkWrap}>
          <Pressable
            onPress={() => {
              selectMode(isAdminMode ? 'user' : 'admin');
              setAuthFlow('initial');
            }}
            hitSlop={16}
            style={styles.adminLinkButton}
          >
            <Text style={styles.adminLinkLead}>
              {isAdminMode ? 'Club leader view enabled' : 'Are you a club leader?'}
            </Text>
            <Text style={styles.adminLinkText}>
              {isAdminMode ? 'Student Sign Up' : 'Admin Sign In'}
            </Text>
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
    paddingVertical: 28,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 84,
    marginBottom: 54,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  brandTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '900',
    color: '#141111',
    letterSpacing: -1.8,
    textAlign: 'center',
  },
  adminBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(80,0,0,0.08)',
  },
  adminBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  brandSubtitle: {
    ...TYPOGRAPHY.body,
    marginTop: 12,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#7B7270',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  primaryCta: {
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 18,
  },
  primaryCtaGradient: {
    minHeight: 68,
    borderRadius: 999,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
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
    letterSpacing: 0.2,
  },
  providersStack: {
    gap: 12,
  },
  outlineButton: {
    minHeight: 66,
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
    fontSize: 17,
    lineHeight: 22,
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 30,
  },
  bottomPromptText: {
    color: '#7A7270',
    fontSize: 15,
  },
  bottomPromptLink: {
    color: '#231919',
    fontSize: 15,
    fontWeight: '800',
  },
  adminLinkWrap: {
    marginTop: 44,
    alignItems: 'center',
  },
  adminLinkButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminLinkLead: {
    color: '#8E8482',
    fontSize: 13,
    fontWeight: '700',
  },
  adminLinkText: {
    marginTop: 4,
    color: '#8B1208',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
