import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  OverlayProvider,
  Chat,
  Channel,
  MessageList,
  MessageInput,
  useCreateChatClient,
} from 'stream-chat-react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../config';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  maroon: '#500000',
  maroonDark: '#3a0000',
  white: '#FFFFFF',
  bg: '#F7F4F4',
  textPrimary: '#111',
  textSecondary: '#888',
  online: '#34D399',
  border: '#EEE',
};

// ─── Stream Chat Full Theme ───────────────────────────────────────────────────
const streamTheme = {
  colors: {
    accent_blue: C.maroon,
    accent_green: C.online,
    bg_gradient_start: C.bg,
    bg_gradient_end: C.white,
    black: C.textPrimary,
    blue_alice: '#FFF5F5',
    border: C.border,
    grey: C.textSecondary,
    grey_whisper: '#F4EFEF',
    icon_background: C.white,
    modal_shadow: '#000',
    overlay: 'rgba(0,0,0,0.5)',
    shadow_icon: '#000',
    targetedMessageBackground: '#FFF0F0',
    transparent: 'transparent',
    white: C.white,
    white_smoke: C.bg,
    white_snow: C.white,
  },
  messageSimple: {
    content: {
      containerInner: {
        backgroundColor: C.maroon,
        borderRadius: 20,
        borderBottomRightRadius: 4,
      },
      receivedContainerInner: {
        backgroundColor: C.white,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#EBEBEB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
      },
      textContainer: {
        backgroundColor: 'transparent',
      },
      markdown: {
        text: { color: C.white, fontSize: 15.5 },
      },
    },
    receivedContent: {
      markdown: {
        text: { color: C.textPrimary, fontSize: 15.5 },
      },
    },
  },
  messageInput: {
    container: {
      backgroundColor: C.white,
      borderTopWidth: 1,
      borderTopColor: '#F0EBEB',
      paddingTop: 8,
      paddingBottom: 28,
      paddingHorizontal: 12,
    },
    inputBoxContainer: {
      backgroundColor: '#F4EFEF',
      borderRadius: 26,
      borderWidth: 0,
      flex: 1,
      paddingHorizontal: 4,
    },
    inputBox: {
      fontSize: 15,
      color: C.textPrimary,
      paddingVertical: 10,
    },
    sendButton: {
      backgroundColor: C.maroon,
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginLeft: 8,
    },
  },
} as any;

// ─── Avatar initials helper ───────────────────────────────────────────────────
function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  route: {
    params: {
      otherUserClerkId: string;
      otherUserName?: string;
    };
  };
  navigation: any;
};

// ─── ChatScreen ───────────────────────────────────────────────────────────────
export function ChatScreen({ route, navigation }: Props) {
  const { otherUserClerkId, otherUserName = 'Aggie' } = route.params;
  const { user, isLoaded } = useUser();
  const initials = getInitials(otherUserName);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // 1. Fetch Stream credentials
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch(`${API_URL}/chat/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerk_user_id: user.id,
        other_clerk_user_id: otherUserClerkId,
      }),
    })
      .then(r => { if (!r.ok) throw new Error(`Token fetch failed: ${r.status}`); return r.json(); })
      .then(data => {
        setApiKey(data.stream_api_key);
        setUserId(data.stream_user_id);
        setUserToken(data.stream_user_token);
      })
      .catch(err => setErrorStatus(err.message));
  }, [isLoaded, user]);

  // 2. Create Stream client
  const chatClient = useCreateChatClient({
    apiKey: apiKey || '',
    userData: { id: userId || 'placeholder', name: user?.fullName || 'Aggie' },
    tokenOrProvider: userToken || '',
  });

  // 3. Create/watch channel
  useEffect(() => {
    if (!chatClient || !userId || !userToken) return;
    const run = async () => {
      try {
        const c = chatClient.channel('messaging', { members: [userId, otherUserClerkId] });
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('Connection timed out. Is the backend running?')), 15000)
        );
        await Promise.race([c.watch(), timeout]);
        setChannel(c);
      } catch (err: any) {
        setErrorStatus(err.message);
      }
    };
    void run();
  }, [chatClient, userId, userToken, otherUserClerkId]);

  // ── Custom Header ────────────────────────────────────────────────────────────
  const CustomHeader = () => (
    <View style={styles.header}>
      <StatusBar barStyle="light-content" backgroundColor={C.maroon} />
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
        <Text style={styles.backArrow}>‹</Text>
      </Pressable>

      <View style={styles.headerAvatar}>
        <Text style={styles.headerAvatarText}>{initials}</Text>
        <View style={styles.headerOnlineDot} />
      </View>

      <View style={styles.headerInfo}>
        <Text style={styles.headerName} numberOfLines={1}>{otherUserName}</Text>
        <Text style={styles.headerStatus}>Active now</Text>
      </View>
    </View>
  );

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (!channel && !errorStatus) {
    return (
      <View style={styles.screen}>
        <CustomHeader />
        <View style={styles.centerFlex}>
          <ActivityIndicator size="large" color={C.maroon} />
          <Text style={styles.loadingText}>Opening conversation…</Text>
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (errorStatus) {
    return (
      <View style={styles.screen}>
        <CustomHeader />
        <View style={styles.centerFlex}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{errorStatus}</Text>
          <Pressable style={styles.retryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.retryText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Chat ──────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <CustomHeader />
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <OverlayProvider value={{ style: streamTheme }}>
          <Chat client={chatClient!} style={streamTheme}>
            <Channel
              channel={channel}
              keyboardVerticalOffset={0}
            >
              <MessageList />
              <MessageInput />
            </Channel>
          </Chat>
        </OverlayProvider>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  chatContainer: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.maroon,
    paddingTop: 54,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: { paddingRight: 4 },
  backArrow: { fontSize: 34, color: C.white, lineHeight: 36, marginTop: -4, fontWeight: '300' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerAvatarText: { color: C.white, fontWeight: '700', fontSize: 15 },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.online,
    borderWidth: 2,
    borderColor: C.maroon,
  },
  headerInfo: { flex: 1 },
  headerName: { color: C.white, fontWeight: '700', fontSize: 17, letterSpacing: -0.2 },
  headerStatus: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },

  // Loading / Error
  centerFlex: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: C.textSecondary, fontSize: 14 },
  errorEmoji: { fontSize: 40 },
  errorText: {
    color: C.maroon, fontSize: 14, textAlign: 'center',
    paddingHorizontal: 32, lineHeight: 20,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: C.maroon,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: { color: C.white, fontWeight: '700', fontSize: 15 },
});
