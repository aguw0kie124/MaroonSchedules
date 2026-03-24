import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const SectionLabel = ({ children }: any) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

export const Divider = () => <View style={styles.divider} />;

export const StatPill = ({ label, value, color }: any) => (
  <View style={[styles.pill, { borderColor: color + '44' }]}>
    <Text style={[styles.pillValue, { color }]}>{value}</Text>
    <Text style={styles.pillLabel}>{label}</Text>
  </View>
);

export const MacroBar = ({ label, current, target, color }: any) => {
  const pct = Math.min(1, current / (target || 1));
  return (
    <View style={styles.macroWrap}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={[styles.macroVal, { color }]}>{Math.round(current)}<Text style={styles.macroTarget}>/{Math.round(target)}</Text></Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export const ActionButton = ({ label, onPress, disabled, color = '#500000', textColor = '#fff' }: any) => (
  <TouchableOpacity 
    style={[styles.actionBtn, { backgroundColor: color }, disabled && { opacity: 0.5 }]} 
    onPress={onPress} 
    disabled={disabled}
  >
    <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>
  </TouchableOpacity>
);

export const ListItem = ({ label, value, sub, onPress }: any) => (
  <TouchableOpacity style={styles.listItem} onPress={onPress} disabled={!onPress}>
    <View style={{ flex: 1 }}>
      <Text style={styles.listLabel}>{label}</Text>
      {sub && <Text style={styles.listSub}>{sub}</Text>}
    </View>
    {value && <Text style={styles.listValue}>{value}</Text>}
  </TouchableOpacity>
);

export const Badge = ({ label, color }: any) => (
  <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#111', borderRadius: 16, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 15 },
  pill: { flex: 1, alignItems: 'center', backgroundColor: '#000', borderRadius: 12, borderWidth: 1, padding: 10 },
  pillValue: { fontSize: 16, fontWeight: '800' },
  pillLabel: { fontSize: 9, color: '#666', marginTop: 2, textTransform: 'uppercase' },
  macroWrap: { marginBottom: 12 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  macroLabel: { fontSize: 11, color: '#999', fontWeight: '600' },
  macroVal: { fontSize: 11, fontWeight: '700' },
  macroTarget: { color: '#444' },
  track: { height: 4, backgroundColor: '#1a1a1a', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  actionBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  actionBtnText: { fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  listLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  listSub: { color: '#555', fontSize: 11, marginTop: 2 },
  listValue: { color: '#E8922A', fontWeight: 'bold' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
