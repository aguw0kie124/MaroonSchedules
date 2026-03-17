import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../config';

type ClerkUser = { id: string; name: string; email: string };

// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  maroon: '#500000',
  maroonLight: '#7a1010',
  white: '#FFFFFF',
  bg: '#FAFAFA',
  textPrimary: '#111111',
  textSecondary: '#8A8A8A',
  border: '#F0F0F0',
  online: '#34D399',
  searchBg: 'rgba(255,255,255,0.15)',
};

const AVATAR_PALETTE = ['#500000', '#6B0000', '#8B1A1A', '#A52A2A', '#7a1010'];

function getAvatarColor(id: string) {
  return AVATAR_PALETTE[id.charCodeAt(4) % AVATAR_PALETTE.length];
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, userId }: { name: string; userId: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: getAvatarColor(userId) }]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
      <View style={styles.onlineBadge} />
    </View>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────
function UserRow({ item, onPress }: { item: ClerkUser; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      android_ripple={{ color: '#F5EAEA' }}
    >
      <Avatar name={item.name} userId={item.id} />

      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
      </View>

      <View style={styles.chevronWrap}>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function UsersScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const [all, setAll] = useState<ClerkUser[]>([]);
  const [filtered, setFiltered] = useState<ClerkUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/chat/users?exclude_id=${user?.id ?? ''}`)
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(data => { setAll(data); setFiltered(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const onSearch = (text: string) => {
    setQuery(text);
    const q = text.toLowerCase();
    setFiltered(all.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  };

  const openChat = (other: ClerkUser) =>
    navigation.navigate('ChatScreen', { otherUserClerkId: other.id, otherUserName: other.name });

  if (loading) return (
    <View style={styles.centerFull}>
      <ActivityIndicator size="large" color={C.maroon} />
    </View>
  );

  if (error) return (
    <View style={styles.centerFull}>
      <Text style={styles.errorText}>⚠️  {error}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.maroon} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filtered.length}</Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Aggies…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={query}
            onChangeText={onSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        style={styles.list}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No Aggies yet</Text>
            <Text style={styles.emptySub}>Users appear here once they've signed in</Text>
          </View>
        }
        renderItem={({ item }) => (
          <UserRow item={item} onPress={() => openChat(item)} />
        )}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const HEADER_PADDING_TOP = 60;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  centerFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  errorText: { color: C.maroon, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },

  // Header
  header: {
    backgroundColor: C.maroon,
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: { marginRight: 4 },
  backArrow: { fontSize: 34, color: C.white, lineHeight: 36, marginTop: -4, fontWeight: '300' },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
    flex: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '600',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.searchBg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchIcon: { fontSize: 18, color: 'rgba(255,255,255,0.6)' },
  searchInput: { flex: 1, fontSize: 15, color: C.white },

  // List
  list: { flex: 1, backgroundColor: C.white },
  emptyContainer: { flex: 1 },
  separator: { height: 1, backgroundColor: C.border, marginLeft: 88 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: C.white,
    minHeight: 76,
  },
  rowPressed: { backgroundColor: '#FFF8F8' },

  // Avatar
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  avatarInitials: {
    color: C.white,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: C.online,
    borderWidth: 2.5,
    borderColor: C.white,
  },

  // Row text
  rowText: { flex: 1, justifyContent: 'center', gap: 4 },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.1,
  },
  rowEmail: {
    fontSize: 13.5,
    color: C.textSecondary,
    fontWeight: '400',
  },

  // Chevron
  chevronWrap: { paddingLeft: 8 },
  chevron: { fontSize: 24, color: '#CCCCCC', fontWeight: '300' },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
});
