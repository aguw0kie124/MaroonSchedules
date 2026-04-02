import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Cog } from "lucide-react-native";
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
  onOpenSettings,
}: LayerPillScrollerProps) {
  const { advanceStep, activeTargetName } = useTour();
  const scrollRef = React.useRef<ScrollView>(null);

  // Auto-scroll to highlight targets when they appear
  React.useEffect(() => {
    if ((activeTargetName === 'gyms-pill' || activeTargetName === 'places-settings') && scrollRef.current) {
      // Find the Rec pill or just scroll to end if it's new
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 500);
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
          const Icon = getCategoryPillIcon(layer.id);
          const pill = (
            <TouchableOpacity
              style={[
                styles.layerPill,
                isActive && styles.layerPillActive,
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
                ]}
              >
                {layer.label}
              </Text>
            </TouchableOpacity>
          );

          if (layer.id === 'Rec') return <TourTarget key={layer.id} name="gyms-pill">{pill}</TourTarget>;
          if (layer.id === 'Bus') return <TourTarget key={layer.id} name="bus-routes">{pill}</TourTarget>;
          
          return <React.Fragment key={layer.id}>{pill}</React.Fragment>;
        })}

        <TourTarget name="places-settings">
          <TouchableOpacity
            style={styles.layerSettingsPill}
            onPress={() => {
              onOpenSettings();
              if (activeTargetName === 'places-settings') {
                advanceStep('places-settings');
              }
            }}
          >
            <Cog size={16} color={COLORS.textPrimary} />
            <Text style={styles.layerSettingsPillText}>Edit</Text>
          </TouchableOpacity>
        </TourTarget>
      </ScrollView>
    </View>
  );
}
