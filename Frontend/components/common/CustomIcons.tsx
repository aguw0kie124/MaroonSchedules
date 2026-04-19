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

export const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path
      d="M17.64 9.2045C17.64 8.56632 17.5827 7.95268 17.4764 7.36359H9V10.8454H13.8436C13.635 11.9704 12.9982 12.9232 12.0418 13.5614V15.8205H14.9509C16.6527 14.2541 17.64 11.9459 17.64 9.2045Z"
      fill="#4285F4"
    />
    <Path
      d="M9 18C11.43 18 13.4673 17.1941 14.9509 15.8204L12.0418 13.5614C11.2359 14.1014 10.2055 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.95636V13.0427C2.43182 15.975 5.46545 18 9 18Z"
      fill="#34A853"
    />
    <Path
      d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95727H0.956364C0.348545 6.16818 0 7.53682 0 9C0 10.4632 0.348545 11.8318 0.956364 13.0427L3.96409 10.71Z"
      fill="#FBBC05"
    />
    <Path
      d="M9 3.57955C10.3159 3.57955 11.4982 4.03182 12.4277 4.91909L15.0164 2.33045C13.4632 0.867273 11.4259 0 9 0C5.46545 0 2.43182 2.025 0.95636 4.95727L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z"
      fill="#EA4335"
    />
  </Svg>
);

export const AppleIcon = ({ size = 18, color = '#111111' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M16.3654 12.16C16.3888 14.7494 18.6306 15.6114 18.6552 15.6213C18.6369 15.6821 18.2993 16.8378 17.4915 18.0319C16.7932 19.0643 16.0683 20.0933 14.9262 20.1152C13.8048 20.1368 13.4456 19.4506 12.1634 19.4506C10.8813 19.4506 10.4817 20.0933 9.42098 20.1369C8.3184 20.1796 7.47808 19.0233 6.7743 17.9948C5.33698 15.9177 4.23917 12.123 5.71418 9.56068C6.4461 8.28893 7.75478 7.48312 9.17477 7.46136C10.2571 7.44054 11.278 8.18861 11.9388 8.18861C12.5998 8.18861 13.8399 7.28935 15.1451 7.42199C15.6914 7.44479 17.2233 7.64274 18.2086 9.08498C18.1291 9.13411 16.3428 10.174 16.3654 12.16Z"
      fill={color}
    />
    <Path
      d="M14.2896 6.06896C14.8745 5.36085 15.2682 4.37957 15.1605 3.40002C14.3171 3.43357 13.2965 3.96158 12.6911 4.66939C12.1485 5.29849 11.6732 6.30281 11.8045 7.2639C12.7442 7.33648 13.7045 6.77707 14.2896 6.06896Z"
      fill={color}
    />
  </Svg>
);
