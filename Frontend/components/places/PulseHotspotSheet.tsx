import React from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { CalendarDays, Flame, MapPin, TrendingUp, X } from "lucide-react-native";

import type { CampusHotspot } from "../../services/campusPulse";

interface PulseHotspotSheetProps {
  styles: any;
  COLORS: any;
  hotspot: CampusHotspot | null;
  onClose: () => void;
  onOpenPlace: (hotspot: CampusHotspot) => void;
  onOpenItem: (hotspot: CampusHotspot, item: CampusHotspot["items"][number]) => void;
}

export function PulseHotspotSheet({
  styles,
  COLORS,
  hotspot,
  onClose,
  onOpenPlace,
  onOpenItem,
}: PulseHotspotSheetProps) {
  if (!hotspot) return null;

  return (
    <View style={styles.pulseSheetWrap} pointerEvents="box-none">
      <Animated.View style={styles.pulseSheetCard}>
        <View style={styles.pulseSheetHandle} />

        <View style={styles.pulseSheetHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.pulseSheetEyebrowRow}>
              <View
                style={[
                  styles.pulseSheetStatusBadge,
                  { backgroundColor: `${hotspot.pulseColor}22` },
                ]}
              >
                <Flame size={13} color={hotspot.pulseColor} />
                <Text
                  style={[
                    styles.pulseSheetStatusLabel,
                    { color: hotspot.pulseColor },
                  ]}
                >
                  {hotspot.pulseLabel}
                </Text>
              </View>
              <Text style={styles.pulseSheetPreviewLabel}>{hotspot.previewLabel}</Text>
            </View>
            <Text style={styles.pulseSheetTitle}>{hotspot.locationName}</Text>
            <Text style={styles.pulseSheetSummary}>{hotspot.summary}</Text>
          </View>

          <Pressable style={styles.pulseSheetCloseButton} onPress={onClose}>
            <X size={18} color={COLORS.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.pulseSheetStatsRow}>
          <View style={styles.pulseSheetStatCard}>
            <TrendingUp size={15} color={hotspot.pulseColor} />
            <Text style={styles.pulseSheetStatValue}>{hotspot.score}</Text>
            <Text style={styles.pulseSheetStatLabel}>Pulse</Text>
          </View>
          <View style={styles.pulseSheetStatCard}>
            <CalendarDays size={15} color={COLORS.textPrimary} />
            <Text style={styles.pulseSheetStatValue}>
              {hotspot.eventCount}
            </Text>
            <Text style={styles.pulseSheetStatLabel}>Events</Text>
          </View>
          <View style={styles.pulseSheetStatCard}>
            <MapPin size={15} color={COLORS.textPrimary} />
            <Text style={styles.pulseSheetStatValue}>
              {hotspot.pingCount}
            </Text>
            <Text style={styles.pulseSheetStatLabel}>Pings</Text>
          </View>
        </View>

        <View style={styles.pulseSheetActionsRow}>
          <Pressable style={styles.pulseSheetPrimaryAction} onPress={() => onOpenPlace(hotspot)}>
            <MapPin size={15} color="#FFFFFF" />
            <Text style={styles.pulseSheetPrimaryActionText}>Open place</Text>
          </Pressable>
        </View>

        <View style={styles.pulseSheetSectionHeader}>
          <Text style={styles.pulseSheetSectionTitle}>What is happening here</Text>
          <Text style={styles.pulseSheetSectionMeta}>{hotspot.dominantCategory}</Text>
        </View>

        <ScrollView
          style={styles.pulseSheetItemsScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pulseSheetItemsContent}
        >
          {hotspot.items.map((item) => (
            <Pressable
              key={`${item.source}-${item.id}`}
              style={styles.pulseSheetItemCard}
              onPress={() => onOpenItem(hotspot, item)}
            >
              <View style={styles.pulseSheetItemHeader}>
                <Text style={styles.pulseSheetItemSource}>
                  {item.source === "event" ? "Featured Event" : "Live Ping"}
                </Text>
                <Text style={styles.pulseSheetItemTime}>{item.timeLabel}</Text>
              </View>
              <Text style={styles.pulseSheetItemTitle}>{item.title}</Text>
              <Text style={styles.pulseSheetItemMeta}>
                {item.category}
                {item.subtitle ? ` · ${item.subtitle}` : ""}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
