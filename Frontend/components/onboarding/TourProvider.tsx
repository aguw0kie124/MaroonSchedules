import React, { createContext, useContext } from 'react';
import { View } from 'react-native';

type TargetRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type TourContextValue = {
  isTourActive: boolean;
  activeTargetName: string | null;
  currentStep: number;
  startTour: () => void;
  endTour: () => void;
  advanceStep: (_name: string) => void;
  registerTarget: (_name: string, _measureFn: () => Promise<TargetRect | null>) => void;
  registerAssistAction: (_name: string, _assistFn?: (() => void | Promise<void>) | null) => void;
};

const noop = () => {};

const TourContext = createContext<TourContextValue>({
  isTourActive: false,
  activeTargetName: null,
  currentStep: 0,
  startTour: noop,
  endTour: noop,
  advanceStep: noop,
  registerTarget: noop,
  registerAssistAction: noop,
});

export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function TourTarget({
  children,
  style,
}: {
  name?: string;
  children: React.ReactNode;
  style?: any;
  assistAction?: (() => void | Promise<void>) | null;
}) {
  if (style) {
    return <View style={style}>{children}</View>;
  }
  return <>{children}</>;
}
