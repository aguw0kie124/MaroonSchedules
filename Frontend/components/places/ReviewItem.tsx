import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Star, Trash2, Flag, Shield } from "lucide-react-native";

interface ReviewItemProps {
  rev: any;
  currentUserId?: string;
  onDelete: () => void;
  onReport: () => void;
  onBlock: () => void;
}

export const ReviewItem = React.memo(({ 
  rev, 
  currentUserId, 
  onDelete, 
  onReport, 
  onBlock 
}: ReviewItemProps) => {
  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewMeta}>
        <View style={styles.reviewUserRow}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>
              {rev.user ? rev.user[0] : "?"}
            </Text>
          </View>
          <Text style={styles.reviewUser}>{rev.user || "Anonymous"}</Text>
        </View>
        <View style={styles.reviewStars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={11}
              fill={s <= rev.rating ? "#FFD700" : "transparent"}
              color={s <= rev.rating ? "#FFD700" : "#555"}
            />
          ))}
        </View>
      </View>
      <Text style={styles.reviewComment} numberOfLines={3}>
        {rev.comment}
      </Text>
      <View style={styles.reviewActions}>
        {rev.userId === currentUserId ? (
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Trash2 size={14} color="#E56B6B" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={onReport} style={styles.actionButton}>
              <Flag size={14} color="#888" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onBlock} style={styles.actionButton}>
              <Shield size={14} color="#888" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  reviewItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  reviewMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  reviewUser: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewComment: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 18,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 8,
  },
  actionButton: {
    padding: 2,
  },
});
