import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { 
  GestureHandlerRootView, 
  GestureDetector, 
  Gesture 
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { X, ChevronRight, ChevronLeft, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../SharedUI';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StoryViewerProps {
  visible: boolean;
  pings: any[];
  userName: string;
  userImage: string | null;
  onClose: () => void;
  onMarkSeen?: (pingIds: string[]) => void;
  onNextUser?: () => void;
  onPrevUser?: () => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  visible,
  pings = [],
  userName = '',
  userImage = null,
  onClose,
  onMarkSeen,
  onNextUser,
  onPrevUser,
  initialIndex = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { COLORS } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const [isPaused, setIsPaused] = useState(false);
  const STORY_DURATION = 5000; // 5 seconds per story

  const currentPing = pings[currentIndex];
  const totalStories = pings.length;

  useEffect(() => {
    if (visible) {
      startProgress();
    } else {
      progress.setValue(0);
    }
  }, [visible, currentIndex]);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [userName, pings, initialIndex]);

  useEffect(() => {
    if (visible && pings[currentIndex]) {
      onMarkSeen?.([pings[currentIndex].id]);
    }
  }, [currentIndex, visible, pings, onMarkSeen]);

  const startProgress = () => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });
  };

  const handleNext = () => {
    if (currentIndex < totalStories - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (onNextUser) {
        onNextUser();
      } else {
        handleClose();
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      if (onPrevUser) {
        onPrevUser();
      } else {
        progress.setValue(0);
        startProgress();
      }
    }
  };

  const handleClose = () => {
    if (onMarkSeen) {
      onMarkSeen(pings.map(p => p.id));
    }
    onClose();
    setCurrentIndex(0);
    progress.setValue(0);
  };

  const handlePressIn = () => setIsPaused(true);
  const handlePressOut = () => setIsPaused(false);

  useEffect(() => {
    if (isPaused) {
      progress.stopAnimation();
    } else if (visible) {
      const currentVal = (progress as any)._value ?? 0;
      const remaining = STORY_DURATION * (1 - currentVal);
      Animated.timing(progress, {
        toValue: 1,
        duration: remaining,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) handleNext();
      });
    }
  }, [isPaused]);

  // Combined Gestures using modern RNGH API
  const gestures = useMemo(() => {
    // 1. Long Press to Pause
    const longPress = Gesture.LongPress()
      .minDuration(200)
      .onBegin(() => {
        runOnJS(setIsPaused)(true);
      })
      .onFinalize(() => {
        runOnJS(setIsPaused)(false);
      });

    // 2. Pan to Swipe between users
    const pan = Gesture.Pan()
      .activeOffsetX([-30, 30])
      .onEnd((event) => {
        const { translationX } = event;
        if (translationX < -60) {
          runOnJS(onNextUser || handleClose)();
        } else if (translationX > 60) {
          runOnJS(onPrevUser || (() => {}))();
        }
      });

    // 3. Tap to move between pings (left/right side)
    const tap = Gesture.Tap()
      .onEnd((event) => {
        if (event.x < SCREEN_WIDTH / 3) {
          runOnJS(handlePrev)();
        } else {
          runOnJS(handleNext)();
        }
      });

    // Composition: Pan and Tap are exclusive, LongPress can happen simultaneously with pan begin
    return Gesture.Race(
      pan,
      Gesture.Exclusive(longPress, tap)
    );
  }, [onNextUser, onPrevUser, handleNext, handlePrev, handleClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={gestures}>
          <View style={styles.container}>
            <StatusBar barStyle="light-content" />
             
            {/* Background (Dark overlay) */}
            <View style={styles.background} />
    
            {/* Content Area */}
            <View style={styles.contentContainer}>
              {currentPing?.imageUrl ? (
                <Image
                  source={{ uri: currentPing.imageUrl }}
                  style={styles.storyMedia}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={['#1a1a1a', '#2d2d2d']}
                  style={styles.textStoryBackground}
                >
                  <View style={styles.textContainer}>
                    <Text style={styles.textTitle}>{currentPing?.title}</Text>
                    <Text style={styles.textBody}>{currentPing?.body}</Text>
                  </View>
                </LinearGradient>
              )}
    
              {/* Header (Progress bars, User info) */}
              <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.progressBarContainer}>
                  {pings.map((_, index) => (
                    <View key={index} style={styles.progressBarBackground}>
                      <Animated.View
                        style={[
                          styles.progressBarFill,
                          {
                            width: index === currentIndex 
                              ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                              : index < currentIndex ? '100%' : '0%',
                            backgroundColor: '#FFFFFF',
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
    
                <View style={styles.userInfoRow}>
                  <View style={styles.userMeta}>
                    {userImage ? (
                      <Image source={{ uri: userImage }} style={styles.userAvatar} />
                    ) : (
                      <View style={[styles.userAvatarPlaceholder, { backgroundColor: COLORS.primary }]}>
                        <Text style={styles.userAvatarText}>{userName.charAt(0)}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.userName}>{userName}</Text>
                      <Text style={styles.pingLocation}>
                        <MapPin size={10} color="rgba(255,255,255,0.7)" /> {currentPing?.locationTag || 'Campus'}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={handleClose} style={styles.closeButton}>
                    <X size={24} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
    
              {/* Note: Tap areas are now handled by GestureDetector internally */}
    
              {/* Footer (Metadata if any) */}
              <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                {currentPing?.imageUrl && (
                   <View style={styles.footerContent}>
                      <Text style={styles.footerTitle}>{currentPing.title}</Text>
                      {currentPing.body ? <Text style={styles.footerBody}>{currentPing.body}</Text> : null}
                   </View>
                )}
              </View>
            </View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  contentContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
  },
  storyMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textStoryBackground: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  textContainer: {
    alignItems: 'center',
  },
  textTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  textBody: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 28,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  progressBarContainer: {
    flexDirection: 'row',
    height: 2,
    marginBottom: 12,
    gap: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  userAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pingLocation: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  closeButton: {
    padding: 8,
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 5,
  },
  touchSide: {
    flex: 1,
    height: '100%',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  footerContent: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 16,
    borderRadius: 16,
  },
  footerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  footerBody: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
});
