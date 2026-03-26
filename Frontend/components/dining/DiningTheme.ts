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

// ── Rose gold + wood accent palette ──────────────────────────────────────────
export const accent = {
  roseGold:      '#b98d73',
  roseGoldLight: '#d4b59a',
  roseGoldDark:  '#8a6550',
  roseGoldSheen: 'rgba(185,141,115,0.45)',
  woodLight:     '#8b6335',
  woodMid:       '#6a4520',
  woodDark:      '#4a2a0e',
  woodRich:      '#5a3a1a',
  gold:          '#c4a44a',
  goldSheen:     'rgba(196,164,74,0.35)',
};

// ── Dark theme (black marble) ─────────────────────────────────────────────────
export const darkTheme = {
  bg:           '#0a0604',
  bg2:          'rgba(20,12,6,0.75)',
  bg3:          'rgba(35,20,10,0.65)',
  bg4:          'rgba(50,30,15,0.55)',
  card:         'rgba(15,10,5,0.72)',
  cardBorder:   'rgba(185,141,115,0.20)',
  border:       'rgba(185,141,115,0.15)',
  border2:      'rgba(185,141,115,0.25)',
  border3:      'rgba(185,141,115,0.35)',
  text:         '#f5ead8',
  text2:        '#c8a070',
  text3:        '#8a6040',
  text4:        '#5a3820',
  statusBar:    'light-content',
  // Functional colors
  amber:        '#e8922a',
  amberLight:   '#f5ae50',
  amberDim:     '#9a5a12',
  copper:       '#c87030',
  maroon:       '#6b1010',
  maroonMid:    '#8b2020',
  maroonLight:  '#a83030',
  tamuMaroon:   '#500000',
  tamuGold:     '#c4a44a',
  sage:         '#5a7a48',
  sageDim:      '#2a4820',
  clay:         '#b84030',
  clayDim:      '#6b1818',
  sky:          '#4a7898',
  skyDim:       '#1a3848',
  // Ring track colors
  ringTrack:    'rgba(255,255,255,0.08)',
  ringProtein:  '#52d98a',
  ringCarbs:    '#5ab0e8',
  ringFat:      '#d4a030',
  ringCal:      '#e8922a',
  // Button neumorphic
  btnBg:        'rgba(15,10,5,0.80)',
  btnBorder:    'rgba(185,141,115,0.25)',
  btnShadow:    'rgba(0,0,0,0.5)',
  btnHighlight: 'rgba(185,141,115,0.08)',
  headerBg:     'rgba(10,6,4,0.85)',
  tabBarBg:     'rgba(15,10,5,0.88)',
  ...layout,
  ...accent,
};

// ── Light theme (white marble) ────────────────────────────────────────────────
export const lightTheme = {
  bg:           '#f5f0ea',
  bg2:          'rgba(240,230,218,0.80)',
  bg3:          'rgba(225,215,200,0.65)',
  bg4:          'rgba(210,195,178,0.55)',
  card:         'rgba(245,238,228,0.82)',
  cardBorder:   'rgba(185,141,115,0.25)',
  border:       'rgba(185,141,115,0.20)',
  border2:      'rgba(185,141,115,0.30)',
  border3:      'rgba(185,141,115,0.40)',
  text:         '#3a2518',
  text2:        '#6b4a30',
  text3:        '#9a7a5a',
  text4:        '#bfa888',
  statusBar:    'dark-content',
  // Functional colors
  amber:        '#c87020',
  amberLight:   '#e89838',
  amberDim:     '#8a5010',
  copper:       '#a85a20',
  maroon:       '#6b1010',
  maroonMid:    '#8b2020',
  maroonLight:  '#a83030',
  tamuMaroon:   '#500000',
  tamuGold:     '#9a8038',
  sage:         '#4a6838',
  sageDim:      '#2a4820',
  clay:         '#a83528',
  clayDim:      '#6b1818',
  sky:          '#3a6888',
  skyDim:       '#1a3848',
  // Ring track colors
  ringTrack:    'rgba(0,0,0,0.06)',
  ringProtein:  '#3ab868',
  ringCarbs:    '#4890c0',
  ringFat:      '#b88828',
  ringCal:      '#c87020',
  // Button neumorphic
  btnBg:        'rgba(245,238,228,0.90)',
  btnBorder:    'rgba(185,141,115,0.30)',
  btnShadow:    'rgba(120,80,40,0.15)',
  btnHighlight: 'rgba(255,255,255,0.60)',
  headerBg:     'rgba(245,238,228,0.90)',
  tabBarBg:     'rgba(245,238,228,0.92)',
  ...layout,
  ...accent,
};

export function useDiningTheme(isDark: boolean) {
    return isDark ? darkTheme : lightTheme;
}
