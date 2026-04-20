import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import {
  Settings2,
  GraduationCap,
  LibraryBig,
  BriefcaseBusiness,
  Wallet,
  Dumbbell,
  ChevronRight,
  ExternalLink,
  Scale,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from './SharedUI';

export function ResourcesScreen() {
  const insets = useSafeAreaInsets();
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const navigation = useNavigation<any>();

  const openExternal = (url: string) => {
    Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
  };

  const resources = [
    {
      key: 'schedules',
      title: 'Manage Schedules',
      icon: Settings2,
      iconColor: COLORS.primary,
      iconBg: 'rgba(59, 130, 246, 0.12)',
      action: () => navigation.navigate('ScheduleList'),
      internal: true,
    },
    {
      key: 'grades',
      title: 'Grades & Distributions',
      icon: GraduationCap,
      iconColor: '#10B981',
      iconBg: 'rgba(16,185,129,0.15)',
      action: () => navigation.navigate('GradesScreen'),
      internal: true,
    },
    {
      key: 'annex',
      title: 'Library Services',
      icon: LibraryBig,
      iconColor: '#00CFC7',
      iconBg: 'rgba(0, 207, 199, 0.14)',
      action: () => navigation.navigate('AnnexHub'),
      internal: true,
    },
    {
      key: 'howdy',
      title: 'Howdy Portal',
      icon: GraduationCap,
      iconColor: COLORS.primary,
      iconBg: 'rgba(80,0,0,0.12)',
      action: () => openExternal('https://howdy.tamu.edu/main/home/card-view'),
    },
    {
      key: 'hire',
      title: 'Hire Aggies',
      icon: BriefcaseBusiness,
      iconColor: '#3B82F6',
      iconBg: 'rgba(59,130,246,0.12)',
      action: () => openExternal('https://tamu-csm.symplicity.com/students/index.php?signin_tab=0'),
    },
    {
      key: 'transact',
      title: 'Transact eAccounts',
      icon: Wallet,
      iconColor: '#F59E0B',
      iconBg: 'rgba(245, 158, 11, 0.15)',
      action: () => openExternal('https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx'),
    },
    {
      key: 'rec',
      title: 'Rec Center Hours',
      icon: Dumbbell,
      iconColor: '#10B981',
      iconBg: 'rgba(16,185,129,0.15)',
      action: () => navigation.navigate('RecreationFacilities'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: COLORS.textPrimary }]}>Campus Resources</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {resources.map((resource, index) => {
          const Icon = resource.icon;
          return (
            <Pressable
              key={resource.key}
              style={[styles.toolRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
              onPress={resource.action}
            >
              <View style={[styles.toolIconBg, { backgroundColor: resource.iconBg || 'rgba(243,241,237,0.12)' }]}>
                <Icon size={20} color={resource.iconColor || COLORS.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toolTitle, { color: COLORS.textPrimary }]}>{resource.title}</Text>
              </View>
              {resource.internal ? (
                <ChevronRight size={18} color={COLORS.textTertiary} />
              ) : (
                <ExternalLink size={18} color={COLORS.textTertiary} />
              )}
            </Pressable>
          );
        })}

        <Pressable
          style={[styles.toolRow, { marginTop: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
          onPress={() => openExternal('https://www.termsfeed.com/live/2fc33440-a5a9-4943-a1da-d3c5d5abc1e5')}
        >
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(0, 122, 255, 0.15)' }]}>
            <Scale size={20} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toolTitle, { color: COLORS.textPrimary }]}>Terms of Service</Text>
          </View>
          <ExternalLink size={18} color={COLORS.textTertiary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 16,
  },
  toolIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});
