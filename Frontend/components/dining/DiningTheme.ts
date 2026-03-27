// ── Shared layout tokens ──────────────────────────────────────────────────────
export const layout = {
  pad:       16,
  padSm:     10,
  padLg:     22,
  gap:       12,
  gapSm:     8,
  radius:    10,
  radiusLg:  16,
};

// ── Strict Monochrome + Maroon accent palette ──────────────────────────────
export const accent = {
  maroon:       '#500000',
  maroonLight:  '#6b1010',
  maroonDark:   '#300000',
  maroonSheen:  'rgba(80,0,0,0.3)',
};

// ── Dark theme (Stark & Minimal) ─────────────────────────────────────────────────
export const darkTheme = {
  bg:           '#000000',
  bg2:          '#0A0A0A',
  bg3:          '#111111',
  bg4:          '#1A1A1A',
  card:         '#141414',
  cardBorder:   'rgba(255,255,255,0.08)',
  border:       'rgba(255,255,255,0.05)',
  border2:      'rgba(255,255,255,0.1)',
  border3:      'rgba(255,255,255,0.15)',
  text:         '#FFFFFF',
  text2:        '#CCCCCC',
  text3:        '#888888',
  text4:        '#555555',
  statusBar:    'light-content',
  // Functional colors
  amber:        '#e8922a',
  amberLight:   '#f5ae50',
  amberDim:     '#9a5a12',
  copper:       '#c87030',
  maroon:       '#500000',
  maroonMid:    '#3a0000',
  maroonLight:  '#6b1010',
  tamuMaroon:   '#500000',
  tamuGold:     '#FFFFFF', // Replaced gold with clean white for highlights
  sage:         '#32D74B',
  sageDim:      '#1C3A24',
  clay:         '#FF453A',
  clayDim:      '#6b1818',
  sky:          '#0A84FF',
  skyDim:       '#1a3848',
  // Ring track colors
  ringTrack:    'rgba(255,255,255,0.08)',
  ringProtein:  '#32D74B',
  ringCarbs:    '#0A84FF',
  ringFat:      '#FF9F0A',
  ringCal:      '#500000',
  // Flat Neumorphic/Modern App style
  btnBg:        '#1A1A1A',
  btnBorder:    'rgba(255,255,255,0.08)',
  btnShadow:    'transparent',
  btnHighlight: 'rgba(255,255,255,0.1)',
  headerBg:     'rgba(0,0,0,0.85)',
  tabBarBg:     'rgba(0,0,0,0.88)',
  ...layout,
  ...accent,
};

// ── Light theme (Stark & Minimal) ────────────────────────────────────────────────
export const lightTheme = {
  bg:           '#FFFFFF',
  bg2:          '#F8F8F8',
  bg3:          '#F2F2F2',
  bg4:          '#ECECEC',
  card:         '#FFFFFF',
  cardBorder:   'rgba(0,0,0,0.08)',
  border:       'rgba(0,0,0,0.05)',
  border2:      'rgba(0,0,0,0.08)',
  border3:      'rgba(0,0,0,0.12)',
  text:         '#000000',
  text2:        '#333333',
  text3:        '#666666',
  text4:        '#999999',
  statusBar:    'dark-content',
  // Functional colors
  amber:        '#c87020',
  amberLight:   '#e89838',
  amberDim:     '#8a5010',
  copper:       '#a85a20',
  maroon:       '#500000',
  maroonMid:    '#3a0000',
  maroonLight:  '#6b1010',
  tamuMaroon:   '#500000',
  tamuGold:     '#000000', // Replaced gold with crisp black
  sage:         '#34C759',
  sageDim:      '#2a4820',
  clay:         '#FF3B30',
  clayDim:      '#6b1818',
  sky:          '#007AFF',
  skyDim:       '#1a3848',
  // Ring track colors
  ringTrack:    'rgba(0,0,0,0.06)',
  ringProtein:  '#34C759',
  ringCarbs:    '#007AFF',
  ringFat:      '#FF9500',
  ringCal:      '#500000',
  // Flat Modern App style
  btnBg:        '#F2F2F2',
  btnBorder:    'rgba(0,0,0,0.08)',
  btnShadow:    'transparent',
  btnHighlight: 'rgba(0,0,0,0.05)',
  headerBg:     'rgba(255,255,255,0.90)',
  tabBarBg:     'rgba(255,255,255,0.92)',
  ...layout,
  ...accent,
};

export function useDiningTheme(isDark: boolean) {
    return isDark ? darkTheme : lightTheme;
}
