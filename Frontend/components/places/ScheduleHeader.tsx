import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { ScheduleMapOption } from "./types";

interface ScheduleHeaderProps {
  styles: any;
  COLORS: any;
  activeLayer: string;
  scheduleOptions: ScheduleMapOption[];
  activeScheduleOption: ScheduleMapOption | null;
  scheduleSummaryLabel: string;
  isLoadingSchedules: boolean;
  setActiveScheduleId: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  openScheduleList: () => void;
  openNewCourseSearch: () => void;
  openScheduleList: () => void;
  openNewCourseSearch: () => void;
}

export function ScheduleHeader({
  styles,
  COLORS,
  activeLayer,
  scheduleOptions,
  activeScheduleOption,
  scheduleSummaryLabel,
  isLoadingSchedules,
  setActiveScheduleId,
  setSelectedId,
  openScheduleList,
  openNewCourseSearch,
}: ScheduleHeaderProps) {
  if (activeLayer !== "Today" && activeLayer !== "Schedule") return null;

  return (
    <View style={styles.scheduleHeaderCard}>
      <View style={styles.scheduleHeaderTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.scheduleHeaderEyebrow}>Class map</Text>
          <Text style={styles.scheduleHeaderTitle}>
            {activeScheduleOption
              ? activeScheduleOption.label
              : "No schedule selected"}
          </Text>
          <Text style={styles.scheduleHeaderBody}>
            {activeScheduleOption
              ? `${scheduleSummaryLabel}. Tap a building to see the classes meeting there.`
              : isLoadingSchedules
                ? "Loading your saved schedules and uploaded class data."
                : "Upload a schedule or add classes manually to pin your day onto the map."}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.scheduleHeaderButton}
          onPress={openScheduleList}
        >
          <Text style={styles.scheduleHeaderButtonText}>Schedules</Text>
        </TouchableOpacity>
      </View>

      {scheduleOptions.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scheduleChipScroller}
          >
            {scheduleOptions.map((option) => {
              const isActive = activeScheduleOption?.id === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.scheduleChip,
                    isActive && styles.scheduleChipActive,
                  ]}
                  onPress={() => {
                    setActiveScheduleId(option.id);
                    setSelectedId(null);
                  }}
                >
                  <Text
                    style={[
                      styles.scheduleChipLabel,
                      isActive && styles.scheduleChipLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.scheduleChipMeta,
                      isActive && styles.scheduleChipMetaActive,
                    ]}
                  >
                    {option.source === "uploaded"
                      ? "Uploaded schedule"
                      : `${option.entries.length} classes`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.scheduleHeaderFooter}>
            <Text style={styles.scheduleHeaderFooterText}>
              {scheduleSummaryLabel}
            </Text>
            <TouchableOpacity onPress={openNewCourseSearch}>
              <Text style={styles.seeAllText}>Add class</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : isLoadingSchedules ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.scheduleEmptyState}>
          <Text style={styles.scheduleEmptyStateTitle}>
            No classes on the map yet
          </Text>
          <Text style={styles.scheduleEmptyStateBody}>
            Keep Places centered on your day by adding a saved schedule or choosing sections manually.
          </Text>
          <View style={styles.scheduleEmptyActionRow}>
            <TouchableOpacity
              style={[
                styles.scheduleEmptyAction,
                styles.scheduleEmptyActionPrimary,
              ]}
              onPress={openScheduleList}
            >
              <Text style={styles.scheduleEmptyActionPrimaryText}>
                My Schedules
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scheduleEmptyAction}
              onPress={openNewCourseSearch}
            >
              <Text style={styles.scheduleEmptyActionText}>Add Class</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
