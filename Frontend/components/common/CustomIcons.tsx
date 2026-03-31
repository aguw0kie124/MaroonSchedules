import React from 'react';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export const SoccerBallIcon = ({ size = 24, color = '#FFFFFF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
    <Path d="M12 2L9 7L4 8L3 13L7 17L12 22L17 17L21 13L20 8L15 7L12 2Z" stroke={color} strokeWidth="1" />
    <Path d="M9 7L12 10L15 7M4 8L8 11L9 7M20 8L16 11L15 7M3 13L8 14L8 11M21 13L16 14L16 11M7 17L8 14M17 17L16 14M12 22V18L16 17M12 10V14L8 11M12 14L16 11M12 18L8 17" stroke={color} strokeWidth="1" />
  </Svg>
);

export const BaseballIcon = ({ size = 24, color = '#FFFFFF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
    {/* Stitches Left */}
    <Path d="M7 3.5C5 6 5 18 7 20.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <Path d="M5.5 7L7.5 8M5 11L7 11.5M5.5 15L7.5 14" stroke={color} strokeWidth="1" strokeLinecap="round" />
    {/* Stitches Right */}
    <Path d="M17 3.5C19 6 19 18 17 20.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <Path d="M18.5 7L16.5 8M19 11L17 11.5M18.5 15L16.5 14" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </Svg>
);

export const TennisRacketIcon = ({ size = 24, color = '#FFFFFF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Handle */}
    <Rect x="13.5" y="13.5" width="2" height="10" rx="1" transform="rotate(-45 13.5 13.5)" fill={color} />
    {/* Racket Head */}
    <Circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1.5" />
    {/* Strings */}
    <Path d="M5 6L13 12M6 5L12 13M4 9L14 9M9 4L9 14M7 12L12 7M12 11L11 12" stroke={color} strokeWidth="0.8" opacity="0.6" />
  </Svg>
);

export const FootballIcon = ({ size = 24, color = '#FFFFFF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <G transform="rotate(-45 12 12)">
        <Path d="M4 12C4 7 8 4 12 4C16 4 20 7 20 12C20 17 16 20 12 20C8 20 4 17 4 12Z" stroke={color} strokeWidth="1.5" />
        <Path d="M8 12H16M10 10V14M12 10V14M14 10V14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        {/* End stripes */}
        <Path d="M6 9C7 9.5 7 14.5 6 15M18 9C17 9.5 17 14.5 18 15" stroke={color} strokeWidth="1" opacity="0.6" />
    </G>
  </Svg>
);

export const BasketballIcon = ({ size = 24, color = '#FFFFFF' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
    <Path d="M12 2V22M2 12H22" stroke={color} strokeWidth="1.2" />
    <Path d="M5 5C8 8 8 16 5 19" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <Path d="M19 5C16 8 16 16 19 19" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </Svg>
);
