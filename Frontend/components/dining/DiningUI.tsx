import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

function useDiningStyles() {
  const { theme } = useTheme();
  const T = useDiningTheme(theme === 'dark');
  const isDark = theme === 'dark';

  return StyleSheet.create({
    card: {
      backgroundColor: isDark ? 'rgba(12,12,14,0.74)' : 'rgba(255,255,255,0.76)',
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: T.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0.14 : 0.07,
      shadowRadius: 10,
      elevation: 4,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: T.text3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    divider: {
      height: 1,
      backgroundColor: T.border,
      marginVertical: 20,
    },
    pill: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: T.btnBg,
      borderRadius: 16,
      borderWidth: 1,
      padding: 10,
      borderColor: T.btnBorder,
    },
    pillValue: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    pillLabel: {
      fontSize: 10,
      color: T.text3,
      marginTop: 3,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    macroWrap: {
      marginBottom: 16,
    },
    macroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    macroLabel: {
      fontSize: 13,
      color: T.text2,
      fontWeight: '700',
    },
    macroVal: {
      fontSize: 13,
      fontWeight: '800',
    },
    macroTarget: {
      color: T.text3,
    },
    track: {
      height: 6,
      backgroundColor: T.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    actionBtn: {
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
      marginTop: 10,
      borderWidth: 1,
      borderColor: T.btnBorder,
      shadowColor: T.tamuMaroon,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.1 : 0.06,
      shadowRadius: 8,
    },
    actionBtnText: {
      fontWeight: '800',
      fontSize: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: T.border,
    },
    listLabel: {
      color: T.text,
      fontSize: 15,
      fontWeight: '700',
    },
    listSub: {
      color: T.text3,
      fontSize: 12,
      marginTop: 4,
    },
    listValue: {
      color: T.amber,
      fontWeight: '900',
      fontSize: 16,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
  });
}

export const Card = ({ children, style }: any) => {
  const styles = useDiningStyles();
  return <View style={[styles.card, style]}>{children}</View>;
};

export const SectionLabel = ({ children }: any) => {
  const styles = useDiningStyles();
  return <Text style={styles.sectionLabel}>{children}</Text>;
};

export const Divider = () => {
  const styles = useDiningStyles();
  return <View style={styles.divider} />;
};

export const StatPill = ({ label, value, color, valueStyle, style, labelStyle }: any) => {
  const styles = useDiningStyles();
  return (
    <View style={[styles.pill, { borderColor: color + '44' }, style]}>
      <Text style={[styles.pillValue, { color }, valueStyle]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.pillLabel, labelStyle]}>{label}</Text>
    </View>
  );
};

export const MacroBar = ({ label, current, target, color }: any) => {
  const styles = useDiningStyles();
  const pct = Math.min(1, current / (target || 1));
  return (
    <View style={styles.macroWrap}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={[styles.macroVal, { color }]}>
          {Math.round(current)}
          <Text style={styles.macroTarget}>/{Math.round(target)}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export const ActionButton = ({ label, onPress, disabled, color = '#500000', textColor = '#fff', style, textStyle }: any) => {
  const styles = useDiningStyles();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.actionBtn, { backgroundColor: color }, style, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionBtnText, { color: textColor }, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

export const ListItem = ({ label, value, sub, onPress }: any) => {
  const styles = useDiningStyles();
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress} disabled={!onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listLabel}>{label}</Text>
        {sub && <Text style={styles.listSub}>{sub}</Text>}
      </View>
      {value && <Text style={styles.listValue}>{value}</Text>}
    </TouchableOpacity>
  );
};

export const Badge = ({ label, color }: any) => {
  const styles = useDiningStyles();
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
};
