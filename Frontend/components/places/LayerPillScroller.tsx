import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Cog } from "lucide-react-native";
import { getCategoryPillIcon } from "./utils";

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
  return (
    <View style={styles.layerPillRail}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerPillScrollerContent}
      >
        {layers.map((layer) => {
          const isActive = layer.id === activeLayer;
          const Icon = getCategoryPillIcon(layer.id);
          return (
            <TouchableOpacity
              key={layer.id}
              style={[
                styles.layerPill,
                isActive && styles.layerPillActive,
              ]}
              onPress={() => onSelectLayer(layer.id)}
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
        })}

        <TouchableOpacity
          style={styles.layerSettingsPill}
          onPress={onOpenSettings}
        >
          <Cog size={16} color={COLORS.textPrimary} />
          <Text style={styles.layerSettingsPillText}>Edit</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
