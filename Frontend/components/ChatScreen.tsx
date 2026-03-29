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
  Modal,
  FlatList,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import {
  OverlayProvider,
  Chat,
  Channel,
  MessageList,
  MessageInput,
  useCreateChatClient,
  Attachment,
} from 'stream-chat-react-native';
import { useUser } from '@clerk/clerk-expo';
import { Calendar, LogOut, UserPlus, ChevronLeft, Check, X } from 'lucide-react-native';
import { API_URL } from '../config';
import { fetchSchedules } from '../api/client';

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
      otherUserClerkId?: string;
      otherUserName?: string;
      otherUserImageUrl?: string;
      memberIds?: string[];
      groupName?: string;
      isGroup?: boolean;
      channelId?: string;
    };
  };
  navigation: any;
};

// ─── ChatScreen ───────────────────────────────────────────────────────────────
export function ChatScreen({ route, navigation }: Props) {
  const { 
    otherUserClerkId, 
    otherUserName = 'Aggie',
    otherUserImageUrl,
    memberIds,
    groupName,
    isGroup = false,
    channelId
  } = route.params;
  
  const displayName = isGroup ? (groupName || 'Group Chat') : otherUserName;
  const { user, isLoaded } = useUser();
  const initials = getInitials(displayName);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<any[]>([]);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Group Management State
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [addMembersMode, setAddMembersMode] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSchedules(user.id).then(setSchedules).catch(console.error);
    }
  }, [user]);

  // 1. Fetch Stream credentials
  useEffect(() => {
    if (!isLoaded || !user) return;
    const other_ids = isGroup && memberIds 
      ? memberIds 
      : (otherUserClerkId ? [otherUserClerkId] : []);

    fetch(`${API_URL}/chat/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerk_user_id: user.id,
        other_clerk_user_ids: other_ids,
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

  // 3. Create/watch channel
  useEffect(() => {
    if (!chatClient || !userId || !userToken) return;
    const run = async () => {
      try {
        const members = isGroup && memberIds 
          ? [userId, ...memberIds] 
          : [userId, otherUserClerkId!];
          
        const c = channelId 
          ? chatClient.channel('messaging', channelId)
          : chatClient.channel('messaging', { 
              members,
              name: isGroup ? displayName : undefined
            } as any);
        
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
  }, [chatClient, userId, userToken, otherUserClerkId, memberIds, isGroup]);

  // ── Custom Header ────────────────────────────────────────────────────────────
  const CustomHeader = () => {
    const isGroupChat = isGroup || (channel && Object.keys(channel.state.members).length > 2);
    
    let isOnline = false;
    let lastActive = null;
    if (channel && !isGroupChat) {
      const members = Object.values(channel.state.members) as any[];
      const otherUser = members.find(m => m.user?.id !== userId);
      isOnline = otherUser?.user?.online || false;
      lastActive = otherUser?.user?.last_active;
    }

    const formatLastActive = (dateStr: string) => {
      if (!dateStr) return 'Offline';
      const date = new Date(dateStr);
      const diff = Math.floor((new Date().getTime() - date.getTime()) / 60000);
      if (diff < 1) return 'Active just now';
      if (diff < 60) return `Active ${diff}m ago`;
      const hours = Math.floor(diff / 60);
      if (hours < 24) return `Active ${hours}h ago`;
      return `Active ${Math.floor(hours / 24)}d ago`;
    };

    const statusText = isGroupChat 
      ? (channel ? `${Object.keys(channel.state.members).length} members` : `${(memberIds?.length || 0) + 1} members`)
      : (isOnline ? 'Active now' : (channel ? formatLastActive(lastActive) : 'Connecting...'));

    return (
      <View style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor={C.maroon} />
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>

        <Pressable 
          style={styles.headerContent} 
          onPress={() => isGroupChat && setInfoModalVisible(true)}
          disabled={!isGroupChat}
        >
          <View style={styles.headerAvatar}>
            {otherUserImageUrl && !isGroup ? (
              <Image source={{ uri: otherUserImageUrl }} style={styles.headerAvatarImage} />
            ) : (
              <Text style={styles.headerAvatarText}>{initials}</Text>
            )}
            {!isGroup && isOnline && <View style={styles.headerOnlineDot} />}
          </View>
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.headerStatus}>{statusText}</Text>
          </View>
        </Pressable>
      </View>
    );
  };

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

  const shareSchedule = async (schedule: any) => {
    setShareModalVisible(false);
    if (channel) {
      await channel.sendMessage({
        text: 'Check out my schedule!',
        attachments: [{
          type: 'schedule',
          schedule_id: schedule.schedule_id,
          name: schedule.name,
          term: schedule.term_code,
          enrolled: schedule.section_ids?.length || 0,
        }]
      });
    }
  };

  const CustomInputButtons = () => (
    <Pressable onPress={() => setShareModalVisible(true)} style={{ padding: 8, justifyContent: 'center' }}>
       <Calendar size={22} color={C.maroon} />
    </Pressable>
  );

  const CustomAttachment = (props: any) => {
    const { attachment } = props;
    if (attachment.type === 'schedule') {
      return (
        <Pressable 
          style={{ backgroundColor: C.maroon, padding: 16, borderRadius: 12, margin: 4, width: 250 }}
          onPress={() => navigation.navigate('ScheduleDetail', { scheduleId: attachment.schedule_id, scheduleObj: { ...attachment }})}
        >
          <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>{attachment.name}</Text>
          <Text style={{color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4}}>{attachment.term} • {attachment.enrolled} classes</Text>
          <View style={{backgroundColor: 'white', padding: 8, borderRadius: 8, marginTop: 12, alignItems: 'center'}}>
             <Text style={{color: C.maroon, fontWeight: 'bold'}}>View Schedule</Text>
          </View>
        </Pressable>
      );
    }
    return <Attachment {...props} />;
  };

  // ── Group Management Handlers ─────────────────────────────────────────────────
  const fetchClerkUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/chat/users?exclude_id=${user?.id ?? ''}`);
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (e) {
      console.warn("Failed to fetch users for adding to group", e);
    }
  };

  const openAddMembers = () => {
    fetchClerkUsers();
    setAddMembersMode(true);
    setSelectedNewMembers([]);
  };

  const closeGroupInfo = () => {
    setInfoModalVisible(false);
    setAddMembersMode(false);
    setSelectedNewMembers([]);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group chat?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Leave", 
          style: "destructive",
          onPress: async () => {
            if (!channel || !user) return;
            setIsLeaving(true);
            try {
              await channel.removeMembers([user.id]);
              setInfoModalVisible(false);
              navigation.goBack();
            } catch (e) {
              Alert.alert("Error", "Could not leave group.");
            } finally {
              setIsLeaving(false);
            }
          }
        }
      ]
    );
  };

  const handleConfirmAddMembers = async () => {
    if (!channel || selectedNewMembers.length === 0 || !user) return;
    setIsAdding(true);
    try {
      // Ensure users exist in Stream Chat before adding them
      await fetch(`${API_URL}/chat/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_user_id: user.id,
          other_clerk_user_ids: selectedNewMembers,
        }),
      });

      await channel.addMembers(selectedNewMembers);
      setAddMembersMode(false);
      setSelectedNewMembers([]);
    } catch (e: any) {
      console.warn("Add members failed:", e);
      Alert.alert("Error", `Could not add members: ${e.message || 'Unknown error'}`);
    } finally {
      setIsAdding(false);
    }
  };

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
              Attachment={CustomAttachment}
            >
              <MessageList />
              <MessageInput InputButtons={CustomInputButtons} />
            </Channel>
          </Chat>
        </OverlayProvider>
        
        {/* Share Schedule Modal */}
        <Modal visible={shareModalVisible} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: C.bg, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: C.textPrimary }}>Share Schedule</Text>
                        <Pressable onPress={() => setShareModalVisible(false)}>
                           <Text style={{fontSize: 18, color: C.textSecondary}}>Close</Text>
                        </Pressable>
                    </View>
                    <FlatList 
                        data={schedules}
                        keyExtractor={(s) => s.schedule_id}
                        renderItem={({item}) => (
                            <Pressable 
                              style={{ backgroundColor: C.white, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border }}
                              onPress={() => shareSchedule(item)}
                            >
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.textPrimary }}>{item.name}</Text>
                                <Text style={{ color: C.textSecondary, marginTop: 4 }}>{item.term_code} • {item.section_ids?.length || 0} enrolled</Text>
                            </Pressable>
                        )}
                        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: C.textSecondary }}>No schedules found.</Text>}
                    />
                </View>
            </View>
        </Modal>

        {/* Group Info Modal */}
        <Modal visible={infoModalVisible} transparent animationType="slide">
          <View style={styles.modalBg}>
            <View style={styles.modalContent}>
              
              {!addMembersMode ? (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Group Info</Text>
                    <Pressable onPress={closeGroupInfo} style={styles.modalCloseBtn}>
                      <X color={C.textSecondary} size={24} />
                    </Pressable>
                  </View>
                  
                  <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
                    <Text style={styles.sectionHeader}>MEMBERS</Text>
                    {channel && Object.values(channel.state.members).map((m: any) => (
                      <View key={m.user.id} style={styles.memberRow}>
                        <View style={[styles.memberAvatar, { backgroundColor: C.maroon }]}>
                          {m.user.image ? (
                            <Image source={{ uri: m.user.image }} style={styles.memberAvatarImg} />
                          ) : (
                            <Text style={styles.memberAvatarText}>{getInitials(m.user.name || 'A')}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{m.user.name}</Text>
                          {m.role === 'owner' && <Text style={styles.memberRole}>Owner</Text>}
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={styles.groupActions}>
                    <Pressable style={styles.groupActionBtn} onPress={openAddMembers}>
                      <UserPlus color={C.maroon} size={20} />
                      <Text style={styles.groupActionText}>Add Members</Text>
                    </Pressable>
                    <Pressable style={[styles.groupActionBtn, { borderTopWidth: 1, borderColor: C.border }]} onPress={handleLeaveGroup} disabled={isLeaving}>
                      {isLeaving ? <ActivityIndicator color="#FF3B30" size="small" /> : <LogOut color="#FF3B30" size={20} />}
                      <Text style={[styles.groupActionText, { color: '#FF3B30' }]}>Leave Group</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.modalHeader}>
                    <Pressable onPress={() => setAddMembersMode(false)} style={styles.modalBackBtn}>
                      <ChevronLeft color={C.maroon} size={28} />
                    </Pressable>
                    <Text style={[styles.modalTitle, { flex: 1, textAlign: 'center', marginRight: 28 }]}>Add Members</Text>
                  </View>

                  <ScrollView style={styles.membersList}>
                    {allUsers
                      .filter(u => !(channel?.state?.members as any)?.[u.id])
                      .map(u => {
                        const isSelected = selectedNewMembers.includes(u.id);
                        return (
                          <Pressable 
                            key={u.id} 
                            style={[styles.memberRow, isSelected && { backgroundColor: '#FFF5F5' }]}
                            onPress={() => setSelectedNewMembers(prev => 
                              isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                            )}
                          >
                            <View style={[styles.memberAvatar, { backgroundColor: C.maroon }]}>
                              {u.profile_image_url ? (
                                <Image source={{ uri: u.profile_image_url }} style={styles.memberAvatarImg} />
                              ) : (
                                <Text style={styles.memberAvatarText}>{getInitials(u.name)}</Text>
                              )}
                              {isSelected && (
                                <View style={styles.checkOverlay}>
                                  <Check color="#FFF" size={16} strokeWidth={3} />
                                </View>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.memberName}>{u.name}</Text>
                              <Text style={styles.memberRole}>{u.email}</Text>
                            </View>
                          </Pressable>
                        );
                    })}
                    {allUsers.filter(u => !(channel?.state?.members as any)?.[u.id]).length === 0 && (
                      <Text style={{ textAlign: 'center', color: C.textSecondary, marginTop: 40 }}>All users are already in this group.</Text>
                    )}
                  </ScrollView>

                  <Pressable 
                    style={[styles.confirmAddBtn, selectedNewMembers.length === 0 && { opacity: 0.5 }]} 
                    disabled={selectedNewMembers.length === 0 || isAdding}
                    onPress={handleConfirmAddMembers}
                  >
                    {isAdding ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmAddText}>Add {selectedNewMembers.length} to Group</Text>}
                  </Pressable>
                </>
              )}
              
            </View>
          </View>
        </Modal>

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
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
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
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  
  // Group Info Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: '50%', maxHeight: '90%', paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary },
  modalCloseBtn: { padding: 4, marginRight: -4 },
  modalBackBtn: { padding: 4, marginLeft: -8 },
  
  membersList: { flex: 1 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: C.textSecondary, marginTop: 20, marginBottom: 8, paddingHorizontal: 20, letterSpacing: 0.5 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  memberAvatarImg: { width: '100%', height: '100%' },
  memberAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  checkOverlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  memberName: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  memberRole: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  
  groupActions: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, marginTop: 10 },
  groupActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  groupActionText: { fontSize: 16, fontWeight: '600', color: C.maroon },
  
  confirmAddBtn: { backgroundColor: C.maroon, marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  confirmAddText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
