import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Pressable,
} from 'react-native';
import {
  OverlayProvider,
  Chat,
  ChannelList,
  useCreateChatClient,
} from 'stream-chat-react-native';
import { useUser } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { MessageSquarePlus } from 'lucide-react-native';
import { API_URL } from '../config';

// ─── Design Tokens (Matching UsersScreen/ChatScreen) ───────────────────────────
const C = {
  maroon: '#500000',
  white: '#FFFFFF',
  bg: '#FAFAFA',
  textPrimary: '#111111',
  textSecondary: '#8A8A8A',
  border: '#F0F0F0',
};

const streamTheme = {
  colors: {
    accent_blue: C.maroon,
    bg_gradient_start: C.bg,
    bg_gradient_end: C.white,
    black: C.textPrimary,
    border: C.border,
    grey: C.textSecondary,
    white: C.white,
  },
} as any;

export function ChannelListScreen() {
  const navigation = useNavigation<any>();
  const { user, isLoaded } = useUser();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // 1. Fetch Stream credentials
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch(`${API_URL}/chat/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerk_user_id: user.id,
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
    userData: { 
      id: userId || 'placeholder', 
      name: user?.fullName || 'Aggie',
      image: user?.imageUrl || undefined
    },
    tokenOrProvider: userToken || '',
  });

  if (errorStatus) {
    return (
      <View style={styles.centerFull}>
        <Text style={styles.errorText}>⚠️ {errorStatus}</Text>
      </View>
    );
  }

  if (!chatClient || !userId) {
    return (
      <View style={styles.centerFull}>
        <ActivityIndicator size="large" color={C.maroon} />
        <Text style={styles.loadingText}>Connecting to Chat…</Text>
      </View>
    );
  }

  const filters = { members: { $in: [userId] } };
  const sort = { last_message_at: -1 } as any;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.maroon} />
      
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Pressable 
          style={styles.actionBtn} 
          onPress={() => navigation.navigate('UsersScreen')}
        >
          <MessageSquarePlus color={C.white} size={24} />
        </Pressable>
      </View>

      <OverlayProvider value={{ style: streamTheme }}>
        <Chat client={chatClient}>
          <ChannelList
            filters={filters}
            sort={sort}
            onSelect={(channel) => {
              navigation.navigate('ChatScreen', {
                channelId: channel.id,
                isGroup: !!(channel.data as any)?.name,
              });
            }}
          />
        </Chat>
      </OverlayProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  centerFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { marginTop: 12, color: C.textSecondary, fontSize: 14 },
  errorText: { color: C.maroon, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  
  header: {
    backgroundColor: C.maroon,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
