import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const SectionLabel = ({ children }: any) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

export const Divider = () => <View style={styles.divider} />;

export const StatPill = ({ label, value, color, valueStyle }: any) => (
  <View style={[styles.pill, { borderColor: color + '44' }]}>
    <Text style={[styles.pillValue, { color }, valueStyle]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
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
    activeOpacity={0.7}
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
  card: { 
    backgroundColor: '#0a0a0a', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  sectionLabel: { 
    fontSize: 11, 
    fontWeight: '900', 
    color: '#E8922A', 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    marginBottom: 16 
  },
  divider: { height: 1, backgroundColor: '#1a1a1a', marginVertical: 20 },
  pill: { 
    flex: 1, 
    alignItems: 'center', 
    backgroundColor: '#050505', 
    borderRadius: 16, 
    borderWidth: 1, 
    padding: 12,
    borderColor: '#111'
  },
  pillValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  pillLabel: { fontSize: 10, color: '#444', marginTop: 4, fontWeight: '800', textTransform: 'uppercase' },
  macroWrap: { marginBottom: 16 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  macroLabel: { fontSize: 13, color: '#aaa', fontWeight: '700' },
  macroVal: { fontSize: 13, fontWeight: '800' },
  macroTarget: { color: '#333' },
  track: { height: 6, backgroundColor: '#0f0f0f', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  actionBtn: { 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 12,
    shadowColor: '#500000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionBtnText: { fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1.5 },
  listItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#0f0f0f' 
  },
  listLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listSub: { color: '#444', fontSize: 12, marginTop: 4 },
  listValue: { color: '#E8922A', fontWeight: '900', fontSize: 16 },
  badge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10, 
    borderWidth: 1.5, 
    alignSelf: 'flex-start' 
  },
  badgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
});
