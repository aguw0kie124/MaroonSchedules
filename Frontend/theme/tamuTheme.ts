export const tamuTheme = {
  campus: 'TAMU',

  colors: {
    primary: '#500000',
    secondary: '#8C8C8C',
    accent: '#FFFFFF',
    background: '#FFFFFF',
    card: '#F5F5F5',
    text: '#000000',
  },

  branding: {
    campusName: 'Texas A&M University',
    mascot: 'Aggies',
    logo: require('../../assets/logos/tamu.png'),
  },

  map: {
    markerColor: '#500000',
    routeColor: '#500000',
  },

  navigation: {
    tabActiveColor: '#500000',
    headerColor: '#500000',
  },
} as const;
