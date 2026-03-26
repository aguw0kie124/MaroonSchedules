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

import { useTheme } from './SharedUI';

export function ChannelListScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<any>();
  const { user, isLoaded } = useUser();
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  const streamTheme = {
    colors: {
      accent_blue: COLORS.primary,
      bg_gradient_start: COLORS.background,
      bg_gradient_end: COLORS.surface,
      black: COLORS.textPrimary,
      border: COLORS.border,
      grey: COLORS.textSecondary,
      grey_whisper: COLORS.surfaceElevated,
      icon_background: COLORS.surface,
      white: COLORS.surface,
      white_smoke: COLORS.background,
      white_snow: COLORS.background,
      blue_alice: COLORS.primary + '1A',
      overlay: 'rgba(0,0,0,0.75)',
    },
  } as any;

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

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
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Connecting to Chat…</Text>
      </View>
    );
  }

  const filters = { members: { $in: [userId] } };
  const sort = { last_message_at: -1 } as any;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* ── Header ── */}
      {!embedded && (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Pressable 
          style={styles.actionBtn} 
          onPress={() => navigation.navigate('UsersScreen')}
        >
        <MessageSquarePlus color={COLORS.textPrimary} size={24} />
        </Pressable>
      </View>
      )}

      <OverlayProvider value={{ style: streamTheme }}>
        <Chat client={chatClient}>
          <ChannelList
            filters={filters}
            sort={sort}
            onSelect={(channel) => {
              const channelData = channel.data as any;
              const isGroup = !!channelData?.name;

              // For DMs, find the other member's display info from the channel state
              let otherUserName: string | undefined;
              let otherUserImageUrl: string | undefined;
              if (!isGroup && chatClient) {
                const members = Object.values(channel.state?.members ?? {});
                const other = members.find((m: any) => m.user?.id !== userId);
                if (other) {
                  otherUserName = (other as any).user?.name;
                  otherUserImageUrl = (other as any).user?.image;
                }
              }

              navigation.navigate('ChatScreen', {
                channelId: channel.id,
                isGroup,
                groupName: isGroup ? channelData?.name : undefined,
                otherUserName: otherUserName,
                otherUserImageUrl: otherUserImageUrl,
              });
            }}
          />
        </Chat>
      </OverlayProvider>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  centerFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, gap: 12 },
  loadingText: { marginTop: 4, color: COLORS.textSecondary, fontSize: 14 },
  errorText: { color: COLORS.danger, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  
  header: {
    backgroundColor: COLORS.background,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  actionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
