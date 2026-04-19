import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import {
  X,
  Plus,
  Search,
  MapPin,
  LocateFixed,
  EyeOff,
  Clock,
  Image as ImageIcon,
  Pizza,
  Users,
  Sparkles,
  Flame,
  Megaphone,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '../SharedUI';
import { ScalePressable } from '../common/Motion';
import { TourTarget } from '../onboarding/TourProvider';
import { addPing, uploadMediaImage } from '../../services/socialFeedService';
import { buildCampusDirectory, getCanonicalLocationName } from '../places/campusData';

export type PingCategory =
  | 'Free Food'
  | 'Hangout'
  | 'Study'
  | 'Show'
  | 'Sports'
  | 'Popup'
  | 'Heads Up';

export type TimePreset = 'now' | 'soon' | 'tonight' | 'tomorrow';

export interface ComposerGeoLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export const PING_CATEGORIES: Array<{ id: PingCategory; accent: string; Icon: any }> = [
  { id: 'Free Food', accent: '#E48B3D', Icon: Pizza },
  { id: 'Hangout', accent: '#D85F8D', Icon: Users },
  { id: 'Study', accent: '#6888E8', Icon: Sparkles },
  { id: 'Show', accent: '#855FF0', Icon: Flame },
  { id: 'Sports', accent: '#3CA86E', Icon: Flame },
  { id: 'Popup', accent: '#4B8AC9', Icon: Megaphone },
  { id: 'Heads Up', accent: '#CC5454', Icon: Megaphone },
];

export const TIME_PRESETS: Array<{ id: TimePreset; label: string }> = [
  { id: 'now', label: 'Now' },
  { id: 'soon', label: 'In 1h' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'tomorrow', label: 'Tomorrow' },
];

function buildPresetWindow(preset: TimePreset, durationHours: number = 3) {
  const now = new Date();
  const start = new Date(now);

  if (preset === 'soon') {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  } else if (preset === 'tonight') {
    start.setHours(19, 0, 0, 0);
    if (start <= now) {
      start.setDate(start.getDate() + 1);
    }
  } else if (preset === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    start.setHours(12, 0, 0, 0);
  }

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + Math.round(durationHours * 60));

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function haversineDistanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const R = 6371e3;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLon = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface PingComposerModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  onSuccess?: (createdPing: any) => void;
}

export const PingComposerModal: React.FC<PingComposerModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<PingCategory>('Popup');
  const [composerTimePreset, setComposerTimePreset] = useState<TimePreset>('now');
  const [composerDurationHours, setComposerDurationHours] = useState<number>(3);
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [composerGeoLocation, setComposerGeoLocation] = useState<ComposerGeoLocation | null>(null);
  const [composerImageUri, setComposerImageUri] = useState<string | null>(null);
  const [composerAnonymous, setComposerAnonymous] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [composerAspectRatio, setComposerAspectRatio] = useState<'1:1' | '4:5' | '16:9'>('1:1');

  const directory = useMemo(() => buildCampusDirectory(), []);
  const locationLookup = useMemo(
    () => new Map(directory.map((item) => [getCanonicalLocationName(item.location), item])),
    [directory],
  );

  const resetComposer = useCallback(() => {
    setComposerTitle('');
    setComposerBody('');
    setComposerCategory('Popup');
    setComposerTimePreset('now');
    setComposerDurationHours(3);
    setLocationQuery('');
    setSelectedLocation(null);
    setComposerGeoLocation(null);
    setComposerImageUri(null);
    setComposerAnonymous(false);
    setUseCurrentLocation(true);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetComposer();
  }, [onClose, resetComposer]);

  const handleSelectLocation = useCallback((locationName: string) => {
    setUseCurrentLocation(false);
    setSelectedLocation(locationName);
    setComposerGeoLocation(null);
    setLocationQuery(locationName);
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setUseCurrentLocation(true);
    setIsResolvingCurrentLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location unavailable', 'Allow location access to pin your current spot.');
        return null;
      }

      let current;
      try {
        current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (_error) {
        current = await Location.getLastKnownPositionAsync();
      }
      if (!current) {
        throw new Error('Could not determine your location.');
      }
      const latitude = current.coords.latitude;
      const longitude = current.coords.longitude;

      const nearest = directory.reduce(
        (best, item) => {
          const distanceMeters = haversineDistanceMeters(
            latitude,
            longitude,
            item.coord.lat,
            item.coord.lng,
          );
          if (!best || distanceMeters < best.distanceMeters) {
            return { item, distanceMeters };
          }
          return best;
        },
        null as { item: (typeof directory)[number]; distanceMeters: number } | null,
      );

      const label =
        nearest && nearest.distanceMeters <= 220
          ? `Near ${nearest.item.location}`
          : 'Pinned location';

      const nextLocation = {
        latitude,
        longitude,
        label,
      };
      setComposerGeoLocation(nextLocation);
      setSelectedLocation(null);
      setLocationQuery('');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return nextLocation;
    } catch (error) {
      console.warn('[Pings] current location failed', error);
      Alert.alert('Could not pin location', 'Try again in a moment.');
      return null;
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  }, [directory]);

  useEffect(() => {
    if (!visible || !useCurrentLocation || composerGeoLocation || isResolvingCurrentLocation) return;
    if (selectedLocation || locationQuery.trim().length > 0) return;
    handleUseCurrentLocation();
  }, [
    visible,
    useCurrentLocation,
    composerGeoLocation,
    isResolvingCurrentLocation,
    selectedLocation,
    locationQuery,
    handleUseCurrentLocation,
  ]);

  const handlePickPingImage = useCallback(async () => {
    const launchCamera = async () => {
      try {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          Alert.alert('Camera unavailable', 'Allow camera access to take a photo for your ping.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.82,
          aspect: [4, 3],
        });

        if (!result.canceled && result.assets[0]) {
          setComposerImageUri(result.assets[0].uri);
        }
      } catch (error) {
        console.warn('[Pings] camera capture failed', error);
        Alert.alert('Capture failed', 'Could not open your camera.');
      }
    };

    const launchLibrary = async () => {
      try {
        const existingPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        const permission =
          existingPermission.granted || !existingPermission.canAskAgain
            ? existingPermission
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert('Photos unavailable', 'Allow photo access to attach an image to your ping.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.82,
          aspect: [4, 3],
        });

        if (!result.canceled && result.assets[0]) {
          setComposerImageUri(result.assets[0].uri);
        }
      } catch (error) {
        console.warn('[Pings] image library pick failed', error);
        Alert.alert('Selection failed', 'Could not open your photo library.');
      }
    };

    Alert.alert(
      'Attach Image',
      'Choose a source for your photo',
      [
        { text: 'Take Photo', onPress: launchCamera },
        { text: 'Choose from Library', onPress: launchLibrary },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, []);

  const handleCreatePing = useCallback(async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to post a ping.');
      return;
    }
    if (!composerTitle.trim()) {
      Alert.alert('Missing details', 'Add a title so people know what is happening.');
      return;
    }

    let finalLocation = selectedLocation;
    let finalLat: number | undefined;
    let finalLng: number | undefined;
    let anchorType: 'place' | 'geo' = 'place';

    if (useCurrentLocation) {
      if (composerGeoLocation) {
        finalLocation = composerGeoLocation.label;
        finalLat = composerGeoLocation.latitude;
        finalLng = composerGeoLocation.longitude;
        anchorType = 'geo';
      } else {
        const resolvedLocation = await handleUseCurrentLocation();
        if (!resolvedLocation) {
          Alert.alert('Location unavailable', 'We could not lock onto your current location yet.');
          return;
        }
        finalLocation = resolvedLocation.label;
        finalLat = resolvedLocation.latitude;
        finalLng = resolvedLocation.longitude;
        anchorType = 'geo';
      }
    } else {
      const lookup = locationLookup.get(getCanonicalLocationName(finalLocation || ''));
      if (lookup && lookup.coord) {
        finalLat = lookup.coord.lat;
        finalLng = lookup.coord.lng;
      }
    }

    if (!finalLocation) {
      Alert.alert('Pick a location', 'Tag a campus location so this ping can connect back into the map.');
      return;
    }

    const { startAt, endAt } = buildPresetWindow(composerTimePreset, composerDurationHours);
    setIsPosting(true);
    try {
      let uploadedImageUrl: string | undefined;
      if (composerImageUri) {
        uploadedImageUrl = await uploadMediaImage(composerImageUri);
      }

      const createdPing = await addPing({
        userId: user.id,
        userName: user.fullName || 'Aggie',
        userImage: user.imageUrl,
        title: composerTitle.trim(),
        body: composerBody.trim(),
        category: composerCategory,
        locationTag: finalLocation,
        latitude: finalLat,
        longitude: finalLng,
        anchorType,
        startAt,
        endAt,
        isAnonymous: composerAnonymous,
        mediaUrl: uploadedImageUrl,
      });

      if (onSuccess) onSuccess(createdPing);
      handleClose();
    } catch (error: any) {
      console.warn('[Pings] create failed', error);
      Alert.alert('Could not post ping', error?.message || 'Something went wrong.');
    } finally {
      setIsPosting(false);
    }
  }, [
    composerBody,
    composerCategory,
    composerTitle,
    composerDurationHours,
    composerTimePreset,
    composerImageUri,
    composerAnonymous,
    composerGeoLocation,
    selectedLocation,
    handleUseCurrentLocation,
    handleClose,
    user,
    locationLookup,
    useCurrentLocation,
    onSuccess,
  ]);

  const locationSuggestions = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return directory.slice(0, 8);
    return directory
      .filter((item) => {
        const name = item.location.toLowerCase();
        const short = item.shortName?.toLowerCase() || '';
        return name.includes(query) || short.includes(query);
      })
      .slice(0, 8);
  }, [directory, locationQuery]);

  const canSubmitComposer = Boolean(composerTitle.trim()) && (selectedLocation || composerGeoLocation || useCurrentLocation);

  const styles = StyleSheet.create({
    composerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    composerSheet: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      height: '92%',
      overflow: 'hidden',
    },
    composerKeyboardWrap: {
      flex: 1,
    },
    composerScreen: {
      flex: 1,
    },
    composerTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    composerTopIconButton: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: COLORS.surfaceElevated,
    },
    composerTopTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    composerTopPostButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: COLORS.primary + '10',
    },
    composerTopPostLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.primary,
    },
    composerTopPostLabelDisabled: {
      opacity: 0.4,
    },
    composerScroll: {
      flex: 1,
    },
    composerScrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    composerCategoryRow: {
      flexDirection: 'row',
      marginBottom: 24,
    },
    composerCategoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: COLORS.surfaceElevated,
      marginRight: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    composerCategoryPillActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    composerCategoryLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    composerCategoryLabelActive: {
      color: '#FFFFFF',
    },
    composerTextStack: {
      marginBottom: 24,
    },
    composerTitleInput: {
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 12,
    },
    composerPromptInput: {
      fontSize: 17,
      color: COLORS.textSecondary,
      lineHeight: 24,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    composerMediaCard: {
      marginBottom: 24,
    },
    composerMediaStage: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 24,
      backgroundColor: COLORS.surfaceElevated,
      overflow: 'hidden',
    },
    composerMediaStageEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: COLORS.border,
      padding: 40,
    },
    composerMediaStageIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: COLORS.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    composerMediaStageTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 8,
    },
    composerMediaStageSubtitle: {
      fontSize: 14,
      color: COLORS.textTertiary,
      textAlign: 'center',
    },
    composerMediaStagePreview: {
      width: '100%',
      height: '100%',
    },
    composerMediaStageOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerMediaStageOverlayText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    composerMediaRemoveButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aspectRatioRow: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 10,
    },
    aspectRatioPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: COLORS.surfaceElevated,
    },
    aspectRatioPillActive: {
      backgroundColor: COLORS.primary,
    },
    aspectRatioText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    aspectRatioTextActive: {
      color: '#FFFFFF',
    },
    composerSectionBlock: {
      marginBottom: 32,
    },
    composerSectionLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 16,
    },
    composerSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 56,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: COLORS.textPrimary,
    },
    composerSearchAction: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: COLORS.primary + '15',
    },
    composerSearchActionActive: {
      backgroundColor: COLORS.primary,
    },
    suggestionsWrap: {
      maxHeight: 200,
      marginTop: 8,
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 16,
      padding: 8,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 12,
    },
    suggestionText: {
      fontSize: 15,
      color: COLORS.textPrimary,
    },
    selectedLocationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.primary + '10',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      marginTop: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: COLORS.primary + '20',
    },
    selectedLocationCopy: {
      flex: 1,
    },
    selectedLocationText: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.primary,
    },
    selectedLocationSubtext: {
      fontSize: 12,
      color: COLORS.primary,
      opacity: 0.7,
      marginTop: 2,
    },
    anonymousCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 20,
      padding: 16,
      gap: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    anonymousCardActive: {
      borderColor: COLORS.success,
    },
    anonymousIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
    },
    anonymousIconWrapActive: {
      backgroundColor: COLORS.success + '10',
    },
    anonymousCopy: {
      flex: 1,
    },
    anonymousTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    anonymousSubtitle: {
      fontSize: 13,
      color: COLORS.textTertiary,
      marginTop: 4,
      lineHeight: 18,
    },
    composerPreferenceCard: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 20,
      marginTop: 12,
      padding: 16,
    },
    compactPreferenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    compactPreferenceLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    durationStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.background,
      borderRadius: 12,
      padding: 4,
    },
    stepperButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    stepperValueContainer: {
      paddingHorizontal: 12,
      minWidth: 50,
      alignItems: 'center',
    },
    stepperValueText: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.primary,
    },
    sharePingButton: {
      backgroundColor: COLORS.primary,
      height: 64,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    },
    sharePingButtonDisabled: {
      opacity: 0.5,
      backgroundColor: COLORS.textTertiary,
    },
    sharePingButtonText: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.composerOverlay}>
        <Animated.View entering={SlideInDown.duration(220)} exiting={SlideOutDown.duration(180)} style={styles.composerSheet}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.composerKeyboardWrap}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.composerScreen, { paddingTop: Math.max(insets.top + 8, 20) }]}>
                <View style={styles.composerTopBar}>
                  <Pressable onPress={handleClose} style={styles.composerTopIconButton}>
                    <X size={20} color={COLORS.textPrimary} />
                  </Pressable>

                  <Text style={styles.composerTopTitle}>Create</Text>

                  <Pressable
                    onPress={handleCreatePing}
                    disabled={!canSubmitComposer || isPosting}
                    style={styles.composerTopPostButton}
                  >
                    {isPosting ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text
                        style={[
                          styles.composerTopPostLabel,
                          (!canSubmitComposer || isPosting) && styles.composerTopPostLabelDisabled,
                        ]}
                      >
                        Post
                      </Text>
                    )}
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.composerScroll}
                  contentContainerStyle={[
                    styles.composerScrollContent,
                    { paddingBottom: Math.max(insets.bottom + 44, 44) },
                  ]}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.composerCategoryRow}
                  >
                    {PING_CATEGORIES.map((cat) => {
                      const active = composerCategory === cat.id;
                      const Icon = cat.Icon;
                      return (
                        <Pressable
                          key={cat.id}
                          style={[styles.composerCategoryPill, active && styles.composerCategoryPillActive]}
                          onPress={() => setComposerCategory(cat.id)}
                        >
                          <Icon size={14} color={active ? '#FFFFFF' : cat.accent} />
                          <Text
                            style={[
                              styles.composerCategoryLabel,
                              active && styles.composerCategoryLabelActive,
                            ]}
                            numberOfLines={1}
                          >
                            {cat.id}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.composerTextStack}>
                    <TextInput
                      value={composerTitle}
                      onChangeText={setComposerTitle}
                      placeholder="Title your ping..."
                      placeholderTextColor={COLORS.textTertiary}
                      style={styles.composerTitleInput}
                    />
                    <TextInput
                      value={composerBody}
                      onChangeText={setComposerBody}
                      placeholder="What's happening?"
                      placeholderTextColor={COLORS.textTertiary}
                      style={styles.composerPromptInput}
                      multiline
                    />
                  </View>

                  <View style={styles.composerMediaCard}>
                    {composerImageUri ? (
                      <View style={styles.composerMediaStage}>
                        <Image source={{ uri: composerImageUri }} style={styles.composerMediaStagePreview} />
                        <Pressable style={styles.composerMediaStageOverlay} onPress={handlePickPingImage}>
                          <Text style={styles.composerMediaStageOverlayText}>Tap to replace</Text>
                        </Pressable>
                        <Pressable style={styles.composerMediaRemoveButton} onPress={() => setComposerImageUri(null)}>
                          <X size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.composerMediaStage, styles.composerMediaStageEmpty]}
                        onPress={handlePickPingImage}
                      >
                        <View style={styles.composerMediaStageIconWrap}>
                          <ImageIcon size={24} color={COLORS.primary} />
                        </View>
                        <Text style={styles.composerMediaStageTitle}>Add Media (Optional)</Text>
                        <Text style={styles.composerMediaStageSubtitle}>
                          Share a photo or video of what's happening.
                        </Text>
                      </Pressable>
                    )}

                    {composerImageUri && (
                      <View style={styles.aspectRatioRow}>
                        {(['1:1', '4:5', '16:9'] as const).map((ratio) => (
                          <Pressable 
                            key={ratio}
                            style={[styles.aspectRatioPill, composerAspectRatio === ratio && styles.aspectRatioPillActive]}
                            onPress={() => setComposerAspectRatio(ratio)}
                          >
                            <Text style={[styles.aspectRatioText, composerAspectRatio === ratio && styles.aspectRatioTextActive]}>{ratio}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.composerSectionBlock}>
                    <Text style={styles.composerSectionLabel}>Location</Text>
                    <View style={styles.composerSearchWrap}>
                      <Search size={16} color={COLORS.textSecondary} />
                      <TextInput
                        value={locationQuery}
                        onChangeText={(text) => {
                          setUseCurrentLocation(false);
                          setLocationQuery(text);
                          setSelectedLocation(null);
                          setComposerGeoLocation(null);
                        }}
                        placeholder="Search for a building or spot..."
                        placeholderTextColor={COLORS.textTertiary}
                        style={styles.searchInput}
                      />
                      <Pressable
                        style={[
                          styles.composerSearchAction,
                          (composerGeoLocation || isResolvingCurrentLocation) &&
                            styles.composerSearchActionActive,
                        ]}
                        onPress={handleUseCurrentLocation}
                        disabled={isResolvingCurrentLocation}
                      >
                        {isResolvingCurrentLocation ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <LocateFixed
                            size={16}
                            color={composerGeoLocation ? '#FFFFFF' : COLORS.primary}
                          />
                        )}
                      </Pressable>
                    </View>

                    {locationQuery.trim().length > 0 && !selectedLocation && !composerGeoLocation && (
                      <ScrollView
                        style={styles.suggestionsWrap}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {locationSuggestions.map((loc) => (
                          <Pressable
                            key={`${loc.placeId || loc.location}-${loc.coord.lat}-${loc.coord.lng}`}
                            style={styles.suggestionItem}
                            onPress={() => handleSelectLocation(loc.location)}
                          >
                            <MapPin size={14} color={COLORS.textSecondary} />
                            <Text style={styles.suggestionText}>{loc.location}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}

                    {selectedLocation && (
                      <View style={styles.selectedLocationBadge}>
                        <MapPin size={14} color={COLORS.primary} />
                        <View style={styles.selectedLocationCopy}>
                          <Text style={styles.selectedLocationText}>{selectedLocation}</Text>
                          <Text style={styles.selectedLocationSubtext}>Campus Landmark</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            setUseCurrentLocation(false);
                            setSelectedLocation(null);
                            setLocationQuery('');
                          }}
                        >
                          <X size={14} color={COLORS.textSecondary} />
                        </Pressable>
                      </View>
                    )}

                    {composerGeoLocation && (
                      <View style={styles.selectedLocationBadge}>
                        <LocateFixed size={14} color={COLORS.primary} />
                        <View style={styles.selectedLocationCopy}>
                          <Text style={styles.selectedLocationText}>{composerGeoLocation.label}</Text>
                          <Text style={styles.selectedLocationSubtext}>Auto-selected from your current location</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            setUseCurrentLocation(false);
                            setComposerGeoLocation(null);
                          }}
                        >
                          <X size={14} color={COLORS.textSecondary} />
                        </Pressable>
                      </View>
                    )}
                  </View>

                  <View style={styles.composerSectionBlock}>
                    <Text style={styles.composerSectionLabel}>Details</Text>
                    <Pressable
                      style={[
                        styles.anonymousCard,
                        composerAnonymous && styles.anonymousCardActive,
                      ]}
                      onPress={() => setComposerAnonymous((current) => !current)}
                    >
                      <View
                        style={[
                          styles.anonymousIconWrap,
                          composerAnonymous && styles.anonymousIconWrapActive,
                        ]}
                      >
                        <EyeOff
                          size={18}
                          color={composerAnonymous ? COLORS.success : COLORS.primary}
                        />
                      </View>
                      <View style={styles.anonymousCopy}>
                        <Text style={styles.anonymousTitle}>Post anonymously</Text>
                        <Text style={styles.anonymousSubtitle}>
                          Your ping will show as Anonymous in the feed while still staying tied to your account for moderation.
                        </Text>
                      </View>
                    </Pressable>
                    <View style={styles.composerPreferenceCard}>
                      <View style={styles.compactPreferenceRow}>
                        <Clock size={18} color={COLORS.textSecondary} />
                        <Text style={styles.compactPreferenceLabel}>Active for</Text>
                        <View style={styles.durationStepper}>
                          <ScalePressable
                            onPress={() => setComposerDurationHours(Math.max(0.5, composerDurationHours - 0.5))}
                            style={styles.stepperButton}
                          >
                            <Text style={styles.stepperButtonText}>-</Text>
                          </ScalePressable>
                          <View style={styles.stepperValueContainer}>
                            <Text style={styles.stepperValueText}>
                              {composerDurationHours === 0.5 ? '30m' : `${composerDurationHours}h`}
                            </Text>
                          </View>
                          <ScalePressable
                            onPress={() => setComposerDurationHours(Math.min(24, composerDurationHours + 0.5))}
                            style={styles.stepperButton}
                          >
                            <Text style={styles.stepperButtonText}>+</Text>
                          </ScalePressable>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Pressable
                    style={[
                      styles.sharePingButton,
                      (!canSubmitComposer || isPosting) && styles.sharePingButtonDisabled,
                    ]}
                    onPress={handleCreatePing}
                    disabled={!canSubmitComposer || isPosting}
                  >
                    {isPosting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.sharePingButtonText}>Share Ping</Text>
                    )}
                  </Pressable>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};
