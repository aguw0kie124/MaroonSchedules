import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Clipboard,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2,
  Link as LinkIcon,
  Instagram,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Phone,
  X,
} from 'lucide-react-native';

import { useTheme } from './SharedUI';
import { useShareStore } from '../store/shareStore';
import { useChatClient } from '../hooks/useChatClient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SOCIAL_APPS = [
  { id: 'imessage', name: 'Messages', color: '#34C759', Icon: MessageCircle, scheme: 'sms:' },
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', Icon: Phone, scheme: 'whatsapp://send' },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', Icon: Instagram, scheme: 'instagram://' },
  { id: 'copy', name: 'Copy Link', color: '#8E8E93', Icon: LinkIcon },
  { id: 'more', name: 'More', color: '#3A3A3C', Icon: MoreHorizontal },
] as const;

export function ShareOverlay() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const { isVisible, content, closeShare } = useShareStore();
  const { client, userId, isReady } = useChatClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT * 0.2,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (isReady && client) {
        fetchRecentChats();
      } else {
        setRecentChats([]);
      }
      return;
    }

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setSearchQuery('');
    setSelectedFriends([]);
  }, [client, isReady, isVisible, opacityAnim, slideAnim]);

  const fetchRecentChats = async () => {
    if (!client || !userId) return;
    try {
      const filter = { members: { $in: [userId] } };
      const sort = { last_message_at: -1 } as any;
      const channels = await client.queryChannels(filter, sort, { limit: 12 });

      const chats = channels.map((channel) => {
        const otherMember = Object.values(channel.state?.members ?? {}).find(
          (member: any) => member.user?.id !== userId,
        );
        return {
          id: channel.id,
          name: (otherMember as any)?.user?.name || 'Group Chat',
          image: (otherMember as any)?.user?.image,
        };
      });
      setRecentChats(chats);
    } catch (error) {
      console.error('Error fetching chats for share:', error);
      setRecentChats([]);
    }
  };

  const getShareText = () =>
    `${content?.title ? `${content.title}\n` : ''}${content?.message || ''}\n${content?.url || ''}`;

  const handleAppShare = async (app: (typeof SOCIAL_APPS)[number]) => {
    if (!content) return;
    const shareText = getShareText();

    if (app.id === 'copy') {
      Clipboard.setString(content.url || shareText);
      await Haptics.selectionAsync();
      return;
    }

    if (app.id === 'more') {
      try {
        await Share.share({
          title: content.title,
          message: shareText,
          url: content.url,
        });
      } catch (error) {
        console.error('System share failed', error);
      }
      return;
    }

    const url =
      app.id === 'imessage'
        ? `sms:&body=${encodeURIComponent(shareText)}`
        : app.id === 'whatsapp'
          ? `whatsapp://send?text=${encodeURIComponent(shareText)}`
          : app.scheme;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message: shareText });
      }
    } catch (error) {
      console.error('App share failed', error);
      await Share.share({ message: shareText });
    }
  };

  const toggleFriendSelection = (id: string) => {
    setSelectedFriends((previous) =>
      previous.includes(id) ? previous.filter((friendId) => friendId !== id) : [...previous, id],
    );
  };

  const handleImmediateSend = async (chatId: string) => {
    if (!content || !client) return;
    setLoading(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const channel = client.channel('messaging', chatId);
      await channel.sendMessage({ text: getShareText() });
      closeShare();
    } catch (error) {
      console.error('Failed to send immediately', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInternalSend = async () => {
    if (!content || !client || selectedFriends.length === 0) return;
    setLoading(true);
    try {
      const shareText = `[Shared Content]\n${getShareText()}`;
      for (const channelId of selectedFriends) {
        const channel = client.channel('messaging', channelId);
        await channel.sendMessage({ text: shareText });
      }
      closeShare();
      setSelectedFriends([]);
    } catch (error) {
      console.error('Failed to send internally', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  const filteredChats = recentChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
      <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={closeShare} />

      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
            backgroundColor: isDark ? 'rgba(28, 28, 30, 0.94)' : 'rgba(255, 255, 255, 0.94)',
          },
        ]}
      >
        <BlurView
          intensity={isDark ? 40 : 60}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />

        <View style={styles.header}>
          <TouchableOpacity style={styles.headerClose} onPress={closeShare}>
            <X size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.dragHandle} />
            <Text style={[styles.title, { color: COLORS.textPrimary }]}>Share</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
          ]}
        >
          <Search size={18} color={COLORS.textSecondary} />
          <TextInput
            placeholder="Search"
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.searchInput, { color: COLORS.textPrimary }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {recentChats.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Suggestions</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.suggestionsRow}
              >
                {recentChats.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.suggestionItem}
                    onPress={() => handleImmediateSend(chat.id)}
                  >
                    <View style={styles.avatarWrap}>
                      {chat.image ? (
                        <Image source={{ uri: chat.image }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <Text style={styles.avatarInitial}>{chat.name[0]}</Text>
                        </View>
                      )}
                      {selectedFriends.includes(chat.id) ? (
                        <View style={styles.checkmarkWrap}>
                          <CheckCircle2 size={16} color={COLORS.primary} fill="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.suggestionName, { color: COLORS.textPrimary }]}
                      numberOfLines={1}
                    >
                      {chat.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Share to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.appsRow}>
            {SOCIAL_APPS.map((app) => (
              <TouchableOpacity key={app.id} style={styles.appItem} onPress={() => handleAppShare(app)}>
                <View style={[styles.appIcon, { backgroundColor: app.color }]}>
                  <app.Icon size={24} color="#FFF" />
                </View>
                <Text style={[styles.appName, { color: COLORS.textPrimary }]}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {recentChats.length > 0 ? (
            <View style={styles.friendList}>
              {filteredChats.map((chat) => (
                <TouchableOpacity
                  key={chat.id}
                  style={styles.friendRow}
                  onPress={() => toggleFriendSelection(chat.id)}
                >
                  <View style={styles.avatarWrap}>
                    {chat.image ? (
                      <Image source={{ uri: chat.image }} style={styles.rowAvatar} />
                    ) : (
                      <View style={[styles.rowAvatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitial}>{chat.name[0]}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: COLORS.textPrimary }]}>{chat.name}</Text>
                    <Text style={styles.rowHandle}>Aggie Friend</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      selectedFriends.includes(chat.id)
                        ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                        : null,
                    ]}
                  >
                    {selectedFriends.includes(chat.id) ? <X size={12} color="#FFF" /> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.rowSendBtn, { backgroundColor: COLORS.surface }]}
                    onPress={() => handleImmediateSend(chat.id)}
                  >
                    <Send size={14} color={COLORS.primary} />
                    <Text style={[styles.rowSendText, { color: COLORS.primary }]}>Send</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={{ height: 100 }} />
        </ScrollView>

        {selectedFriends.length > 0 ? (
          <Animated.View style={styles.sendButtonWrap}>
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: COLORS.primary }]}
              onPress={handleInternalSend}
              disabled={loading}
            >
              <Text style={styles.sendButtonText}>
                {loading
                  ? 'Sending...'
                  : `Send to ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 9999,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.8,
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 36,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.3)',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  suggestionsRow: {
    paddingLeft: 16,
    marginBottom: 10,
  },
  suggestionItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 64,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarPlaceholder: {
    backgroundColor: '#3D0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },
  checkmarkWrap: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 1,
  },
  suggestionName: {
    fontSize: 12,
    textAlign: 'center',
  },
  appsRow: {
    paddingLeft: 16,
    marginBottom: 10,
  },
  appItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  appName: {
    fontSize: 11,
    textAlign: 'center',
  },
  friendList: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowHandle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(150,150,150,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 12,
  },
  rowSendText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sendButtonWrap: {
    position: 'absolute',
    bottom: 34,
    left: 20,
    right: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sendButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
