import React from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../SharedUI';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export function CanvasGradesScreen() {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginLeft: 16 }}>Grades</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Lock color={COLORS.textTertiary} size={48} style={{ marginBottom: 16 }} />
        <Text style={{ color: COLORS.textPrimary, fontSize: 18 }}>Grades Sync Unavailable</Text>
        <Text style={{ color: COLORS.textSecondary, marginTop: 8, marginHorizontal: 32, textAlign: 'center' }}>
            Requires additional Canvas developer scopes to view explicit grade values natively.
        </Text>
      </View>
    </SafeAreaView>
  );
}
