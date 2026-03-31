import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from "react-native";
import { Info, MapPin, Medal } from "lucide-react-native";
import { useTheme } from "./SharedUI";

// Mock Data
const MOCK_PODIUM = [
  { id: "2", name: "Asvath Madahn", points: 6767, checks: 28, color: "#C0C0C0" }, // Silver
  { id: "1", name: "Adhip Kumar", points: 69420, checks: 69, color: "#FFD700" }, // Gold
  { id: "3", name: "Parin Vakati", points: 4100, checks: 41, color: "#CD7F32" }, // Bronze
];

const MOCK_RANKS = Array.from({ length: 20 }, (_, i) => ({
  id: `r-${i + 4}`,
  rank: i + 4,
  name: `Student ${i + 4}`,
  points: 3800 - i * 150,
  checks: 20 - i,
}));

export function LeaderboardScreen() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<"Campus" | "Friends" | "This Week">("Campus");
  const previewCardBackground = isDark ? "rgba(80, 0, 0, 0.22)" : "#FFF3F0";
  const previewCardBorder = isDark ? "rgba(255, 212, 204, 0.2)" : "#F3C2B8";
  const previewBodyColor = isDark ? "rgba(255,255,255,0.78)" : "#6E4C46";

  const renderPodium = () => {
    return (
      <View style={styles.podiumContainer}>
        {MOCK_PODIUM.map((user, index) => {
          const isGold = index === 1;
          const height = isGold ? 120 : index === 0 ? 90 : 70;
          return (
            <View key={user.id} style={styles.podiumItem}>
              <View style={[styles.avatar, { borderColor: user.color, borderWidth: 3 }]}>
                {isGold && <Medal size={16} color={user.color} style={styles.medalIcon} />}
                <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
              </View>
              <Text style={[styles.podiumName, { color: COLORS.textPrimary }]} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.podiumPoints}>{user.points} pts</Text>

              <View style={[styles.podiumPillar, { height, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
                <Text style={styles.pillarRank}>{index === 1 ? "1" : index === 0 ? "2" : "3"}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: previewCardBackground,
              borderColor: previewCardBorder,
            },
          ]}
        >
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>Preview</Text>
          </View>
          <View style={styles.previewHeader}>
            <Info size={16} color="#500000" />
            <Text style={[styles.previewTitle, { color: COLORS.textPrimary }]}>Leaderboard coming soon!</Text>
          </View>
          <Text style={[styles.previewBody, { color: previewBodyColor }]}>
            This screen is a preview only. Rankings, check-ins, tabs, and personal placement are not functional yet.
          </Text>
        </View>

        <Text style={[styles.title, { color: COLORS.textPrimary }]}>Campus Rankings</Text>
        <Text style={styles.subtitle}>Preview only. Live points and rank updates are not available yet.</Text>

        {/* Tabs */}
        <View style={styles.tabsMenu}>
          {["Global", "Friends", "This Week"].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && styles.previewTabActive]}
                onPress={() => setActiveTab(tab as any)}
                disabled
                activeOpacity={1}
              >
                <Text style={[styles.tabText, isActive && styles.previewTabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <Text style={styles.tabsHelperText}>Tabs are shown for preview purposes and are currently disabled.</Text>
      </View>

      <FlatList
        data={MOCK_RANKS}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderPodium}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={[styles.rankRow, { borderBottomColor: COLORS.border }]}>
            <Text style={styles.rankNumber}>{item.rank}</Text>
            <View style={styles.rowAvatar}>
              <Text style={styles.rowAvatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.rowName, { color: COLORS.textPrimary }]}>{item.name}</Text>
              <Text style={styles.rowChecks}>
                <MapPin size={10} color={COLORS.textTertiary} /> {item.checks} Check-ins
              </Text>
            </View>
            <Text style={[styles.rowPoints, { color: COLORS.textPrimary }]}>{item.points}</Text>
          </View>
        )}
      />

      {/* Sticky Personal Rank */}
      <View style={[styles.stickyFooter, { backgroundColor: isDark ? "#111" : "#FFF", borderTopColor: COLORS.border }]}>
        <Text style={styles.myRankNum}>142</Text>
        <View style={[styles.rowAvatar, { backgroundColor: "#500000" }]}>
          <Text style={[styles.rowAvatarText, { color: "#FFF" }]}>Y</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.rowName, { color: COLORS.textPrimary }]}>You</Text>
          <Text style={styles.rowChecks}>Preview only. Personal rank is not live yet.</Text>
        </View>
        <Text style={[styles.rowPoints, { color: COLORS.textPrimary }]}>1,420</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  previewBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#500000",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  previewBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  previewBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  tabsMenu: {
    flexDirection: "row",
    marginTop: 16,
    backgroundColor: "rgba(100,100,100,0.1)",
    borderRadius: 99,
    padding: 4,
    opacity: 0.7,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 99,
  },
  previewTabActive: {
    backgroundColor: "rgba(80, 0, 0, 0.18)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
  },
  previewTabTextActive: {
    color: "#500000",
    fontWeight: "700",
  },
  tabsHelperText: {
    fontSize: 12,
    color: "#888",
    marginTop: 8,
  },
  podiumContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 16,
    height: 220,
    marginBottom: 20,
    gap: 8,
  },
  podiumItem: {
    alignItems: "center",
    width: "30%",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    zIndex: 2,
    position: "relative",
  },
  medalIcon: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FFF",
    borderRadius: 10,
    overflow: "hidden",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  podiumName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  podiumPoints: {
    fontSize: 11,
    color: "#888",
    marginBottom: 8,
  },
  podiumPillar: {
    width: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: "center",
    paddingTop: 12,
  },
  pillarRank: {
    fontSize: 24,
    fontWeight: "800",
    color: "#888",
    opacity: 0.5,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankNumber: {
    width: 30,
    fontSize: 15,
    fontWeight: "700",
    color: "#888",
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
  },
  rowAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowChecks: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  rowPoints: {
    fontSize: 15,
    fontWeight: "700",
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 20,
  },
  myRankNum: {
    width: 30,
    fontSize: 16,
    fontWeight: "800",
    color: "#500000",
  },
});
