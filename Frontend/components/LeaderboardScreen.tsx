import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { Trophy, Users, MapPin, ChevronRight, Medal } from "lucide-react-native";
import { useTheme } from "./SharedUI";

// Mock Data
const MOCK_PODIUM = [
  { id: "2", name: "Aditya Sudharshan", points: 6767, checks: 28, color: "#C0C0C0" }, // Silver
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
  const [activeTab, setActiveTab] = useState<"Global" | "Friends" | "This Week">("Global");

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
        <Text style={[styles.title, { color: COLORS.textPrimary }]}>Campus Rankings</Text>
        <Text style={styles.subtitle}>Check into places to earn points!</Text>

        {/* Tabs */}
        <View style={styles.tabsMenu}>
          {["Global", "Friends", "This Week"].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && { backgroundColor: "#500000" }]}
                onPress={() => setActiveTab(tab as any)}
              >
                <Text style={[styles.tabText, isActive && { color: "#FFFFFF", fontWeight: "700" }]}>{tab}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
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
          <Text style={styles.rowChecks}>82 points to Rank 141!</Text>
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
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 99,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
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
  }
});
