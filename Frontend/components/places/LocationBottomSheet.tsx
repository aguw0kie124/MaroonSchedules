import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import {
  X,
  ExternalLink,
  Calendar,
  Clock,
  Utensils,
  Layers,
  Star,
  Navigation,
  Share2,
} from "lucide-react-native";
import { useShareStore } from "../../store/shareStore";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import type { CampusLocation } from "./types";
import { SNAP_PEEK, SNAP_FULL, SNAP_HIDDEN, SHEET_BOTTOM_OFFSET, SCREEN_HEIGHT } from "./types";
import {
  getStatusColor,
  formatScheduleDays,
  getLocationContextLink,
} from "./utils";
import { getCanonicalLocationName } from "./campusData";
import {
  DiningMealPeriod,
  getDiningMealOptionsForLocation,
  getDiningMenuCandidates,
  isDiningHallMenuLocation,
} from "../../services/diningMenuCache";
import { PillTabs } from "../PillTabs";

interface LocationBottomSheetProps {
  styles: any;
  COLORS: any;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  selectedLoc: CampusLocation | undefined;
  // Sheet state is managed internally
  // Reviews
  streamReviews: any[];
  reviewModalVisible: boolean;
  setReviewModalVisible: (v: boolean) => void;
  newRating: number;
  setNewRating: (v: number) => void;
  newReviewText: string;
  setNewReviewText: (v: string) => void;
  isPostingReview: boolean;
  handlePostReview: () => void;
  allReviewsModalVisible: boolean;
  setAllReviewsModalVisible: (v: boolean) => void;
  isFetchingReviews: boolean;
  fetchReviews: (placeId: string, limit?: number) => void;
  // Dining
  hubRestaurants: string[];
  diningMenuOptions: string[];
  activeDiningMenu: string | null;
  setActiveDiningMenu: (v: string | null) => void;
  activeDiningMealPeriod: DiningMealPeriod;
  setActiveDiningMealPeriod: (v: DiningMealPeriod) => void;
  diningMenuPreview: any | null;
  isFetchingDining: boolean;
  isPrimaryDiningHallSelection: boolean;
  openFullMenu: (locationName: string) => void;
  // Schedule
  openScheduleList: () => void;
  // Recreation
  selectedRecreationFacility: any | null;
  recreationFacilityMap: Map<string, any>;
  // Navigation
  navigation: any;
  // External link
  getPlaceExternalLink: (location: CampusLocation) => { label: string; url: string };
  // Bus state — to know when not to show
  selectedStop: any;
  selectedBus: any;
}

export function LocationBottomSheet({
  styles,
  COLORS,
  selectedId,
  setSelectedId,
  selectedLoc,
  streamReviews,
  reviewModalVisible,
  setReviewModalVisible,
  newRating,
  setNewRating,
  newReviewText,
  setNewReviewText,
  isPostingReview,
  handlePostReview,
  allReviewsModalVisible,
  setAllReviewsModalVisible,
  isFetchingReviews,
  fetchReviews,
  hubRestaurants,
  diningMenuOptions,
  activeDiningMenu,
  setActiveDiningMenu,
  activeDiningMealPeriod,
  setActiveDiningMealPeriod,
  diningMenuPreview,
  isFetchingDining,
  isPrimaryDiningHallSelection,
  openFullMenu,
  openScheduleList,
  selectedRecreationFacility,
  recreationFacilityMap,
  navigation,
  getPlaceExternalLink,
  selectedStop,
  selectedBus,
}: LocationBottomSheetProps) {
  // ── Bottom sheet animation ──────────────────────────────────
  const sheetY = useRef(new Animated.Value(SNAP_HIDDEN)).current;
  const sheetSnap = useRef<number>(SNAP_HIDDEN);
  const panStartY = useRef<number>(SNAP_HIDDEN);
  const [diningDetailTab, setDiningDetailTab] = useState<"reviews" | "menus">(
    "reviews",
  );

  const animateSheet = useCallback(
    (toValue: number, onDone?: () => void) => {
      sheetSnap.current = toValue;
      Animated.spring(sheetY, {
        toValue,
        useNativeDriver: true,
        damping: 30,
        stiffness: 260,
        mass: 0.9,
      }).start(onDone);
    },
    [sheetY],
  );

  useEffect(() => {
    setDiningDetailTab("reviews");
    if (selectedId) {
      animateSheet(SNAP_PEEK);
    } else {
      animateSheet(SNAP_HIDDEN);
    }
  }, [selectedId, animateSheet]);

  const isDiningHallCard =
    !!selectedLoc &&
    isDiningHallMenuLocation(selectedLoc.location) &&
    isPrimaryDiningHallSelection;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
        onPanResponderGrant: () => {
          panStartY.current = sheetSnap.current;
          sheetY.stopAnimation();
        },
        onPanResponderMove: (_, { dy }) => {
          const next = Math.max(SNAP_FULL, panStartY.current + dy);
          sheetY.setValue(next);
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          const liveY = panStartY.current + dy;

          if (vy > 1.0) {
            if (sheetSnap.current < SNAP_PEEK - 20) {
              animateSheet(SNAP_PEEK);
            } else {
              animateSheet(SNAP_HIDDEN, () => setSelectedId(null));
            }
            return;
          }
          if (vy < -1.0) {
            animateSheet(SNAP_FULL);
            return;
          }

          const midPeekFull = (SNAP_PEEK + SNAP_FULL) / 2;
          const midPeekHidden = (SNAP_PEEK + SNAP_HIDDEN) / 2;

          if (liveY > midPeekHidden) {
            animateSheet(SNAP_HIDDEN, () => setSelectedId(null));
          } else if (liveY > midPeekFull) {
            animateSheet(SNAP_PEEK);
          } else {
            animateSheet(SNAP_FULL);
          }
        },
      }),
    [animateSheet, setSelectedId],
  );

  if (!selectedId || selectedStop || selectedBus) return null;

  return (
    <>
      <Animated.View
        style={[styles.bottomSheet, { transform: [{ translateY: sheetY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandle} />

        {selectedLoc ? (
          <>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.locationName}>{selectedLoc.location}</Text>
                <View style={styles.sheetBadgeRow}>
                  <Text style={styles.typeTextSlim}>{selectedLoc.type}</Text>
                  {selectedLoc.is_live ? (
                    <View style={styles.liveBadgeSlim}>
                      <Text style={styles.dotSeparator}>•</Text>
                      <View style={styles.livePulse} />
                      <Text style={styles.liveTextSlim}>Live Traffic</Text>
                    </View>
                  ) : selectedLoc.classMeetings?.length ? (
                    <View style={styles.aiBadgeSlim}>
                      <Text style={styles.dotSeparator}>•</Text>
                      <Text style={styles.aiTextSlim}>Your events</Text>
                    </View>
                  ) : (
                    <View style={styles.aiBadgeSlim}>
                      <Text style={styles.dotSeparator}>•</Text>
                      <Text style={styles.aiTextSlim}>Directory</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ alignItems: "center", gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setSelectedId(null)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.dismissBtn}
                >
                  <X size={18} color="#888" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.circularActionBtn}
                  onPress={() =>
                    useShareStore.getState().openShare({
                      title: selectedLoc.location,
                      message: `Check out ${selectedLoc.location} on MaroonSchedules!`,
                      url: `https://maroonschedules.tamu.edu/places/${selectedLoc.location.replace(/\s+/g, '-')}`
                    })
                  }
                >
                  <Share2 size={20} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.circularActionBtn}
                  onPress={() =>
                    navigation.navigate("CampusNavigation", {
                      initialDestination: {
                        id: selectedLoc.location,
                        name: selectedLoc.location,
                        shortName: selectedLoc.shortName || selectedLoc.location,
                        latitude: selectedLoc.coord.lat,
                        longitude: selectedLoc.coord.lng,
                        type:
                          selectedLoc.type === "Academic"
                            ? "academic"
                            : selectedLoc.type === "Library"
                              ? "library"
                              : selectedLoc.type === "Dining"
                                ? "dining"
                                : selectedLoc.type === "Rec"
                                  ? "recreation"
                                  : selectedLoc.type === "Housing"
                                    ? "housing"
                                    : selectedLoc.type === "Athletics"
                                      ? "athletics"
                                      : "landmark",
                      },
                    })
                  }
                >
                  <Navigation size={20} fill="#FFF" color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedLoc.description ? (
              <Text style={styles.descriptionText} numberOfLines={1}>
                {selectedLoc.description}
              </Text>
            ) : null}

            {/* Quick actions + context cards */}
            {(() => {
              const parkingRecommendation =
                selectedLoc.type === "Parking"
                  ? (() => {
                      const lower = selectedLoc.location.toLowerCase();
                      const isGarage = lower.includes("garage");
                      return isGarage
                        ? { badge: "Recommended", detail: "A strong all-around option for most valid permits." }
                        : { badge: "Available", detail: "Keep this as a fallback if your primary lots are full." };
                    })()
                  : null;
              const contextLink = getLocationContextLink(selectedLoc);
              const externalLink = getPlaceExternalLink(selectedLoc);
              return (
                <>
                  <View style={styles.quickActionRow}>
                    <TouchableOpacity
                      style={styles.quickActionPill}
                      onPress={() =>
                        Linking.openURL(externalLink.url).catch((error) => {
                          console.warn("Unable to open place external link", error);
                        })
                      }
                    >
                      <ExternalLink size={14} color="#F3F1ED" />
                        <Text style={styles.quickActionText}>
                        {externalLink.label}
                        </Text>
                      </TouchableOpacity>

                    {isDiningHallMenuLocation(selectedLoc.location) &&
                    activeDiningMenu &&
                    isPrimaryDiningHallSelection ? (
                      <TouchableOpacity
                        style={[styles.quickActionPill, styles.quickActionPrimary]}
                        onPress={() => openFullMenu(activeDiningMenu)}
                      >
                        <Utensils size={14} color="#FFFFFF" />
                        <Text style={styles.quickActionPrimaryText}>
                          Menus
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {selectedLoc.classMeetings?.length ? (
                      <TouchableOpacity
                        style={styles.quickActionPill}
                        onPress={openScheduleList}
                      >
                        <Calendar size={14} color="#F3F1ED" />
                        <Text style={styles.quickActionText}>Today</Text>
                      </TouchableOpacity>
                    ) : null}

                    {contextLink ? (
                      <TouchableOpacity
                        style={styles.quickActionPill}
                        onPress={() =>
                          Linking.openURL(contextLink.url).catch((error) => {
                            console.warn("Unable to open place context link", error);
                          })
                        }
                      >
                        <ExternalLink size={14} color="#F3F1ED" />
                        <Text style={styles.quickActionText}>
                          {contextLink.label}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {parkingRecommendation ? (
                    <View style={styles.contextCard}>
                      <Text style={styles.contextCardTitle}>
                        {parkingRecommendation.badge}
                      </Text>
                      <Text style={styles.contextCardBody}>
                        {parkingRecommendation.detail}
                      </Text>
                    </View>
                  ) : null}

                  {selectedLoc.current_event ? (
                    <View style={styles.contextCard}>
                      <Text style={styles.contextCardTitle}>
                        Active at this place
                      </Text>
                      <Text style={styles.contextCardBody}>
                        {selectedLoc.current_event}
                      </Text>
                    </View>
                  ) : null}
                </>
              );
            })()}

            {/* Hub Restaurants / Occupancy / Hours */}
            {hubRestaurants.length > 0 ? (
              <View style={styles.infoBlock}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.sectionTitle}>Inside this Hub</Text>
                  <View style={styles.restaurantChipList}>
                    {hubRestaurants.map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.restaurantChip,
                          activeDiningMenu === getDiningMenuCandidates(r)[0] &&
                            styles.restaurantChipActive,
                        ]}
                        onPress={() => {
                          const nextMenu = getDiningMenuCandidates(r)[0];
                          if (nextMenu) {
                            setActiveDiningMenu(nextMenu);
                          }
                        }}
                      >
                        <Text style={styles.restaurantChipText}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.hoursInfo}>
                  <Clock size={12} color={COLORS.textTertiary} />
                  <Text style={styles.hoursText}>
                    {selectedLoc.hours || "Open Today · 7:00 AM – 10:00 PM"}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.infoBlock}>
                {selectedLoc.type === "Library" || selectedLoc.type === "Rec" ? (
                  <View style={styles.occupancyBlock}>
                    <View style={styles.occupancyHeaderRow}>
                      <Layers
                        size={18}
                        color={getStatusColor(selectedLoc.percent_full)}
                      />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text style={styles.occupancyLiveLabel}>
                          Live Occupancy
                        </Text>
                        <Text
                          style={[
                            styles.occupancyLiveText,
                            {
                              color: getStatusColor(selectedLoc.percent_full),
                            },
                          ]}
                        >
                          {selectedLoc.percent_full}% Full
                        </Text>
                      </View>
                    </View>
                    <View style={styles.occupancyTrack}>
                      <View
                        style={[
                          styles.occupancyFill,
                          {
                            width: `${selectedLoc.percent_full}%` as any,
                            backgroundColor: getStatusColor(
                              selectedLoc.percent_full,
                            ),
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.hoursInfo}>
                      <Clock size={16} color={"#888"} />
                      <Text style={styles.hoursText}>
                        {selectedLoc.type === "Rec"
                          ? `Today: ${selectedRecreationFacility?.today_hours || selectedRecreationFacility?.hours_hint || selectedLoc.hours || "Check official facility page"}`
                          : selectedLoc.hours || "6:00 AM – 12:00 AM"}
                      </Text>
                    </View>
                    {selectedLoc.type === "Rec" &&
                    selectedRecreationFacility?.source_url ? (
                      <TouchableOpacity
                        style={styles.inlineLinkRow}
                        onPress={() =>
                          Linking.openURL(
                            selectedRecreationFacility.source_url,
                          ).catch(() => {})
                        }
                      >
                        <ExternalLink size={14} color="#F3F1ED" />
                        <Text style={styles.inlineLinkText}>
                          Open official facility page
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.hoursInfoBlock}>
                    <Clock size={16} color={"#888"} />
                    <Text style={styles.hoursText}>
                      {selectedLoc.hours || "6:00 AM – 12:00 AM"}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.sheetDivider} />

            {/* Scrollable detail content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              scrollEventThrottle={16}
            >
              {isDiningHallCard ? (
                <>
                  <View style={styles.detailTabsWrap}>
                    <PillTabs
                      items={[
                        { key: "reviews", label: "Reviews" },
                        { key: "menus", label: "Menus" },
                      ]}
                      activeKey={diningDetailTab}
                      onChange={(key) =>
                        setDiningDetailTab(key as "reviews" | "menus")
                      }
                      floating
                      compact
                    />
                  </View>

                  {diningDetailTab === "menus" ? (
                    <View style={styles.infoBlock}>
                      <View style={styles.reviewsHeader}>
                        <View>
                          <Text style={styles.sectionTitle}>Live menus</Text>
                          <Text style={styles.menuIntroText}>
                            Live dining hall menu.
                          </Text>
                        </View>
                        {activeDiningMenu ? (
                          <TouchableOpacity
                            onPress={() =>
                              openFullMenu(
                                activeDiningMenu || selectedLoc.location,
                              )
                            }
                          >
                            <Text style={styles.seeAllText}>Open full menu</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {diningMenuOptions.length > 1 ? (
                        <View style={styles.restaurantChipList}>
                          {diningMenuOptions.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={[
                                styles.restaurantChip,
                                activeDiningMenu === option &&
                                  styles.restaurantChipActive,
                              ]}
                              onPress={() => setActiveDiningMenu(option)}
                            >
                              <Text style={styles.restaurantChipText}>
                                {option}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}

                      {activeDiningMenu ? (
                        <View style={styles.restaurantChipList}>
                          {getDiningMealOptionsForLocation(activeDiningMenu).map(
                            (mealPeriod) => (
                              <TouchableOpacity
                                key={mealPeriod}
                                style={[
                                  styles.restaurantChip,
                                  activeDiningMealPeriod === mealPeriod &&
                                    styles.restaurantChipActive,
                                ]}
                                onPress={() =>
                                  setActiveDiningMealPeriod(
                                    mealPeriod as DiningMealPeriod,
                                  )
                                }
                              >
                                <Text style={styles.restaurantChipText}>
                                  {mealPeriod.charAt(0).toUpperCase() +
                                    mealPeriod.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            ),
                          )}
                        </View>
                      ) : null}

                      <View style={styles.metaPillRow}>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>
                            {diningMenuPreview?.count ?? 0} items
                          </Text>
                        </View>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>
                            {diningMenuPreview?.categories?.length ?? 0} categories
                          </Text>
                        </View>
                      </View>

                      {isFetchingDining ? (
                        <ActivityIndicator
                          color={COLORS.primary}
                          style={{ marginVertical: 18 }}
                        />
                      ) : diningMenuPreview?.categories?.length ? (
                        <View style={styles.menuCategoryList}>
                          {diningMenuPreview.categories.map((category: any) => (
                            <View
                              key={category.name}
                              style={styles.menuCategoryCard}
                            >
                              <View style={styles.menuCategoryHeader}>
                                <Text style={styles.menuCategoryTitle}>
                                  {category.name}
                                </Text>
                                <Text style={styles.menuCategoryCount}>
                                  {category.items.length}
                                </Text>
                              </View>

                              <View style={styles.menuCategoryItems}>
                                {category.items.slice(0, 2).map((item: any) => (
                                  <View
                                    key={`${activeDiningMenu}-${category.name}-${item.name}`}
                                    style={styles.menuCategoryItem}
                                  >
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.menuCategoryItemName}>
                                        {item.name}
                                      </Text>
                                      {item.calories || item.protein ? (
                                        <Text
                                          style={styles.menuCategoryItemMeta}
                                          numberOfLines={1}
                                        >
                                          {item.calories
                                            ? `${Math.round(item.calories || 0)} kcal`
                                            : ""}
                                          {item.calories && item.protein
                                            ? " · "
                                            : ""}
                                          {item.protein
                                            ? `${Math.round(item.protein)}g protein`
                                            : ""}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                ))}
                                {category.items.length > 2 ? (
                                  <Text style={styles.menuCategoryMoreText}>
                                    +{category.items.length - 2} more items
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.emptyReviews}>
                          <Text style={styles.emptyReviewsText}>
                            Menu not available yet for this meal period.
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.infoBlock}>
                      <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>Reviews</Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <TouchableOpacity
                            onPress={() => setReviewModalVisible(true)}
                          >
                            <Text style={styles.addReviewText}>
                              + Add Review
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setAllReviewsModalVisible(true);
                              fetchReviews(selectedId!, 30);
                            }}
                          >
                            <Text style={styles.seeAllText}>See all</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {streamReviews.length > 0 ? (
                        streamReviews.slice(0, 3).map((rev, i) => (
                          <View key={rev.id || i} style={styles.reviewItem}>
                            <View style={styles.reviewMeta}>
                              <View style={styles.reviewUserRow}>
                                <View style={styles.userAvatar}>
                                  <Text style={styles.avatarText}>
                                    {rev.user[0]}
                                  </Text>
                                </View>
                                <Text style={styles.reviewUser}>
                                  {rev.user}
                                </Text>
                              </View>
                              <View style={styles.reviewStars}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={11}
                                    fill={
                                      s <= rev.rating ? "#FFD700" : "transparent"
                                    }
                                    color={s <= rev.rating ? "#FFD700" : "#555"}
                                  />
                                ))}
                              </View>
                            </View>
                            <Text style={styles.reviewComment} numberOfLines={3}>
                              {rev.comment}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptyReviews}>
                          <Text style={styles.emptyReviewsText}>
                            No reviews found for this location.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* Traffic chart */}
                  {(selectedLoc.type === "Library" ||
                    selectedLoc.type === "Rec") && (
                    <View style={styles.chartContainer}>
                      <Text style={styles.chartTitle}>Foot Traffic · Last 8h</Text>
                      <View style={styles.chartBars}>
                        {(
                          selectedLoc.traffic_history || [
                            20, 45, 15, 60, 40, 25, 20, 50,
                          ]
                        ).map((val: number, i: number) => (
                          <View key={i} style={styles.barWrapper}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  height: Math.max(8, (val / 100) * 45),
                                  backgroundColor: getStatusColor(val),
                                },
                              ]}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Class meetings */}
                  {selectedLoc.classMeetings?.length ? (
                    <View style={styles.infoBlock}>
                      <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>Today's Schedule</Text>
                        <TouchableOpacity onPress={openScheduleList}>
                          <Text style={styles.seeAllText}>My Today</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.classMeetingList}>
                        {selectedLoc.classMeetings.slice(0, 3).map((meeting) => (
                          <View
                            key={meeting.id}
                            style={styles.classMeetingCard}
                          >
                            <View style={styles.classMeetingHeader}>
                              <Text style={styles.classMeetingCode}>
                                {meeting.code}
                              </Text>
                              <Text style={styles.classMeetingTime}>
                                {meeting.timeLabel}
                              </Text>
                            </View>
                            <Text style={styles.classMeetingName}>
                              {meeting.name}
                            </Text>
                            <Text style={styles.classMeetingMeta}>
                              {formatScheduleDays(meeting.days)}
                              {meeting.room ? ` · Room ${meeting.room}` : ""}
                            </Text>
                            <Text style={styles.classMeetingScheduleLabel}>
                              {meeting.scheduleLabel}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* Reviews */}
                  <View style={styles.reviewsHeader}>
                    <Text style={styles.sectionTitle}>Reviews</Text>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                      <TouchableOpacity
                        onPress={() => setReviewModalVisible(true)}
                      >
                        <Text style={styles.addReviewText}>+ Add Review</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setAllReviewsModalVisible(true);
                          fetchReviews(selectedId!, 30);
                        }}
                      >
                        <Text style={styles.seeAllText}>See all</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {streamReviews.length > 0 ? (
                    streamReviews.slice(0, 3).map((rev, i) => (
                      <View key={rev.id || i} style={styles.reviewItem}>
                        <View style={styles.reviewMeta}>
                          <View style={styles.reviewUserRow}>
                            <View style={styles.userAvatar}>
                              <Text style={styles.avatarText}>
                                {rev.user[0]}
                              </Text>
                            </View>
                            <Text style={styles.reviewUser}>{rev.user}</Text>
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
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyReviews}>
                      <Text style={styles.emptyReviewsText}>
                        No reviews found for this location.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </>
        ) : null}
      </Animated.View>

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} animationType="fade" transparent>
        <TouchableWithoutFeedback
          onPress={() => setReviewModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ width: "100%", alignItems: "center" }}
            >
              <TouchableWithoutFeedback
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.reviewModalContainer}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Rate {selectedId}</Text>
                    <TouchableOpacity
                      onPress={() => setReviewModalVisible(false)}
                    >
                      <X size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          setNewRating(s);
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                        }}
                        style={styles.starTouch}
                      >
                        <Star
                          size={38}
                          fill={s <= newRating ? "#FFD700" : "transparent"}
                          color={s <= newRating ? "#FFD700" : "#333"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Sharing your experience helps other Aggies..."
                      placeholderTextColor="#555"
                      multiline
                      value={newReviewText}
                      onChangeText={setNewReviewText}
                      maxLength={500}
                    />
                    <Text style={styles.charCount}>
                      {newReviewText.length}/500
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.premiumPostBtn,
                      (!newReviewText.trim() || newRating === 0) && {
                        opacity: 0.4,
                      },
                    ]}
                    onPress={handlePostReview}
                    disabled={
                      !newReviewText.trim() ||
                      newRating === 0 ||
                      isPostingReview
                    }
                  >
                    <View style={styles.btnContent}>
                      {isPostingReview ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.premiumPostBtnText}>
                          Post Review
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Full Reviews Modal */}
      <Modal
        visible={allReviewsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAllReviewsModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setAllReviewsModalVisible(false)}
        >
          <View style={styles.fullReviewsOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.fullReviewsContainer}>
                <View style={styles.dragHandle} />
                <View style={styles.fullReviewsHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fullReviewsTitle}>User Reviews</Text>
                    <Text style={styles.fullReviewsSubtitle}>{selectedId}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAllReviewsModalVisible(false)}
                    style={styles.backBtn}
                  >
                    <X size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {isFetchingReviews ? (
                  <View style={styles.fullReviewsLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.fullReviewsLoadingText}>
                      Loading reviews...
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.fullReviewsScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {streamReviews.length > 0 ? (
                      streamReviews.map((rev, i) => (
                        <View key={i} style={styles.reviewItem}>
                          <View style={styles.reviewMeta}>
                            <Text style={styles.reviewUser}>{rev.user}</Text>
                            <View style={styles.reviewStars}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={11}
                                  fill={
                                    s <= rev.rating ? "#FFD700" : "transparent"
                                  }
                                  color={s <= rev.rating ? "#FFD700" : "#444"}
                                />
                              ))}
                            </View>
                          </View>
                          <Text style={styles.reviewComment}>{rev.comment}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyReviews}>
                        <Text style={styles.emptyReviewsText}>
                          No reviews found for this location.
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
