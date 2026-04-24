import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { getCategoryPillIcon } from "./utils";
import { TourTarget, useTour } from "../onboarding/TourProvider";

interface LayerItem {
  id: string;
  label: string;
}

interface LayerPillScrollerProps {
  styles: any;
  COLORS: any;
  activeLayer: string;
  layers: LayerItem[];
  onSelectLayer: (layerId: string) => void;
  onOpenSettings: () => void;
}

export function LayerPillScroller({
  styles,
  COLORS,
  activeLayer,
  layers,
  onSelectLayer,
  onOpenSettings: _onOpenSettings,
}: LayerPillScrollerProps) {
  const { advanceStep, activeTargetName } = useTour();
  const scrollRef = React.useRef<ScrollView>(null);

  // Auto-scroll to highlight targets when they appear
  React.useEffect(() => {
    if (activeTargetName === 'gyms-pill' && scrollRef.current) {
      // Keep the right-side controls visible so the highlighted target is reliably tappable.
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  }, [activeTargetName]);
  return (
    <View style={styles.layerPillRail}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerPillScrollerContent}
      >
        {layers.map((layer) => {
          const isActive = layer.id === activeLayer;
          const isGymTourTarget = activeTargetName === 'gyms-pill' && layer.id === 'Rec';
          const Icon = getCategoryPillIcon(layer.id);
          const pill = (
            <TouchableOpacity
              hitSlop={{ top: 8, right: 10, bottom: 8, left: 10 }}
              activeOpacity={0.85}
              style={[
                styles.layerPill,
                isActive && styles.layerPillActive,
                isGymTourTarget && {
                  borderWidth: 2,
                  borderColor: COLORS.primary,
                  backgroundColor: `${COLORS.primary}1A`,
                },
              ]}
              onPress={() => {
                onSelectLayer(layer.id);
                if (activeTargetName === 'gyms-pill' && layer.id === 'Rec') {
                  advanceStep('gyms-pill');
                }
                if (activeTargetName === 'bus-routes' && layer.id === 'Bus') {
                  advanceStep('bus-routes');
                }
              }}
            >
              <Icon
                size={16}
                color={isActive ? "#FFFFFF" : COLORS.textPrimary}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <Text
                style={[
                  styles.layerPillText,
                  isActive && styles.layerPillTextActive,
                  isGymTourTarget && { color: COLORS.primary, fontWeight: '800' },
                ]}
              >
                {layer.label}
              </Text>
            </TouchableOpacity>
          );

          if (layer.id === 'Rec') {
            return (
              <TourTarget
                key={layer.id}
                name="gyms-pill"
                assistAction={() => {
                  onSelectLayer('Rec');
                  setTimeout(() => advanceStep('gyms-pill'), 250);
                }}
              >
                {pill}
              </TourTarget>
            );
          }
          if (layer.id === 'Bus') return <TourTarget key={layer.id} name="bus-routes">{pill}</TourTarget>;
          
          return <React.Fragment key={layer.id}>{pill}</React.Fragment>;
        })}
      </ScrollView>
    </View>
  );
}
