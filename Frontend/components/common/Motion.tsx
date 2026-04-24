import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type ScalePressableProps = PressableProps & {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  pressNudgeX?: number;
  pressNudgeY?: number;
  scaleTo?: number;
};

export function ScalePressable({
  children,
  containerStyle,
  onPress,
  onPressIn,
  onPressOut,
  pressNudgeX = 0,
  pressNudgeY = 0,
  scaleTo = 0.975,
  style,
  ...rest
}: ScalePressableProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value } as any,
      { translateY: translateY.value } as any,
      { scale: scale.value } as any,
    ],
  }));

  const handlePressIn = React.useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      scale.value = withSpring(scaleTo, {
        damping: 18,
        stiffness: 320,
        mass: 0.7,
      });
      onPressIn?.(event);
    },
    [onPressIn, scale, scaleTo],
  );

  const handlePressOut = React.useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      scale.value = withSpring(1, {
        damping: 16,
        stiffness: 260,
        mass: 0.7,
      });
      onPressOut?.(event);
    },
    [onPressOut, scale],
  );

  const handlePress = React.useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (pressNudgeX || pressNudgeY) {
        translateX.value = withTiming(pressNudgeX, { duration: 95 }, (finished) => {
          if (finished) {
            translateX.value = withSpring(0, {
              damping: 15,
              stiffness: 220,
              mass: 0.6,
            });
          }
        });
        translateY.value = withTiming(pressNudgeY, { duration: 95 }, (finished) => {
          if (finished) {
            translateY.value = withSpring(0, {
              damping: 15,
              stiffness: 220,
              mass: 0.6,
            });
          }
        });
      }
      onPress?.(event);
    },
    [onPress, pressNudgeX, pressNudgeY, translateX, translateY],
  );

  return (
    <Animated.View style={[animatedStyle, containerStyle]}>
      <Pressable
        {...rest}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function FocusMotionView({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const isFocused = useIsFocused();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);
  const scale = useSharedValue(0.992);

  React.useEffect(() => {
    if (!isFocused) {
      opacity.value = 0;
      translateY.value = 14;
      scale.value = 0.992;
      return;
    }

    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 19,
        stiffness: 180,
        mass: 0.8,
      }),
    );
    scale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 20,
        stiffness: 190,
        mass: 0.8,
      }),
    );
  }, [delay, isFocused, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value } as any, { scale: scale.value } as any],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
