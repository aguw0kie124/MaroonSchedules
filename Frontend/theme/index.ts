import React, { createContext, useContext } from 'react';
import { tamuTheme } from './tamuTheme';
import { utdTheme } from './utdTheme';

export type CampusCode = 'TAMU' | 'UTD';

export interface CampusTheme {
  campus: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    text: string;
  };
  branding: {
    campusName: string;
    mascot: string;
    logo: any;
  };
  map: {
    markerColor: string;
    routeColor: string;
  };
  navigation: {
    tabActiveColor: string;
    headerColor: string;
  };
}

export interface CampusThemeContextValue {
  campus: CampusCode;
  theme: CampusTheme;
  isLoading: boolean;
  refreshCampusTheme: () => Promise<void>;
}

export const CAMPUS_THEME_REGISTRY: Record<string, CampusTheme> = {
  TAMU: tamuTheme,
  UTD: utdTheme,
};

export function getCampusTheme(campus: string): CampusTheme {
  return CAMPUS_THEME_REGISTRY[campus as CampusCode] || tamuTheme;
}

const defaultContextValue: CampusThemeContextValue = {
  campus: 'TAMU',
  theme: tamuTheme,
  isLoading: false,
  refreshCampusTheme: async () => {},
};

export const CampusThemeContext = createContext<CampusThemeContextValue>(defaultContextValue);

export const CampusThemeProvider = CampusThemeContext.Provider;

export function useCampusThemeContext(): CampusThemeContextValue {
  return useContext(CampusThemeContext);
}

export { tamuTheme, utdTheme };
