import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Animated, PanResponder, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TAMUEvent, CATEGORY_META, classifyCategory, formatDate, formatTime, shortDescription } from './EventUtils';
import { resolveEventImage } from './EventImages';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.24;

const styles = StyleSheet.create({
  swipeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  swipeCard: {
    width: SCREEN_WIDTH - 44,
    height: SCREEN_HEIGHT * 0.6,
    borderRadius: 34,
    overflow: 'hidden',
  },
  swipeGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.16)',
    opacity: 0.5,
  },
  swipeWatermark: {
    position: 'absolute',
    bottom: 140,
    left: 18,
    opacity: 0.5,
  },
  swipeTopLabel: {
    marginTop: 16,
    marginLeft: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  swipeTopLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  swipeBody: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  swipeTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.85,
  },
  swipeMeta: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  swipeDescription: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
});

export function SwipeEventCard({
  event,
  pan,
  opacity,
  onSwipeLeft,
  onSwipeRight,
  onOpen,
}: {
  event: TAMUEvent;
  pan: Animated.ValueXY;
  opacity: Animated.Value;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onOpen: () => void;
}) {
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue: SCREEN_WIDTH + 80,
              duration: 220,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 220,
              useNativeDriver: false,
            }),
          ]).start(onSwipeRight);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue: -(SCREEN_WIDTH + 80),
              duration: 220,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 220,
              useNativeDriver: false,
            }),
          ]).start(onSwipeLeft);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <View style={styles.swipeWrap}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeCard,
          {
            backgroundColor: meta.cardTint,
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
            opacity,
          },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onOpen}>
          <View style={StyleSheet.absoluteFill}>
            <Image
              source={resolveEventImage(event)}
              style={[StyleSheet.absoluteFill, { borderRadius: 34 }]}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={[StyleSheet.absoluteFill, { borderRadius: 34 }]}
            />
          </View>
          <View style={styles.swipeWatermark}>
            <Icon size={108} color="rgba(255,255,255,0.22)" />
          </View>
          <View style={styles.swipeTopLabel}>
            <Text style={styles.swipeTopLabelText}>{category}</Text>
          </View>
          <View style={styles.swipeBody}>
            <Text style={styles.swipeTitle}>{event.title}</Text>
            <Text style={styles.swipeMeta}>
              {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
            </Text>
            {event.location ? (
              <Text style={styles.swipeMeta}>{event.location}</Text>
            ) : null}
            {shortDescription(event.description) ? (
              <Text style={styles.swipeDescription}>{shortDescription(event.description)}</Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
